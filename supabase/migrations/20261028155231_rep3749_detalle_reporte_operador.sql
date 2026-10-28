-- REP-3749 — Detalle del reporte para el operador del organismo de prueba (Sprint 18)
--
-- Fuente funcional: reglas del panel v1.0 (REP-3876) §7 (qué ve y qué nunca ve el operador), §8 (calle y altura) y §9
-- caso 5 (reporte ajeno); Hernán 24/10/2026 (D4: número de caso; sanciones con leyenda); PM 25/10 (se mantienen las
-- coordenadas).
--
-- Estado previo (verificado en staging el 28/10/2026):
--   * El operador no lee citizen_reports (REP-3747): el detalle necesita una lectura propia.
--   * get_report_legal_foundation (DEFINER, ya controla quién accede) devuelve las citas SIN el tipo de fragmento;
--     las sanciones son citas de tipo «sancion» (191 citas en 134 reportes).
--   * No existe un número de caso legible ni ningún dato de urgencia (no se muestra: «solo si consta»).
--
-- Cambios:
--   1. citizen_reports.case_number: correlativo generado por la base (los reportes existentes se numeran solos).
--   2. get_panel_inbox suma case_number (cambia el tipo de retorno: se recrea).
--   3. get_panel_report_detail(id): para quien atiende el reporte (profile_attends_report), un JSON con proyección
--      explícita: código, número de caso, fecha, categoría, estado, descripción REDACTADA (REP-3874), localidad,
--      coordenadas, calle y altura (REP-3843), rutas de las fotos anonimizadas y el fundamento con el tipo de cada
--      cita. Nunca user_id, client_side_id ni la descripción original. Para cualquier otro (ajeno, ciudadano,
--      inexistente) devuelve null, sin distinguir los casos.
--
-- ROLLBACK:
--   `drop function public.get_panel_report_detail(uuid);`
--   get_panel_inbox: versión de 20261025142623_rep3000_bandeja_organismo_prueba.sql
--   `alter table public.citizen_reports drop column case_number;`
--
-- No se aplica sola: la migración se corre a mano en staging.
--
-- APLICADA en la base Reportalo el 28/10/2026, con aprobación de Matías. Versión registrada 20261028155231; el archivo
-- se renombró para coincidir. Verificado con sesiones simuladas: todos los reportes con número de caso; el operador de
-- CABA recibe solo las claves del contrato (sin user_id ni client_side_id), con dirección, fotos y fundamento; ajeno,
-- ciudadano e inexistente → null; anon no ejecuta el detalle ni la bandeja.
--
-- Usa address_street / address_number de REP-3843 (migración 20261025160631, ya aplicada en staging).

begin;

-- 1) Número de caso ------------------------------------------------------------------------------------------------
alter table public.citizen_reports
  add column if not exists case_number bigint generated always as identity;

create unique index if not exists citizen_reports_case_number_uq on public.citizen_reports (case_number);

comment on column public.citizen_reports.case_number is
  'REP-3749 (Hernán D4): número de caso legible, lo asigna Reportalo al crear el reporte.';

-- 2) Bandeja con número de caso ------------------------------------------------------------------------------------
drop function if exists public.get_panel_inbox();
create function public.get_panel_inbox()
returns table (
  report_id   uuid,
  report_code text,
  case_number bigint,
  category    text,
  created_at  timestamptz,
  zone        text,
  state_code  text,
  state_label text
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
         st.description
    from citizen_reports r
    left join services s       on s.id = r.service_id
    left join localities l     on l.id = r.locality_id
    left join report_states st on st.code = r.current_state_code
   where public.profile_attends_report(auth.uid(), r.id)
   order by r.created_at desc;
$$;

revoke execute on function public.get_panel_inbox() from public, anon;
grant  execute on function public.get_panel_inbox() to authenticated;

-- 3) Detalle para quien atiende el reporte -------------------------------------------------------------------------
create or replace function public.get_panel_report_detail(p_report_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_foundation jsonb;   -- fundamento (la función ya controla el acceso)
  v_detalle    jsonb;
begin
  -- Ajeno, ciudadano o inexistente: null, sin decir cuál de los tres (caso 5 de las reglas)
  if auth.uid() is null or not public.profile_attends_report(auth.uid(), p_report_id) then
    return null;
  end if;

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
           'foundation',     v_foundation)
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

revoke execute on function public.get_panel_report_detail(uuid) from public, anon;
grant  execute on function public.get_panel_report_detail(uuid) to authenticated;

commit;
