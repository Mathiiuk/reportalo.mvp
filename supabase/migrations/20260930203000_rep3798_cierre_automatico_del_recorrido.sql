-- REP-3798 — El recorrido automático del reporte termina en un estado final según lo que concluye la IA
--
-- Decisión de producto (Matías, 30/09/2026): después de pasar a «En revisión» (migración
-- rep3798_estado_en_revision_al_enviar) el reporte tiene que terminar en algún lado según el resultado del análisis:
--   * fuera_de_alcance → DESESTIMADO (Descartado), con el motivo en el historial.
--   * asistencia       → RESUELTO, porque la respuesta al ciudadano (911 / canales oficiales) ya se dio.
--   * fundamentado, sin_normativa, indeterminado → SE QUEDA en «En revisión»: los revisa una persona.
--     «Notificado al responsable» NO se automatiza: hoy no existe una notificación real a un organismo
--     (la IA no sugirió ninguna agencia en los 181 análisis de producción).
--
-- Se hace dentro de persist_rag_analysis, en la misma transacción que guarda el análisis: el resultado y el
-- estado se guardan juntos o ninguno. Solo se mueve un reporte que siga en EN_ANALISIS, así que un estado
-- que una persona ya cambió a mano no se pisa, y un reintento del mismo análisis (que sale antes del
-- cambio) no duplica el historial.
--
-- Se conserva íntegro el cuerpo vigente de la función (verificado contra producción el 30/09/2026);
-- create or replace conserva los permisos (solo service_role). Solo afecta a análisis nuevos: los reportes
-- que ya estaban en «Enviado» o «En revisión» no se tocan.
--
-- Probada en la base descartable, dentro de una transacción que se deshace.

create or replace function public.persist_rag_analysis(p_analysis jsonb, p_evidence jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_report uuid;
  v_result text;
  v_next text;
  v_note text;
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
    select id into v_id from report_ai_analysis where report_id = (p_analysis ->> 'report_id')::uuid;
    return v_id;
  end if;

  insert into report_ai_evidence (analysis_id, fragment_id, rank, similarity, was_cited, quoted_text)
  select v_id, e.fragment_id, e.rank, e.similarity, e.was_cited, e.quoted_text
  from jsonb_to_recordset(coalesce(p_evidence, '[]'::jsonb))
       as e(fragment_id uuid, rank int, similarity numeric, was_cited boolean, quoted_text text);

  -- Cierre del recorrido automático (REP-3798)
  v_report := (p_analysis ->> 'report_id')::uuid;
  v_result := p_analysis ->> 'result_status_code';
  v_next := case v_result
    when 'fuera_de_alcance' then 'DESESTIMADO'
    when 'asistencia' then 'RESUELTO'
    else null
  end;

  if v_next is not null then
    v_note := case v_result
      when 'fuera_de_alcance' then 'Fuera del alcance de Reportalo'
      else 'Asistencia: se indicó al ciudadano los canales oficiales'
    end;

    update citizen_reports
       set current_state_code = v_next
     where id = v_report
       and current_state_code = 'EN_ANALISIS';

    if found then
      insert into report_state_history (report_id, state_code, notes)
      values (v_report, v_next, v_note);
    end if;
  end if;

  return v_id;  -- todo en una sola transaccion: o se guarda todo, o nada
end;
$$;
