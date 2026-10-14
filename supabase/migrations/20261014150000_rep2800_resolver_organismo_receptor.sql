-- REP-2800 — Resolver el organismo receptor de un reporte por prestación y jurisdicción (Sprint 16)
--
-- Motor de routing DETERMINÍSTICO. El destino sale SIEMPRE del catálogo aprobado por el PO en REP-2806
-- (organismos, canales y competencias cargados en agencies / agency_contacts / agency_services). No consulta al
-- RAG, ni a un LLM, ni a Internet, y no envía nada: el MVP trabaja en «solo borrador» (decisión del PO, 14/10/2026).
--
-- QUÉ AGREGA (sin tablas de catálogo nuevas: el modelo ya tenía agencies, agency_contacts y agency_services)
--   agency_contacts : label, source_url, verified_at, is_approved, is_emergency, test_value
--   agency_services : attribute_value_id (prestación), route_role, road_scope, channel_detail
--   agencies        : el nombre deja de ser único solo; pasa a serlo por (nombre, subdivisión). Los organismos de toda
--                     la Ciudad se cargan UNA FILA POR COMUNA (opción A del PO) para no tocar el RLS por subdivisión.
--   report_routing  : única tabla nueva. Guarda el resultado de cada reporte con versión de catálogo, regla y entrada
--                     (trazabilidad y repetibilidad: misma entrada + mismo catálogo = mismo destino, sin duplicar filas).
--
-- FUNCIONES
--   resolve_report_destination(locality, prestacion, urgente, tipo_via) -> jsonb   pura, sin efectos (fixtures de QA)
--   route_report(report, prestacion, urgente, tipo_via)                 -> jsonb   resuelve y persiste (idempotente)
--
-- CRITERIOS (campo `criterio`, mapeados a las reglas R-1..R-8 de REP-2806)
--   regla_inequivoca     R-1  un solo organismo y canal aprobados
--   precedencia_urgencia R-4  inundación/derrame/emergencia vial: primero el canal de guardia
--   precedencia_legal    R-4  calle secundaria -> Comuna, avenida -> Ministerio (Ley 1777 art. 10 inc. a)
--   no_resuelto          R-4  hay más de un candidato y no alcanza la regla: se muestran todos, no se elige
--   sin_destino          R-2/R-3/R-5  sin prestación, sin canal aprobado o fuera del piloto: no se asigna destinatario
--
-- Es SECURITY DEFINER a propósito porque agency_contacts no tiene política de lectura (P-04: solo el servidor), pero
-- la función solo devuelve canales APROBADOS y quien llama debe ser el autor, quien atiende el reporte o el servidor.
-- Las dos funciones quedan sin EXECUTE para anon/public.
-- No se aplica sola: la migración se corre a mano en staging, y después el script de carga del catálogo
-- (supabase/catalogo/rep2800_carga_catalogo_destinos.sql).

begin;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Organismos: el nombre se repite entre comunas (Ministerio, Secretaría de Tránsito, APRA, AGC...)
-- ---------------------------------------------------------------------------------------------------------------
alter table public.agencies add column if not exists parent_agency_id uuid references public.agencies(id);
alter table public.agencies drop constraint if exists agencies_name_key;
alter table public.agencies drop constraint if exists agencies_name_subdivision_key;
alter table public.agencies add constraint agencies_name_subdivision_key unique (name, subdivision_id);

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Canales: fuente oficial, vigencia y aprobación. Un canal sin aprobar o sin verificar NUNCA se devuelve.
-- ---------------------------------------------------------------------------------------------------------------
alter table public.agency_contacts
  add column if not exists label        text,
  add column if not exists source_url   text,
  add column if not exists verified_at  date,
  add column if not exists is_approved  boolean not null default false,
  add column if not exists is_emergency boolean not null default false,
  add column if not exists test_value   text;

alter table public.agency_contacts drop constraint if exists agency_contacts_channel_check;
alter table public.agency_contacts add constraint agency_contacts_channel_check
  check (contact_channel in ('web', 'telefono', 'email', 'whatsapp', 'tramite'));

comment on column public.agency_contacts.is_approved  is 'REP-2806: el PO aprobó el canal. Sin aprobar no se devuelve en el routing.';
comment on column public.agency_contacts.is_emergency is 'Canal de guardia (103, Defensa Civil...). Solo se ofrece si la prestación lo habilita con route_role = urgencia.';
comment on column public.agency_contacts.test_value   is 'Dirección de prueba asociada al contacto (REP-2801). Solo la ve el servidor; nunca reemplaza al canal verificado.';

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Organismo <-> prestación. La PK (agency_id, service_id) impedía varias prestaciones por categoría.
-- ---------------------------------------------------------------------------------------------------------------
alter table public.agency_services
  add column if not exists attribute_value_id uuid references public.service_attribute_values(id),
  add column if not exists route_role         text not null default 'principal',
  add column if not exists road_scope         text,
  add column if not exists channel_detail     text;

alter table public.agency_services drop constraint if exists agency_services_route_role_check;
alter table public.agency_services add constraint agency_services_route_role_check
  check (route_role in ('principal', 'urgencia', 'general'));
alter table public.agency_services drop constraint if exists agency_services_road_scope_check;
alter table public.agency_services add constraint agency_services_road_scope_check
  check (road_scope is null or road_scope in ('secundaria', 'avenida'));

alter table public.agency_services drop constraint if exists agency_services_pkey;
create unique index if not exists agency_services_uq
  on public.agency_services (agency_id, service_id,
                             coalesce(attribute_value_id, '00000000-0000-0000-0000-000000000000'::uuid),
                             route_role, coalesce(road_scope, ''));
create index if not exists agency_services_attribute_value_idx on public.agency_services (attribute_value_id);

comment on column public.agency_services.route_role is 'principal = destino de la prestación · urgencia = habilita el canal de guardia (R-4) · general = organismo/canal general de la jurisdicción (R-2).';
comment on column public.agency_services.road_scope is 'CABA: secundaria -> Comuna, avenida -> Ministerio (Ley 1777 art. 10 inc. a). Nulo = no depende de la vía.';

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Resultado persistido (trazabilidad + repetibilidad)
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.report_routing (
  report_id              uuid primary key references public.citizen_reports(id) on delete cascade,
  catalog_version        text        not null,
  input                  jsonb       not null,
  input_hash             text        not null,
  criterio               text        not null,
  sin_destino_verificado boolean     not null,
  result                 jsonb       not null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
alter table public.report_routing enable row level security;

-- Lectura: el autor y quien atiende el reporte (misma regla que report_ai_analysis). Nadie escribe desde el cliente.
drop policy if exists "read own or attended" on public.report_routing;
create policy "read own or attended" on public.report_routing
  for select to authenticated
  using (
    exists (select 1 from public.citizen_reports r
             where r.id = report_routing.report_id and r.user_id = (select auth.uid()))
    or public.profile_attends_report((select auth.uid()), report_id)
  );
revoke all on public.report_routing from anon, public;
grant select on public.report_routing to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Versión del catálogo. Se sube a mano cada vez que se vuelve a cargar la matriz (cada sprint).
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.routing_catalog_version()
returns text
language sql
immutable
set search_path = public
as $$ select 'REP-2806 v1.2'::text $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Motor puro: no escribe nada, no mira al RAG
-- ---------------------------------------------------------------------------------------------------------------

-- Auxiliar interna: arma los candidatos (organismo + canal) de una jurisdicción y prestación, ya ordenados.
--   rol 'urgencia'  -> canales de guardia (is_emergency) del organismo habilitado para la prestación (solo si hay urgencia)
--   rol 'principal' -> canales administrativos aprobados (no de guardia)
--   rol 'general'   -> organismo/canal general de la jurisdicción (R-2)
-- Solo canales aprobados y verificados. El orden es total (nombre, id), nunca depende del azar.
create or replace function public._routing_candidates(
  p_subdivision_id uuid,
  p_attribute_value_id uuid,
  p_general boolean,
  p_urgente boolean,
  p_tipo_via text,
  p_server boolean
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with filas as (
    select distinct s.route_role, s.road_scope, s.channel_detail, a.id agency_id, a.name agency_name, pa.name parent_name
      from public.agency_services s
      join public.agencies a on a.id = s.agency_id
      left join public.agencies pa on pa.id = a.parent_agency_id
     where a.subdivision_id = p_subdivision_id
       and ((p_general and s.route_role = 'general')
         or (not p_general and s.attribute_value_id = p_attribute_value_id and s.route_role in ('principal', 'urgencia')))
  ),
  scoped as (select coalesce(bool_or(road_scope is not null) filter (where route_role = 'principal'), false) v from filas),
  -- Regla de vía: si el catálogo distingue por jerarquía de la calle y la vía es conocida, se descarta la otra
  vigentes as (
    select f.* from filas f, scoped sc
     where not (f.route_role = 'principal' and f.road_scope is not null and sc.v
                and coalesce(p_tipo_via, '') in ('secundaria', 'avenida') and f.road_scope <> p_tipo_via)
  ),
  numeradas as (
    select jsonb_build_object(
             'orden', row_number() over (order by (f.route_role = 'urgencia') desc, f.agency_name, f.agency_id,
                                                  k.is_primary desc, k.contact_channel, k.contact_value, k.id),
             'rol', f.route_role,
             'organismo', jsonb_build_object('id', f.agency_id, 'nombre', f.agency_name, 'organismo_padre', f.parent_name),
             'canal', jsonb_build_object('tipo', k.contact_channel, 'valor', k.contact_value,
                                         'etiqueta', concat_ws(' › ', k.label, f.channel_detail),
                                         'principal', k.is_primary, 'urgencia', k.is_emergency),
             'fuente', jsonb_build_object('url', k.source_url, 'verificado_el', k.verified_at),
             'via', f.road_scope,
             'canal_prueba', case when p_server then k.test_value else null end) c
      from vigentes f
      join public.agency_contacts k on k.agency_id = f.agency_id
     where k.is_approved and k.verified_at is not null
       and ((f.route_role = 'urgencia' and k.is_emergency and coalesce(p_urgente, false))
         or (f.route_role <> 'urgencia' and not k.is_emergency))
  )
  select jsonb_build_object(
           'agencias', (select count(distinct agency_id) from vigentes where route_role <> 'urgencia'),
           'scoped', (select v from scoped),
           'candidatos', coalesce((select jsonb_agg(c order by (c ->> 'orden')::int) from numeradas), '[]'::jsonb));
$$;

create or replace function public.resolve_report_destination(
  p_locality_id     uuid,
  p_prestacion_key  text    default null,
  p_urgente         boolean default false,
  p_tipo_via        text    default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_is_server   boolean := coalesce(auth.role(), '') = 'service_role';
  v_sub_id      uuid;
  v_sub_name    text;
  v_state_name  text;
  v_juris       text;
  v_av_id       uuid;
  v_av_name     text;
  v_service     text;
  v_general     boolean := false;
  v_c           jsonb;
  v_candidatos  jsonb;
  v_agencias    integer;
  v_scoped      boolean;
  v_criterio    text;
  v_motivo      text;
  v_falta       text[] := '{}';
  v_top         jsonb;
  v_rest        jsonb;
  v_accion      text;
  v_via         text := nullif(lower(btrim(coalesce(p_tipo_via, ''))), '');
begin
  -- Jurisdicción efectiva: localidad -> subdivisión -> provincia. Avellaneda de Santa Fe NO es el partido de PBA.
  select sd.id, sd.name, sp.name
    into v_sub_id, v_sub_name, v_state_name
    from public.localities l
    join public.subdivisions sd on sd.id = l.subdivision_id
    join public.states_provinces sp on sp.id = sd.state_province_id
   where l.id = p_locality_id;

  v_juris := case
    when v_state_name = 'Ciudad Autónoma de Buenos Aires'            then 'CABA'
    when v_state_name = 'Buenos Aires' and v_sub_name = 'Avellaneda' then 'AVELLANEDA'
    else 'FUERA_DEL_PILOTO'
  end;

  if v_juris = 'FUERA_DEL_PILOTO' then
    return jsonb_build_object(
      'schema_version', 1, 'catalog_version', public.routing_catalog_version(),
      'jurisdiccion', v_juris, 'prestacion', null,
      'organismo_verificado', null, 'canal_verificado', null, 'canales_alternativos', '[]'::jsonb,
      'candidatos', '[]'::jsonb, 'fuente', null,
      'criterio', 'sin_destino', 'regla', 'R-5', 'sin_destino_verificado', true,
      'motivo', case when v_sub_id is null then 'No se pudo determinar la jurisdicción del reporte.'
                     else 'El reporte está fuera del piloto (CABA y Avellaneda).' end,
      'falta', jsonb_build_array('receptor'), 'accion', 'ninguna',
      'requiere_envio', false, 'modo_entrega', 'borrador', 'canal_prueba', null);
  end if;

  -- Prestación (valor del atributo «prestacion»)
  if p_prestacion_key is not null then
    select av.id, av.value_name, s.service_code
      into v_av_id, v_av_name, v_service
      from public.service_attribute_values av
      join public.service_attributes sa on sa.id = av.attribute_id and sa.attribute_code = 'prestacion'
      join public.services s on s.id = sa.service_id
     where av.value_key = p_prestacion_key;
  end if;

  if v_av_id is null then
    -- R-2: no sabemos qué prestación es. Organismo y canal generales, marcado «sin destino verificado».
    v_general := true;
    v_criterio := 'sin_destino';
    v_motivo := case when p_prestacion_key is null
                     then 'No se identificó la prestación: se propone el organismo y el canal generales de la jurisdicción.'
                     else 'La prestación «' || p_prestacion_key || '» no está en el catálogo: se propone el canal general.' end;
  end if;

  v_c := public._routing_candidates(v_sub_id, v_av_id, v_general, coalesce(p_urgente, false), v_via, v_is_server);
  v_candidatos := v_c -> 'candidatos';
  v_agencias   := (v_c ->> 'agencias')::integer;
  v_scoped     := (v_c ->> 'scoped')::boolean;

  if not v_general then
    -- Vía conocida -> manda la ley (precedencia_legal). Vía desconocida -> se muestran los dos candidatos.
    if v_scoped then
      if v_via in ('secundaria', 'avenida') then
        v_criterio := 'precedencia_legal';
      else
        v_criterio := 'no_resuelto';
        v_motivo := 'Comuna o Ministerio de Espacio Público, según la jerarquía de la calle: no se pudo determinar la vía.';
      end if;
    elsif v_agencias > 1 then
      v_criterio := 'no_resuelto';
      v_motivo := 'Hay más de un organismo posible y no hay una regla aprobada que desempate.';
    end if;

    -- Falta de receptor o de contacto: dos condiciones distintas (el fundamento lo informa route_report)
    if v_agencias = 0 then
      v_falta := array_append(v_falta, 'receptor');
    elsif jsonb_array_length(v_candidatos) = 0 then
      v_falta := array_append(v_falta, 'contacto');
    end if;

    -- Urgencia (R-4): primero el canal de guardia, si la prestación lo habilita y hay un canal aprobado
    if coalesce(p_urgente, false)
       and exists (select 1 from jsonb_array_elements(v_candidatos) e where e ->> 'rol' = 'urgencia') then
      v_criterio := 'precedencia_urgencia';
    end if;

    -- Sin receptor o sin canal aprobado: no se asigna destinatario; se ofrece el general (R-3)
    if jsonb_array_length(v_candidatos) = 0 then
      v_general := true;
      v_criterio := 'sin_destino';
      v_motivo := case when v_agencias = 0
                       then 'La prestación no tiene organismo asignado en el catálogo aprobado.'
                       else 'El organismo no tiene un canal aprobado: se propone el canal general de la jurisdicción.' end;
      v_c := public._routing_candidates(v_sub_id, null, true, false, v_via, v_is_server);
      v_candidatos := v_c -> 'candidatos';
    end if;
  end if;

  if v_general and jsonb_array_length(v_candidatos) = 0 and not ('receptor' = any (v_falta)) then
    v_falta := array_append(v_falta, 'receptor');
  end if;

  v_criterio := coalesce(v_criterio, 'regla_inequivoca');

  -- El primer candidato es el destino, salvo que el caso quede sin resolver (se muestran todos, no se elige)
  v_top := case when v_criterio = 'no_resuelto' then null else v_candidatos -> 0 end;
  select coalesce(jsonb_agg(e -> 'canal' order by (e ->> 'orden')::int), '[]'::jsonb)
    into v_rest
    from jsonb_array_elements(v_candidatos) e
   where v_top is not null
     and (e ->> 'orden')::int > 1
     and (e -> 'organismo' ->> 'id') = (v_top -> 'organismo' ->> 'id');

  v_accion := case
    when v_criterio in ('sin_destino', 'no_resuelto') then 'ninguna'
    when v_service = 'VULNERABILIDAD_SOCIAL'          then 'informar_canal'
    else 'preparar_borrador' end;

  return jsonb_build_object(
    'schema_version', 1,
    'catalog_version', public.routing_catalog_version(),
    'jurisdiccion', v_juris,
    'prestacion', case when v_av_id is null then null
                       else jsonb_build_object('clave', p_prestacion_key, 'nombre', v_av_name, 'categoria', v_service) end,
    'organismo_verificado', v_top -> 'organismo',
    'canal_verificado', v_top -> 'canal',
    'canales_alternativos', coalesce(v_rest, '[]'::jsonb),
    'candidatos', v_candidatos,
    'fuente', v_top -> 'fuente',
    'criterio', v_criterio,
    'regla', case v_criterio when 'regla_inequivoca' then 'R-1' when 'sin_destino' then 'R-2' else 'R-4' end,
    'sin_destino_verificado', v_criterio = 'sin_destino',
    'motivo', v_motivo,
    'falta', to_jsonb(v_falta),
    'accion', v_accion,
    'requiere_envio', false,
    'modo_entrega', 'borrador',
    'canal_prueba', v_top ->> 'canal_prueba'
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Routing de un reporte: resuelve, persiste y es repetible
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.route_report(
  p_report_id       uuid,
  p_prestacion_key  text    default null,
  p_urgente         boolean default false,
  p_tipo_via        text    default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_report    public.citizen_reports%rowtype;
  v_prest     text;
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

  -- Quién puede routear/ver el destino: el autor, quien atiende el reporte y el servidor (como REP-2902)
  if not (coalesce(auth.role(), '') = 'service_role'
          or (v_uid is not null and v_report.user_id = v_uid)
          or (v_uid is not null and public.profile_attends_report(v_uid, p_report_id))) then
    return null;
  end if;

  -- Prestación: el parámetro manda; si no viene, la que el vecino eligió en el reporte
  v_prest := coalesce(
    nullif(btrim(p_prestacion_key), ''),
    (select r.selected_value
       from public.infraction_attribute_responses r
       join public.service_attributes sa on sa.id = r.attribute_id and sa.attribute_code = 'prestacion'
      where r.report_id = p_report_id
      limit 1));

  v_input := jsonb_build_object(
    'locality_id', v_report.locality_id,
    'prestacion', v_prest,
    'urgente', coalesce(p_urgente, false),
    'tipo_via', nullif(lower(btrim(coalesce(p_tipo_via, ''))), ''));
  v_hash := md5(v_input::text);

  -- Misma entrada y mismo catálogo: se devuelve lo ya registrado (no se recalcula ni se duplica nada)
  select * into v_prev from public.report_routing where report_id = p_report_id;
  if found and v_prev.input_hash = v_hash and v_prev.catalog_version = v_version then
    return v_prev.result;
  end if;

  v_result := public.resolve_report_destination(v_report.locality_id, v_prest, coalesce(p_urgente, false), p_tipo_via);

  -- Fundamento: informativo. Nunca cambia el receptor ni la clasificación del RAG (D4: sin infracción != sin organismo).
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

-- Permisos: ni anon ni public. Los ejecuta la app (usuario autenticado, con la validación de arriba) y el servidor.
revoke all on function public.routing_catalog_version()                              from public, anon;
revoke all on function public.resolve_report_destination(uuid, text, boolean, text)  from public, anon;
revoke all on function public.route_report(uuid, text, boolean, text)                from public, anon;
revoke all on function public._routing_candidates(uuid, uuid, boolean, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.routing_catalog_version()                              to authenticated, service_role;
grant execute on function public.resolve_report_destination(uuid, text, boolean, text) to authenticated, service_role;
grant execute on function public.route_report(uuid, text, boolean, text)                to authenticated, service_role;

commit;
