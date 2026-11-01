-- REP-3892 · Verificación del borrador solo para reportes elegibles (O-01) y de la etiqueta «usuario» (O-03)
--
-- Se corre contra una base donde YA está aplicada 20261101120000_rep3892_borradores_excluidos.sql. NO deja nada:
-- termina SIEMPRE con una excepción para que cualquier ejecutor revierta lo que creó (reportes, análisis, entregas y
-- routing de prueba). Si todo está bien, el mensaje empieza con «REP-3892 OK».
--
-- Escenarios del ticket:
--   C-09  · #RP-371F42E4 (Tránsito, fuera_de_alcance) pedido por su autor con 'bache_calle' -> sin borrador
--   O-01b · prestación de otra categoría con análisis válido -> rechazo sin reescribir la categoría
--   O-01c · asistencia nunca termina en borrador_generado; situacion_de_calle sigue en 'comunicado'
--   O-01d · bache legítimo en CABA y en Avellaneda -> borrador_generado, reintento sin duplicado
--   O-01e · un tercero recibe null
--   O-03  · el borrador dice «Descripción del usuario»

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
-- Un reporte de prueba del autor dado, en la categoría y localidad dadas, con su último análisis (null = sin análisis)
create or replace function pg_temp.mk_report(p_uid uuid, p_service text, p_loc text, p_analisis text) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.citizen_reports (client_side_id, user_id, service_id, locality_id, description, latitud, longitud)
  values (gen_random_uuid(), p_uid, (select id from public.services where service_code = p_service), pg_temp.loc(p_loc),
          'Pozo grande en la calzada frente a la escuela.', -34.6283, -58.4631)
  returning id into v_id;
  if p_analisis is not null then
    insert into public.report_ai_analysis (report_id, result_status_code, confidence_score, embedding_model_code)
    values (v_id, p_analisis, 0.9, 'rep3892-verificacion');
  end if;
  return v_id;
end $$;

do $t$
declare
  v_c09      uuid;
  v_autor    uuid;
  v_uid      uuid;
  v_other    uuid := gen_random_uuid();
  v_rep      uuid;
  v_svc      uuid;
  v_routing  text;
  v_n        int;
  r          jsonb;
  r2         jsonb;
begin
  perform pg_temp.as_server();
  perform pg_temp.chk(position('REP-3892 O-01' in pg_get_functiondef(
                        'public.prepare_organism_delivery(uuid,text,boolean,text)'::regprocedure)) > 0,
                      'PRECONDICION: falta la migración de REP-3892');
  select id into v_uid from public.profiles order by id limit 1;

  -- ------------------------------------------------------------------------------------------------------------
  -- C-09 · el caso real de Ivo, pedido por su autor
  -- ------------------------------------------------------------------------------------------------------------
  select id, user_id, service_id into v_c09, v_autor, v_svc from public.citizen_reports where id::text like '371f42e4%';
  perform pg_temp.chk(v_c09 is not null, 'PRECONDICION: no está #RP-371F42E4');
  select count(*) into v_n from public.report_outreach_logs where report_id = v_c09;
  select result::text into v_routing from public.report_routing where report_id = v_c09;

  perform pg_temp.as_user(v_autor);
  r := public.prepare_organism_delivery(v_c09, 'bache_calle');
  perform pg_temp.chk(r ->> 'estado' = 'excluido_fuera_de_alcance' and not (r ->> 'es_borrador')::boolean
                      and not (r ->> 'enviado')::boolean and r -> 'entrega_id' = 'null'::jsonb and r -> 'payload' is null,
                      'C-09: ' || coalesce(r::text, 'null'));
  r := public.prepare_organism_delivery(v_c09, null);
  perform pg_temp.chk(r ->> 'estado' = 'excluido_fuera_de_alcance', 'C-09 sin prestación: ' || coalesce(r::text, 'null'));
  perform pg_temp.chk((select count(*) from public.report_outreach_logs where report_id = v_c09) = v_n,
                      'C-09: no se guardó ninguna entrega nueva');
  perform pg_temp.chk((select result::text from public.report_routing where report_id = v_c09) is not distinct from v_routing,
                      'C-09: el routing no cambió');
  perform pg_temp.chk((select service_id from public.citizen_reports where id = v_c09) is not distinct from v_svc,
                      'C-09: la categoría del reporte no cambió');

  perform pg_temp.as_user(v_other);
  perform pg_temp.chk(public.prepare_organism_delivery(v_c09, 'bache_calle') is null, 'C-09: un tercero recibe null');

  -- ------------------------------------------------------------------------------------------------------------
  -- O-01b · prestación de otra categoría con análisis válido
  -- ------------------------------------------------------------------------------------------------------------
  perform pg_temp.as_server();
  v_rep := pg_temp.mk_report(v_uid, 'TRANSITO', 'Flores', 'fundamentado');
  perform pg_temp.as_user(v_uid);
  r := public.prepare_organism_delivery(v_rep, 'bache_calle', false, 'secundaria');
  perform pg_temp.chk(r ->> 'estado' = 'prestacion_incompatible' and r ->> 'motivo' like '%«bache_calle»%',
                      'O-01b: ' || coalesce(r::text, 'null'));
  perform pg_temp.chk(not exists (select 1 from public.report_outreach_logs where report_id = v_rep)
                      and not exists (select 1 from public.report_routing where report_id = v_rep)
                      and (select s.service_code from public.citizen_reports c join public.services s on s.id = c.service_id
                            where c.id = v_rep) = 'TRANSITO',
                      'O-01b: sin entrega, sin routing y categoría Tránsito intacta');

  -- ------------------------------------------------------------------------------------------------------------
  -- O-01c · asistencia
  -- ------------------------------------------------------------------------------------------------------------
  perform pg_temp.as_server();
  v_rep := pg_temp.mk_report(v_uid, 'INFRAESTRUCTURA', 'Flores', 'asistencia');
  perform pg_temp.as_user(v_uid);
  r := public.prepare_organism_delivery(v_rep, 'bache_calle', false, 'secundaria');
  perform pg_temp.chk(r ->> 'estado' = 'excluido_asistencia'
                      and not exists (select 1 from public.report_outreach_logs where report_id = v_rep),
                      'O-01c: ' || coalesce(r::text, 'null'));
  perform pg_temp.as_server();
  v_rep := pg_temp.mk_report(v_uid, 'VULNERABILIDAD_SOCIAL', 'Balvanera', 'asistencia');
  perform pg_temp.as_user(v_uid);
  r := public.prepare_organism_delivery(v_rep, 'situacion_de_calle');
  perform pg_temp.chk(r ->> 'estado' = 'comunicado' and not (r ->> 'enviado')::boolean,
                      'O-01c situación de calle sigue en comunicado: ' || coalesce(r::text, 'null'));

  -- ------------------------------------------------------------------------------------------------------------
  -- O-01d + O-03 · baches legítimos con reintento
  -- ------------------------------------------------------------------------------------------------------------
  perform pg_temp.as_server();
  v_rep := pg_temp.mk_report(v_uid, 'INFRAESTRUCTURA', 'Flores', 'fundamentado');
  perform pg_temp.as_user(v_uid);
  r := public.prepare_organism_delivery(v_rep, 'bache_calle', false, 'secundaria');
  r2 := public.prepare_organism_delivery(v_rep, 'bache_calle', false, 'secundaria');
  perform pg_temp.chk(r ->> 'estado' = 'borrador_generado' and r -> 'payload' -> 'destino' -> 'organismo' ->> 'nombre' = 'Comuna 7',
                      'O-01d CABA: ' || coalesce(r::text, 'null'));
  perform pg_temp.chk(r ->> 'cuerpo_texto' like '%Descripción del usuario: Pozo grande%'
                      and r ->> 'cuerpo_texto' not like '%Descripción del vecino%', 'O-03 CABA: ' || (r ->> 'cuerpo_texto'));
  perform pg_temp.chk((r2 ->> 'repetido')::boolean and r2 ->> 'entrega_id' = r ->> 'entrega_id'
                      and (select count(*) from public.report_outreach_logs where report_id = v_rep) = 1,
                      'O-01d CABA reintento sin duplicado');

  perform pg_temp.as_server();
  v_rep := pg_temp.mk_report(v_uid, 'INFRAESTRUCTURA', 'Sarandí', 'fundamentado');
  perform pg_temp.as_user(v_uid);
  r := public.prepare_organism_delivery(v_rep, 'bache_calle');
  r2 := public.prepare_organism_delivery(v_rep, 'bache_calle');
  perform pg_temp.chk(r ->> 'estado' = 'borrador_generado' and r -> 'payload' -> 'destino' ->> 'jurisdiccion' = 'AVELLANEDA',
                      'O-01d Avellaneda: ' || coalesce(r::text, 'null'));
  perform pg_temp.chk((r2 ->> 'repetido')::boolean and (select count(*) from public.report_outreach_logs where report_id = v_rep) = 1,
                      'O-01d Avellaneda reintento sin duplicado');

  -- Ningún correo real: todo sigue siendo borrador sin fecha de envío
  perform pg_temp.chk(not exists (select 1 from public.report_outreach_logs
                                   where report_id in (select id from public.citizen_reports where description like 'Pozo grande en la calzada frente a la escuela.')
                                     and (sent_at is not null or mode <> 'borrador')),
                      'sin envíos reales');

  raise exception 'REP-3892 OK · todas las verificaciones pasaron (se revierte todo)';
end
$t$;
