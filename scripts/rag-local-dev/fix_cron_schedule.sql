-- El schedule original de rag-analysis-dispatch en supabase/rag_async_pipeline.sql
-- ('*/10 * * * * *', 6 campos con segundos) no es soportado por el pg_cron de
-- este proyecto: se interpreto como cron estandar de 5 campos y corrio cada
-- 10 MINUTOS en vez de cada 10 segundos (confirmado via cron.job_run_details,
-- REP-DEPLOY-RAG-SUPABASE run-001 §6). Se cambia a la alternativa ya
-- documentada en el SQL original para este caso: cada 1 minuto.
--
-- Aplicado contra Supabase real el 2026-09-14.

select cron.alter_job(
  (select jobid from cron.job where jobname = 'rag-analysis-dispatch'),
  schedule := '* * * * *'
);
