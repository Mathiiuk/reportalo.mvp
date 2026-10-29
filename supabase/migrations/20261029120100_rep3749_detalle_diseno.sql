-- =====================================================================================================================
-- REP-3749 · Detalle con el diseño de Iván (29/10). No cambia ninguna regla: misma regla de atención y misma
-- proyección (descripción redactada, sin identidad ni user_id).
--
-- get_panel_report_detail suma:
--   - el tipo de vía (address_road_type, REP-3843) para la ubicación;
--   - en el historial, el tipo de actor y el organismo, este último solo en acciones de un organismo. Nunca el
--     operador: changed_by no sale.
--
-- Reversión: volver a crear get_panel_report_detail desde 20261028164553_rep3001_acciones_del_operador.sql.
-- =====================================================================================================================

-- Detalle con historial completo para el diseño -----------------------------------------------------------------
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
                                                 'escalated_to',      h.escalated_to) order by h.changed_at, h.id)
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
