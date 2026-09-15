begin;

alter table public.report_ai_analysis enable row level security;
alter table public.report_ai_evidence enable row level security;

-- Reemplazo de las politicas publicas heredadas de un despliegue previo del
-- schema (permitian SELECT/INSERT a cualquiera, sin restriccion) por el
-- criterio de REP-2909: el ciudadano ve el analisis de sus reportes, el
-- organismo ve el de los que atiende, y nadie escribe desde el cliente (solo
-- la Edge Function via service_role, que bypassea RLS).
drop policy if exists "insert_publico" on public.report_ai_analysis;
drop policy if exists "lectura_publica" on public.report_ai_analysis;

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

drop policy if exists "agency reads assigned report ai analysis" on public.report_ai_analysis;
create policy "agency reads assigned report ai analysis"
on public.report_ai_analysis for select
to authenticated
using (
  public.profile_attends_report(auth.uid(), report_ai_analysis.report_id)
);

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

commit;
