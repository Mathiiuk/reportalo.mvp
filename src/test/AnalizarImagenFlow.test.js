/**
 * @file AnalizarImagenFlow.test.js
 * @description REP-3818: todos los caminos de analizar-imagen-reporte con las dependencias simuladas (base, bucket,
 * modelo y cola). Cubre el contrato, la falla cerrada y que la función no toque nada más que su propio resultado.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeImage } from '../../supabase/functions/analizar-imagen-reporte/analyze';

const IMAGE_ID = '11111111-2222-3333-4444-555555555555';
const CSID = '6296bc60-a340-4966-ba24-594f3572e1f2';
const FAKE_KEY = 'AIzaSyD-FAKEfakeFAKEfakeFAKEfake_123456';

const imagen = (extra = {}) => ({
  id: IMAGE_ID,
  report_id: 'rep-1',
  image_url: `https://x.supabase.co/storage/v1/object/public/report-evidences/${CSID}/foto.jpg`,
  client_side_id: CSID,
  description: 'Bache grande en la calle frente a una casa.',
  service_code: 'INFRAESTRUCTURA',
  ...extra,
});

const salidaValida = (extra = {}) => ({
  scene_summary: 'Se observa un bache en la calzada con piedras sueltas.',
  coherence: 'coincide',
  suggested_service_code: 'INFRAESTRUCTURA',
  quality_flags: [],
  confidence_score: 0.95,
  ...extra,
});

const modeloOk = (salida = salidaValida(), extraData = {}) => ({
  ok: true,
  status: 200,
  latencyMs: 2540.4,
  errorText: null,
  data: {
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(salida) }] } }],
    usageMetadata: { promptTokenCount: 1552, candidatesTokenCount: 99, thoughtsTokenCount: 0 },
    ...extraData,
  },
});
const modeloHttp = (status, errorText = 'error') => ({ ok: false, status, latencyMs: 300, errorText, data: null });

let deps;
beforeEach(() => {
  deps = {
    geminiConfigured: true,
    getImage: vi.fn().mockResolvedValue(imagen()),
    hasAnalysis: vi.fn().mockResolvedValue(false),
    downloadEvidence: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1, 2, 3, 4]), mimeType: 'image/jpeg' }),
    resolveServiceId: vi.fn().mockResolvedValue('service-infra-id'),
    callModel: vi.fn().mockResolvedValue(modeloOk()),
    persist: vi.fn().mockResolvedValue(true),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    sleep: vi.fn().mockResolvedValue(undefined),
  };
});

const correr = (payload = { imageId: IMAGE_ID, queueMessageId: 7 }) => analyzeImage(deps, payload);
const filaGuardada = () => deps.persist.mock.calls[0][0];

describe('REP-3818: camino feliz', () => {
  it('UT-V3818-23: guarda el resultado completado con modelo, versión de prompt, tokens y latencia, y borra el mensaje', async () => {
    const r = await correr();

    expect(r).toMatchObject({ status: 200, body: { estado: 'completado', modelo: 'gemini-3.8-flash' } });
    expect(deps.persist).toHaveBeenCalledTimes(1);
    expect(filaGuardada()).toEqual({
      image_id: IMAGE_ID,
      status: 'completado',
      scene_summary: 'Se observa un bache en la calzada con piedras sueltas.',
      coherence: 'coincide',
      suggested_service_id: 'service-infra-id',
      quality_flags: [],
      confidence_score: 0.95,
      model_code: 'gemini-3.8-flash',
      prompt_version: 'visual-v1',
      input_tokens: 1552,
      output_tokens: 99,
      latency_ms: 2540,
      status_reason: null,
    });
    expect(deps.resolveServiceId).toHaveBeenCalledWith('INFRAESTRUCTURA');
    expect(deps.deleteMessage).toHaveBeenCalledWith(7);
  });

  it('UT-V3818-24: lee exclusivamente la foto del bucket de evidencias bajo la carpeta del reporte', async () => {
    await correr();
    expect(deps.downloadEvidence).toHaveBeenCalledTimes(1);
    expect(deps.downloadEvidence).toHaveBeenCalledWith(`${CSID}/foto.jpg`);
  });

  it('UT-V3818-25: la descripción y la categoría salen de la base: lo que llegue en el cuerpo se ignora', async () => {
    await correr({ imageId: IMAGE_ID, queueMessageId: 7, description: 'TEXTO INVENTADO POR EL LLAMADOR', category: 'TRANSITO', reportId: 'otro', image_url: 'https://malo.com/x.jpg' });

    const { prompt } = deps.callModel.mock.calls[0][0];
    expect(prompt).toContain('Bache grande en la calle frente a una casa.');
    expect(prompt).toContain('<<<INFRAESTRUCTURA>>>');
    expect(prompt).not.toContain('INVENTADO');
    expect(prompt).not.toContain('<<<TRANSITO>>>');
    expect(deps.downloadEvidence).toHaveBeenCalledWith(`${CSID}/foto.jpg`);
  });

  it('UT-V3818-26: la imagen viaja en base64 con su tipo MIME', async () => {
    await correr();
    const args = deps.callModel.mock.calls[0][0];
    expect(args.model).toBe('gemini-3.8-flash');
    expect(args.mimeType).toBe('image/jpeg');
    expect(args.imageBase64).toBe(btoa(String.fromCharCode(1, 2, 3, 4)));
  });

  it('UT-V3818-27: NINGUNO no busca servicio; un código sin servicio cargado deja el id en null; las marcas no se repiten', async () => {
    deps.callModel.mockResolvedValue(modeloOk(salidaValida({ suggested_service_code: 'NINGUNO', quality_flags: ['oscura', 'oscura', 'borrosa'] })));
    await correr();
    expect(deps.resolveServiceId).not.toHaveBeenCalled();
    expect(filaGuardada().suggested_service_id).toBeNull();
    expect(filaGuardada().quality_flags).toEqual(['oscura', 'borrosa']);

    deps.persist.mockClear();
    deps.callModel.mockResolvedValue(modeloOk());
    deps.resolveServiceId.mockResolvedValue(null);
    await correr();
    expect(filaGuardada().suggested_service_id).toBeNull();
  });

  it('UT-V3818-28: sin queueMessageId (prueba manual) guarda igual y no borra nada', async () => {
    const r = await correr({ imageId: IMAGE_ID });
    expect(r.status).toBe(200);
    expect(deps.persist).toHaveBeenCalled();
    expect(deps.deleteMessage).not.toHaveBeenCalled();
  });

  it('UT-V3818-29: si el resultado ya está guardado pero no se puede borrar el mensaje, igual responde 200', async () => {
    deps.deleteMessage.mockRejectedValue(new Error('cola caída'));
    const r = await correr();
    expect(r.status).toBe(200);
    expect(r.body.estado).toBe('completado');
  });
});

describe('REP-3818: casos que no llaman al modelo', () => {
  it('UT-V3818-30: un imageId inválido es un 400 y no toca nada', async () => {
    const r = await correr({ imageId: 'no-es-uuid' });
    expect(r.status).toBe(400);
    expect(deps.getImage).not.toHaveBeenCalled();
    expect(await analyzeImage(deps, null)).toMatchObject({ status: 400 });
  });

  it('UT-V3818-31: la categoría VULNERABILIDAD_SOCIAL no se analiza: queda «omitido», sin modelo y sin leer la foto', async () => {
    deps.getImage.mockResolvedValue(imagen({ service_code: 'VULNERABILIDAD_SOCIAL' }));
    const r = await correr();

    expect(r.body.estado).toBe('omitido');
    expect(filaGuardada()).toMatchObject({ status: 'omitido', status_reason: 'categoria_no_analizable', scene_summary: null, coherence: null });
    expect(deps.callModel).not.toHaveBeenCalled();
    expect(deps.downloadEvidence).not.toHaveBeenCalled();
    expect(deps.deleteMessage).toHaveBeenCalledWith(7);
  });

  it('UT-V3818-32: una evidencia que ya tiene resultado no vuelve a pagar el modelo (idempotencia) y se borra el mensaje', async () => {
    deps.hasAnalysis.mockResolvedValue(true);
    const r = await correr();

    expect(r).toEqual({ status: 200, body: { estado: 'ya_analizada' } });
    expect(deps.callModel).not.toHaveBeenCalled();
    expect(deps.persist).not.toHaveBeenCalled();
    expect(deps.deleteMessage).toHaveBeenCalledWith(7);
  });

  it('UT-V3818-33: una evidencia borrada es un 404 y se descarta el mensaje (no tiene sentido reintentar)', async () => {
    deps.getImage.mockResolvedValue(null);
    const r = await correr();

    expect(r.status).toBe(404);
    expect(deps.persist).not.toHaveBeenCalled();
    expect(deps.deleteMessage).toHaveBeenCalledWith(7);
  });
});

describe('REP-3818: falla cerrada con estado controlado (el reporte continúa)', () => {
  const esperarFallido = async (motivo) => {
    const r = await correr();
    expect(r.status).toBe(200);
    expect(r.body.estado).toBe('fallido');
    expect(filaGuardada()).toMatchObject({ status: 'fallido', scene_summary: null, coherence: null, suggested_service_id: null });
    expect(filaGuardada().status_reason).toContain(motivo);
    expect(deps.deleteMessage).toHaveBeenCalledWith(7); // controlado: no se reintenta
  };

  it('UT-V3818-34: una foto de otra carpeta (ruta inválida) no se lee y queda «fallido»', async () => {
    deps.getImage.mockResolvedValue(imagen({ image_url: 'https://x.supabase.co/storage/v1/object/public/report-evidences/otro-reporte/foto.jpg' }));
    await esperarFallido('ruta_de_evidencia_invalida');
    expect(deps.downloadEvidence).not.toHaveBeenCalled();
    expect(deps.callModel).not.toHaveBeenCalled();
  });

  it('UT-V3818-35: una imagen vacía, enorme o de formato no soportado queda «fallido» sin llamar al modelo', async () => {
    deps.downloadEvidence.mockResolvedValue({ bytes: new Uint8Array(0), mimeType: 'image/jpeg' });
    await esperarFallido('imagen_vacia');

    deps.persist.mockClear();
    deps.downloadEvidence.mockResolvedValue({ bytes: new Uint8Array(10 * 1024 * 1024 + 1), mimeType: 'image/jpeg' });
    await esperarFallido('imagen_demasiado_grande');

    deps.persist.mockClear();
    deps.getImage.mockResolvedValue(imagen({ image_url: `https://x.supabase.co/storage/v1/object/public/report-evidences/${CSID}/foto.gif` }));
    deps.downloadEvidence.mockResolvedValue({ bytes: new Uint8Array([1]), mimeType: 'image/gif' });
    await esperarFallido('formato_de_imagen_no_soportado');
    expect(deps.callModel).not.toHaveBeenCalled();
  });

  it('UT-V3818-36: una salida del modelo que no cumple el contrato no se guarda: queda «fallido» con el motivo y el consumo', async () => {
    deps.callModel.mockResolvedValue(modeloOk(salidaValida({ coherence: 'quizas' })));
    await esperarFallido('validacion: coherence inválido');
    // Gemini ya respondió (y se pagó): modelo, prompt y tokens quedan registrados igual
    expect(filaGuardada()).toMatchObject({ model_code: 'gemini-3.8-flash', prompt_version: 'visual-v1', input_tokens: 1552, output_tokens: 99 });
  });

  it('UT-V3818-37: un servicio inventado por el modelo se rechaza (no se guarda un id que no existe)', async () => {
    deps.callModel.mockResolvedValue(modeloOk(salidaValida({ suggested_service_code: '170275b6-9d03-4aed-9179-2e11cd429c2c' })));
    await esperarFallido('suggested_service_code inexistente');
  });

  it('UT-V3818-38: un resumen con un dato personal no se guarda (ni el resumen ni nada de lo que dijo)', async () => {
    deps.callModel.mockResolvedValue(modeloOk(salidaValida({ scene_summary: 'Un bache. Vecino: Juan, tel 11 9876-0123.' })));
    await esperarFallido('resumen_con_datos_personales');
    expect(JSON.stringify(filaGuardada())).not.toContain('9876');
    expect(JSON.stringify(filaGuardada())).not.toContain('Juan');
  });

  it('UT-V3818-39: una respuesta cortada, bloqueada o que no es JSON queda «fallido»', async () => {
    deps.callModel.mockResolvedValue(modeloOk(salidaValida(), {}));
    deps.callModel.mockResolvedValue({ ...modeloOk(), data: { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"scene' }] } }], usageMetadata: {} } });
    await esperarFallido('respuesta_incompleta (finishReason: MAX_TOKENS)');

    deps.persist.mockClear();
    deps.callModel.mockResolvedValue({ ...modeloOk(), data: { promptFeedback: { blockReason: 'SAFETY' }, candidates: [] } });
    await esperarFallido('bloqueado_por_el_modelo (SAFETY)');

    deps.persist.mockClear();
    deps.callModel.mockResolvedValue({ ...modeloOk(), data: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Lo siento, no puedo.' }] } }] } });
    await esperarFallido('respuesta_no_json');
  });

  it('UT-V3818-40: si el modelo rechaza el pedido (400) queda «fallido» sin probar otros modelos', async () => {
    deps.callModel.mockResolvedValue(modeloHttp(400, 'Invalid image'));
    await esperarFallido('solicitud_rechazada_por_el_modelo (HTTP 400)');
    expect(deps.callModel).toHaveBeenCalledTimes(1);
  });

  it('UT-V3818-41: la clave de Gemini nunca queda en el motivo guardado', async () => {
    deps.callModel.mockResolvedValue(modeloHttp(400, `bad request for url (https://x?key=${FAKE_KEY}) con ${FAKE_KEY}`));
    await correr();
    expect(filaGuardada().status_reason).not.toContain(FAKE_KEY);
    expect(filaGuardada().status_reason).toContain('***');
  });

  it('UT-V3818-42: el motivo guardado nunca supera los 300 caracteres', async () => {
    deps.callModel.mockResolvedValue(modeloHttp(400, 'x'.repeat(2000)));
    await correr();
    expect(filaGuardada().status_reason.length).toBeLessThanOrEqual(301);
  });
});

describe('REP-3818: errores transitorios (no se guarda nada: el despachador reintenta)', () => {
  const noGuardaNiBorra = () => {
    expect(deps.persist).not.toHaveBeenCalled();
    expect(deps.deleteMessage).not.toHaveBeenCalled();
  };

  it('UT-V3818-43: modelo principal con un reintento y, ante indisponibilidad total, los dos respaldos; responde 503 sin guardar', async () => {
    deps.callModel.mockResolvedValue(modeloHttp(503));
    const r = await correr();

    expect(r.status).toBe(503);
    expect(deps.callModel.mock.calls.map((c) => c[0].model)).toEqual(['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite']);
    expect(deps.sleep).toHaveBeenCalledTimes(1);
    noGuardaNiBorra();
  });

  it('UT-V3818-44: con el principal caído, el respaldo responde y el resultado dice con qué modelo se obtuvo', async () => {
    deps.callModel
      .mockResolvedValueOnce(modeloHttp(503))
      .mockResolvedValueOnce(modeloHttp(503))
      .mockResolvedValueOnce(modeloOk());
    const r = await correr();

    expect(r.body).toMatchObject({ estado: 'completado', modelo: 'gemini-3.7-flash' });
    expect(filaGuardada().model_code).toBe('gemini-3.7-flash');
  });

  it('UT-V3818-45: un error 429 en el primer intento se reintenta con el mismo modelo', async () => {
    deps.callModel.mockResolvedValueOnce(modeloHttp(429)).mockResolvedValueOnce(modeloOk());
    const r = await correr();

    expect(r.body.modelo).toBe('gemini-3.8-flash');
    expect(deps.callModel).toHaveBeenCalledTimes(2);
  });

  it('UT-V3818-46: un modelo retirado (404) pasa al respaldo', async () => {
    deps.callModel.mockResolvedValueOnce(modeloHttp(404)).mockResolvedValueOnce(modeloHttp(404)).mockResolvedValueOnce(modeloOk());
    const r = await correr();
    expect(r.body.modelo).toBe('gemini-3.7-flash');
  });

  it('UT-V3818-47: un corte de red o un tiempo agotado es transitorio y el mensaje de error no lleva la clave', async () => {
    deps.callModel.mockRejectedValue(new Error(`fetch failed https://g?key=${FAKE_KEY}`));
    const r = await correr();

    expect(r.status).toBe(503);
    expect(JSON.stringify(r.body)).not.toContain(FAKE_KEY);
    noGuardaNiBorra();
  });

  it('UT-V3818-48: sin GEMINI_API_KEY responde 503 sin llamar a nadie y sin guardar', async () => {
    deps.geminiConfigured = false;
    const r = await correr();

    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/GEMINI_API_KEY/);
    expect(deps.callModel).not.toHaveBeenCalled();
    noGuardaNiBorra();
  });

  it('UT-V3818-49: si no se puede leer la foto del bucket responde 503 sin guardar', async () => {
    deps.downloadEvidence.mockRejectedValue(new Error('timeout'));
    const r = await correr();

    expect(r.status).toBe(503);
    expect(deps.callModel).not.toHaveBeenCalled();
    noGuardaNiBorra();
  });

  it('UT-V3818-50: si no se puede guardar el resultado responde 500 y el mensaje se queda en la cola', async () => {
    deps.persist.mockResolvedValue(false);
    const r = await correr();
    expect(r.status).toBe(500);
    expect(deps.deleteMessage).not.toHaveBeenCalled();

    deps.persist.mockRejectedValue(new Error('base caída'));
    expect((await correr()).status).toBe(500);
    expect(deps.deleteMessage).not.toHaveBeenCalled();
  });

  it('UT-V3818-51: un error de la base al leer la evidencia es un 500 sin guardar ni borrar', async () => {
    deps.getImage.mockRejectedValue(new Error('conexión perdida'));
    const r = await correr();
    expect(r.status).toBe(500);
    noGuardaNiBorra();
  });
});

describe('REP-3818: la función no toca nada más que su resultado', () => {
  const source = readFileSync(resolve(__dirname, '../../supabase/functions/analizar-imagen-reporte/index.ts'), 'utf8');

  it('UT-V3818-52: el token del despachador se exige antes de leer el cuerpo o tocar la base, y se compara en tiempo constante', () => {
    const token = source.indexOf("req.headers.get('x-visual-dispatch-token')");
    const cuerpo = source.indexOf('await req.json()');
    const cliente = source.indexOf('createClient(supabaseUrl');
    expect(token).toBeGreaterThan(-1);
    expect(token).toBeLessThan(cuerpo);
    expect(token).toBeLessThan(cliente);
    expect(source).toContain('safeEqual(');
    expect(source).toMatch(/Deno\.env\.get\('VISUAL_DISPATCH_TOKEN'\)/);
  });

  it('UT-V3818-53: solo escribe vía persist_visual_analysis y borra de visual_analysis_queue', () => {
    expect(source).toContain("rpc('persist_visual_analysis'");
    expect(source).toContain("queue_name: QUEUE_NAME");
    expect(source).toContain("const QUEUE_NAME = 'visual_analysis_queue'");
    expect(source).not.toMatch(/rag_analysis_queue/);
  });

  it('UT-V3818-54: no modifica el reporte ni el análisis jurídico (no escribe en citizen_reports, report_ai_analysis ni knowledge_fragments)', () => {
    expect(source).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect(source).not.toMatch(/report_ai_analysis|report_ai_evidence|knowledge_fragments|match_knowledge_fragments/);
    expect(source).not.toMatch(/from\('citizen_reports'\)/);
  });

  it('UT-V3818-55: lee solo del bucket de evidencias y la clave de Gemini no viaja en la URL', () => {
    expect(source).toContain('storage.from(EVIDENCE_BUCKET)');
    expect(source).not.toContain('evidence-quarantine');
    expect(source).not.toMatch(/[?&]key=/);
    const gemini = readFileSync(resolve(__dirname, '../../supabase/functions/analizar-imagen-reporte/gemini.ts'), 'utf8');
    expect(gemini.match(/'x-goog-api-key': apiKey/g)).toHaveLength(1);
    expect(gemini).not.toMatch(/[?&]key=/);
  });

  it('UT-V3818-56: no se modificó analizar-reporte (el RAG textual sigue autocontenido)', () => {
    const rag = readFileSync(resolve(__dirname, '../../supabase/functions/analizar-reporte/index.ts'), 'utf8');
    expect(rag).not.toMatch(/report_image_analysis|visual_analysis_queue|analizar-imagen-reporte/);
  });
});
