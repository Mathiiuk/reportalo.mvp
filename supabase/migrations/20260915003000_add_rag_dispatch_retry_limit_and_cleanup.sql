-- V-08: dispatch_rag_analysis_queue no revisaba read_ct -- un mensaje que
-- falla siempre (Edge Function con error antes de poder borrarlo de la cola)
-- quedaba reintentandose cada minuto para siempre, con costo real de Gemini
-- en cada intento. Se agrega un limite de 5 intentos: superado, se archiva
-- el mensaje (nunca se borra, pgmq.archive) y se guarda un analisis
-- 'indeterminado' con el motivo, en vez de seguir reintentando.
create or replace function public.dispatch_rag_analysis_queue()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  msg record;
  function_url text;
  service_role_key text;
  max_retries constant int := 5;
begin
  select decrypted_secret into function_url
  from vault.decrypted_secrets where name = 'rag_analizar_reporte_url';
  select decrypted_secret into service_role_key
  from vault.decrypted_secrets where name = 'rag_service_role_key';

  if function_url is null or service_role_key is null then
    raise notice 'Faltan los secrets rag_analizar_reporte_url / rag_service_role_key en Vault: dispatch_rag_analysis_queue no puede llamar a la Edge Function.';
    return;
  end if;

  for msg in select * from pgmq.read('rag_analysis_queue', 90, 20) loop
    if msg.read_ct > max_retries then
      perform pgmq.archive('rag_analysis_queue', msg.msg_id);
      insert into public.report_ai_analysis (
        report_id, result_status_code, is_infraction, citizen_feedback,
        official_legal_foundation, confidence_score
      )
      values (
        (msg.message ->> 'reportId')::uuid, 'indeterminado', null,
        'No se pudo completar el analisis automatico tras varios intentos.',
        format('Se supero el limite de %s reintentos en dispatch_rag_analysis_queue; mensaje archivado (msg_id=%s).', max_retries, msg.msg_id),
        0
      );
    else
      perform net.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := msg.message || jsonb_build_object('queueMessageId', msg.msg_id)
      );
    end if;
  end loop;
end;
$$;

-- Limpieza de cron.job_run_details (crece sin limite; ~1100 filas/dia con el
-- schedule actual de 1 minuto). Se agrega una tarea diaria que borra lo
-- anterior a 7 dias.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'rag-cleanup-job-run-details') then
    perform cron.schedule(
      'rag-cleanup-job-run-details',
      '0 3 * * *',
      $job$delete from cron.job_run_details where start_time < now() - interval '7 days';$job$
    );
  end if;
end $$;
