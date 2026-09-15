-- V-08 (ronda 2 de Hernan, REP-2908-VERIF_ronda2_hernan.md): ajusta el
-- limite de reintentos de 5 a 3 (propuesta explicita de Hernan) y corrige
-- el insert de archivado, que tenia el mismo bug encontrado en V-09
-- (embedding_model_code es NOT NULL y este insert nunca lo completaba --
-- un mensaje archivado por exceso de reintentos habria fallado el insert
-- tambien, perdiendo el registro sin dejar rastro).
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
  max_retries constant int := 3;
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
        official_legal_foundation, confidence_score, embedding_model_code
      )
      values (
        (msg.message ->> 'reportId')::uuid, 'indeterminado', null,
        'No se pudo completar el analisis automatico tras varios intentos.',
        format('Se supero el limite de %s reintentos en dispatch_rag_analysis_queue; mensaje archivado (msg_id=%s).', max_retries, msg.msg_id),
        0,
        'gemini-embedding-2@768'
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
