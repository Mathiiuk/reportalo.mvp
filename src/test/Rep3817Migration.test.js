import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// REP-3817: la migración fija reglas de seguridad y de idempotencia que la app no puede garantizar sola. Este test
// evita que alguien las afloje sin darse cuenta (no ejecuta SQL: lee el archivo). El comportamiento real se
// verifica con supabase/tests/REP-3817_verificacion.sql contra una base con la migración aplicada.
describe('REP-3817: migración del análisis visual (cola y persistencia)', () => {
  const raw = fs.readFileSync(
    path.resolve(__dirname, '../../supabase/migrations/20261004120000_rep3817_analisis_visual_cola_y_persistencia.sql'),
    'utf8'
  );
  // Sin comentarios: las comprobaciones de «no se toca el RAG» no deben dispararse por el texto explicativo
  const sql = raw.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');

  it('UT-V3817-01: un resultado por evidencia (image_id único) que se borra junto con la evidencia', () => {
    expect(sql).toContain('create table if not exists public.report_image_analysis');
    expect(sql).toMatch(/image_id\s+uuid not null references public\.report_images\(id\) on delete cascade/);
    expect(sql).toContain('constraint report_image_analysis_image_id_key unique (image_id)');
  });

  it('UT-V3817-02: el contrato se valida en la tabla (estado, coherencia, marcas, confianza, resumen)', () => {
    expect(sql).toContain("status in ('completado', 'omitido', 'fallido')");
    expect(sql).toContain("coherence in ('coincide', 'no_coincide', 'no_concluyente')");
    expect(sql).toContain("array['oscura', 'borrosa', 'no_se_ve_el_hecho', 'sin_contexto_de_lugar']");
    expect(sql).toContain('confidence_score >= 0 and confidence_score <= 1');
    expect(sql).toContain('char_length(scene_summary) <= 600');
    expect(sql).toContain("status <> 'completado' or (scene_summary is not null and coherence is not null)");
  });

  it('UT-V3817-03: RLS activa; lee el dueño o quien atiende; el cliente nunca escribe', () => {
    expect(sql).toContain('alter table public.report_image_analysis enable row level security');
    expect(sql).toContain('on public.report_image_analysis for select');
    expect(sql).toContain('r.user_id = (select auth.uid())');
    expect(sql).toContain('public.profile_attends_report((select auth.uid()), report_image_analysis.report_id)');
    expect(sql).toContain('revoke all on table public.report_image_analysis from public, anon, authenticated');
    expect(sql).toContain('grant select on table public.report_image_analysis to authenticated');
    expect(sql).not.toMatch(/for (insert|update|delete|all) /i);
  });

  it('UT-V3817-04: una evidencia nueva se encola una vez y un fallo al encolar no rompe el alta', () => {
    expect(sql).toContain("perform pgmq.create('visual_analysis_queue')");
    expect(sql).toContain('after insert on public.report_images');
    expect(sql).toContain("jsonb_build_object('imageId', new.id, 'reportId', new.report_id)");
    expect(sql).toMatch(/exception when others then\s*raise warning 'enqueue_visual_analysis/);
  });

  it('UT-V3817-05: persistir es idempotente y solo lo ejecuta service_role', () => {
    expect(sql).toContain('on conflict (image_id) do nothing');
    expect(sql).toMatch(/revoke execute on function public\.persist_visual_analysis\(jsonb\) from public, anon, authenticated/);
    expect(sql).toMatch(/grant\s+execute on function public\.persist_visual_analysis\(jsonb\) to service_role/);
    // El reporte sale de la evidencia, no del parámetro
    expect(sql).toContain('select report_id into v_report_id from report_images where id = v_image_id');
  });

  it('UT-V3817-06: el despachador no hace nada sin secrets, limita reintentos y no lo puede invocar un ciudadano', () => {
    expect(sql).toContain("name = 'visual_analizar_imagen_url'");
    expect(sql).toContain("name = 'visual_dispatch_token'");
    expect(sql).toContain("name = 'rag_service_role_key'");
    expect(sql).toMatch(/if function_url is null or service_role_key is null or dispatch_token is null then[\s\S]*?return;/);
    expect(sql).toContain('max_retries constant int := 3');
    expect(sql).toContain("pgmq.archive('visual_analysis_queue', msg.msg_id)");
    expect(sql).toContain("'x-visual-dispatch-token', dispatch_token");
    expect(sql).toMatch(/revoke execute on function public\.dispatch_visual_analysis_queue\(\) from public, anon, authenticated/);
  });

  it('UT-V3817-07: no se vuelve a llamar al modelo por una evidencia que ya tiene resultado', () => {
    expect(sql).toContain("perform pgmq.delete('visual_analysis_queue', msg.msg_id)");
  });

  it('UT-V3817-08: el cron corre cada minuto y es repetible', () => {
    expect(sql).toContain("'visual-analysis-dispatch'");
    expect(sql).toContain("'* * * * *'");
    expect(sql).toContain("if not exists (select 1 from cron.job where jobname = 'visual-analysis-dispatch')");
    expect(sql).toContain('create or replace function public.dispatch_visual_analysis_queue()');
    expect(sql).toContain('drop trigger if exists trg_enqueue_visual_analysis');
  });

  it('UT-V3817-09: no se toca el circuito RAG ni se versiona ningún secreto', () => {
    expect(sql).not.toMatch(/function public\.(enqueue_rag_analysis|persist_rag_analysis|dispatch_rag_analysis_queue)/);
    expect(sql).not.toContain("'rag_analysis_queue'");
    expect(sql).not.toMatch(/on public\.citizen_reports/);
    expect(sql).not.toContain('vault.create_secret');
    expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/); // ningún JWT pegado
  });
});
