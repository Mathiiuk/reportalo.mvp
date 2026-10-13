-- REP-2502 · Prueba LOCAL de la migración de estados y trazabilidad.
--
-- ⚠ SOLO PARA UN POSTGRES LOCAL DESCARTABLE. Crea tablas y funciones de reemplazo (auth.uid, auth.role,
-- profile_attends_report, etc.) con los mismos nombres que las reales: NUNCA correr contra staging ni producción.
--
-- Uso (con un Postgres local vacío):
--   createdb rep2502 && psql -d rep2502 -v ON_ERROR_STOP=1 -f scripts/rep2502/prueba_local_estados.sql
-- Termina con «REP-2502: todas las pruebas pasaron» o aborta con la primera aserción que falle.

\set ON_ERROR_STOP on

-- ------------------------------------------------------------------ esquema mínimo de reemplazo
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;

create schema if not exists auth;
create or replace function auth.uid()  returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select nullif(current_setting('test.role', true), '') $$;

create table agencies(id uuid primary key, name text);
create table profiles(id uuid primary key, agency_id uuid);
create table report_states(code varchar primary key, description text not null, open311_status varchar not null);
create table citizen_reports(id uuid primary key, user_id uuid, description text,
  current_state_code varchar not null default 'RECIBIDO' references report_states(code),
  created_at timestamptz default now(), updated_at timestamptz default now());
create table report_state_history(id uuid primary key default gen_random_uuid(), report_id uuid not null references citizen_reports(id),
  state_code varchar not null references report_states(code), changed_by uuid references profiles(id), notes text,
  changed_at timestamptz default now(), actor_agency_id uuid references agencies(id));
create table test_attends(profile_id uuid, report_id uuid);
create function profile_attends_report(p_profile_id uuid, p_report_id uuid) returns boolean language sql stable as
  $$ select exists (select 1 from test_attends t where t.profile_id = p_profile_id and t.report_id = p_report_id) $$;

insert into report_states values
  ('RECIBIDO', 'Recibido', 'open'), ('EN_ANALISIS', 'En análisis', 'open'), ('DERIVADO', 'Derivado al organismo', 'open'),
  ('RESUELTO', 'Resuelto', 'closed'), ('DESESTIMADO', 'Desestimado', 'closed');

-- Personas: 1111 = autora · 2222 = tercero · 3333 = funcionaria que atiende · 4444 = funcionaria que NO atiende
insert into agencies values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Municipalidad de Avellaneda');
insert into profiles values
  ('11111111-1111-1111-1111-111111111111', null), ('22222222-2222-2222-2222-222222222222', null),
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Reportes (ids terminados en 01..09)
insert into citizen_reports (id, user_id, description) select ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
  '11111111-1111-1111-1111-111111111111', 'reporte ' || n from generate_series(1, 9) n;
insert into test_attends values
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000003'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000004');

-- ------------------------------------------------------------------ La migración bajo prueba
-- Antes: un historial «viejo» (sin las columnas nuevas) para comprobar el relleno
insert into report_state_history (report_id, state_code, notes, changed_at) values
  ('00000000-0000-0000-0000-000000000008', 'RECIBIDO',    null,                           now() - interval '3 hours'),
  ('00000000-0000-0000-0000-000000000008', 'EN_ANALISIS', 'Análisis automático en curso', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-000000000008', 'RESUELTO',    'Asistencia: canales',          now() - interval '1 hour');
update citizen_reports set current_state_code = 'RESUELTO' where id = '00000000-0000-0000-0000-000000000008';

\i supabase/migrations/20261013160000_rep2502_estados_y_trazabilidad_del_reporte.sql

-- ------------------------------------------------------------------ aserciones
create or replace function assert_eq(p_name text, p_actual text, p_expected text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FALLÓ [%]: esperado %, obtenido %', p_name, coalesce(p_expected, 'NULL'), coalesce(p_actual, 'NULL');
  end if;
  raise notice 'ok  %', p_name;
end $$;

create or replace function st(p_report text) returns text language sql as
  $$ select current_state_code from citizen_reports where id = ('00000000-0000-0000-0000-0000000000' || p_report)::uuid $$;
create or replace function nhist(p_report text) returns bigint language sql as
  $$ select count(*) from report_state_history where report_id = ('00000000-0000-0000-0000-0000000000' || p_report)::uuid $$;
create or replace function nrej(p_report text, p_code text) returns bigint language sql as
  $$ select count(*) from report_state_change_rejections where report_id = ('00000000-0000-0000-0000-0000000000' || p_report)::uuid and reason_code = p_code $$;

-- R · relleno del historial viejo
select assert_eq('R1 el primer registro no tiene estado anterior', (select previous_state_code from report_state_history where report_id = '00000000-0000-0000-0000-000000000008' and state_code = 'RECIBIDO'), null);
select assert_eq('R2 EN_ANALISIS viene de RECIBIDO', (select previous_state_code from report_state_history where report_id = '00000000-0000-0000-0000-000000000008' and state_code = 'EN_ANALISIS'), 'RECIBIDO');
select assert_eq('R3 el evento se deduce de la matriz', (select event_code from report_state_history where report_id = '00000000-0000-0000-0000-000000000008' and state_code = 'EN_ANALISIS'), 'ANALISIS_AUTOMATICO');
select assert_eq('R4 el cierre viejo queda con su evento', (select event_code from report_state_history where report_id = '00000000-0000-0000-0000-000000000008' and state_code = 'RESUELTO'), 'CIERRE_AUTOMATICO_ASISTENCIA');
select assert_eq('R5 los viejos quedan como del sistema', (select count(*) from report_state_history where actor_type is distinct from 'sistema')::text, '0');
select assert_eq('R6 la matriz trae solo las 3 transiciones del sistema', (select count(*) from report_state_transitions)::text || '/' || (select count(*) filter (where actor_type = 'sistema') from report_state_transitions)::text, '3/3');

-- H · un registro nuevo escrito como lo hacen las funciones del RAG (sin las columnas nuevas) se completa solo
insert into report_state_history (report_id, state_code, notes) values ('00000000-0000-0000-0000-000000000001', 'EN_ANALISIS', 'Análisis automático en curso');
select assert_eq('H1 estado anterior del registro nuevo: no hay (es el primero del reporte)', (select previous_state_code from report_state_history where report_id = '00000000-0000-0000-0000-000000000001'), null);
update citizen_reports set current_state_code = 'EN_ANALISIS' where id = '00000000-0000-0000-0000-000000000001';
insert into report_state_history (report_id, state_code, notes) values ('00000000-0000-0000-0000-000000000001', 'DESESTIMADO', 'Fuera del alcance de Reportalo');
select assert_eq('H2 estado anterior completado solo', (select previous_state_code from report_state_history where report_id = '00000000-0000-0000-0000-000000000001' and state_code = 'DESESTIMADO'), 'EN_ANALISIS');
select assert_eq('H3 evento deducido', (select event_code from report_state_history where report_id = '00000000-0000-0000-0000-000000000001' and state_code = 'DESESTIMADO'), 'CIERRE_AUTOMATICO_FUERA_DE_ALCANCE');
select assert_eq('H4 actor deducido', (select actor_type from report_state_history where report_id = '00000000-0000-0000-0000-000000000001' and state_code = 'DESESTIMADO'), 'sistema');

-- Preparación: el reporte 02 pasa a EN_ANALISIS (como lo deja enqueue_rag_analysis)
update citizen_reports set current_state_code = 'EN_ANALISIS' where id = '00000000-0000-0000-0000-000000000002';
insert into report_state_history (report_id, state_code, notes) values ('00000000-0000-0000-0000-000000000002', 'RECIBIDO', null);
insert into report_state_history (report_id, state_code, notes) values ('00000000-0000-0000-0000-000000000002', 'EN_ANALISIS', 'Análisis automático en curso');

-- S · el servidor (sistema)
select set_config('test.uid', '', false) as a, set_config('test.role', 'service_role', false) as b \gset
select change_report_state('00000000-0000-0000-0000-000000000002', 'DESESTIMADO', 'Fuera del alcance de Reportalo') as r \gset s1_
select assert_eq('S1 el sistema cierra EN_ANALISIS -> DESESTIMADO', :'s1_r'::jsonb ->> 'ok', 'true');
select assert_eq('S1 el estado cambió', st('02'), 'DESESTIMADO');
select assert_eq('S1 quedó el estado anterior', (select previous_state_code from report_state_history where report_id = '00000000-0000-0000-0000-000000000002' and state_code = 'DESESTIMADO'), 'EN_ANALISIS');
select assert_eq('S1 quedó el evento', (select event_code from report_state_history where report_id = '00000000-0000-0000-0000-000000000002' and state_code = 'DESESTIMADO'), 'CIERRE_AUTOMATICO_FUERA_DE_ALCANCE');
select assert_eq('S1 quedó el motivo', (select notes from report_state_history where report_id = '00000000-0000-0000-0000-000000000002' and state_code = 'DESESTIMADO'), 'Fuera del alcance de Reportalo');
select assert_eq('S1 quedó la fecha', (select (changed_at is not null)::text from report_state_history where report_id = '00000000-0000-0000-0000-000000000002' and state_code = 'DESESTIMADO'), 'true');

-- X · transición no definida, aun para el servidor: el estado NO cambia y queda evidencia
select change_report_state('00000000-0000-0000-0000-000000000002', 'EN_ANALISIS', 'volver atrás') as r \gset x1_
select assert_eq('X1 DESESTIMADO -> EN_ANALISIS no está definida', :'x1_r'::jsonb ->> 'code', 'transicion_no_definida');
select assert_eq('X1 el estado no cambió', st('02'), 'DESESTIMADO');
select assert_eq('X1 no se agregó historial', nhist('02')::text, '3');
select assert_eq('X1 quedó la evidencia del rechazo', nrej('02', 'transicion_no_definida')::text, '1');
select assert_eq('X1 la evidencia dice qué se intentó', (select attempted_state || '/' || current_state_code || '/' || actor_type from report_state_change_rejections where report_id = '00000000-0000-0000-0000-000000000002'), 'EN_ANALISIS/DESESTIMADO/sistema');

-- M · mismo estado y estado inexistente
select change_report_state('00000000-0000-0000-0000-000000000002', 'DESESTIMADO', 'x') as r \gset m1_
select assert_eq('M1 mismo estado', :'m1_r'::jsonb ->> 'code', 'mismo_estado');
select change_report_state('00000000-0000-0000-0000-000000000002', 'INVENTADO', 'x') as r \gset m2_
select assert_eq('M2 estado inexistente', :'m2_r'::jsonb ->> 'code', 'estado_inexistente');
select change_report_state('00000000-0000-0000-0000-0000000000ff', 'RESUELTO', 'x') as r \gset m3_
select assert_eq('M3 reporte inexistente', :'m3_r'::jsonb ->> 'code', 'reporte_inexistente');
select assert_eq('M3 el reporte inexistente no deja evidencia colgada', (select count(*) from report_state_change_rejections where attempted_state = 'RESUELTO' and report_id::text like '%ff')::text, '0');

-- O · organismo que atiende: hoy NO hay transiciones aprobadas para organismos -> se rechaza y se deja evidencia
update citizen_reports set current_state_code = 'EN_ANALISIS' where id = '00000000-0000-0000-0000-000000000003';
select set_config('test.uid', '33333333-3333-3333-3333-333333333333', false) as a, set_config('test.role', 'authenticated', false) as b \gset
select change_report_state('00000000-0000-0000-0000-000000000003', 'DERIVADO', 'Se derivó a Obras Públicas') as r \gset o1_
select assert_eq('O1 sin transición aprobada para organismos, se rechaza', :'o1_r'::jsonb ->> 'code', 'transicion_no_definida');
select assert_eq('O1 el estado no cambió', st('03'), 'EN_ANALISIS');
select assert_eq('O1 la evidencia registra al organismo', (select actor_type || '/' || actor_profile_id::text from report_state_change_rejections where report_id = '00000000-0000-0000-0000-000000000003'), 'organismo/33333333-3333-3333-3333-333333333333');

-- O2..O5 · una vez que el PO apruebe una transición de organismo, se agrega como DATOS y funciona (acá se simula con una fila de prueba)
select set_config('test.uid', '', false) as a, set_config('test.role', 'service_role', false) as b \gset
insert into report_state_transitions values ('EN_ANALISIS', 'DERIVADO', 'organismo', 'DERIVACION_A_ORGANISMO', 'SOLO PRUEBA LOCAL', current_date, 'fila de prueba');
select set_config('test.uid', '33333333-3333-3333-3333-333333333333', false) as a, set_config('test.role', 'authenticated', false) as b \gset
select change_report_state('00000000-0000-0000-0000-000000000003', 'DERIVADO', null) as r \gset o2_
select assert_eq('O2 un organismo debe indicar el motivo', :'o2_r'::jsonb ->> 'code', 'motivo_requerido');
select assert_eq('O2 el estado no cambió', st('03'), 'EN_ANALISIS');
select change_report_state('00000000-0000-0000-0000-000000000003', 'DERIVADO', 'Se derivó a Obras Públicas') as r \gset o3_
select assert_eq('O3 con transición aprobada y motivo, el organismo cambia el estado', :'o3_r'::jsonb ->> 'ok', 'true');
select assert_eq('O3 el estado cambió', st('03'), 'DERIVADO');
select assert_eq('O3 queda quién, de qué organismo y cómo', (select changed_by::text || '/' || actor_agency_id::text || '/' || actor_type || '/' || event_code from report_state_history where report_id = '00000000-0000-0000-0000-000000000003' and state_code = 'DERIVADO'), '33333333-3333-3333-3333-333333333333/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/organismo/DERIVACION_A_ORGANISMO');
select assert_eq('O3 queda el estado anterior', (select previous_state_code from report_state_history where report_id = '00000000-0000-0000-0000-000000000003' and state_code = 'DERIVADO'), 'EN_ANALISIS');

-- P · sin permiso: otra funcionaria que NO atiende ese reporte, un tercero y la propia autora
update citizen_reports set current_state_code = 'EN_ANALISIS' where id = '00000000-0000-0000-0000-000000000005';
select set_config('test.uid', '44444444-4444-4444-4444-444444444444', false) as a \gset
select change_report_state('00000000-0000-0000-0000-000000000005', 'DERIVADO', 'intento') as r \gset p1_
select assert_eq('P1 funcionaria que no atiende el reporte', :'p1_r'::jsonb ->> 'code', 'sin_permiso');
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false) as a \gset
select change_report_state('00000000-0000-0000-0000-000000000005', 'RESUELTO', 'intento') as r \gset p2_
select assert_eq('P2 tercero sin relación', :'p2_r'::jsonb ->> 'code', 'sin_permiso');
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false) as a \gset
select change_report_state('00000000-0000-0000-0000-000000000005', 'RESUELTO', 'lo cierro yo') as r \gset p3_
select assert_eq('P3 la autora no puede cambiar el estado de su propio reporte', :'p3_r'::jsonb ->> 'code', 'sin_permiso');
select assert_eq('P3 el estado no cambió', st('05'), 'EN_ANALISIS');
select assert_eq('P3 hay evidencia de los 3 intentos', nrej('05', 'sin_permiso')::text, '3');
select assert_eq('P3 la evidencia distingue quién intentó', (select string_agg(actor_type, ',' order by actor_type) from report_state_change_rejections where report_id = '00000000-0000-0000-0000-000000000005'), 'ciudadano,desconocido,desconocido');

-- Q · permisos de ejecución
select assert_eq('Q1 anónimo no puede ejecutarla', has_function_privilege('anon', 'public.change_report_state(uuid,text,text)', 'execute')::text, 'false');
select assert_eq('Q2 usuario autenticado sí', has_function_privilege('authenticated', 'public.change_report_state(uuid,text,text)', 'execute')::text, 'true');
select assert_eq('Q3 los intentos rechazados no los lee un usuario autenticado', has_table_privilege('authenticated', 'public.report_state_change_rejections', 'select')::text, 'false');
select assert_eq('Q4 la matriz sí la puede leer', has_table_privilege('authenticated', 'public.report_state_transitions', 'select')::text, 'true');
select assert_eq('Q5 la matriz no la puede modificar un usuario', has_table_privilege('authenticated', 'public.report_state_transitions', 'insert')::text, 'false');

-- C · coherencia: el estado actual de cada reporte con historial es el del último registro
select assert_eq('C1 estado actual = último estado del historial (reportes tocados por la prueba)',
  (select count(*) from citizen_reports r join lateral (select h.state_code from report_state_history h where h.report_id = r.id order by h.changed_at desc, h.id desc limit 1) l on true
    where l.state_code <> r.current_state_code and r.id in ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000008'))::text, '0');

\echo
\echo 'REP-2502: todas las pruebas pasaron'
