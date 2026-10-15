-- REP-2801 · Verificación del borrador de entrega al organismo
--
-- Se corre contra una base donde YA están aplicadas la migración de REP-2800, la carga de su catálogo y la migración
-- 20261015120000_rep2801_entrega_borrador_al_organismo.sql. NO deja nada: termina SIEMPRE con una excepción para que
-- cualquier ejecutor revierta lo que creó. Si todo está bien, el mensaje empieza con «REP-2801 OK».
--
-- Escenarios del ticket:
--   1. Destino aprobado + fundamento -> el mensaje trae los campos exactos, evidencia anonimizada y fundamento trazable
--   2. Sin canal aprobado -> queda «pendiente/no enviado» con motivo, sin correo externo
--   3. Reintento sobre la misma operación -> no se duplica la entrega ni se marca éxito sin confirmación
-- Más: la identidad no sale nunca, la descripción se filtra, vulnerabilidad social solo informa el canal, la dirección
-- de prueba solo la ve el servidor y no queda guardada, y «enviado» exige confirmación.

create or replace function pg_temp.loc(p_name text) returns uuid language sql as $$
  select id from public.localities where name = p_name order by id limit 1 $$;
create or replace function pg_temp.chk(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'FALLO: %', p_msg; end if;
end $$;
create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true) $$;
create or replace function pg_temp.as_server() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true) $$;
-- Un reporte de prueba del autor dado, con la descripción dada
create or replace function pg_temp.mk_report(p_uid uuid, p_loc text, p_desc text, p_fotos int default 0) returns uuid
language plpgsql as $$
declare v_id uuid; v_service uuid;
begin
  select id into v_service from public.services where service_code = 'INFRAESTRUCTURA';
  insert into public.citizen_reports (client_side_id, user_id, service_id, locality_id, description, latitud, longitud)
  values (gen_random_uuid(), p_uid, v_service, pg_temp.loc(p_loc), p_desc, -34.6283, -58.4631) returning id into v_id;
  insert into public.report_images (report_id, image_url)
  select v_id, 'https://x.supabase.co/storage/v1/object/public/report-evidences/' || r.client_side_id || '/foto' || g || '.jpg'
    from public.citizen_reports r, generate_series(1, p_fotos) g where r.id = v_id;
  return v_id;
end $$;

do $t$
declare
  v_uid      uuid;
  v_other    uuid := gen_random_uuid();
  v_username text;
  v_rep      uuid;
  v_rep2     uuid;
  r          jsonb;
  r2         jsonb;
  v_n        int;
  v_ok       boolean;
  v_txt      text;
  v_stub     boolean;
begin
  perform pg_temp.as_server();
  perform pg_temp.chk(to_regprocedure('public.prepare_organism_delivery(uuid,text,boolean,text)') is not null,
                      'PRECONDICION: falta la migración de REP-2801');
  perform pg_temp.chk(to_regprocedure('public.route_report(uuid,text,boolean,text)') is not null, 'PRECONDICION: falta REP-2800');
  select id, username into v_uid, v_username from public.profiles order by id limit 1;
  -- Con el esquema de reemplazo, get_report_legal_foundation es un doble que obedece a rep.fund_status; en staging es la real
  v_stub := exists (select 1 from pg_proc where proname = 'get_report_legal_foundation' and prosrc like '%rep.fund_status%');

  v_rep := pg_temp.mk_report(v_uid, 'Flores', 'Hay un bache profundo frente al numero 1234 de la avenida.', 5);

  -- ------------------------------------------------------------------------------------------------------------
  -- Escenario 1 · borrador completo (bache en Flores, calle secundaria -> Comuna 7)
  -- ------------------------------------------------------------------------------------------------------------
  perform set_config('rep.fund_status', 'fundamento_preliminar', true);
  perform pg_temp.as_user(v_uid);
  r := public.prepare_organism_delivery(v_rep, 'bache_calle', false, 'secundaria');
  perform pg_temp.chk(r ->> 'estado' = 'borrador_generado' and (r ->> 'es_borrador')::boolean and not (r ->> 'enviado')::boolean,
                      'E1 estado: ' || coalesce(r::text, 'null'));
  perform pg_temp.chk(r -> 'payload' -> 'destino' -> 'organismo' ->> 'nombre' = 'Comuna 7'
                      and r -> 'payload' -> 'destino' -> 'fuente' ->> 'url' is not null, 'E1 destino y fuente');
  perform pg_temp.chk(r -> 'payload' -> 'reporte' ->> 'codigo' = '#RP-' || upper(substr(v_rep::text, 1, 8))
                      and r -> 'payload' -> 'reporte' ->> 'prestacion' = 'Reparación de bache en calle', 'E1 reporte');
  perform pg_temp.chk(r -> 'payload' -> 'ubicacion' ->> 'localidad' = 'Flores'
                      and (r -> 'payload' -> 'ubicacion' ->> 'latitud')::float = -34.6283, 'E1 ubicación con coordenadas y localidad');
  perform pg_temp.chk(r -> 'payload' ->> 'descripcion' like 'Hay un bache profundo%', 'E1 descripción limpia sale textual');
  perform pg_temp.chk((r -> 'payload' -> 'evidencia' ->> 'cantidad')::int = 4 and (r -> 'payload' -> 'evidencia' ->> 'maximo')::int = 4,
                      'E1 máximo de 4 adjuntos (hay 5 fotos)');
  perform pg_temp.chk(r::text !~ 'https?://[^"]*report-evidences'
                      and r -> 'payload' -> 'evidencia' -> 'adjuntos' -> 0 ->> 'ruta' like 'report-evidences/%',
                      'E1 la evidencia va por referencia a la foto anonimizada, no por URL');
  perform pg_temp.chk(r ->> 'cuerpo_texto' like 'BORRADOR%'
                      and r ->> 'cuerpo_texto' like '%preliminar generado con asistencia de inteligencia artificial%',
                      'E1 texto con aviso de borrador y aviso de IA');
  perform pg_temp.chk(r::text not like '%resumen tecnico secreto%', 'E1 el resumen técnico de la IA no viaja (H-4)');
  if v_stub then
    perform pg_temp.chk(r -> 'payload' -> 'fundamento' ->> 'estado' = 'fundamento_preliminar'
                        and r -> 'payload' -> 'fundamento' -> 'citas' -> 0 ->> 'extracto' is not null
                        and r -> 'payload' -> 'fundamento' -> 'citas' -> 0 ->> 'fuente' is not null
                        and r ->> 'cuerpo_texto' like '%Cita textual: «%', 'E1 fundamento con cita y fuente');
  end if;
  perform pg_temp.chk(r::text not like '%' || v_uid::text || '%' and r::text not like '%' || v_username || '%',
                      'E1 la identidad del vecino no sale nunca');
  perform pg_temp.chk(r ->> 'asunto' like '[BORRADOR]%', 'E1 asunto marcado como borrador');

  select count(*) into v_n from public.report_outreach_logs
   where report_id = v_rep and delivery_status = 'borrador_generado' and sent_at is null and mode = 'borrador'
     and contact_id is not null and idempotency_key is not null;
  perform pg_temp.chk(v_n = 1, 'E1 debe haber un registro de entrega, sin fecha de envío, con contacto aprobado');

  -- ------------------------------------------------------------------------------------------------------------
  -- Escenario 3 · reintento: no se duplica ni se marca éxito
  -- ------------------------------------------------------------------------------------------------------------
  r2 := public.prepare_organism_delivery(v_rep, 'bache_calle', false, 'secundaria');
  perform pg_temp.chk((r2 ->> 'repetido')::boolean and r2 ->> 'entrega_id' = r ->> 'entrega_id'
                      and r2 ->> 'estado' = 'borrador_generado' and not (r2 ->> 'enviado')::boolean, 'E3 repetición: ' || r2::text);
  select count(*) into v_n from public.report_outreach_logs where report_id = v_rep;
  perform pg_temp.chk(v_n = 1, 'E3 el reintento no debe crear otro registro');

  -- Una entrada distinta (otra descripción) crea un registro nuevo y conserva el anterior
  perform pg_temp.as_server();
  update public.citizen_reports set description = 'El bache sigue creciendo y ya rompio tres autos.' where id = v_rep;
  perform pg_temp.as_user(v_uid);
  r2 := public.prepare_organism_delivery(v_rep, 'bache_calle', false, 'secundaria');
  perform pg_temp.chk(not (r2 ->> 'repetido')::boolean and r2 ->> 'entrega_id' <> r ->> 'entrega_id', 'E3 entrada distinta = registro nuevo');
  select count(*) into v_n from public.report_outreach_logs where report_id = v_rep;
  perform pg_temp.chk(v_n = 2, 'E3 se conserva el registro anterior');

  -- ------------------------------------------------------------------------------------------------------------
  -- Escenario 2 · sin canal aprobado / sin destino: pendiente, con motivo, sin enviar
  -- ------------------------------------------------------------------------------------------------------------
  v_rep2 := pg_temp.mk_report(v_uid, 'Wilde', 'La luminaria de la esquina no funciona hace una semana.', 1);
  r := public.prepare_organism_delivery(v_rep2, null);   -- sin prestación identificada
  perform pg_temp.chk(r ->> 'estado' = 'pendiente_sin_canal' and r ->> 'motivo' is not null and not (r ->> 'enviado')::boolean
                      and r -> 'payload' -> 'destino' ->> 'sin_destino_verificado' = 'true', 'E2 sin prestación: ' || r::text);
  select count(*) into v_n from public.report_outreach_logs
   where report_id = v_rep2 and delivery_status = 'pendiente_sin_canal' and contact_id is null and sent_at is null and reason is not null;
  perform pg_temp.chk(v_n = 1, 'E2 queda registrado como pendiente, sin contacto, sin envío y con motivo');

  r := public.prepare_organism_delivery(v_rep, 'bache_calle', false, null);   -- sin dato de vía: no se elige
  perform pg_temp.chk(r ->> 'estado' = 'pendiente_sin_canal' and r -> 'payload' -> 'destino' ->> 'criterio' = 'no_resuelto',
                      'E2 caso sin resolver no se envía: ' || r::text);

  perform pg_temp.as_server();
  update public.agency_contacts set is_approved = false
   where agency_id in (select id from public.agencies where name = 'Dirección de Alumbrado, Sistemas Eléctricos y Vía Pública');
  perform pg_temp.as_user(v_uid);
  r := public.prepare_organism_delivery(v_rep2, 'luminaria_apagada_noche');
  perform pg_temp.chk(r ->> 'estado' = 'pendiente_sin_canal' and r -> 'payload' -> 'destino' -> 'falta' @> '["contacto"]'::jsonb,
                      'E2 canal no aprobado: ' || r::text);
  perform pg_temp.as_server();
  update public.agency_contacts set is_approved = true
   where agency_id in (select id from public.agencies where name = 'Dirección de Alumbrado, Sistemas Eléctricos y Vía Pública');
  perform pg_temp.as_user(v_uid);

  -- Fuera del piloto (Avellaneda de Santa Fe no es el partido de Buenos Aires)
  perform pg_temp.as_server();
  insert into public.citizen_reports (client_side_id, user_id, service_id, locality_id, description, latitud, longitud)
  select gen_random_uuid(), v_uid, service_id, (select l.id from public.localities l join public.subdivisions sd on sd.id = l.subdivision_id
                                                  join public.states_provinces sp on sp.id = sd.state_province_id
                                                 where l.name = 'Avellaneda' and sp.name = 'Santa Fe' limit 1),
         'Reporte de prueba fuera del piloto de la zona.', -31.7, -60.5
    from public.citizen_reports where id = v_rep returning id into v_rep2;
  perform pg_temp.as_user(v_uid);
  r := public.prepare_organism_delivery(v_rep2, 'bache_calle');
  perform pg_temp.chk(r ->> 'estado' = 'pendiente_sin_canal' and r -> 'payload' -> 'destino' ->> 'jurisdiccion' = 'FUERA_DEL_PILOTO',
                      'E2 fuera del piloto: ' || r::text);

  -- ------------------------------------------------------------------------------------------------------------
  -- Descripción: el filtro retiene y pide revisión (no reescribe)
  -- ------------------------------------------------------------------------------------------------------------
  foreach v_txt in array array[
      'Estos hijos de puta no arreglan nada nunca.',
      'Escribanme a vecino@correo.com para mas datos.',
      'Llamar al 11 5555 1234 que vive al lado.',
      'Mas info en https://ejemplo.com/foto del lugar.'] loop
    v_rep2 := pg_temp.mk_report(v_uid, 'Flores', v_txt, 1);
    r := public.prepare_organism_delivery(v_rep2, 'bache_calle', false, 'secundaria');
    perform pg_temp.chk(r ->> 'estado' = 'pendiente_revision' and r -> 'payload' -> 'descripcion' = 'null'::jsonb
                        and r ->> 'cuerpo_texto' like '%[retenida: necesita revisión]%' and r::text not like '%' || left(v_txt, 12) || '%'
                        and jsonb_array_length(r -> 'payload' -> 'descripcion_a_revisar') >= 1,
                        'filtro de descripción: ' || v_txt || ' -> ' || r::text);
  end loop;
  perform pg_temp.chk(cardinality(public.description_review_flags('Frente al 1234 de la avenida hay un pozo de 40 cm.')) = 0
                      and cardinality(public.description_review_flags('Bache en 25 de Mayo 1500, esquina Rivadavia')) = 0,
                      'una dirección con altura no debe marcarse como teléfono');

  -- ------------------------------------------------------------------------------------------------------------
  -- Vulnerabilidad social: se informa el canal, no se deriva
  -- ------------------------------------------------------------------------------------------------------------
  v_rep2 := pg_temp.mk_report(v_uid, 'Balvanera', 'Hay una persona durmiendo en la plaza desde hace dias.', 0);
  r := public.prepare_organism_delivery(v_rep2, 'situacion_de_calle');
  perform pg_temp.chk(r ->> 'estado' = 'comunicado' and r -> 'payload' -> 'destino' -> 'canal' ->> 'valor' = '108'
                      and not (r ->> 'enviado')::boolean, 'vulnerabilidad social: ' || r::text);

  -- ------------------------------------------------------------------------------------------------------------
  -- Fundamento: sin fundamento verificado no hay texto jurídico
  -- ------------------------------------------------------------------------------------------------------------
  perform set_config('rep.fund_status', 'sin_fundamento_verificado', true);
  v_rep2 := pg_temp.mk_report(v_uid, 'Flores', 'Pozo grande en la calzada frente a la escuela.', 1);
  r := public.prepare_organism_delivery(v_rep2, 'bache_calle', false, 'avenida');
  perform pg_temp.chk(r ->> 'estado' = 'borrador_generado' and r ->> 'cuerpo_texto' not like '%Cita textual%'
                      and r -> 'payload' -> 'destino' -> 'organismo' ->> 'nombre' = 'Ministerio de Espacio Público e Higiene Urbana',
                      'D4: sin fundamento verificado igual deriva por competencia: ' || r::text);
  perform pg_temp.chk(r -> 'payload' -> 'fundamento' ->> 'estado' in ('sin_fundamento_verificado', 'pendiente')
                      and (r ->> 'cuerpo_texto' like '%sin fundamento verificado%' or r ->> 'cuerpo_texto' like '%análisis pendiente%'),
                      'sin fundamento verificado no hay texto jurídico');
  perform set_config('rep.fund_status', 'fundamento_preliminar', true);

  -- ------------------------------------------------------------------------------------------------------------
  -- Acceso y dirección de prueba
  -- ------------------------------------------------------------------------------------------------------------
  perform pg_temp.as_user(v_other);
  perform pg_temp.chk(public.prepare_organism_delivery(v_rep, 'bache_calle', false, 'secundaria') is null, 'un tercero no debe armar ni ver el borrador');

  perform pg_temp.as_server();
  update public.agency_contacts set test_value = 'prueba@example.test'
   where is_primary and agency_id in (select id from public.agencies where name = 'Comuna 7');
  v_rep2 := pg_temp.mk_report(v_uid, 'Flores', 'Bache nuevo con la direccion de prueba cargada en el contacto.', 1);
  r := public.prepare_organism_delivery(v_rep2, 'bache_calle', false, 'secundaria');   -- primera llamada: la hace el servidor
  perform pg_temp.chk(r ->> 'destinatario_prueba' = 'prueba@example.test'
                      and r -> 'payload' -> 'destino' -> 'canal' ->> 'valor' <> 'prueba@example.test', 'el servidor ve la dirección de prueba aparte');
  select count(*) into v_n from public.report_outreach_logs where payload_snapshot like '%prueba@example%';
  perform pg_temp.chk(v_n = 0, 'la dirección de prueba no se guarda en el registro de entregas');
  select count(*) into v_n from public.report_routing where result::text like '%prueba@example%';
  perform pg_temp.chk(v_n = 0, 'REP-2800: lo que guarda route_report nunca lleva la dirección de prueba');
  perform pg_temp.as_user(v_uid);
  r := public.prepare_organism_delivery(v_rep2, 'bache_calle', false, 'secundaria');   -- el autor reintenta
  perform pg_temp.chk(r::text not like '%prueba@example%' and (r ->> 'repetido')::boolean, 'el autor no ve la dirección de prueba');
  r := public.route_report(v_rep2, 'bache_calle', false, 'secundaria');
  perform pg_temp.chk(r::text not like '%prueba@example%', 'route_report tampoco se la muestra al autor');

  -- ------------------------------------------------------------------------------------------------------------
  -- «enviado» exige confirmación; seguridad
  -- ------------------------------------------------------------------------------------------------------------
  perform pg_temp.as_server();
  v_ok := false;
  begin
    update public.report_outreach_logs set delivery_status = 'enviado' where report_id = v_rep;
  exception when check_violation then v_ok := true;
  end;
  perform pg_temp.chk(v_ok, 'no debe poder marcarse «enviado» sin fecha y referencia externa');
  update public.report_outreach_logs set delivery_status = 'enviado', sent_at = now(), external_reference = 'msg-prueba-1'
   where id = (select id from public.report_outreach_logs where report_id = v_rep order by created_at limit 1);

  perform pg_temp.chk(not has_function_privilege('anon', 'public.prepare_organism_delivery(uuid,text,boolean,text)', 'execute')
                      and has_function_privilege('authenticated', 'public.prepare_organism_delivery(uuid,text,boolean,text)', 'execute')
                      and has_function_privilege('service_role', 'public.prepare_organism_delivery(uuid,text,boolean,text)', 'execute'),
                      'permisos de prepare_organism_delivery');
  perform pg_temp.chk(not has_function_privilege('authenticated', 'public._routing_without_test_channel(jsonb)', 'execute'),
                      'la auxiliar interna no debe ser ejecutable por authenticated');
  select count(*) into v_n from pg_policies where schemaname = 'public' and tablename = 'report_outreach_logs';
  perform pg_temp.chk(v_n = 0, 'report_outreach_logs debe seguir sin políticas (solo servidor)');
  perform pg_temp.chk((select relrowsecurity from pg_class where oid = 'public.report_outreach_logs'::regclass), 'report_outreach_logs debe tener RLS');

  raise exception 'REP-2801 OK · todas las verificaciones pasaron (se revierte todo)';
end
$t$;
