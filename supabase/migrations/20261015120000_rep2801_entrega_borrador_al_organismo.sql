-- REP-2801 — Generar el reporte estructurado para el organismo y registrar su entrega (Sprint 16)
--
-- En el MVP la entrega es SOLO BORRADOR (decisión del PO, 14/10/2026): no sale ningún correo a un organismo.
-- Esta migración arma el mensaje (payload + texto) a partir de lo que ya existe y lo REGISTRA con su estado real.
-- Nunca se marca «enviado» por haber generado un borrador.
--
-- QUÉ ARMA (campos de REP-2805, decisiones del PO del 14/10)
--   * reporte, categoría y prestación · ubicación (coordenadas + localidad, SIN identidad del vecino)
--   * descripción filtrada: si trae lenguaje ofensivo, correo, teléfono o enlaces, NO sale: queda «pendiente_revision»
--   * evidencia: referencias a las fotos ANONIMIZADAS del propio reporte (el adjunto lo arma quien envíe, con servidor)
--   * destino: el que resuelve REP-2800 (route_report), con su fuente. Nunca lo elige el RAG
--   * fundamento: norma, artículo, cita textual y fuente (opción C, REP-2902). El resumen técnico de la IA NO viaja
--
-- ESTADOS DE LA ENTREGA (report_outreach_logs.delivery_status)
--   borrador_generado     hay destino aprobado y el mensaje está listo; NO se envió
--   pendiente_sin_canal   sin destino o canal aprobado, o caso sin resolver (se dice el motivo)
--   pendiente_revision    la descripción necesita revisión humana antes de salir
--   comunicado            vulnerabilidad social: se informa el canal al vecino, no se deriva (PO, 14/10)
--   enviado / fallido     reservados para el envío real; «enviado» exige fecha y referencia externa confirmadas
--
-- REINTENTOS: la misma entrada y el mismo catálogo producen la misma clave de idempotencia; no se crea otra fila.
-- Una entrada distinta (por ejemplo, otra descripción) crea un registro nuevo y conserva el anterior.
--
-- También corrige un detalle de REP-2800: route_report guardaba la dirección de prueba cuando la primera llamada
-- era del servidor, y después se la devolvía a cualquiera. Ahora lo que se guarda nunca lleva `canal_prueba`.
--
-- No se aplica sola: la migración se corre a mano en staging.

begin;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Registro de entregas: report_outreach_logs ya existía (0 filas, sin políticas: solo servidor)
-- ---------------------------------------------------------------------------------------------------------------
alter table public.report_outreach_logs alter column contact_id drop not null;   -- sin canal aprobado no hay contacto
alter table public.report_outreach_logs alter column sent_at drop default;       -- sent_at = envío CONFIRMADO, no creación

alter table public.report_outreach_logs
  add column if not exists idempotency_key text,
  add column if not exists mode            text not null default 'borrador',
  add column if not exists reason          text,
  add column if not exists routing_criterio text,
  add column if not exists catalog_version text,
  add column if not exists template_version text,
  add column if not exists created_at      timestamptz not null default now();

alter table public.report_outreach_logs drop constraint if exists report_outreach_logs_status_check;
alter table public.report_outreach_logs add constraint report_outreach_logs_status_check
  check (delivery_status in ('borrador_generado', 'pendiente_sin_canal', 'pendiente_revision', 'comunicado', 'enviado', 'fallido'));

alter table public.report_outreach_logs drop constraint if exists report_outreach_logs_mode_check;
alter table public.report_outreach_logs add constraint report_outreach_logs_mode_check
  check (mode in ('borrador', 'prueba', 'real'));

-- «enviado» solo con confirmación: fecha y referencia externa
alter table public.report_outreach_logs drop constraint if exists report_outreach_logs_sent_needs_proof;
alter table public.report_outreach_logs add constraint report_outreach_logs_sent_needs_proof
  check (delivery_status <> 'enviado' or (sent_at is not null and external_reference is not null));

create unique index if not exists report_outreach_logs_idempotency_uq
  on public.report_outreach_logs (idempotency_key) where idempotency_key is not null;
create index if not exists report_outreach_logs_report_idx on public.report_outreach_logs (report_id, created_at desc);

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Filtro de la descripción: devuelve los motivos por los que necesita revisión (vacío = puede salir)
--    Lista simple y revisable. No reescribe el texto: si algo coincide, lo revisa una persona.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.description_review_flags(p_text text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_remove(array[
    case when p_text ~* '\m(mierda|puta|puto|carajo|boludo|boluda|pelotudo|pelotuda|idiota|imbecil|imbécil|estupido|estúpido|forro|cagon|cagón|conchudo|hdp|hijo de puta)\M'
         then 'lenguaje_ofensivo' end,
    case when p_text ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then 'correo_electronico' end,
    case when p_text ~ '\+?\d[\d\s().-]{7,}\d' then 'telefono_o_documento' end,
    case when p_text ~* 'https?://|www\.' then 'enlace' end
  ], null), '{}'::text[])
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. route_report: lo guardado nunca lleva la dirección de prueba (solo el servidor la ve, al resolver)
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public._routing_without_test_channel(p_result jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case when p_result is null then null else
    jsonb_set(p_result - 'canal_prueba', '{candidatos}',
      coalesce((select jsonb_agg(c - 'canal_prueba') from jsonb_array_elements(p_result -> 'candidatos') c), '[]'::jsonb))
  end
$$;

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

  v_input := jsonb_build_object(
    'locality_id', v_report.locality_id,
    'prestacion', v_prest,
    'urgente', coalesce(p_urgente, false),
    'tipo_via', nullif(lower(btrim(coalesce(p_tipo_via, ''))), ''));
  v_hash := md5(v_input::text);

  select * into v_prev from public.report_routing where report_id = p_report_id;
  if found and v_prev.input_hash = v_hash and v_prev.catalog_version = v_version then
    return v_prev.result;
  end if;

  -- Lo que se guarda y se devuelve a quien llama NUNCA lleva canal_prueba (se calcula aparte, solo para el servidor)
  v_result := public._routing_without_test_channel(
    public.resolve_report_destination(v_report.locality_id, v_prest, coalesce(p_urgente, false), p_tipo_via));

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

-- ---------------------------------------------------------------------------------------------------------------
-- 4. El borrador: arma el mensaje, lo registra con su estado real y es repetible
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.prepare_organism_delivery(
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
  c_template constant text := 'REP-2805 v0.6';
  c_max_fotos constant integer := 4;
  c_aviso_borrador constant text :=
    'BORRADOR: este mensaje todavía NO fue enviado a ningún organismo. Reportalo está en etapa de prueba.';
  c_aviso_ia constant text :=
    'Fundamento preliminar generado con asistencia de inteligencia artificial a partir del corpus normativo '
    'verificado del proyecto. No es una decisión administrativa ni una resolución estatal: la decisión '
    'corresponde exclusivamente al organismo competente.';

  v_report     public.citizen_reports%rowtype;
  v_route      jsonb;
  v_found      jsonb;
  v_loc        record;
  v_service    text;
  v_flags      text[];
  v_fotos      jsonb;
  v_n_fotos    integer;
  v_status     text;
  v_reason     text;
  v_contact    uuid;
  v_codigo     text;
  v_desc       text;
  v_fund       jsonb;
  v_org        jsonb;
  v_canal      jsonb;
  v_estado_inf text;
  v_payload    jsonb;
  v_asunto     text;
  v_cuerpo     text;
  v_lines      text[];
  v_cit        jsonb;
  v_key        text;
  v_id         uuid;
  v_result     jsonb;
  v_prev       public.report_outreach_logs%rowtype;
  v_test       text;
  v_i          integer;
begin
  select * into v_report from public.citizen_reports where id = p_report_id;
  if not found then
    return null;
  end if;

  -- Destino (REP-2800). Devuelve null si quien llama no es el autor, quien atiende el reporte ni el servidor
  v_route := public.route_report(p_report_id, p_prestacion_key, p_urgente, p_tipo_via);
  if v_route is null then
    return null;
  end if;

  select l.name as locality, sd.name as subdivision, sp.name as province
    into v_loc
    from public.localities l
    join public.subdivisions sd on sd.id = l.subdivision_id
    join public.states_provinces sp on sp.id = sd.state_province_id
   where l.id = v_report.locality_id;

  v_service := v_route -> 'prestacion' ->> 'categoria';
  v_codigo  := '#RP-' || upper(substr(v_report.id::text, 1, 8));
  v_org     := v_route -> 'organismo_verificado';
  v_canal   := v_route -> 'canal_verificado';

  -- Fundamento (REP-2902): solo citas verificadas. El resumen técnico de la IA no viaja (H-4, opción C)
  v_found := null;
  if to_regprocedure('public.get_report_legal_foundation(uuid)') is not null then
    execute 'select public.get_report_legal_foundation($1)' into v_found using p_report_id;
  end if;
  v_fund := jsonb_build_object(
    'estado', coalesce(v_found ->> 'status', 'pendiente'),
    'motivo', v_found ->> 'abstention_reason',
    'aviso', coalesce(v_found ->> 'disclaimer', c_aviso_ia),
    'citas', case when v_found ->> 'status' = 'fundamento_preliminar'
                  then coalesce((select jsonb_agg(jsonb_build_object(
                           'referencia', c ->> 'reference',
                           'norma', btrim(concat_ws(' ', replace(c ->> 'document_type', '_', '-'), c ->> 'document_number', '— ' || (c ->> 'source_title'))),
                           'autoridad', c ->> 'issuing_authority',
                           'extracto', c ->> 'quoted_text',
                           'fuente', c ->> 'source_url',
                           'verificada_el', c ->> 'verified_at'))
                         from jsonb_array_elements(v_found -> 'citations') c), '[]'::jsonb)
                  else '[]'::jsonb end);

  -- Evidencia: solo referencias a las fotos anonimizadas del propio reporte (no la URL, no el original)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id,
           'ruta', regexp_replace(i.image_url, '^.*/object/public/', ''),
           'anonimizada', true) order by i.created_at, i.id), '[]'::jsonb)
    into v_fotos
    from (select * from public.report_images where report_id = p_report_id order by created_at, id limit c_max_fotos) i;
  v_n_fotos := jsonb_array_length(v_fotos);

  -- Descripción: sale solo si no hay nada que revisar
  v_flags := public.description_review_flags(v_report.description);
  v_desc  := case when cardinality(v_flags) = 0 then btrim(v_report.description) else null end;

  -- Estado real de la entrega. Nunca «enviado» por haber armado un borrador
  if v_route ->> 'accion' = 'informar_canal' then
    v_status := 'comunicado';
    v_reason := 'Vulnerabilidad social: se informa el canal al vecino y no se deriva con esta plantilla.';
  elsif (v_route ->> 'sin_destino_verificado')::boolean or v_route ->> 'criterio' = 'no_resuelto' then
    v_status := 'pendiente_sin_canal';
    v_reason := coalesce(v_route ->> 'motivo', 'No hay un destino verificado.');
  elsif cardinality(v_flags) > 0 then
    v_status := 'pendiente_revision';
    v_reason := 'La descripción necesita revisión antes de salir: ' || array_to_string(v_flags, ', ') || '.';
  else
    v_status := 'borrador_generado';
    v_reason := null;
  end if;

  v_estado_inf := case v_status
    when 'borrador_generado' then 'Borrador preparado para ' || (v_org ->> 'nombre') || '. Todavía no fue notificado.'
    when 'comunicado'        then 'Se informó al vecino el canal que corresponde. No se derivó a un organismo.'
    else 'Sin notificar: ' || coalesce(v_reason, 'pendiente') end;

  -- Contacto aprobado del destino (solo cuando hay destino verificado)
  v_contact := null;
  if v_status in ('borrador_generado', 'comunicado') and v_org is not null and v_canal is not null then
    select k.id into v_contact
      from public.agency_contacts k
     where k.agency_id = (v_org ->> 'id')::uuid
       and k.contact_channel = v_canal ->> 'tipo'
       and k.contact_value = v_canal ->> 'valor'
     limit 1;
  end if;

  v_payload := jsonb_build_object(
    'schema_version', 1,
    'plantilla', c_template,
    'es_borrador', true,
    'estado_entrega', v_status,
    'aviso_borrador', c_aviso_borrador,
    'reporte', jsonb_build_object(
      'codigo', v_codigo,
      'categoria', v_service,
      'prestacion', v_route -> 'prestacion' ->> 'nombre',
      'fecha', to_char(v_report.created_at at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD')),
    'ubicacion', jsonb_build_object(
      'latitud', v_report.latitud, 'longitud', v_report.longitud,
      'localidad', v_loc.locality, 'subdivision', v_loc.subdivision, 'provincia', v_loc.province,
      'mapa', 'https://www.google.com/maps?q=' || v_report.latitud::text || ',' || v_report.longitud::text),
    'descripcion', v_desc,
    'descripcion_a_revisar', to_jsonb(v_flags),
    'evidencia', jsonb_build_object('anonimizada', true, 'cantidad', v_n_fotos, 'maximo', c_max_fotos, 'adjuntos', v_fotos),
    'destino', jsonb_build_object(
      'jurisdiccion', v_route ->> 'jurisdiccion',
      'organismo', v_org, 'canal', v_canal, 'canales_alternativos', v_route -> 'canales_alternativos',
      'fuente', v_route -> 'fuente', 'criterio', v_route ->> 'criterio', 'regla', v_route ->> 'regla',
      'sin_destino_verificado', (v_route ->> 'sin_destino_verificado')::boolean,
      'motivo', v_route ->> 'motivo', 'falta', v_route -> 'falta'),
    'fundamento', v_fund,
    'estado_informado', v_estado_inf);

  -- Texto plano del mensaje
  v_asunto := '[BORRADOR] Reportalo · ' || v_codigo || ' · ' ||
              coalesce(v_route -> 'prestacion' ->> 'nombre', 'reporte ciudadano') || ' · ' || coalesce(v_loc.locality, '');
  v_lines := array[
    c_aviso_borrador, '',
    'Reportalo · Reporte ' || v_codigo,
    'Categoría: ' || coalesce(v_service, 'sin identificar') || ' · Prestación: ' || coalesce(v_route -> 'prestacion' ->> 'nombre', 'sin identificar'),
    'Fecha del reporte: ' || to_char(v_report.created_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY'),
    'Ubicación: ' || concat_ws(', ', v_loc.locality, v_loc.subdivision, v_loc.province) ||
      ' (' || v_report.latitud::text || ', ' || v_report.longitud::text || ')',
    'Mapa: ' || (v_payload -> 'ubicacion' ->> 'mapa'),
    'Descripción del vecino: ' || coalesce(v_desc, '[retenida: necesita revisión]'),
    'Evidencia: ' || v_n_fotos || ' foto(s) anonimizada(s)',
    '',
    'Destino propuesto: ' || coalesce((v_org ->> 'nombre') || coalesce(' (' || (v_org ->> 'organismo_padre') || ')', ''), 'sin destino verificado'),
    'Canal: ' || coalesce((v_canal ->> 'tipo') || ' ' || (v_canal ->> 'valor'), 'sin canal verificado'),
    'Fuente: ' || coalesce((v_route -> 'fuente' ->> 'url') || ' (verificada el ' || (v_route -> 'fuente' ->> 'verificado_el') || ')', 'sin fuente'),
    'Estado: ' || v_estado_inf,
    '',
    'FUNDAMENTO LEGAL PRELIMINAR (generado con asistencia de IA)'];

  if v_fund ->> 'estado' = 'fundamento_preliminar' and jsonb_array_length(v_fund -> 'citas') > 0 then
    v_lines := array_append(v_lines, 'Normas citadas:');
    v_i := 0;
    for v_cit in select * from jsonb_array_elements(v_fund -> 'citas') loop
      v_i := v_i + 1;
      v_lines := v_lines || array[
        v_i || '. ' || coalesce(v_cit ->> 'referencia', 'Norma del corpus'),
        '   Norma: ' || coalesce(v_cit ->> 'norma', '') || coalesce(' (' || (v_cit ->> 'autoridad') || ')', ''),
        '   Fuente: ' || coalesce(v_cit ->> 'fuente', '') || coalesce(' (verificada el ' || left(v_cit ->> 'verificada_el', 10) || ')', ''),
        '   Cita textual: «' || coalesce(v_cit ->> 'extracto', '') || '»'];
    end loop;
  elsif v_fund ->> 'estado' = 'pendiente' then
    v_lines := array_append(v_lines, 'Estado: análisis pendiente. Todavía no hay fundamento legal para este reporte.');
  else
    v_lines := v_lines || array['Estado: sin fundamento verificado.',
      'Motivo: ' || coalesce(v_fund ->> 'motivo', 'No hay un fundamento normativo verificado para este reclamo.')];
  end if;
  v_lines := v_lines || array['', 'Aviso: ' || (v_fund ->> 'aviso')];
  v_cuerpo := array_to_string(v_lines, E'\n');

  -- Clave de idempotencia: misma entrada + mismo catálogo = mismo registro
  v_key := md5(concat_ws('|', p_report_id::text, v_route ->> 'catalog_version', v_status, v_route::text,
                         coalesce(v_desc, ''), v_fotos::text, v_fund::text, c_template));

  select * into v_prev from public.report_outreach_logs where idempotency_key = v_key;
  if found then
    return (v_prev.payload_snapshot::jsonb) || jsonb_build_object('entrega_id', v_prev.id, 'repetido', true);
  end if;

  v_id := gen_random_uuid();
  v_result := jsonb_build_object('estado', v_status, 'es_borrador', true, 'enviado', false, 'motivo', v_reason,
                                 'asunto', v_asunto, 'cuerpo_texto', v_cuerpo, 'payload', v_payload);

  insert into public.report_outreach_logs (id, report_id, contact_id, delivery_status, payload_snapshot, sent_at,
                                           idempotency_key, mode, reason, routing_criterio, catalog_version, template_version)
  values (v_id, p_report_id, v_contact, v_status, v_result::text, null,
          v_key, 'borrador', v_reason, v_route ->> 'criterio', v_route ->> 'catalog_version', c_template)
  on conflict (idempotency_key) where idempotency_key is not null do nothing;

  -- Si otra llamada ganó la carrera, se devuelve lo que ya quedó registrado
  select * into v_prev from public.report_outreach_logs where idempotency_key = v_key;
  if v_prev.id <> v_id then
    return (v_prev.payload_snapshot::jsonb) || jsonb_build_object('entrega_id', v_prev.id, 'repetido', true);
  end if;

  -- La dirección de prueba (REP-2801) solo la ve el servidor y no se guarda en el registro
  v_test := null;
  if coalesce(auth.role(), '') = 'service_role' then
    v_test := public.resolve_report_destination(v_report.locality_id,
                nullif(btrim(coalesce(p_prestacion_key, v_route -> 'prestacion' ->> 'clave')), ''),
                coalesce(p_urgente, false), p_tipo_via) ->> 'canal_prueba';
  end if;

  return v_result || jsonb_build_object('entrega_id', v_id, 'repetido', false, 'destinatario_prueba', v_test);
end;
$$;

-- Permisos: ni anon ni public. La app la pide con la sesión del autor; el servidor también puede.
revoke all on function public.description_review_flags(text)                     from public, anon;
revoke all on function public._routing_without_test_channel(jsonb)               from public, anon, authenticated;
revoke all on function public.route_report(uuid, text, boolean, text)            from public, anon;
revoke all on function public.prepare_organism_delivery(uuid, text, boolean, text) from public, anon;
grant execute on function public.description_review_flags(text)                       to authenticated, service_role;
grant execute on function public.route_report(uuid, text, boolean, text)              to authenticated, service_role;
grant execute on function public.prepare_organism_delivery(uuid, text, boolean, text) to authenticated, service_role;

commit;
