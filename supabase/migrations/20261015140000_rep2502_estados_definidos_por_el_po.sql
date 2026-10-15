-- REP-2502 — Estados del reporte definidos por el PO (H-2, respuesta de Hernán del 15/10/2026)
--
-- El PO definió la máquina de estados que faltaba. Esta migración la carga COMO DATOS y alinea el cierre automático del RAG
-- con la regla central: RESUELTO y DESESTIMADO los pone solo el organismo, con motivo; nunca lo que diga la IA.
--
-- ESTADOS (report_states)
--   RECIBIDO         estado inicial
--   EN_ANALISIS      lo pone el sistema; mientras la entrega sea borrador, el reporte se queda acá
--   INFORMADO (nuevo)  no se manda nada a un organismo y se le informa al vecino el canal que corresponde
--                      (vulnerabilidad social: 108, Desarrollo Social, 102, Consejo de Niñez)
--   DERIVADO         se notificó al organismo X y queda pendiente de respuesta; solo cuando se envíe DE VERDAD
--   ESCALADO (nuevo)       el organismo lo pasa a otro organismo o área
--   EN_DISCREPANCIA (nuevo) la respuesta del organismo no coincide con lo reportado
--   RESUELTO / DESESTIMADO  solo los pone el organismo, con motivo obligatorio
--
-- TRANSICIONES (report_state_transitions)
--   sistema   : RECIBIDO -> EN_ANALISIS (ya existía) · EN_ANALISIS -> INFORMADO · EN_ANALISIS -> DERIVADO (envío confirmado)
--   organismo : DERIVADO -> RESUELTO | DESESTIMADO | ESCALADO | EN_DISCREPANCIA (de DERIVADO se puede ir directo a RESUELTO
--               o DESESTIMADO)
--   Se RETIRAN las dos transiciones que el sistema hacía por inferencia de la IA (EN_ANALISIS -> RESUELTO y
--   EN_ANALISIS -> DESESTIMADO): contradicen la regla del PO.
--   Desde ESCALADO y EN_DISCREPANCIA el PO no definió salidas; se cargan las que parecen obvias (RESUELTO, DESESTIMADO y
--   entre ellos) MARCADAS como propuesta de Matías, pendiente de confirmar. No se usan mientras la entrega sea borrador.
--
-- persist_rag_analysis (RAG): «asistencia» y toda vulnerabilidad social pasan a INFORMADO. «fuera de alcance» YA NO cierra el
-- reporte como DESESTIMADO: queda en EN_ANALISIS hasta que lo revise una persona (propuesta de Matías; el PO no la
-- había definido).
--
-- DATOS EXISTENTES: todos los reportes actuales son de prueba (confirmado por el PO), así que se corrigen:
--   * los RESUELTO sin actuación de un organismo pasan a INFORMADO (los 20 «asistencia»);
--   * los DESESTIMADO sin actuación de un organismo vuelven a EN_ANALISIS (los cerró la IA).
--   Cada corrección deja su fila en el historial (evento CORRECCION_PO_H2). Los DERIVADO no se tocan.
--
-- No se aplica sola: la migración se corre a mano en staging.

begin;

-- 1) Estados nuevos --------------------------------------------------------------------------------------------------
insert into public.report_states (code, description, open311_status)
values ('INFORMADO', 'Informado', 'closed'),
       ('ESCALADO', 'Escalado a otro organismo', 'open'),
       ('EN_DISCREPANCIA', 'En discrepancia', 'open')
on conflict (code) do nothing;

-- 2) Transiciones ---------------------------------------------------------------------------------------------------
delete from public.report_state_transitions
 where actor_type = 'sistema'
   and from_state_code = 'EN_ANALISIS'
   and to_state_code in ('RESUELTO', 'DESESTIMADO');

insert into public.report_state_transitions (from_state_code, to_state_code, actor_type, event_code, approved_by, approved_on, notes)
values
  ('EN_ANALISIS', 'INFORMADO', 'sistema', 'CIERRE_AUTOMATICO_ASISTENCIA',
   'Hernán Gregorini (PO, REP-2502 H-2)', date '2026-10-15',
   'El análisis concluye «asistencia» o el reporte es de vulnerabilidad social: se informa al vecino el canal que corresponde. No se manda nada a un organismo.'),
  ('EN_ANALISIS', 'DERIVADO', 'sistema', 'ENTREGA_CONFIRMADA',
   'Hernán Gregorini (PO, REP-2502 H-2)', date '2026-10-15',
   'Solo cuando se envíe DE VERDAD a un organismo (guardando cuál). Mientras la entrega sea borrador el reporte sigue en EN_ANALISIS.'),
  ('DERIVADO', 'RESUELTO', 'organismo', 'RESPUESTA_RESUELTO',
   'Hernán Gregorini (PO, REP-2502 H-2)', date '2026-10-15', 'Lo pone solo el organismo, con motivo.'),
  ('DERIVADO', 'DESESTIMADO', 'organismo', 'RESPUESTA_DESESTIMADO',
   'Hernán Gregorini (PO, REP-2502 H-2)', date '2026-10-15', 'Lo pone solo el organismo, con motivo.'),
  ('DERIVADO', 'ESCALADO', 'organismo', 'ESCALADO_A_OTRO_ORGANISMO',
   'Hernán Gregorini (PO, REP-2502 H-2)', date '2026-10-15', 'El organismo lo pasa a otro organismo o área. No se usa mientras la entrega sea borrador.'),
  ('DERIVADO', 'EN_DISCREPANCIA', 'organismo', 'RESPUESTA_EN_DISCREPANCIA',
   'Hernán Gregorini (PO, REP-2502 H-2)', date '2026-10-15', 'La respuesta del organismo no coincide con lo reportado. No se usa mientras la entrega sea borrador.'),
  ('ESCALADO', 'RESUELTO', 'organismo', 'RESPUESTA_RESUELTO',
   'Matías Krepchuk (propuesta, pendiente de confirmar por el PO)', date '2026-10-15', 'El PO no definió las salidas de ESCALADO.'),
  ('ESCALADO', 'DESESTIMADO', 'organismo', 'RESPUESTA_DESESTIMADO',
   'Matías Krepchuk (propuesta, pendiente de confirmar por el PO)', date '2026-10-15', 'El PO no definió las salidas de ESCALADO.'),
  ('ESCALADO', 'EN_DISCREPANCIA', 'organismo', 'RESPUESTA_EN_DISCREPANCIA',
   'Matías Krepchuk (propuesta, pendiente de confirmar por el PO)', date '2026-10-15', 'El PO no definió las salidas de ESCALADO.'),
  ('EN_DISCREPANCIA', 'RESUELTO', 'organismo', 'RESPUESTA_RESUELTO',
   'Matías Krepchuk (propuesta, pendiente de confirmar por el PO)', date '2026-10-15', 'El PO no definió las salidas de EN_DISCREPANCIA.'),
  ('EN_DISCREPANCIA', 'DESESTIMADO', 'organismo', 'RESPUESTA_DESESTIMADO',
   'Matías Krepchuk (propuesta, pendiente de confirmar por el PO)', date '2026-10-15', 'El PO no definió las salidas de EN_DISCREPANCIA.'),
  ('EN_DISCREPANCIA', 'ESCALADO', 'organismo', 'ESCALADO_A_OTRO_ORGANISMO',
   'Matías Krepchuk (propuesta, pendiente de confirmar por el PO)', date '2026-10-15', 'El PO no definió las salidas de EN_DISCREPANCIA.')
on conflict (from_state_code, to_state_code, actor_type) do nothing;

-- 3) Cierre automático del RAG: la IA ya no resuelve ni desestima --------------------------------------------------
create or replace function public.persist_rag_analysis(p_analysis jsonb, p_evidence jsonb)
returns uuid
language plpgsql
set search_path to 'public'
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

  -- Cierre del recorrido automático (REP-3798, ajustado por REP-2502 H-2): la IA NUNCA marca RESUELTO ni DESESTIMADO.
  -- «asistencia» y toda vulnerabilidad social: se informa el canal al vecino (INFORMADO). «fuera de alcance» y el resto
  -- siguen en EN_ANALISIS hasta que los revise una persona.
  v_report := (p_analysis ->> 'report_id')::uuid;
  v_result := p_analysis ->> 'result_status_code';
  v_next := case
    when v_result = 'asistencia' then 'INFORMADO'
    when exists (select 1 from citizen_reports r join services s on s.id = r.service_id
                  where r.id = v_report and s.service_code = 'VULNERABILIDAD_SOCIAL') then 'INFORMADO'
    else null
  end;

  if v_next is not null then
    v_note := 'Se informó al vecino el canal que corresponde. No se derivó a un organismo.';

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

-- 4) Datos de prueba existentes (el PO confirmó que todos los reportes actuales son de prueba) ----------------------
with fixed as (
  update public.citizen_reports r
     set current_state_code = 'INFORMADO', updated_at = now()
   where r.current_state_code = 'RESUELTO'
     and not exists (select 1 from public.report_state_history h where h.report_id = r.id and h.actor_type = 'organismo')
  returning r.id
)
insert into public.report_state_history (report_id, state_code, previous_state_code, actor_type, event_code, notes)
select f.id, 'INFORMADO', 'RESUELTO', 'sistema', 'CORRECCION_PO_H2',
       'Reclasificado por decisión del PO (15/10/2026): la IA no cierra reportes como resueltos; se informó al vecino el canal que corresponde.'
  from fixed f;

with reopened as (
  update public.citizen_reports r
     set current_state_code = 'EN_ANALISIS', updated_at = now()
   where r.current_state_code = 'DESESTIMADO'
     and not exists (select 1 from public.report_state_history h where h.report_id = r.id and h.actor_type = 'organismo')
  returning r.id
)
insert into public.report_state_history (report_id, state_code, previous_state_code, actor_type, event_code, notes)
select f.id, 'EN_ANALISIS', 'DESESTIMADO', 'sistema', 'CORRECCION_PO_H2',
       'Vuelve a análisis por decisión del PO (15/10/2026): la IA no desestima reportes; lo revisa una persona.'
  from reopened f;

commit;
