/**
 * @file Rep3822RegistroIntentos.test.js
 * @description REP-3822: cada intento contra Gemini queda en visual_call_log (también los fallidos y los reintentos),
 * con modelo, tokens, uso original y desenlace, sin romper el análisis si el registro falla. Más la migración de las
 * dos tablas nuevas (solo servidor).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { analyzeImage } from '../../supabase/functions/analizar-imagen-reporte/analyze';

const IMAGE_ID = '11111111-2222-3333-4444-555555555555';
const CSID = '6296bc60-a340-4966-ba24-594f3572e1f2';

const salida = (extra = {}) => ({
  scene_summary: 'Se observa un bache en la calzada.',
  coherence: 'no_coincide',
  suggested_service_code: 'INFRAESTRUCTURA',
  quality_flags: [],
  confidence_score: 0.9,
  ...extra,
});
const usageMetadata = { promptTokenCount: 1552, candidatesTokenCount: 99, thoughtsTokenCount: 184, totalTokenCount: 1835 };
const ok = (out = salida(), data = {}) => ({
  ok: true,
  status: 200,
  latencyMs: 2540,
  errorText: null,
  data: {
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(out) }] } }],
    usageMetadata,
    modelVersion: 'gemini-3.8-flash-001',
    ...data,
  },
});
const http = (status, errorText = 'error') => ({ ok: false, status, latencyMs: 300, errorText, data: null });

let deps;
let log;
beforeEach(() => {
  log = [];
  deps = {
    geminiConfigured: true,
    deploymentId: 'abc1234',
    getImage: vi.fn().mockResolvedValue({
      id: IMAGE_ID,
      report_id: 'rep-1',
      image_url: `https://x.supabase.co/storage/v1/object/public/report-evidences/${CSID}/foto.jpg`,
      client_side_id: CSID,
      description: 'Auto mal estacionado en la rampa.',
      service_code: 'TRANSITO',
    }),
    hasAnalysis: vi.fn().mockResolvedValue(false),
    downloadEvidence: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' }),
    resolveServiceId: vi.fn().mockResolvedValue('svc-id'),
    callModel: vi.fn().mockResolvedValue(ok()),
    persist: vi.fn().mockResolvedValue(true),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    sleep: vi.fn().mockResolvedValue(undefined),
    logCall: vi.fn(async (entry) => {
      log.push(entry);
    }),
  };
});
const correr = () => analyzeImage(deps, { imageId: IMAGE_ID, queueMessageId: 7 });

describe('REP-3822: un registro por intento', () => {
  it('UT-V3822-01: un intento exitoso deja una fila con modelo, tokens, uso original, resultado y trazabilidad', async () => {
    await correr();

    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      image_id: IMAGE_ID,
      report_id: 'rep-1',
      queue_message_id: 7,
      attempt: 1,
      stage: 'visual',
      deployment_id: 'abc1234',
      prompt_version: 'visual-v1',
      model_requested: 'gemini-3.8-flash',
      model_returned: 'gemini-3.8-flash-001',
      http_status: 200,
      status: 'ok',
      error_code: null,
      error_message: null,
      input_tokens: 1552,
      output_tokens: 283,
      thinking_tokens: 184,
      visual_result: 'no_coincide',
    });
    expect(log[0].raw_usage_metadata).toEqual(usageMetadata);
    expect(log[0].call_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.parse(log[0].finished_at)).toBeGreaterThanOrEqual(Date.parse(log[0].started_at));
    expect(log[0].duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('UT-V3822-02: output_tokens ya incluye el thinking (no se suma dos veces)', async () => {
    await correr();
    expect(log[0].output_tokens).toBe(99 + 184);
    expect(deps.persist.mock.calls[0][0].output_tokens).toBe(log[0].output_tokens);
  });

  it('UT-V3822-03: los fallos y los reintentos se registran con intentos numerados y el modelo real de cada uno', async () => {
    deps.callModel
      .mockResolvedValueOnce(http(503, 'overloaded'))
      .mockResolvedValueOnce(http(429, 'quota'))
      .mockResolvedValueOnce(ok());

    const r = await correr();

    expect(r.body.modelo).toBe('gemini-3.7-flash');
    expect(log.map((e) => [e.attempt, e.model_requested, e.status, e.error_code])).toEqual([
      [1, 'gemini-3.8-flash', 'http_error', 'HTTP_503'],
      [2, 'gemini-3.8-flash', 'http_error', 'HTTP_429'],
      [3, 'gemini-3.7-flash', 'ok', null],
    ]);
    expect(new Set(log.map((e) => e.call_id)).size).toBe(3);
  });

  it('UT-V3822-04: un fallo sin respuesta guarda los tokens como desconocidos (null), nunca 0', async () => {
    deps.callModel.mockResolvedValue(http(503));

    const r = await correr();

    expect(r.status).toBe(503);
    expect(deps.persist).not.toHaveBeenCalled();
    expect(log).toHaveLength(4);
    for (const e of log) {
      expect(e.input_tokens).toBeNull();
      expect(e.output_tokens).toBeNull();
      expect(e.thinking_tokens).toBeNull();
      expect(e.raw_usage_metadata).toBeNull();
      expect(e.model_returned).toBeNull();
    }
    expect(log.map((e) => e.attempt)).toEqual([1, 2, 3, 4]);
  });

  it('UT-V3822-05: una excepción de red o un timeout se distinguen y no filtran la clave', async () => {
    const abort = Object.assign(new Error('The signal has been aborted'), { name: 'AbortError' });
    deps.callModel
      .mockRejectedValueOnce(abort)
      .mockRejectedValueOnce(new Error('fetch failed https://x/models/m:generateContent?key=AIzaSyD-FAKEfakeFAKEfakeFAKEfake_123456'))
      .mockResolvedValueOnce(ok());

    await correr();

    expect(log[0]).toMatchObject({ status: 'timeout', error_code: 'TIMEOUT', http_status: null });
    expect(log[1]).toMatchObject({ status: 'network_error', error_code: 'NETWORK_ERROR' });
    expect(JSON.stringify(log)).not.toContain('AIzaSy');
  });

  it('UT-V3822-06: un 400 se registra una sola vez y no prueba otro modelo', async () => {
    deps.callModel.mockResolvedValue(http(400, 'bad request'));

    await correr();

    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ status: 'http_error', error_code: 'HTTP_400', http_status: 400 });
  });

  it('UT-V3822-07: una salida inválida conserva el consumo y queda como invalid_output, sin resultado visual', async () => {
    deps.callModel.mockResolvedValue(ok(salida({ coherence: 'quizas' })));

    await correr();

    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ status: 'invalid_output', error_code: 'VALIDATION', input_tokens: 1552, visual_result: null });
  });

  it('UT-V3822-08: bloqueo, respuesta incompleta, no-JSON y datos personales tienen su propio estado', async () => {
    deps.callModel.mockResolvedValueOnce(ok(salida(), { promptFeedback: { blockReason: 'SAFETY' } }));
    await correr();
    deps.callModel.mockResolvedValueOnce(ok(salida(), { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] }));
    await correr();
    deps.callModel.mockResolvedValueOnce(ok(salida(), { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'no es json' }] } }] }));
    await correr();
    deps.callModel.mockResolvedValueOnce(ok(salida({ scene_summary: 'Escrito: juan@mail.com 11 2345 6789' })));
    await correr();

    expect(log.map((e) => [e.status, e.error_code])).toEqual([
      ['blocked', 'BLOCKED'],
      ['incomplete', 'FINISH_REASON'],
      ['invalid_output', 'NOT_JSON'],
      ['invalid_output', 'PERSONAL_DATA'],
    ]);
    // El correo del resumen descartado no se copia al registro
    expect(JSON.stringify(log)).not.toContain('juan@mail.com');
  });

  it('UT-V3822-09: el intento queda guardado ANTES de persistir el análisis (aunque persistir falle)', async () => {
    const orden = [];
    deps.logCall = vi.fn(async () => {
      orden.push('log');
    });
    deps.persist = vi.fn(async () => {
      orden.push('persist');
      return false;
    });

    const r = await correr();

    expect(r.status).toBe(500);
    expect(orden).toEqual(['log', 'persist']);
  });

  it('UT-V3822-10: si el registro falla, el análisis se guarda igual', async () => {
    deps.logCall = vi.fn().mockRejectedValue(new Error('tabla inexistente'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const r = await correr();

    expect(r).toMatchObject({ status: 200, body: { estado: 'completado' } });
    expect(deps.persist).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('UT-V3822-11: sin logCall inyectado la función se comporta como antes', async () => {
    delete deps.logCall;
    const r = await correr();
    expect(r).toMatchObject({ status: 200, body: { estado: 'completado' } });
  });

  it('UT-V3822-12: las fotos omitidas (VULNERABILIDAD_SOCIAL) no generan intentos: no hubo llamada al proveedor', async () => {
    const imagen = await deps.getImage();
    deps.getImage.mockResolvedValue({ ...imagen, service_code: 'VULNERABILIDAD_SOCIAL' });

    await correr();

    expect(deps.callModel).not.toHaveBeenCalled();
    expect(log).toHaveLength(0);
  });
});

describe('REP-3822: migración de visual_call_log y visual_qa_cases', () => {
  const raw = fs.readFileSync(
    path.resolve(__dirname, '../../supabase/migrations/20261008174835_rep3822_registro_de_intentos_visuales.sql'),
    'utf8'
  );
  const sql = raw.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');

  it('UT-V3822-13: ambas tablas son solo de servidor (RLS activa, sin policies, sin permisos para el cliente)', () => {
    for (const tabla of ['visual_call_log', 'visual_qa_cases']) {
      expect(sql).toContain(`alter table public.${tabla} enable row level security`);
      expect(sql).toContain(`revoke all on table public.${tabla} from public, anon, authenticated`);
      expect(sql).toContain(`grant all on table public.${tabla} to service_role`);
    }
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/to authenticated/i);
  });

  it('UT-V3822-14: el registro de intentos sobrevive al borrado de la foto y del reporte (sin FK)', () => {
    const bloque = sql.slice(sql.indexOf('create table if not exists public.visual_call_log'), sql.indexOf('create table if not exists public.visual_qa_cases'));
    expect(bloque).not.toMatch(/references/i);
    expect(bloque).toMatch(/call_id\s+uuid primary key/);
  });

  it('UT-V3822-15: el contrato de estados y de resultado visual se valida en la tabla', () => {
    expect(sql).toContain("'ok', 'http_error', 'network_error', 'timeout', 'blocked', 'incomplete', 'invalid_output'");
    expect(sql).toContain("visual_result is null or visual_result in ('coincide', 'no_coincide', 'no_concluyente')");
    expect(sql).toMatch(/stage\s+text not null default 'visual'/);
  });

  it('UT-V3822-16: un reporte pertenece a un solo caso por lote y el lote/caso es la clave', () => {
    expect(sql).toContain('primary key (qa_batch_id, case_id)');
    expect(sql).toContain('unique (qa_batch_id, report_id)');
    expect(sql).toMatch(/report_id\s+uuid not null references public\.citizen_reports\(id\)/);
  });

  it('UT-V3822-18: se escribe por la función log_visual_call, solo ejecutable por service_role', () => {
    expect(sql).toContain('create or replace function public.log_visual_call(p_entry jsonb)');
    expect(sql).toContain('revoke execute on function public.log_visual_call(jsonb) from public, anon, authenticated');
    expect(sql).toContain('grant  execute on function public.log_visual_call(jsonb) to service_role');
    expect(sql).toContain('on conflict (call_id) do nothing');
  });

  it('UT-V3822-17: no toca report_image_analysis, la cola ni el RAG', () => {
    expect(sql).not.toMatch(/alter table public\.report_image_analysis/i);
    expect(sql).not.toMatch(/rag_analysis_queue|visual_analysis_queue|report_ai_analysis|pgmq|cron/i);
  });
});
