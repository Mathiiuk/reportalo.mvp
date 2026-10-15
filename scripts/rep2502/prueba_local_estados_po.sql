-- REP-2502 (H-2) · Prueba LOCAL de la migración de estados definidos por el PO.
--
-- ⚠ SOLO PARA UN POSTGRES LOCAL DESCARTABLE. Crea tablas y funciones de reemplazo con los mismos nombres que las reales:
-- NUNCA correr contra staging ni producción.
--
-- Uso (con un Postgres local vacío, desde la raíz del repositorio):
--   createdb rep2502po && psql -d rep2502po -v ON_ERROR_STOP=1 -f scripts/rep2502/prueba_local_estados_po.sql
-- Termina con «REP-2502 H-2: todas las pruebas pasaron» o aborta con la primera aserción que falle.

\set ON_ERROR_STOP on

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
create table services(id uuid primary key, service_code text not null);
create table report_states(code varchar primary key, description text not null, open311_status varchar not null);
create table citizen_reports(id uuid primary key, user_id uuid, service_id uuid references services(id), description text,
  current_state_code varchar not null default 'RECIBIDO' references report_states(code),
  created_at timestamptz default now(), updated_at timestamptz default now());
create table report_state_history(id uuid primary key default gen_random_uuid(), report_id uuid not null references citizen_reports(id),
  state_code varchar not null references report_states(code), changed_by uuid references profiles(id), notes text,
  changed_at timestamptz default now(), actor_agency_id uuid references agencies(id));
create table test_attends(profile_id uuid, report_id uuid);
create function profile_attends_report(p_profile_id uuid, p_report_id uuid) returns boolean language sql stable as
  $$ select exists (select 1 from test_attends t where t.profile_id = p_profile_id and t.report_id = p_report_id) $$;

-- Lo mínimo del RAG que persist_rag_analysis necesita
create table report_ai_analysis(id uuid primary key default gen_random_uuid(), report_id uuid not null unique, result_status_code text,
  is_infraction boolean, suggested_service_id uuid, suggested_agency_id uuid, citizen_feedback text, official_legal_foundation text,
  confidence_score numeric, embedding_model_code text, generation_model_code text, prompt_version text, input_tokens int,
  output_tokens int, latency_ms int, status_reason text, created_at timestamptz default now());
create table report_ai_evidence(analysis_id uuid, fragment_id uuid, rank int, similarity numeric, was_cited boolean, quoted_text text);

insert into report_states values
  ('RECIBIDO', 'Recibido', 'open'), ('EN_ANALISIS', 'En análisis', 'open'), ('DERIVADO', 'Derivado al organismo', 'open'),
  ('RESUELTO', 'Resuelto', 'closed'), ('DESESTIMADO', 'Desestimado', 'closed');

insert into agencies values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Municipalidad de Avellaneda');
insert into profiles values
  ('11111111-1111-1111-1111-111111111111', null),
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into services values ('99999999-0000-0000-0000-000000000001', 'INFRAESTRUCTURA'), ('99999999-0000-0000-0000-000000000002', 'VULNERABILIDAD_SOCIAL');

-- Reportes 01..14. Los ids se arman como 00000000-0000-0000-0000-0000000000NN
create function rid(p text) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-0000000000' || p)::uuid $$;
insert into citizen_reports (id, user_id, service_id, description)
select rid(lpad(n::text, 2, '0')), '11111111-1111-1111-1111-111111111111',
       (case when n = 7 then '99999999-0000-0000-0000-000000000002' else '99999999-0000-0000-0000-000000000001' end)::uuid, 'reporte ' || n
  from generate_series(1, 14) n;

-- Datos «viejos» (antes de la migración del PO) -------------------------------------------------------------------
-- 01, 02: RESUELTO por el cierre automático de asistencia · 03: RESUELTO por un organismo (con actor humano)
-- 04: DESESTIMADO por la IA · 05: DESESTIMADO por un organismo · 06: DERIVADO
update citizen_reports set current_state_code = 'RESUELTO'    where id in (rid('01'), rid('02'), rid('03'));
update citizen_reports set current_state_code = 'DESESTIMADO' where id in (rid('04'), rid('05'));
update citizen_reports set current_state_code = 'DERIVADO'    where id = rid('06');
-- 08..14 quedan EN_ANALISIS para probar persist_rag_analysis
update citizen_reports set current_state_code = 'EN_ANALISIS' where id between rid('07') and rid('14');

-- La migración original de REP-2502 (mecanismo) y, a continuación, la del PO
\i supabase/migrations/20261013160000_rep2502_estados_y_trazabilidad_del_reporte.sql

insert into report_state_history (report_id, state_code, notes, changed_at) values
  (rid('01'), 'EN_ANALISIS', null, now() - interval '3 hours'), (rid('01'), 'RESUELTO', 'Asistencia: canales', now() - interval '2 hours'),
  (rid('02'), 'EN_ANALISIS', null, now() - interval '3 hours'), (rid('02'), 'RESUELTO', 'Asistencia: canales', now() - interval '2 hours'),
  (rid('03'), 'EN_ANALISIS', null, now() - interval '3 hours');
insert into report_state_history (report_id, state_code, changed_by, actor_agency_id, notes, changed_at, actor_type)
  values (rid('03'), 'RESUELTO', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Se arregló', now() - interval '1 hour', 'organismo'),
         (rid('05'), 'DESESTIMADO', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'No corresponde', now() - interval '1 hour', 'organismo');
insert into report_state_history (report_id, state_code, notes, changed_at) values
  (rid('04'), 'EN_ANALISIS', null, now() - interval '3 hours'), (rid('04'), 'DESESTIMADO', 'Fuera del alcance de Reportalo', now() - interval '2 hours');

-- Los reportes en análisis ya tienen su fila EN_ANALISIS en el historial (la deja enqueue_rag_analysis)
insert into report_state_history (report_id, state_code, changed_at)
select rid(lpad(n::text, 2, '0')), 'EN_ANALISIS', now() - interval '1 hour' from generate_series(7, 14) n;

\i supabase/migrations/20261015140000_rep2502_estados_definidos_por_el_po.sql

-- Aserciones -------------------------------------------------------------------------------------------------------
create or replace function assert_eq(p_name text, p_actual text, p_expected text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FALLÓ [%]: esperado %, obtenido %', p_name, coalesce(p_expected, 'NULL'), coalesce(p_actual, 'NULL');
  end if;
  raise notice 'ok  %', p_name;
end $$;
create function st(p text) returns text language sql as $$ select current_state_code from citizen_reports where id = rid(p) $$;
create function nh(p text, p_event text) returns bigint language sql as
  $$ select count(*) from report_state_history where report_id = rid(p) and event_code = p_event $$;
create function run_rag(p text, p_result text) returns void language sql as
  $$ select persist_rag_analysis(jsonb_build_object('report_id', rid(p), 'result_status_code', p_result), '[]'::jsonb) $$;

-- M · datos y matriz
select assert_eq('M1 INFORMADO es un estado cerrado', (select open311_status from report_states where code = 'INFORMADO'), 'closed');
select assert_eq('M2 ESCALADO y EN_DISCREPANCIA existen y están abiertos',
  (select string_agg(code || ':' || open311_status, ',' order by code) from report_states where code in ('ESCALADO', 'EN_DISCREPANCIA')),
  'EN_DISCREPANCIA:open,ESCALADO:open');
select assert_eq('M3 el sistema ya no pasa a RESUELTO ni a DESESTIMADO',
  (select count(*)::text from report_state_transitions where actor_type = 'sistema' and to_state_code in ('RESUELTO', 'DESESTIMADO')), '0');
select assert_eq('M4 solo el organismo pasa a RESUELTO o DESESTIMADO',
  (select count(*)::text from report_state_transitions where to_state_code in ('RESUELTO', 'DESESTIMADO') and actor_type <> 'organismo'), '0');
select assert_eq('M5 de DERIVADO se va directo a RESUELTO o DESESTIMADO',
  (select count(*)::text from report_state_transitions where from_state_code = 'DERIVADO' and to_state_code in ('RESUELTO', 'DESESTIMADO') and actor_type = 'organismo'), '2');
select assert_eq('M6 transiciones del sistema', (select string_agg(from_state_code || '>' || to_state_code, ',' order by from_state_code, to_state_code)
  from report_state_transitions where actor_type = 'sistema'), 'EN_ANALISIS>DERIVADO,EN_ANALISIS>INFORMADO,RECIBIDO>EN_ANALISIS');

-- D · datos de prueba corregidos
select assert_eq('D1 RESUELTO por asistencia pasa a INFORMADO (01)', st('01'), 'INFORMADO');
select assert_eq('D2 RESUELTO por asistencia pasa a INFORMADO (02)', st('02'), 'INFORMADO');
select assert_eq('D3 RESUELTO por un organismo se conserva (03)', st('03'), 'RESUELTO');
select assert_eq('D4 DESESTIMADO por la IA vuelve a análisis (04)', st('04'), 'EN_ANALISIS');
select assert_eq('D5 DESESTIMADO por un organismo se conserva (05)', st('05'), 'DESESTIMADO');
select assert_eq('D6 DERIVADO no se toca (06)', st('06'), 'DERIVADO');
select assert_eq('D7 cada corrección deja su historial', (select string_agg(n::text, ',') from (select nh(p, 'CORRECCION_PO_H2') n from unnest(array['01','02','03','04','05','06']) p order by p) x), '1,1,0,1,0,0');
select assert_eq('D8 el historial guarda el estado anterior y el actor', (select previous_state_code || '/' || actor_type from report_state_history where report_id = rid('01') and event_code = 'CORRECCION_PO_H2'), 'RESUELTO/sistema');

-- P · persist_rag_analysis: la IA no resuelve ni desestima
select run_rag('08', 'asistencia');
select assert_eq('P1 asistencia -> INFORMADO', st('08'), 'INFORMADO');
select assert_eq('P2 queda el historial del cierre, con su evento', (select event_code || '/' || actor_type || '/' || previous_state_code from report_state_history where report_id = rid('08') and state_code = 'INFORMADO'), 'CIERRE_AUTOMATICO_ASISTENCIA/sistema/EN_ANALISIS');
select run_rag('09', 'fuera_de_alcance');
select assert_eq('P3 fuera de alcance NO cierra: sigue en EN_ANALISIS', st('09'), 'EN_ANALISIS');
select run_rag('07', 'fundamentado');
select assert_eq('P4 vulnerabilidad social -> INFORMADO aunque el análisis sea otro (07)', st('07'), 'INFORMADO');
select run_rag('10', 'fundamentado');
select run_rag('11', 'sin_normativa');
select run_rag('12', 'indeterminado');
select assert_eq('P5 fundamentado / sin_normativa / indeterminado siguen en EN_ANALISIS', st('10') || st('11') || st('12'), 'EN_ANALISISEN_ANALISISEN_ANALISIS');
select assert_eq('P6 nada queda RESUELTO ni DESESTIMADO por la IA', (select count(*)::text from citizen_reports where id in (rid('07'), rid('08'), rid('09'), rid('10'), rid('11'), rid('12')) and current_state_code in ('RESUELTO', 'DESESTIMADO')), '0');
-- idempotencia: repetir el análisis no vuelve a cerrar ni duplica el historial
select run_rag('08', 'asistencia');
select assert_eq('P7 repetir el análisis no duplica el historial', (select count(*)::text from report_state_history where report_id = rid('08') and state_code = 'INFORMADO'), '1');
-- un reporte que ya no está EN_ANALISIS no se toca
update citizen_reports set current_state_code = 'DERIVADO' where id = rid('13');
select run_rag('13', 'asistencia');
select assert_eq('P8 solo cierra reportes que siguen EN_ANALISIS', st('13'), 'DERIVADO');

-- C · change_report_state con la matriz nueva
set test.role = 'service_role';
select assert_eq('C1 el sistema ya no puede resolver por su cuenta', (select change_report_state(rid('10'), 'RESUELTO', 'x') ->> 'code'), 'transicion_no_definida');
select assert_eq('C2 el sistema puede derivar con el envío confirmado', (select change_report_state(rid('10'), 'DERIVADO', null) ->> 'event'), 'ENTREGA_CONFIRMADA');
select assert_eq('C3 queda en DERIVADO', st('10'), 'DERIVADO');
set test.role = '';
set test.uid = '33333333-3333-3333-3333-333333333333';
insert into test_attends values ('33333333-3333-3333-3333-333333333333', rid('10')), ('33333333-3333-3333-3333-333333333333', rid('11'));
select assert_eq('C4 el organismo no puede resolver sin motivo', (select change_report_state(rid('10'), 'RESUELTO', null) ->> 'code'), 'motivo_requerido');
select assert_eq('C5 el organismo no puede saltar de EN_ANALISIS a RESUELTO', (select change_report_state(rid('11'), 'RESUELTO', 'x') ->> 'code'), 'transicion_no_definida');
select assert_eq('C6 el organismo resuelve desde DERIVADO con motivo', (select change_report_state(rid('10'), 'RESUELTO', 'Se arregló el pozo') ->> 'ok'), 'true');
select assert_eq('C7 queda RESUELTO con el motivo', st('10') || '/' || (select notes from report_state_history where report_id = rid('10') and state_code = 'RESUELTO'), 'RESUELTO/Se arregló el pozo');
set test.uid = '11111111-1111-1111-1111-111111111111';
select assert_eq('C8 la autora no puede cambiar el estado', (select change_report_state(rid('14'), 'INFORMADO', 'x') ->> 'code'), 'sin_permiso');
set test.uid = '';

-- I · la migración se puede volver a correr sin efectos
select count(*) as historial_antes from report_state_history \gset
select count(*) as transiciones_antes from report_state_transitions \gset
\i supabase/migrations/20261015140000_rep2502_estados_definidos_por_el_po.sql
select assert_eq('I1 segunda corrida: el historial no cambia', (select count(*)::text from report_state_history), :'historial_antes');
select assert_eq('I2 segunda corrida: las transiciones no cambian', (select count(*)::text from report_state_transitions), :'transiciones_antes');

do $$ begin raise notice 'REP-2502 H-2: todas las pruebas pasaron'; end $$;
