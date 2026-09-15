-- Corrige el schedule inicial (heredado del script de desarrollo local
-- scripts/rag-local-dev/apply-async-pipeline.sql, que programaba cada 10
-- segundos) a cada 1 minuto, evitando ~8.640 filas/dia en
-- cron.job_run_details y reintentos de costo real sin limite (ver V-08 en
-- .agents/workflow/plans/REP-2908-VERIF.md).
select cron.alter_job((select jobid from cron.job where jobname = 'rag-analysis-dispatch'), schedule := '* * * * *');
