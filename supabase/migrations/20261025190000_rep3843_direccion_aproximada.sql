-- REP-3843 — Dirección aproximada (calle y altura) con visibilidad por rol (Sprint 18)
--
-- Propuesta técnica: docs/REP-3843_propuesta_tecnica.md. Regla de visibilidad: REP-3876 §8 (Hernán, 24/10/2026):
-- autor y operador ven calle y altura; un tercero en el mapa, zona y calle sin altura.
--
-- Estado previo (verificado en staging el 25/10/2026): citizen_reports no tenía columnas de dirección; el borrador
-- (REP-2801) armaba «Ubicación» con localidad y coordenadas; route_report aceptaba p_tipo_via (R-4) pero nadie lo
-- pasaba.
--
-- Cambios:
--   1. citizen_reports: address_street, address_number (solo número de puerta), address_road_type (avenida /
--      secundaria, el vocabulario de route_report) y address_source (sugerida por Nominatim / corregida por el vecino).
--      Todas opcionales: sin dirección el reporte se envía igual. No se rellenan reportes viejos (PM 25/10).
--   2. public_citizen_reports suma SOLO address_street al final (la altura nunca entra en la vista: es la frontera de
--      privacidad para terceros). Se conserva la descripción redactada de REP-3874.
--   3. route_report: si no recibe tipo de vía, usa el guardado en el reporte. Sin dato sigue igual: no hay ruteo
--      inequívoco inventado.
--   4. prepare_organism_delivery: la sección «Ubicación» del borrador suma la dirección aproximada o «Dirección no
--      disponible». Se parchea la definición VIGENTE en la base (difiere de la de 20261015120000 en el repo) en dos
--      fragmentos exactos; si alguno no aparece exactamente una vez, la migración falla entera.
--
-- ROLLBACK:
--   `alter table public.citizen_reports drop column address_street, drop column address_number,
--    drop column address_road_type, drop column address_source;` (antes, la vista sin address_street: 20261025131830)
--   route_report: versión vigente previa (sin v_via). prepare_organism_delivery: quitar el elemento 'direccion' y la
--   línea de dirección del texto.
--
-- No se aplica sola: la migración se corre a mano en staging.

begin;

-- 1) Dirección aproximada del reporte -----------------------------------------------------------------------------
alter table public.citizen_reports
  add column if not exists address_street    text,
  add column if not exists address_number    text,
  add column if not exists address_road_type text,
  add column if not exists address_source    text;

alter table public.citizen_reports drop constraint if exists citizen_reports_address_check;
alter table public.citizen_reports add constraint citizen_reports_address_check check (
  (address_street is null or char_length(btrim(address_street)) between 1 and 120)
  and (address_number is null or address_number ~ '^\d{1,5}[A-Za-z]?$')       -- solo número de puerta
  and (address_road_type is null or address_road_type in ('avenida', 'secundaria'))
  and (address_source is null or address_source in ('sugerida', 'corregida'))
  and (address_street is not null or (address_number is null and address_road_type is null))  -- sin calle no hay altura
);

comment on column public.citizen_reports.address_street is
  'REP-3843: calle aproximada (Nominatim/OSM, corregible por el vecino). Visible para terceros (sin altura).';
comment on column public.citizen_reports.address_number is
  'REP-3843: altura. Solo autor y operador (REP-3876 §8); nunca en public_citizen_reports.';

-- 2) Vista pública: suma la calle, nunca la altura ---------------------------------------------------------------
create or replace view public.public_citizen_reports
with (security_barrier = true)
as
select
  r.id,
  r.service_id,
  r.locality_id,
  public.redact_contact_info(r.description) as description,
  r.current_state_code,
  r.latitud,
  r.longitud,
  r.created_at,
  r.updated_at,
  r.address_street
from public.citizen_reports r;

comment on view public.public_citizen_reports is
  'REP-3849 + REP-3874 + REP-3843: resumen público, sin user_id ni client_side_id, con la descripción sin contactos y la calle sin altura. Agregar una columna acá es publicarla.';

revoke all on public.public_citizen_reports from public, anon, authenticated;
grant select on public.public_citizen_reports to authenticated;

-- 3) route_report: tipo de vía guardado como respaldo (R-4) ------------------------------------------------------
create or replace function public.route_report(
  p_report_id       uuid,
  p_prestacion_key  text    default null,
  p_urgente         boolean default false,
  p_tipo_via        text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_report    public.citizen_reports%rowtype;
  v_prest     text;
  v_via       text;      -- REP-3843: el pasado por parámetro o el guardado en el reporte
  v_input     jsonb;
  v_hash      text;
  v_version   text := public.routing_catalog_version();
  v_prev      public.report_routing%rowtype;
  v_result    jsonb;
  v_found     text;
begin
  select * into v_report from public.citizen_reports where id = p_report_id;
  if not found then
    return null;
  end if;

  if not (coalesce(auth.role(), '') = 'service_role'
          or (v_uid is not null and v_report.user_id = v_uid)
          or (v_uid is not null and public.profile_attends_report(v_uid, p_report_id))) then
    return null;
  end if;

  v_prest := coalesce(
    nullif(btrim(p_prestacion_key), ''),
    (select r.selected_value
       from public.infraction_attribute_responses r
       join public.service_attributes sa on sa.id = r.attribute_id and sa.attribute_code = 'prestacion'
      where r.report_id = p_report_id
      limit 1));

  -- REP-3843: sin tipo de vía explícito, el de la dirección aproximada del reporte (si existe)
  v_via := coalesce(nullif(lower(btrim(coalesce(p_tipo_via, ''))), ''), v_report.address_road_type);

  v_input := jsonb_build_object(
    'locality_id', v_report.locality_id,
    'prestacion', v_prest,
    'urgente', coalesce(p_urgente, false),
    'tipo_via', v_via);
  v_hash := md5(v_input::text);

  select * into v_prev from public.report_routing where report_id = p_report_id;
  if found and v_prev.input_hash = v_hash and v_prev.catalog_version = v_version then
    return v_prev.result;
  end if;

  v_result := public._routing_without_test_channel(
    public.resolve_report_destination(v_report.locality_id, v_prest, coalesce(p_urgente, false), v_via));

  v_found := null;
  if to_regprocedure('public.get_report_legal_foundation(uuid)') is not null then
    execute 'select public.get_report_legal_foundation($1) ->> ''status''' into v_found using p_report_id;
  end if;
  v_result := v_result || jsonb_build_object(
    'report_id', p_report_id,
    'fundamento_status', v_found,
    'falta', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                select jsonb_array_elements_text(v_result -> 'falta') x
                union all
                select 'fundamento' where v_found = 'sin_fundamento_verificado') u));

  insert into public.report_routing (report_id, catalog_version, input, input_hash, criterio, sin_destino_verificado, result)
  values (p_report_id, v_version, v_input, v_hash, v_result ->> 'criterio',
          (v_result ->> 'sin_destino_verificado')::boolean, v_result)
  on conflict (report_id) do update
     set catalog_version = excluded.catalog_version, input = excluded.input, input_hash = excluded.input_hash,
         criterio = excluded.criterio, sin_destino_verificado = excluded.sin_destino_verificado,
         result = excluded.result, updated_at = now();

  return v_result;
end;
$$;

-- 4) Borrador institucional: dirección en «Ubicación» (parche sobre la definición vigente) ------------------------
do $do$
declare
  v_def      text := pg_get_functiondef('public.prepare_organism_delivery(uuid,text,boolean,text)'::regprocedure);
  v_json_old text := $s$'mapa', 'https://www.google.com/maps?q='$s$;
  v_json_new text := $s$'direccion', case when v_report.address_street is null then null
                     else concat_ws(' ', v_report.address_street, v_report.address_number) end,
      'mapa', 'https://www.google.com/maps?q='$s$;
  v_txt_old  text := $s$'Mapa: ' || (v_payload -> 'ubicacion' ->> 'mapa'),$s$;
  v_txt_new  text := $s$case when v_report.address_street is null then 'Dirección no disponible'
         else 'Dirección aproximada: ' || concat_ws(' ', v_report.address_street, v_report.address_number) end,
    'Mapa: ' || (v_payload -> 'ubicacion' ->> 'mapa'),$s$;
begin
  -- Cada fragmento tiene que aparecer exactamente una vez; si no, no se toca nada
  if (length(v_def) - length(replace(v_def, v_json_old, ''))) / length(v_json_old) <> 1
     or (length(v_def) - length(replace(v_def, v_txt_old, ''))) / length(v_txt_old) <> 1 then
    raise exception 'REP-3843: prepare_organism_delivery no tiene los fragmentos esperados; revisar a mano.';
  end if;
  execute replace(replace(v_def, v_json_old, v_json_new), v_txt_old, v_txt_new);
end
$do$;

commit;
