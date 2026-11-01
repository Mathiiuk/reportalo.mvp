-- REP-3892 — Borrador institucional solo para reportes elegibles y etiqueta «usuario» (Sprint 19)
--
-- Origen: QA REP-3875 de Ivo (30/10/2026), observaciones O-01 (alta) y O-03 (baja). O-02 es de la pantalla.
--
-- Estado previo (verificado en staging el 01/11/2026, md5 de pg_get_functiondef = 131b958fd4a78303474b026b6a769718):
-- prepare_organism_delivery llamaba a route_report con la prestación recibida y armaba el borrador con la categoría de
-- esa prestación, sin mirar el último análisis ni la categoría del reporte. El autor de #RP-371F42E4 (Tránsito, análisis
-- fuera_de_alcance) pasó 'bache_calle' y obtuvo borrador_generado para la Comuna 5 con categoría «Reparación de bache en
-- calle». No llegaba a la bandeja (deliver_report_to_test_inbox ya excluye fuera_de_alcance y asistencia), pero REP-3890
-- va a llamar a esta función desde la PWA.
--
-- Cambios (todos dentro de la función; no cambia esquema ni datos):
--   1. Antes de rutear, con el mismo control de acceso que route_report (servidor, autor u operador que lo atiende;
--      cualquier otro recibe null, sin revelar el análisis):
--        - último análisis fuera_de_alcance → estado 'excluido_fuera_de_alcance';
--        - prestación del catálogo que no es de la categoría del reporte (o reporte sin categoría) → estado
--          'prestacion_incompatible'.
--      No se llama a route_report, así que report_routing no se pisa con la prestación ajena.
--   2. Último análisis asistencia y el resultado sería borrador_generado → estado 'excluido_asistencia'. El camino
--      'comunicado' (se informa el canal, REP-2801) no cambia.
--   En los tres casos: es_borrador = false, enviado = false, motivo legible, sin fila en report_outreach_logs (su CHECK
--   no admite estos estados y no es una entrega), sin destinatario y sin tocar la categoría del reporte.
--   3. O-03: «Descripción del vecino» → «Descripción del usuario» en el texto del borrador.
--
-- No se tocan route_report (limitación aceptada en REP-3881 O-02), deliver_report_to_test_inbox ni el prompt de
-- analizar-imagen-reporte (ahí «Descripción del vecino» es entrada del modelo).
--
-- Se parchea la definición VIGENTE en tres fragmentos exactos, como REP-3843; si alguno no aparece exactamente una vez,
-- la migración falla entera.
--
-- ROLLBACK: aplicar el mismo patrón al revés sobre la definición vigente:
--   - quitar el bloque «REP-3892 O-01» que queda antes de `v_route := public.route_report(...)`;
--   - quitar el bloque «REP-3892 O-01 asistencia» que queda antes de `v_estado_inf := case v_status`;
--   - 'Descripción del usuario: ' → 'Descripción del vecino: '.
--
-- No se aplica sola: la migración se corre a mano en staging, con aprobación de Matías.

begin;

do $do$
declare
  v_def        text := pg_get_functiondef('public.prepare_organism_delivery(uuid,text,boolean,text)'::regprocedure);
  -- 1) Guardia antes de rutear
  v_route_old  text := $s$  v_route := public.route_report(p_report_id, p_prestacion_key, p_urgente, p_tipo_via);$s$;
  v_route_new  text := $s$  -- REP-3892 O-01: solo se prepara un borrador para un reporte elegible, con una prestación de su categoría
  declare
    v_uid    uuid := auth.uid();
    v_ultimo text;
    v_prest  text := nullif(btrim(coalesce(p_prestacion_key, '')), '');
  begin
    -- Mismo acceso que route_report: a un tercero no se le revela nada del análisis
    if not (coalesce(auth.role(), '') = 'service_role'
            or (v_uid is not null and v_report.user_id = v_uid)
            or (v_uid is not null and public.profile_attends_report(v_uid, p_report_id))) then
      return null;
    end if;

    select a.result_status_code into v_ultimo
      from public.report_ai_analysis a
     where a.report_id = p_report_id
     order by a.created_at desc
     limit 1;

    -- Fuera de alcance (p. ej. delitos) no se deriva: queda En análisis hasta que lo revise una persona (REP-3876)
    if v_ultimo = 'fuera_de_alcance' then
      return jsonb_build_object('estado', 'excluido_fuera_de_alcance', 'es_borrador', false, 'enviado', false,
        'motivo', 'El análisis determinó que el reclamo está fuera de alcance: no se prepara un borrador para un organismo.',
        'entrega_id', null, 'repetido', false);
    end if;

    -- Una prestación del catálogo tiene que ser de la categoría del reporte; la categoría nunca se reescribe
    if v_prest is not null
       and exists (select 1
                     from public.service_attribute_values av
                     join public.service_attributes sa on sa.id = av.attribute_id and sa.attribute_code = 'prestacion'
                    where av.value_key = v_prest)
       and not exists (select 1
                         from public.service_attribute_values av
                         join public.service_attributes sa on sa.id = av.attribute_id and sa.attribute_code = 'prestacion'
                        where av.value_key = v_prest
                          and sa.service_id = v_report.service_id) then
      return jsonb_build_object('estado', 'prestacion_incompatible', 'es_borrador', false, 'enviado', false,
        'motivo', 'La prestación «' || v_prest || '» no corresponde a la categoría del reporte: '
                  || 'no se prepara el borrador y la categoría no cambia.',
        'entrega_id', null, 'repetido', false);
    end if;
  end;

  v_route := public.route_report(p_report_id, p_prestacion_key, p_urgente, p_tipo_via);$s$;
  -- 2) Asistencia: se informa el canal, nunca un borrador institucional
  v_estado_old text := $s$  v_estado_inf := case v_status$s$;
  v_estado_new text := $s$  -- REP-3892 O-01 asistencia: con análisis de asistencia no sale un borrador para un organismo
  if v_status = 'borrador_generado'
     and (select a.result_status_code
            from public.report_ai_analysis a
           where a.report_id = p_report_id
           order by a.created_at desc
           limit 1) = 'asistencia' then
    return jsonb_build_object('estado', 'excluido_asistencia', 'es_borrador', false, 'enviado', false,
      'motivo', 'El reclamo corresponde a asistencia social: se informa el canal al usuario y no se prepara un borrador '
                || 'para un organismo.',
      'entrega_id', null, 'repetido', false);
  end if;

  v_estado_inf := case v_status$s$;
  -- 3) O-03: etiqueta inclusiva
  v_desc_old   text := $s$'Descripción del vecino: '$s$;
  v_desc_new   text := $s$'Descripción del usuario: '$s$;
begin
  -- Cada fragmento tiene que aparecer exactamente una vez; si no, no se toca nada
  if (length(v_def) - length(replace(v_def, v_route_old, ''))) / length(v_route_old) <> 1
     or (length(v_def) - length(replace(v_def, v_estado_old, ''))) / length(v_estado_old) <> 1
     or (length(v_def) - length(replace(v_def, v_desc_old, ''))) / length(v_desc_old) <> 1 then
    raise exception 'REP-3892: prepare_organism_delivery no tiene los fragmentos esperados; revisar a mano.';
  end if;
  execute replace(replace(replace(v_def, v_route_old, v_route_new), v_estado_old, v_estado_new), v_desc_old, v_desc_new);
end
$do$;

commit;
