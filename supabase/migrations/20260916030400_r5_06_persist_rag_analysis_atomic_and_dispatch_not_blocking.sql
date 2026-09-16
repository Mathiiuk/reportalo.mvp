-- REP-2908-VERIF ronda 5, R5-06 (REP-3776/REP-3777):
--
-- Parte A: persistAnalysis hacia dos inserciones separadas (analisis y
-- evidencia), no atomicas pese a lo que decia el comentario del archivo. Si
-- fallaba la evidencia, el analisis quedaba guardado y el mensaje se
-- reintentaba: como report_id es UNIQUE (confirmado, C6), cada reintento
-- volvia a chocar y el mensaje nunca se borraba de la cola.
--
-- Parte B: al superar los 3 intentos, dispatch_rag_analysis_queue insertaba
-- el 'indeterminado' sin manejar el conflicto de report_id y con
-- excepciones no aisladas por mensaje: si ese insert fallaba, el error
-- abortaba toda la corrida y ningun otro reporte se analizaba hasta el
-- proximo minuto (y el siguiente, indefinidamente, con el mismo mensaje
-- atascado). Ademas manda ahora el header x-rag-dispatch-token (R5-05) para
-- que analizar-reporte solo acepte llamadas del despacho de la cola.
begin;

create or replace function public.persist_rag_analysis(p_analysis jsonb, p_evidence jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into report_ai_analysis (
    report_id, result_status_code, is_infraction, suggested_service_id, suggested_agency_id,
    citizen_feedback, official_legal_foundation, confidence_score, embedding_model_code,
    generation_model_code, prompt_version, input_tokens, output_tokens, latency_ms, status_reason)
  select a.report_id, a.result_status_code, coalesce(a.is_infraction, false), a.suggested_service_id, a.suggested_agency_id,
         a.citizen_feedback, a.official_legal_foundation, coalesce(a.confidence_score, 0), a.embedding_model_code,
         a.generation_model_code, a.prompt_version, a.input_tokens, a.output_tokens, a.latency_ms, a.status_reason
  from jsonb_populate_record(null::public.report_ai_analysis, p_analysis) a
  on conflict (report_id) do nothing
  returning id into v_id;

  if v_id is null then
    -- Ya existia un analisis para ese reporte: no se duplica ni se pisa.
    select id into v_id from report_ai_analysis where report_id = (p_analysis ->> 'report_id')::uuid;
    return v_id;
  end if;

  insert into report_ai_evidence (analysis_id, fragment_id, rank, similarity, was_cited, quoted_text)
  select v_id, e.fragment_id, e.rank, e.similarity, e.was_cited, e.quoted_text
  from jsonb_to_recordset(coalesce(p_evidence, '[]'::jsonb))
       as e(fragment_id uuid, rank int, similarity numeric, was_cited boolean, quoted_text text);

  return v_id;  -- todo en una sola transaccion: o se guardan los dos, o ninguno
end;
$$;

revoke execute on function public.persist_rag_analysis(jsonb, jsonb) from public, anon, authenticated;
grant  execute on function public.persist_rag_analysis(jsonb, jsonb) to service_role;

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
  dispatch_token text;
  max_retries constant int := 3;
begin
  select decrypted_secret into function_url     from vault.decrypted_secrets where name = 'rag_analizar_reporte_url';
  select decrypted_secret into service_role_key from vault.decrypted_secrets where name = 'rag_service_role_key';
  select decrypted_secret into dispatch_token   from vault.decrypted_secrets where name = 'rag_dispatch_token';

  if function_url is null or service_role_key is null or dispatch_token is null then
    raise notice 'Faltan secrets en Vault (rag_analizar_reporte_url / rag_service_role_key / rag_dispatch_token).';
    return;
  end if;

  for msg in select * from pgmq.read('rag_analysis_queue', 90, 20) loop
    begin  -- cada mensaje aislado: un error no corta la corrida
      if msg.read_ct > max_retries then
        perform pgmq.archive('rag_analysis_queue', msg.msg_id);
        begin
          insert into public.report_ai_analysis (
            report_id, result_status_code, is_infraction, citizen_feedback, official_legal_foundation,
            confidence_score, embedding_model_code, status_reason)
          values (
            (msg.message ->> 'reportId')::uuid, 'indeterminado', false,
            'El análisis legal está en revisión.',
            null, 0,
            (select code from public.embedding_models where is_active),
            format('Se superó el límite de %s reintentos; mensaje archivado (msg_id=%s).', max_retries, msg.msg_id))
          on conflict (report_id) do nothing;
        exception when others then
          raise warning 'dispatch_rag_analysis_queue: no se pudo registrar el indeterminado de msg_id=%: %', msg.msg_id, sqlerrm;
        end;
      else
        perform net.http_post(
          url := function_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_role_key,
            'x-rag-dispatch-token', dispatch_token),
          body := msg.message || jsonb_build_object('queueMessageId', msg.msg_id));
      end if;
    exception when others then
      raise warning 'dispatch_rag_analysis_queue: msg_id=% falló: %', msg.msg_id, sqlerrm;
    end;
  end loop;
end;
$$;

revoke execute on function public.dispatch_rag_analysis_queue() from public, anon, authenticated;

commit;
