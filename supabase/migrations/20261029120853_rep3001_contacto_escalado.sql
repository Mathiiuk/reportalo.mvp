-- =====================================================================================================================
-- REP-3001 · Contacto opcional del destino del escalado (diseño de Iván 29/10; decisión 3A de Matías; viabilidad de
-- Hernán §2: «a quién + contacto + por qué»). Ninguna otra regla cambia.
--
--   1. report_state_history.escalated_contact: correo, teléfono o web del destino, en texto libre. Solo en ESCALADO.
--      Lo carga el operador del organismo de prueba; no es dato del vecino. El vecino lo ve junto al destino.
--   2. change_report_state suma p_escalated_contact (opcional). Misma validación que en 20261028164553.
--   3. get_panel_report_detail suma el contacto en el historial.
--
-- APLICADA en staging el 29/10/2026 con el OK de Matías (versión registrada 20261029120853; el archivo se renombró para
-- coincidir). Verificación después de aplicar, con sesiones simuladas y ROLLBACK: 14/14.
--
-- Reversión: volver a crear change_report_state(uuid, text, text, text) desde 20261028164553, get_panel_report_detail
-- desde la migración del detalle de REP-3749, y borrar la columna escalated_contact.
-- =====================================================================================================================

-- 1. Contacto del destino del escalado -----------------------------------------------------------------------------
alter table public.report_state_history add column if not exists escalated_contact text;
comment on column public.report_state_history.escalated_contact is
  'REP-3001 (Iván 29/10, Hernán viabilidad §2): contacto opcional del destino del escalado. Solo en ESCALADO.';

-- 2. change_report_state con contacto opcional -----------------------------------------------------------------------
drop function if exists public.change_report_state(uuid, text, text, text);

create or replace function public.change_report_state(
  p_report_id uuid, p_to_state text, p_reason text default null, p_escalated_to text default null,
  p_escalated_contact text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_is_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_report     public.citizen_reports%rowtype;
  v_actor      text;
  v_agency     uuid;
  v_trans      public.report_state_transitions%rowtype;
  v_reason     text := nullif(btrim(coalesce(p_reason, '')), '');
  v_target     text := nullif(btrim(coalesce(p_escalated_to, '')), '');
  v_contact    text := nullif(btrim(coalesce(p_escalated_contact, '')), '');
  v_at         timestamptz := clock_timestamp();
  v_code       text;
  v_detail     text;
begin
  select * into v_report from public.citizen_reports where id = p_report_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'reporte_inexistente',
                              'detail', 'El reporte no existe.');
  end if;

  if v_is_service then
    v_actor := 'sistema';
  elsif v_uid is not null and public.profile_attends_report(v_uid, p_report_id) then
    v_actor := 'organismo';
    select p.agency_id into v_agency from public.profiles p where p.id = v_uid;
  elsif v_uid is not null and v_report.user_id = v_uid then
    v_actor := 'ciudadano';
  else
    v_actor := 'desconocido';
  end if;

  if v_actor not in ('sistema', 'organismo') then
    v_code := 'sin_permiso';
    v_detail := 'Quien intenta el cambio no es el sistema ni un organismo que atienda este reporte.';
  elsif not exists (select 1 from public.report_states s where s.code = p_to_state) then
    v_code := 'estado_inexistente';
    v_detail := 'El estado «' || coalesce(p_to_state, 'NULL') || '» no existe.';
  elsif p_to_state = v_report.current_state_code then
    v_code := 'mismo_estado';
    v_detail := 'El reporte ya está en ese estado.';
  else
    select * into v_trans
      from public.report_state_transitions t
     where t.from_state_code = v_report.current_state_code
       and t.to_state_code = p_to_state
       and t.actor_type = v_actor;
    if not found then
      v_code := 'transicion_no_definida';
      v_detail := 'No hay una transición aprobada de «' || v_report.current_state_code || '» a «' || p_to_state
                  || '» para ' || v_actor || '.';
    elsif v_actor = 'organismo' and v_reason is null then
      v_code := 'motivo_requerido';
      v_detail := 'Un cambio de estado de un organismo debe indicar el motivo.';
    elsif v_actor = 'organismo' and p_to_state = 'ESCALADO' and v_target is null then
      v_code := 'destino_requerido';
      v_detail := 'Un escalado debe indicar a qué organismo o área corresponde.';
    end if;
  end if;

  if v_code is not null then
    insert into public.report_state_change_rejections
      (report_id, attempted_state, current_state_code, actor_type, actor_profile_id, reason_code, detail)
    values (p_report_id, p_to_state, v_report.current_state_code, v_actor, v_uid, v_code, v_detail);

    return jsonb_build_object('ok', false, 'code', v_code, 'detail', v_detail,
                              'current_state', v_report.current_state_code);
  end if;

  update public.citizen_reports
     set current_state_code = p_to_state,
         updated_at = now()
   where id = p_report_id;

  insert into public.report_state_history
    (report_id, state_code, previous_state_code, changed_by, actor_agency_id, actor_type, event_code, notes,
     escalated_to, escalated_contact, changed_at)
  values
    (p_report_id, p_to_state, v_report.current_state_code,
     case when v_actor = 'organismo' then v_uid end, v_agency, v_actor, v_trans.event_code, v_reason,
     case when p_to_state = 'ESCALADO' then v_target end,
     case when p_to_state = 'ESCALADO' then v_contact end, v_at);

  return jsonb_build_object('ok', true, 'previous_state', v_report.current_state_code, 'state', p_to_state,
                            'event', v_trans.event_code, 'actor_type', v_actor, 'changed_at', v_at);
end;
$$;

revoke execute on function public.change_report_state(uuid, text, text, text, text) from public, anon;
grant  execute on function public.change_report_state(uuid, text, text, text, text) to authenticated, service_role;

-- 3. Detalle con el contacto del escalado en el historial -----------------------------------------------------------------
create or replace function public.get_panel_report_detail(p_report_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_foundation jsonb;   -- fundamento (la función ya controla el acceso)
  v_agency     uuid;
  v_detalle    jsonb;
begin
  -- Ajeno, ciudadano o inexistente: null, sin decir cuál de los tres (caso 5 de las reglas)
  if auth.uid() is null or not public.profile_attends_report(auth.uid(), p_report_id) then
    return null;
  end if;

  select p.agency_id into v_agency from public.profiles p where p.id = auth.uid();
  v_foundation := public.get_report_legal_foundation(p_report_id);

  -- Cada cita con el tipo de su fragmento (la sanción se muestra con la leyenda del PO)
  if v_foundation ? 'citations' then
    v_foundation := jsonb_set(v_foundation, '{citations}', coalesce((
      select jsonb_agg(c || jsonb_build_object('foundation_type', kf.foundation_type_code) order by ord)
        from jsonb_array_elements(v_foundation -> 'citations') with ordinality as e(c, ord)
        left join knowledge_fragments kf on kf.id = nullif(c ->> 'fragment_id', '')::uuid
    ), '[]'::jsonb));
  end if;

  select jsonb_build_object(
           'report_id',      r.id,
           'report_code',    '#RP-' || upper(substr(r.id::text, 1, 8)),
           'case_number',    r.case_number,
           'created_at',     r.created_at,
           'category',       s.service_name,
           'state_code',     r.current_state_code,
           'state_label',    st.description,
           'description',    public.redact_contact_info(r.description),   -- sin correos ni teléfonos (REP-3874)
           'locality',       l.name,
           'subdivision',    sd.name,
           'latitud',        r.latitud,
           'longitud',       r.longitud,
           'address_street', r.address_street,
           'address_number', r.address_number,
           'address_road_type', r.address_road_type,
           -- Fotos ya anonimizadas (la original no se guarda); se firman con la regla de storage de REP-3747
           'images',         coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'image_url', i.image_url) order by i.created_at)
                                         from report_images i where i.report_id = r.id), '[]'::jsonb),
           'foundation',     v_foundation,
           -- REP-3001: lo que el operador puede hacer ahora sale del catálogo; un cerrado no tiene salidas
           'actions',        coalesce((select jsonb_agg(t.to_state_code order by t.to_state_code)
                                         from report_state_transitions t
                                        where t.from_state_code = r.current_state_code
                                          and t.actor_type = 'organismo'), '[]'::jsonb),
           'taken',          (select jsonb_build_object('taken_at', e.occurred_at, 'agency', a.name)
                                from report_events e
                                join agencies a on a.id = e.actor_agency_id
                               where e.report_id = r.id
                                 and e.actor_agency_id = v_agency
                                 and e.event_type_code = 'TOMADO_POR_ORGANISMO'),
           -- El organismo aparece solo en acciones de un organismo; nunca el operador (changed_by no sale)
           'history',        coalesce((select jsonb_agg(jsonb_build_object(
                                                 'state_code',        h.state_code,
                                                 'state_label',       hs.description,
                                                 'changed_at',        h.changed_at,
                                                 'notes',             h.notes,
                                                 'actor_type',        h.actor_type,
                                                 'agency',            case when h.actor_type = 'organismo' then ha.name end,
                                                 'escalated_to',      h.escalated_to,
                                                 'escalated_contact', h.escalated_contact) order by h.changed_at, h.id)
                                         from report_state_history h
                                         left join report_states hs on hs.code = h.state_code
                                         left join agencies ha      on ha.id = h.actor_agency_id
                                        where h.report_id = r.id), '[]'::jsonb))
    into v_detalle
    from citizen_reports r
    left join services s       on s.id = r.service_id
    left join localities l     on l.id = r.locality_id
    left join subdivisions sd  on sd.id = l.subdivision_id
    left join report_states st on st.code = r.current_state_code
   where r.id = p_report_id;

  return v_detalle;
end;
$$;
