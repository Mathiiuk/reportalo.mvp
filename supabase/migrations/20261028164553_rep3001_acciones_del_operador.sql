-- =====================================================================================================================
-- REP-3001 · Acciones del operador del organismo de prueba: tomar, rechazar (escalar, desestimar, discrepancia) y
-- marcar resuelto, con historial append-only y lectura del vecino.
--
-- Fuente: reglas del panel v1.0 (REP-3876, Hernán 24/10) §4, §5, §6 y §9; viabilidad de Hernán §2 (evento
-- TOMADO_POR_ORGANISMO + take_report, índices). Decisión del catálogo: Hernán 24/10 (D-6).
--
--   1. «Tomar el caso» no es un estado: el reporte sigue DERIVADO y queda el evento TOMADO_POR_ORGANISMO (quién y
--      cuándo). Un índice único parcial evita el duplicado por doble clic.
--   2. Catálogo: se quita ESCALADO → EN_DISCREPANCIA (0 usos en staging, verificado el 28/10) y las otras 5 salidas
--      de ESCALADO y EN_DISCREPANCIA pasan de «propuesta de Matías» a aprobadas por el PO. No se borra historial.
--   3. El escalado guarda a quién (texto libre, D-05) en report_state_history.escalated_to. change_report_state lo
--      exige al organismo, igual que el motivo. RESUELTO y DESESTIMADO no tienen salida: no se revierten (D-04).
--   4. Misma etiqueta para el operador y el vecino (§4 y §6): «Derivado» y «Escalado».
--   5. get_panel_report_detail suma las acciones posibles (salen del catálogo), el «tomado» y el historial.
--   6. Índices del historial y de los eventos por reporte.
--
-- APLICADA en staging el 28/10/2026 con el OK de Matías (versión registrada 20261028164553; el archivo se
-- renombró para coincidir). Verificación después de aplicar, con sesiones simuladas y ROLLBACK: 17/17. Ensayada el 28/10 con ROLLBACK y sesiones
-- simuladas (operador CABA, operador Avellaneda, vecino, anon): 20/20. Staging quedó intacta.
-- Reversión: volver a crear change_report_state(uuid, text, text) desde 20261013160000, borrar take_report, la
-- columna escalated_to y el tipo de evento, reinsertar ESCALADO → EN_DISCREPANCIA y las etiquetas anteriores.
-- =====================================================================================================================

-- 1. Evento «tomado» -------------------------------------------------------------------------------------------------
insert into public.report_event_types (code, description)
values ('TOMADO_POR_ORGANISMO', 'Tomado por el organismo')
on conflict (code) do nothing;

-- Un «tomado» por organismo y reporte: el doble clic no duplica
create unique index if not exists report_events_taken_uq
  on public.report_events (report_id, actor_agency_id)
  where event_type_code = 'TOMADO_POR_ORGANISMO';

create or replace function public.take_report(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_agency uuid;
  v_state  text;
  v_at     timestamptz;
begin
  select p.agency_id into v_agency from public.profiles p where p.id = v_uid;
  if v_uid is null or v_agency is null or not public.profile_attends_report(v_uid, p_report_id) then
    return jsonb_build_object('ok', false, 'code', 'sin_permiso',
                              'detail', 'Quien intenta tomar el reporte no es un organismo que lo atienda.');
  end if;

  -- Se bloquea la fila para que un cambio de estado en paralelo no se cruce con el «tomado»
  select r.current_state_code into v_state from public.citizen_reports r where r.id = p_report_id for update;
  if v_state <> 'DERIVADO' then
    return jsonb_build_object('ok', false, 'code', 'estado_no_permite', 'current_state', v_state,
                              'detail', 'Solo se puede tomar un reporte Derivado.');
  end if;

  insert into public.report_events (report_id, event_type_code, actor_profile_id, actor_agency_id)
  values (p_report_id, 'TOMADO_POR_ORGANISMO', v_uid, v_agency)
  on conflict (report_id, actor_agency_id) where event_type_code = 'TOMADO_POR_ORGANISMO' do nothing
  returning occurred_at into v_at;

  if v_at is null then
    select e.occurred_at into v_at
      from public.report_events e
     where e.report_id = p_report_id and e.actor_agency_id = v_agency and e.event_type_code = 'TOMADO_POR_ORGANISMO';
    return jsonb_build_object('ok', true, 'already_taken', true, 'taken_at', v_at);
  end if;

  return jsonb_build_object('ok', true, 'already_taken', false, 'taken_at', v_at);
end;
$$;

revoke execute on function public.take_report(uuid) from public, anon;
grant  execute on function public.take_report(uuid) to authenticated;

-- 2. Catálogo de transiciones (Hernán, 24/10) -----------------------------------------------------------------------
delete from public.report_state_transitions
 where from_state_code = 'ESCALADO' and to_state_code = 'EN_DISCREPANCIA';

update public.report_state_transitions
   set approved_by = 'Hernán Gregorini (PO, REP-3876 §4 / D-6)',
       approved_on = date '2026-10-24',
       notes = 'Salida de ' || from_state_code || ' aprobada por el PO el 24/10, con motivo obligatorio.'
 where from_state_code in ('ESCALADO', 'EN_DISCREPANCIA')
   and actor_type = 'organismo';

-- 3. A quién se escaló ----------------------------------------------------------------------------------------------
alter table public.report_state_history add column if not exists escalated_to text;
comment on column public.report_state_history.escalated_to is
  'REP-3001 (D-05): a qué organismo o área lo pasó el operador, en texto libre. Solo en ESCALADO. No implica un envío real.';

-- La firma cambia (se suma p_escalated_to): se borra la de 3 argumentos para que no queden dos versiones.
-- deliver_report_to_test_inbox la sigue llamando con 3 argumentos y toma el default.
drop function if exists public.change_report_state(uuid, text, text);

create or replace function public.change_report_state(
  p_report_id uuid, p_to_state text, p_reason text default null, p_escalated_to text default null)
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
     escalated_to, changed_at)
  values
    (p_report_id, p_to_state, v_report.current_state_code,
     case when v_actor = 'organismo' then v_uid end, v_agency, v_actor, v_trans.event_code, v_reason,
     case when p_to_state = 'ESCALADO' then v_target end, v_at);

  return jsonb_build_object('ok', true, 'previous_state', v_report.current_state_code, 'state', p_to_state,
                            'event', v_trans.event_code, 'actor_type', v_actor, 'changed_at', v_at);
end;
$$;

revoke execute on function public.change_report_state(uuid, text, text, text) from public, anon;
grant  execute on function public.change_report_state(uuid, text, text, text) to authenticated, service_role;

-- 4. Misma etiqueta para el operador y el vecino (§4 y §6) ---------------------------------------------------------
update public.report_states set description = 'Derivado' where code = 'DERIVADO';
update public.report_states set description = 'Escalado' where code = 'ESCALADO';

-- 5. Detalle del panel con acciones, «tomado» e historial ---------------------------------------------------------
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
           'history',        coalesce((select jsonb_agg(jsonb_build_object(
                                                 'state_code',   h.state_code,
                                                 'state_label',  hs.description,
                                                 'changed_at',   h.changed_at,
                                                 'notes',        h.notes,
                                                 'escalated_to', h.escalated_to) order by h.changed_at, h.id)
                                         from report_state_history h
                                         left join report_states hs on hs.code = h.state_code
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

-- 6. Índices de lectura por reporte ---------------------------------------------------------------------------------
create index if not exists report_state_history_report_changed_idx
  on public.report_state_history (report_id, changed_at desc);
create index if not exists report_events_report_occurred_idx
  on public.report_events (report_id, occurred_at desc);
