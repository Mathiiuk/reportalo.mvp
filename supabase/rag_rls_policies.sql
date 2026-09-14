-- ==============================================================================
-- rag_rls_policies.sql — Bloque 3 de REP-2909: quién puede leer un análisis
-- ==============================================================================
--
-- ESTADO: escrito, NO ejecutado contra ningún proyecto Supabase real desde esta
-- tarea. Es el bloque más sensible de seguridad de REP-2909: revisar con
-- cuidado antes de aplicar en cualquier entorno (ver .agents/workflow/plans/REP-2909.md §6).
--
-- Criterio (docx REP-1009 §10, fila RLS): "Análisis y evidencia: mismo
-- criterio que el reporte" — el ciudadano ve el análisis de SUS reportes, el
-- organismo ve el de los reportes que atiende. Reutiliza
-- public.profile_attends_report(profile_id, report_id), la función que ya
-- define ese mismo criterio para el organismo en la PARTE 5B de
-- docs/REP-3769_seed_y_RAG.sql — así el criterio de "quién atiende qué
-- reporte" vive en un solo lugar (la función), no se reinventa acá.
--
-- SUPUESTO A CONFIRMAR: que public.profile_attends_report ya exista (requiere
-- que la PARTE 5B de REP-3769 esté aplicada). Si todavía no está, este archivo
-- falla al aplicarse — es la señal de que hay que aplicar 5B primero.
--
-- Corresponde a la PARTE 13 (comentada, opcional) de docs/REP-3769_seed_y_RAG.sql
-- — la pregunta Q-3/Q-6 de la guía. Se aplica solo con decisión de Matías.
-- ==============================================================================

begin;

alter table public.report_ai_analysis enable row level security;
alter table public.report_ai_evidence enable row level security;

-- El ciudadano lee el análisis de sus propios reportes.
drop policy if exists "citizen reads own report ai analysis" on public.report_ai_analysis;
create policy "citizen reads own report ai analysis"
on public.report_ai_analysis for select
to authenticated
using (
  exists (
    select 1 from public.citizen_reports cr
    where cr.id = report_ai_analysis.report_id
      and cr.user_id = auth.uid()
  )
);

-- El organismo lee el análisis de los reportes que atiende (mismo criterio
-- que ya usa el panel de organismo para listar reportes).
drop policy if exists "agency reads assigned report ai analysis" on public.report_ai_analysis;
create policy "agency reads assigned report ai analysis"
on public.report_ai_analysis for select
to authenticated
using (
  public.profile_attends_report(auth.uid(), report_ai_analysis.report_id)
);

-- Misma cascada para la evidencia: quien puede ver el análisis, puede ver de
-- qué fragmentos salió (el filtrado de "no mostrar sanciones al ciudadano" es
-- responsabilidad de la pantalla — src/components/report/ReportAiAnalysisPanel.jsx
-- — no de RLS, porque el organismo sí necesita ver las sanciones).
drop policy if exists "read evidence if can read its analysis" on public.report_ai_evidence;
create policy "read evidence if can read its analysis"
on public.report_ai_evidence for select
to authenticated
using (
  exists (
    select 1 from public.report_ai_analysis raa
    where raa.id = report_ai_evidence.analysis_id
      and (
        exists (
          select 1 from public.citizen_reports cr
          where cr.id = raa.report_id and cr.user_id = auth.uid()
        )
        or public.profile_attends_report(auth.uid(), raa.report_id)
      )
  )
);

-- Nadie escribe desde el cliente: solo la Edge Function (service_role, que
-- bypassea RLS) inserta filas. No se agregan políticas de INSERT/UPDATE/DELETE
-- para authenticated/anon a propósito.

commit;
