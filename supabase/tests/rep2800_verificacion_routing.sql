-- REP-2800 · Verificación del routing de organismo receptor
--
-- Se corre contra una base donde YA están aplicadas la migración 20261014150000_rep2800_resolver_organismo_receptor.sql
-- y el script supabase/catalogo/rep2800_carga_catalogo_destinos.sql. NO deja nada: el bloque termina SIEMPRE con una
-- excepción para que cualquier ejecutor revierta lo que creó (reporte de prueba, filas de routing y las modificaciones
-- de catálogo que hace para probar los casos negativos). Si todo está bien, el mensaje empieza con «REP-2800 OK».
-- Cualquier otro mensaje es la verificación que falló.
--
-- Cubre los criterios de aceptación de REP-2800 y los casos que Hernán dejó en REP-2806 (sección 8):
--   Escenario 1 (regla aplicada, coincide con la matriz) · T-1..T-7 (REP-2809) e I-1..I-6 (REP-2810)
--   Escenario 2 (sin destino verificado: no se envía ni se inventa receptor) · fuera del piloto, sin canal, sin receptor
--   Escenario 3 (misma entrada y catálogo = mismo destino, sin filas duplicadas)
--   D4 (bache en Flores deriva por competencia, aunque no haya infracción acreditada)
--   R-8 (nada se cruza de jurisdicción) · seguridad (permisos, RLS, el canal de prueba solo lo ve el servidor)

create or replace function pg_temp.loc(p_name text, p_state text default null) returns uuid language sql as $$
  select l.id from public.localities l
    join public.subdivisions sd on sd.id = l.subdivision_id
    join public.states_provinces sp on sp.id = sd.state_province_id
   where l.name = p_name and (p_state is null or sp.name = p_state)
   order by l.id limit 1 $$;

create or replace function pg_temp.chk(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'FALLO: %', p_msg; end if;
end $$;

-- Simula quién llama (auth.uid() / auth.role() leen estos claims)
create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true) $$;
create or replace function pg_temp.as_server() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true) $$;

do $t$
declare
  v_caba   text := 'Ciudad Autónoma de Buenos Aires';
  v_pba    text := 'Buenos Aires';
  r        jsonb;
  r2       jsonb;
  v_uid    uuid;
  v_other  uuid := gen_random_uuid();
  v_service uuid;
  v_report uuid;
  v_report2 uuid;
  v_n      int;
  v_updated timestamptz;
  v_txt    text;
begin
  perform pg_temp.as_server();

  -- Precondiciones: migración y catálogo cargados
  perform pg_temp.chk(to_regprocedure('public.resolve_report_destination(uuid,text,boolean,text)') is not null,
                      'PRECONDICION: falta la migración de REP-2800');
  select count(*) into v_n from public.service_attribute_values v
    join public.service_attributes a on a.id = v.attribute_id and a.attribute_code = 'prestacion';
  perform pg_temp.chk(v_n = 37, 'PRECONDICION: falta cargar el catálogo (se esperan 37 prestaciones) (hay ' || v_n || ')');

  -- ---------------------------------------------------------------------------------------------------------
  -- Controles del catálogo (propuesta de carga §4)
  -- ---------------------------------------------------------------------------------------------------------
  select count(*) into v_n from public.agencies a join public.subdivisions sd on sd.id = a.subdivision_id
   where a.name = 'Ministerio de Espacio Público e Higiene Urbana';
  perform pg_temp.chk(v_n = 15, 'el Ministerio de Espacio Público debe existir en las 15 comunas (hay ' || v_n || ')');

  select count(*) into v_n from public.service_attribute_values v
    join public.service_attributes a on a.id = v.attribute_id and a.attribute_code = 'prestacion'
   where not exists (select 1 from public.agency_services s join public.agencies g on g.id = s.agency_id
                       join public.subdivisions sd on sd.id = g.subdivision_id and sd.name = 'Avellaneda'
                      where s.attribute_value_id = v.id and s.route_role = 'principal')
      or not exists (select 1 from public.agency_services s join public.agencies g on g.id = s.agency_id
                       join public.subdivisions sd on sd.id = g.subdivision_id and sd.name = 'Comuna 1'
                      where s.attribute_value_id = v.id and s.route_role = 'principal');
  perform pg_temp.chk(v_n = 0, v_n || ' prestaciones sin organismo principal en CABA o en Avellaneda');

  select count(*) into v_n from public.agency_contacts
   where is_approved and (source_url is null or verified_at is null);
  perform pg_temp.chk(v_n = 0, v_n || ' canales aprobados sin fuente o sin fecha de verificación');

  select count(*) into v_n from public.agency_contacts where contact_value like '%@reportalo.test' and is_approved;
  perform pg_temp.chk(v_n = 0, 'hay canales de prueba (@reportalo.test) aprobados');

  -- ---------------------------------------------------------------------------------------------------------
  -- Escenario 1 · CABA · REP-2809 (tránsito) T-1..T-4
  -- ---------------------------------------------------------------------------------------------------------
  r := public.resolve_report_destination(pg_temp.loc('Balvanera'), 'vehiculo_mal_estacionado');
  perform pg_temp.chk(r ->> 'jurisdiccion' = 'CABA', 'T-1 jurisdicción');
  perform pg_temp.chk(r -> 'organismo_verificado' ->> 'nombre' = 'Dirección General del Cuerpo de Agentes de Tránsito', 'T-1 organismo: ' || (r -> 'organismo_verificado')::text);
  perform pg_temp.chk(r -> 'organismo_verificado' ->> 'organismo_padre' = 'Secretaría de Tránsito', 'T-1 padre');
  perform pg_temp.chk(r -> 'canal_verificado' ->> 'etiqueta' = 'BA Colaborativa › Denuncia vial', 'T-1 canal: ' || (r -> 'canal_verificado')::text);
  perform pg_temp.chk(r ->> 'criterio' = 'regla_inequivoca' and r ->> 'regla' = 'R-1', 'T-1 criterio');
  perform pg_temp.chk((r ->> 'sin_destino_verificado')::boolean is false and (r ->> 'requiere_envio')::boolean is false, 'T-1 sin envío');
  perform pg_temp.chk(r -> 'fuente' ->> 'url' is not null and r -> 'fuente' ->> 'verificado_el' is not null, 'T-1 fuente trazable');
  perform pg_temp.chk(r ->> 'catalog_version' = 'REP-2806 v1.2', 'T-1 versión del catálogo');

  r := public.resolve_report_destination(pg_temp.loc('Almagro'), 'vehiculo_obstruyendo_garaje');
  perform pg_temp.chk(r -> 'organismo_verificado' ->> 'nombre' = 'Dirección General del Cuerpo de Agentes de Tránsito'
                      and r ->> 'criterio' = 'regla_inequivoca', 'T-2');
  r := public.resolve_report_destination(pg_temp.loc('Boedo'), 'vehiculo_abandonado');
  perform pg_temp.chk(r -> 'organismo_verificado' ->> 'nombre' = 'Dirección General del Cuerpo de Agentes de Tránsito'
                      and r ->> 'criterio' = 'regla_inequivoca', 'T-3');
  r := public.resolve_report_destination(pg_temp.loc('San Nicolás'), 'semaforo_reparacion');
  perform pg_temp.chk(r -> 'organismo_verificado' ->> 'nombre' = 'Secretaría de Tránsito'
                      and r -> 'canal_verificado' ->> 'etiqueta' = 'BA Colaborativa › Tránsito y Transporte', 'T-4: ' || r::text);

  -- T-5 · fuera del piloto. Avellaneda de SANTA FE no es el partido de Avellaneda (el homónimo de la matriz)
  r := public.resolve_report_destination(pg_temp.loc('Avellaneda', 'Santa Fe'), 'bache_calle');
  perform pg_temp.chk(r ->> 'jurisdiccion' = 'FUERA_DEL_PILOTO' and r ->> 'criterio' = 'sin_destino'
                      and (r ->> 'sin_destino_verificado')::boolean and r -> 'organismo_verificado' = 'null'::jsonb
                      and r -> 'canal_verificado' = 'null'::jsonb and r ->> 'regla' = 'R-5'
                      and (r ->> 'requiere_envio')::boolean is false, 'T-5: ' || r::text);
  r := public.resolve_report_destination(gen_random_uuid(), 'bache_calle');   -- localidad inexistente
  perform pg_temp.chk(r ->> 'criterio' = 'sin_destino' and (r ->> 'sin_destino_verificado')::boolean, 'localidad inexistente');

  -- T-6 · urgencia: primero el 103, después BA Colaborativa; sin urgencia, solo BA Colaborativa
  r := public.resolve_report_destination(pg_temp.loc('Flores'), 'calle_anegada', true);
  perform pg_temp.chk(r ->> 'criterio' = 'precedencia_urgencia' and r -> 'canal_verificado' ->> 'valor' = '103'
                      and r -> 'canales_alternativos' @> '[{"etiqueta": "BA Colaborativa › Pluviales"}]'::jsonb, 'T-6: ' || r::text);
  r := public.resolve_report_destination(pg_temp.loc('Flores'), 'calle_anegada', false);
  perform pg_temp.chk(r ->> 'criterio' = 'regla_inequivoca' and r -> 'canal_verificado' ->> 'etiqueta' = 'BA Colaborativa › Pluviales', 'T-6 sin urgencia');

  -- T-7 / D4 · bache: calle secundaria -> Comuna, avenida -> Ministerio; sin dato de vía se muestran los dos y no se elige
  r := public.resolve_report_destination(pg_temp.loc('Flores'), 'bache_calle');
  perform pg_temp.chk(r ->> 'criterio' = 'no_resuelto' and r -> 'organismo_verificado' = 'null'::jsonb
                      and r -> 'canal_verificado' = 'null'::jsonb and r ->> 'regla' = 'R-4', 'T-7 no resuelto: ' || r::text);
  perform pg_temp.chk(jsonb_array_length(r -> 'candidatos') = 2
                      and exists (select 1 from jsonb_array_elements(r -> 'candidatos') e where e -> 'organismo' ->> 'nombre' = 'Comuna 7')
                      and exists (select 1 from jsonb_array_elements(r -> 'candidatos') e where e -> 'organismo' ->> 'nombre' = 'Ministerio de Espacio Público e Higiene Urbana'),
                      'T-7 candidatos: ' || (r -> 'candidatos')::text);
  perform pg_temp.chk(r ->> 'accion' = 'ninguna' and (r ->> 'requiere_envio')::boolean is false, 'T-7 sin acción');
  r := public.resolve_report_destination(pg_temp.loc('Flores'), 'bache_calle', false, 'secundaria');
  perform pg_temp.chk(r -> 'organismo_verificado' ->> 'nombre' = 'Comuna 7' and r ->> 'criterio' = 'precedencia_legal'
                      and r -> 'canal_verificado' ->> 'etiqueta' = 'BA Colaborativa › Calles', 'D4 secundaria: ' || r::text);
  r := public.resolve_report_destination(pg_temp.loc('Flores'), 'bache_calle', false, 'Avenida');
  perform pg_temp.chk(r -> 'organismo_verificado' ->> 'nombre' = 'Ministerio de Espacio Público e Higiene Urbana'
                      and r ->> 'criterio' = 'precedencia_legal', 'D4 avenida: ' || r::text);
  -- Una vía que no se entiende no se adivina
  r := public.resolve_report_destination(pg_temp.loc('Flores'), 'bache_calle', false, 'calle rara');
  perform pg_temp.chk(r ->> 'criterio' = 'no_resuelto', 'vía desconocida debe quedar no_resuelto');

  -- Otras categorías de CABA
  r := public.resolve_report_destination(pg_temp.loc('Palermo'), 'olores_humos_gases');
  perform pg_temp.chk(r -> 'organismo_verificado' ->> 'nombre' = 'Agencia de Protección Ambiental (APRA)', 'APRA');
  r := public.resolve_report_destination(pg_temp.loc('Palermo'), 'derrame_peligroso', true);
  perform pg_temp.chk(r ->> 'criterio' = 'precedencia_urgencia' and r -> 'canal_verificado' ->> 'valor' = '103', 'derrame con urgencia');
  r := public.resolve_report_destination(pg_temp.loc('Palermo'), 'olores_humos_gases', true);   -- urgencia que la prestación no habilita
  perform pg_temp.chk(r ->> 'criterio' = 'regla_inequivoca' and r -> 'canal_verificado' ->> 'valor' <> '103', 'urgencia no habilitada no se aplica');
  r := public.resolve_report_destination(pg_temp.loc('Retiro'), 'local_sin_habilitacion');
  perform pg_temp.chk(r -> 'organismo_verificado' ->> 'nombre' = 'Agencia Gubernamental de Control (AGC)', 'AGC');
  r := public.resolve_report_destination(pg_temp.loc('Retiro'), 'mantero_vendedor_ambulante');
  perform pg_temp.chk(r -> 'organismo_verificado' ->> 'nombre' = 'Ministerio de Espacio Público e Higiene Urbana', 'mantero');

  -- Vulnerabilidad social (decisión del PO 29/09 y 14/10): se informa el canal, no se envía, no se promete nada
  r := public.resolve_report_destination(pg_temp.loc('Balvanera'), 'situacion_de_calle');
  perform pg_temp.chk(r -> 'organismo_verificado' ->> 'nombre' = 'Ministerio de Desarrollo Humano y Hábitat'
                      and r -> 'canal_verificado' ->> 'valor' = '108' and r ->> 'accion' = 'informar_canal'
                      and (r ->> 'requiere_envio')::boolean is false, 'vulnerabilidad CABA: ' || r::text);
  r := public.resolve_report_destination(pg_temp.loc('Balvanera'), 'situacion_de_calle_ninez');
  perform pg_temp.chk(r -> 'canal_verificado' ->> 'valor' = '102', 'niñez CABA');

  -- ---------------------------------------------------------------------------------------------------------
  -- Escenario 1 · Avellaneda · REP-2810 (infraestructura) I-1..I-6
  -- ---------------------------------------------------------------------------------------------------------
  r := public.resolve_report_destination(pg_temp.loc('Villa Domínico'), 'luminaria_apagada_noche');
  perform pg_temp.chk(r ->> 'jurisdiccion' = 'AVELLANEDA'
                      and r -> 'organismo_verificado' ->> 'nombre' = 'Dirección de Alumbrado, Sistemas Eléctricos y Vía Pública'
                      and r -> 'organismo_verificado' ->> 'organismo_padre' = 'Subsecretaría de Obras Públicas'
                      and r -> 'canal_verificado' ->> 'valor' = 'http://reclamosweb.mda.gob.ar/'
                      and r -> 'canales_alternativos' @> '[{"valor": "4207-9802"}]'::jsonb
                      and r ->> 'criterio' = 'regla_inequivoca', 'I-1: ' || r::text);
  r := public.resolve_report_destination(pg_temp.loc('Piñeyro'), 'bache_calle');
  perform pg_temp.chk(r -> 'organismo_verificado' ->> 'nombre' = 'Subsecretaría de Obras Públicas' and r ->> 'criterio' = 'regla_inequivoca', 'I-2: ' || r::text);
  r := public.resolve_report_destination(pg_temp.loc('Crucecita'), 'vereda_reparacion');
  perform pg_temp.chk(r -> 'organismo_verificado' ->> 'nombre' = 'Subsecretaría de Obras Públicas', 'I-3');
  r := public.resolve_report_destination(pg_temp.loc('Wilde'), 'semaforo_reparacion');
  perform pg_temp.chk(r -> 'organismo_verificado' ->> 'nombre' = 'Dirección de Alumbrado, Sistemas Eléctricos y Vía Pública', 'I-4');

  -- I-5 · urgencia: primero Defensa Civil, después Obras Públicas (que sigue entre los candidatos)
  r := public.resolve_report_destination(pg_temp.loc('Gerli'), 'sumidero_destape', true);
  perform pg_temp.chk(r ->> 'criterio' = 'precedencia_urgencia'
                      and r -> 'organismo_verificado' ->> 'nombre' = 'Defensa Civil de Avellaneda'
                      and r -> 'canal_verificado' ->> 'valor' = '103'
                      and r -> 'canales_alternativos' @> '[{"valor": "0800-333-3218"}]'::jsonb
                      and exists (select 1 from jsonb_array_elements(r -> 'candidatos') e
                                   where e -> 'organismo' ->> 'nombre' = 'Subsecretaría de Obras Públicas'), 'I-5: ' || r::text);

  -- I-6 · sin prestación: organismo y canal generales, marcado sin destino verificado, sin envío
  r := public.resolve_report_destination(pg_temp.loc('Wilde'), null);
  perform pg_temp.chk(r -> 'organismo_verificado' ->> 'nombre' = 'Municipalidad de Avellaneda'
                      and (r ->> 'sin_destino_verificado')::boolean and r ->> 'criterio' = 'sin_destino'
                      and r -> 'canal_verificado' ->> 'valor' = 'http://reclamosweb.mda.gob.ar/'
                      and (r ->> 'requiere_envio')::boolean is false and r ->> 'accion' = 'ninguna', 'I-6: ' || r::text);
  r := public.resolve_report_destination(pg_temp.loc('Flores'), 'prestacion_que_no_existe');
  perform pg_temp.chk(r -> 'organismo_verificado' ->> 'nombre' = 'Gobierno de la Ciudad de Buenos Aires'
                      and (r ->> 'sin_destino_verificado')::boolean, 'prestación desconocida en CABA: ' || r::text);

  -- R-8 · nada se cruza de jurisdicción (ningún canal de CABA en Avellaneda y al revés)
  for v_txt in select unnest(array['bache_calle','vereda_reparacion','semaforo_reparacion','luminaria_apagada_noche','sumidero_destape',
                                   'vehiculo_mal_estacionado','residuos_fuera_contenedor','olores_humos_gases','mantero_vendedor_ambulante',
                                   'local_sin_habilitacion','situacion_de_calle','situacion_de_calle_ninez']) loop
    r  := public.resolve_report_destination(pg_temp.loc('Wilde'), v_txt, true, 'avenida');
    r2 := public.resolve_report_destination(pg_temp.loc('Flores'), v_txt, true, 'avenida');
    perform pg_temp.chk(r::text !~* 'buenosaires\.gob|bacolaborativa|"108"|"147"' and r ->> 'jurisdiccion' = 'AVELLANEDA', 'R-8 Avellaneda con canal de CABA en ' || v_txt);
    perform pg_temp.chk(r2::text !~* 'mda\.gob|reclamosweb|0800-122|CAV|Avellaneda' and r2 ->> 'jurisdiccion' = 'CABA', 'R-8 CABA con canal de Avellaneda en ' || v_txt);
  end loop;

  -- ---------------------------------------------------------------------------------------------------------
  -- Escenario 3 · determinismo
  -- ---------------------------------------------------------------------------------------------------------
  r  := public.resolve_report_destination(pg_temp.loc('Flores'), 'calle_anegada', true);
  r2 := public.resolve_report_destination(pg_temp.loc('Flores'), 'calle_anegada', true);
  perform pg_temp.chk(r = r2, 'misma entrada y catálogo deben dar el mismo resultado');

  -- ---------------------------------------------------------------------------------------------------------
  -- Escenario 2 · sin receptor y sin canal aprobado (se modifica el catálogo; todo se revierte al final)
  -- ---------------------------------------------------------------------------------------------------------
  update public.agency_contacts set is_approved = false
   where agency_id in (select a.id from public.agencies a where a.name = 'Dirección de Alumbrado, Sistemas Eléctricos y Vía Pública');
  r := public.resolve_report_destination(pg_temp.loc('Villa Domínico'), 'luminaria_apagada_noche');
  perform pg_temp.chk((r ->> 'sin_destino_verificado')::boolean and r ->> 'criterio' = 'sin_destino'
                      and r -> 'falta' @> '["contacto"]'::jsonb and not (r -> 'falta' @> '["receptor"]'::jsonb)
                      and r -> 'organismo_verificado' ->> 'nombre' = 'Municipalidad de Avellaneda'
                      and (r ->> 'requiere_envio')::boolean is false, 'canal no aprobado: ' || r::text);

  delete from public.agency_services where route_role = 'principal'
     and attribute_value_id = (select v.id from public.service_attribute_values v where v.value_key = 'bache_calle')
     and agency_id in (select a.id from public.agencies a join public.subdivisions sd on sd.id = a.subdivision_id where sd.name = 'Avellaneda');
  r := public.resolve_report_destination(pg_temp.loc('Piñeyro'), 'bache_calle');
  perform pg_temp.chk((r ->> 'sin_destino_verificado')::boolean and r -> 'falta' @> '["receptor"]'::jsonb
                      and r -> 'organismo_verificado' ->> 'nombre' = 'Municipalidad de Avellaneda', 'sin receptor: ' || r::text);

  -- Catálogo vacío para la jurisdicción: sin organismo, sin canal, sin inventar nada
  delete from public.agency_services where route_role = 'general'
     and agency_id in (select a.id from public.agencies a join public.subdivisions sd on sd.id = a.subdivision_id where sd.name = 'Avellaneda');
  r := public.resolve_report_destination(pg_temp.loc('Wilde'), null);
  perform pg_temp.chk((r ->> 'sin_destino_verificado')::boolean and r -> 'organismo_verificado' = 'null'::jsonb
                      and r -> 'canal_verificado' = 'null'::jsonb and r -> 'falta' @> '["receptor"]'::jsonb, 'catálogo vacío: ' || r::text);

  -- ---------------------------------------------------------------------------------------------------------
  -- route_report · persistencia, repetibilidad y acceso
  -- ---------------------------------------------------------------------------------------------------------
  select id into v_uid from public.profiles order by id limit 1;
  select id into v_service from public.services where service_code = 'INFRAESTRUCTURA';
  perform pg_temp.chk(v_uid is not null and v_service is not null, 'PRECONDICION: hace falta un perfil y la categoría INFRAESTRUCTURA');

  insert into public.citizen_reports (client_side_id, user_id, service_id, locality_id, description, latitud, longitud)
  values (gen_random_uuid(), v_uid, v_service, pg_temp.loc('Flores'), 'Reporte de prueba REP-2800: bache en la calzada', -34.63, -58.46)
  returning id into v_report;

  perform pg_temp.as_user(v_uid);   -- el autor
  r := public.route_report(v_report, 'bache_calle', false, 'secundaria');
  perform pg_temp.chk(r ->> 'report_id' = v_report::text and r -> 'organismo_verificado' ->> 'nombre' = 'Comuna 7', 'route_report autor: ' || coalesce(r::text, 'null'));
  -- D4: el fundamento es solo informativo; que no haya infracción acreditada no quita el receptor
  perform pg_temp.chk(not (r -> 'falta' @> '["receptor"]'::jsonb), 'D4: el receptor no depende del fundamento');
  select count(*), max(updated_at) into v_n, v_updated from public.report_routing where report_id = v_report;
  perform pg_temp.chk(v_n = 1, 'debe haber una sola fila de routing');

  r2 := public.route_report(v_report, 'bache_calle', false, 'secundaria');   -- repetición
  perform pg_temp.chk(r2 = r, 'la repetición debe devolver lo mismo');
  select count(*) into v_n from public.report_routing where report_id = v_report and updated_at = v_updated;
  perform pg_temp.chk(v_n = 1, 'la repetición no debe reescribir ni duplicar el registro');

  r2 := public.route_report(v_report, 'bache_calle', false, 'avenida');      -- otra entrada: se recalcula y se registra
  perform pg_temp.chk(r2 -> 'organismo_verificado' ->> 'nombre' = 'Ministerio de Espacio Público e Higiene Urbana', 'cambio de entrada');
  select count(*) into v_n from public.report_routing where report_id = v_report;
  perform pg_temp.chk(v_n = 1, 'sigue habiendo una sola fila por reporte');

  -- La prestación elegida por el vecino (infraction_attribute_responses) se usa si no viene por parámetro
  insert into public.infraction_attribute_responses (report_id, attribute_id, selected_value)
  select v_report, sa.id, 'bache_calle'
    from public.service_attributes sa where sa.service_id = v_service and sa.attribute_code = 'prestacion';
  r2 := public.route_report(v_report, null, false, 'secundaria');
  perform pg_temp.chk(r2 -> 'organismo_verificado' ->> 'nombre' = 'Comuna 7', 'prestación tomada del reporte: ' || r2::text);

  -- Un tercero no ve nada (ni siquiera si existe)
  perform pg_temp.as_user(v_other);
  perform pg_temp.chk(public.route_report(v_report, 'bache_calle', false, 'secundaria') is null, 'un tercero no debe poder routear ni ver');

  -- El canal de prueba (REP-2801) solo lo ve el servidor
  update public.agency_contacts set test_value = 'prueba@example.test'
   where is_primary and agency_id in (select a.id from public.agencies a where a.name = 'Comuna 7');
  perform pg_temp.as_user(v_uid);
  r := public.resolve_report_destination(pg_temp.loc('Flores'), 'bache_calle', false, 'secundaria');
  perform pg_temp.chk(r ->> 'canal_prueba' is null and r::text !~ 'prueba@example', 'el canal de prueba no debe verse fuera del servidor');
  perform pg_temp.as_server();
  r := public.resolve_report_destination(pg_temp.loc('Flores'), 'bache_calle', false, 'secundaria');
  perform pg_temp.chk(r ->> 'canal_prueba' = 'prueba@example.test'
                      and r -> 'canal_verificado' ->> 'valor' <> 'prueba@example.test', 'el servidor ve el canal de prueba aparte del verificado');

  -- ---------------------------------------------------------------------------------------------------------
  -- Seguridad
  -- ---------------------------------------------------------------------------------------------------------
  perform pg_temp.chk(not has_function_privilege('anon', 'public.route_report(uuid,text,boolean,text)', 'execute')
                      and not has_function_privilege('anon', 'public.resolve_report_destination(uuid,text,boolean,text)', 'execute'),
                      'anon no debe ejecutar el routing');
  perform pg_temp.chk(has_function_privilege('authenticated', 'public.route_report(uuid,text,boolean,text)', 'execute')
                      and has_function_privilege('service_role', 'public.route_report(uuid,text,boolean,text)', 'execute'),
                      'authenticated y service_role deben ejecutar route_report');
  perform pg_temp.chk(not has_function_privilege('authenticated', 'public._routing_candidates(uuid,uuid,boolean,boolean,text,boolean)', 'execute'),
                      'la auxiliar interna no debe ser ejecutable por authenticated');
  perform pg_temp.chk((select relrowsecurity from pg_class where oid = 'public.report_routing'::regclass), 'report_routing debe tener RLS');
  select count(*) into v_n from pg_policies where schemaname = 'public' and tablename = 'report_routing' and cmd <> 'SELECT';
  perform pg_temp.chk(v_n = 0, 'report_routing no debe permitir escrituras desde el cliente');
  select count(*) into v_n from pg_policies where schemaname = 'public' and tablename = 'agency_contacts';
  perform pg_temp.chk(v_n = 0, 'agency_contacts debe seguir sin políticas (solo servidor)');

  raise exception 'REP-2800 OK · todas las verificaciones pasaron (se revierte todo)';
end
$t$;
