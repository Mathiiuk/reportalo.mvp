-- =====================================================================================================================
-- REP-3000 · Bandeja con el diseño de Iván (29/10). No cambia ninguna regla: misma regla de atención
-- (profile_attends_report) y mismos reportes.
--
-- get_panel_inbox suma lo que muestra cada fila del diseño: si este organismo tomó el caso (para «Por tomar» / «En
-- curso»), la fecha de cierre, la calle y la altura, la cantidad de fotos y la primera (miniatura, ya anonimizada).
-- Sigue sin descripción, identidad ni contactos.
--
-- Reversión: volver a crear get_panel_inbox desde 20261028155231_rep3749_detalle_reporte_operador.sql.
-- =====================================================================================================================

-- Bandeja con lo que muestra cada fila --------------------------------------------------------------------------
drop function if exists public.get_panel_inbox();
create function public.get_panel_inbox()
returns table (
  report_id       uuid,
  report_code     text,
  case_number     bigint,
  category        text,
  created_at      timestamptz,
  zone            text,
  state_code      text,
  state_label     text,
  address_street  text,
  address_number  text,
  taken           boolean,
  closed_at       timestamptz,
  image_count     integer,
  first_image_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id,
         '#RP-' || upper(substr(r.id::text, 1, 8)),  -- mismo código que el borrador (REP-2801)
         r.case_number,
         s.service_name,
         r.created_at,
         l.name,
         r.current_state_code,
         st.description,
         r.address_street,
         r.address_number,
         -- Tomado por el organismo de quien mira (REP-3001)
         exists (select 1 from report_events e
                   join profiles p on p.id = auth.uid()
                  where e.report_id = r.id
                    and e.actor_agency_id = p.agency_id
                    and e.event_type_code = 'TOMADO_POR_ORGANISMO'),
         -- Fecha del cierre (Resuelto o Desestimado)
         case when r.current_state_code in ('RESUELTO', 'DESESTIMADO') then
           (select max(h.changed_at) from report_state_history h
             where h.report_id = r.id and h.state_code = r.current_state_code)
         end,
         (select count(*)::integer from report_images i where i.report_id = r.id),
         -- Foto ya anonimizada (la original no se guarda); se firma con la regla de storage de REP-3747
         (select i.image_url from report_images i where i.report_id = r.id order by i.created_at limit 1)
    from citizen_reports r
    left join services s       on s.id = r.service_id
    left join localities l     on l.id = r.locality_id
    left join report_states st on st.code = r.current_state_code
   where public.profile_attends_report(auth.uid(), r.id)
   order by r.created_at desc;
$$;

revoke execute on function public.get_panel_inbox() from public, anon;
grant  execute on function public.get_panel_inbox() to authenticated;
