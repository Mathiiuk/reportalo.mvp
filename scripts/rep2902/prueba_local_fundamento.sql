-- REP-2902 · Prueba LOCAL de get_report_legal_foundation.
--
-- ⚠ SOLO PARA UN POSTGRES LOCAL DESCARTABLE. Crea tablas y funciones de reemplazo (auth.uid, auth.role,
-- profile_attends_report, etc.) con los mismos nombres que las reales: NUNCA correr contra staging ni producción.
--
-- Uso (con un Postgres local vacío):
--   createdb rep2902 && psql -d rep2902 -v ON_ERROR_STOP=1 -f scripts/rep2902/prueba_local_fundamento.sql
-- Termina con «REP-2902: todas las pruebas pasaron» o aborta con la primera aserción que falle.

\set ON_ERROR_STOP on

-- ------------------------------------------------------------------ esquema mínimo de reemplazo
-- Roles que existen en Supabase y que la migración nombra en revoke/grant
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;

create schema if not exists auth;
-- Quién «llama»: se cambia con select set_config('test.uid', ..., false) y set_config('test.role', ..., false)
create or replace function auth.uid()  returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select nullif(current_setting('test.role', true), '') $$;

create table countries(id uuid primary key, name text);
create table states_provinces(id uuid primary key, country_id uuid, name text);
create table subdivisions(id uuid primary key, state_province_id uuid, name text);
create table localities(id uuid primary key, subdivision_id uuid, name text);
create table citizen_reports(id uuid primary key, user_id uuid, locality_id uuid, description text);
create table knowledge_sources(id uuid primary key, document_type_code text, document_number text, title text,
  issuing_authority text, country_id uuid, state_province_id uuid, subdivision_id uuid, requires_adhesion boolean default false,
  source_url text, is_current boolean default true, verified_at timestamptz default now(), last_amended_by text);
create table knowledge_fragments(id uuid primary key, source_id uuid, hierarchy_path text, article text, subsection text,
  content text, is_current boolean default true);
create table source_adhesions(source_id uuid, adhering_source_id uuid);
create table report_ai_analysis(id uuid primary key, report_id uuid, result_status_code text, citizen_feedback text,
  official_legal_foundation text, confidence_score numeric, prompt_version text, generation_model_code text,
  created_at timestamptz default now());
create table report_ai_evidence(analysis_id uuid, fragment_id uuid, rank integer, was_cited boolean, quoted_text text);
-- quién «atiende» cada reporte: en la base real lo resuelve profile_attends_report con perfiles y organismos
create table test_attends(profile_id uuid, report_id uuid);
create function profile_attends_report(p_profile_id uuid, p_report_id uuid) returns boolean language sql stable as
  $$ select exists (select 1 from test_attends t where t.profile_id = p_profile_id and t.report_id = p_report_id) $$;

-- Copia de eligible_knowledge_sources de staging (13/10/2026): el cascade de jurisdicción que usa el RAG
create or replace function public.eligible_knowledge_sources(p_locality_id uuid)
returns table(source_id uuid, scope_level integer) language sql stable set search_path to 'public' as $$
  with geo as (
    select l.subdivision_id, s.state_province_id, sp.country_id
    from localities l join subdivisions s on s.id = l.subdivision_id join states_provinces sp on sp.id = s.state_province_id
    where l.id = p_locality_id)
  select ks.id, case when ks.subdivision_id is not null then 1 when ks.state_province_id is not null then 2 else 3 end
  from knowledge_sources ks cross join geo
  where ks.is_current
    and (ks.subdivision_id = geo.subdivision_id or ks.state_province_id = geo.state_province_id or ks.country_id = geo.country_id)
    and (not ks.requires_adhesion or exists (
          select 1 from source_adhesions a join knowledge_sources ad on ad.id = a.adhering_source_id and ad.is_current
          where a.source_id = ks.id and (ad.subdivision_id = geo.subdivision_id or ad.state_province_id = geo.state_province_id)));
$$;

-- ------------------------------------------------------------------ la función bajo prueba
\i supabase/migrations/20261013140000_rep2902_fundamento_legal_preliminar.sql

-- ------------------------------------------------------------------ datos de prueba
-- Ids fijos para leer los resultados
insert into countries values ('00000000-0000-0000-0000-0000000000a1', 'Argentina');
insert into states_provinces values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'Buenos Aires'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'Ciudad Autónoma de Buenos Aires');
insert into subdivisions values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'Avellaneda'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b2', 'Comuna 7');
insert into localities values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'Gerli'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', 'Flores');

-- Fuentes: una de la Provincia (aplica a Avellaneda), una de CABA (NO aplica a Avellaneda), una derogada de la Provincia
insert into knowledge_sources (id, document_type_code, document_number, title, issuing_authority, state_province_id, source_url, is_current) values
  ('00000000-0000-0000-0000-0000000000e1', 'decreto_ley', '6769/58', 'Ley Orgánica de las Municipalidades', 'Provincia de Buenos Aires', '00000000-0000-0000-0000-0000000000b1', 'https://normas.gba.gob.ar/x', true),
  ('00000000-0000-0000-0000-0000000000e2', 'ley', '451', 'Régimen de Faltas', 'CABA', '00000000-0000-0000-0000-0000000000b2', 'https://boletinoficial.buenosaires.gob.ar/x', true),
  ('00000000-0000-0000-0000-0000000000e3', 'ley', '999', 'Norma ya derogada', 'Provincia de Buenos Aires', '00000000-0000-0000-0000-0000000000b1', 'https://normas.gba.gob.ar/y', false);
insert into knowledge_fragments (id, source_id, hierarchy_path, article, content) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', 'LOM > Artículo 59', '59',
   E'Artículo 59: La construcción, conservación y reparación de calles es competencia municipal.'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e2', 'Ley 451 > Artículo 6.1.52', '6.1.52',
   E'Estacionar en lugar prohibido se sanciona con multa.'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000e3', 'Norma derogada > Artículo 1', '1',
   E'Texto de una norma que ya no rige.');

-- Personas: autora del reporte, un tercero sin relación, quien atiende
-- 1111 = autora · 2222 = tercero · 3333 = quien atiende
insert into citizen_reports values
  ('00000000-0000-0000-0000-00000000aa01', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000d1', 'bache'),   -- S1 fundamentado ok
  ('00000000-0000-0000-0000-00000000aa02', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000d1', 'bache'),   -- S2 cita no literal
  ('00000000-0000-0000-0000-00000000aa03', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000d1', 'auto'),    -- S3 norma de otra jurisdicción
  ('00000000-0000-0000-0000-00000000aa04', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000d1', 'algo'),    -- S4 sin_normativa
  ('00000000-0000-0000-0000-00000000aa05', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000d1', 'nuevo'),   -- S5 sin análisis
  ('00000000-0000-0000-0000-00000000aa06', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000d1', 'viejo');   -- S6 fuente derogada
insert into test_attends values ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-00000000aa01');

insert into report_ai_analysis (id, report_id, result_status_code, citizen_feedback, official_legal_foundation, confidence_score, prompt_version, generation_model_code) values
  ('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-00000000aa01', 'fundamentado', 'TEXTO PRIVADO PARA LA CIUDADANA', 'La conservación de calles es competencia del municipio (art. 59).', 0.9, 'v5', 'gemini-3.8-flash'),
  ('00000000-0000-0000-0000-00000000bb02', '00000000-0000-0000-0000-00000000aa02', 'fundamentado', 'priv', 'Fundamento técnico', 0.9, 'v5', 'gemini-3.8-flash'),
  ('00000000-0000-0000-0000-00000000bb03', '00000000-0000-0000-0000-00000000aa03', 'fundamentado', 'priv', 'Fundamento técnico', 0.9, 'v5', 'gemini-3.8-flash'),
  ('00000000-0000-0000-0000-00000000bb04', '00000000-0000-0000-0000-00000000aa04', 'sin_normativa', 'priv', 'texto que no debe viajar', 0.1, 'v5', 'gemini-3.8-flash'),
  ('00000000-0000-0000-0000-00000000bb06', '00000000-0000-0000-0000-00000000aa06', 'fundamentado', 'priv', 'Fundamento técnico', 0.9, 'v5', 'gemini-3.8-flash');
insert into report_ai_evidence values
  ('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-0000000000f1', 1, true,  'competencia municipal'),                -- literal: está dentro del fragmento
  ('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-0000000000f2', 2, false, null),                                  -- recuperada pero NO citada
  ('00000000-0000-0000-0000-00000000bb02', '00000000-0000-0000-0000-0000000000f1', 1, true,  'es competencia exclusiva del Estado'),  -- NO literal (inventada)
  ('00000000-0000-0000-0000-00000000bb03', '00000000-0000-0000-0000-0000000000f2', 1, true,  'multa'),                               -- literal pero de CABA
  ('00000000-0000-0000-0000-00000000bb04', '00000000-0000-0000-0000-0000000000f1', 1, true,  'competencia municipal'),
  ('00000000-0000-0000-0000-00000000bb06', '00000000-0000-0000-0000-0000000000f3', 1, true,  'ya no rige');

-- ------------------------------------------------------------------ aserciones
create or replace function assert_eq(p_name text, p_actual text, p_expected text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FALLÓ [%]: esperado %, obtenido %', p_name, coalesce(p_expected, 'NULL'), coalesce(p_actual, 'NULL');
  end if;
  raise notice 'ok  %', p_name;
end $$;

-- Llamar como: autora
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false) as a, set_config('test.role', 'authenticated', false) as b \gset

-- S1 · escenario 1 del ticket: norma recuperada y validada para su jurisdicción -> fundamento con referencia legal
select get_report_legal_foundation('00000000-0000-0000-0000-00000000aa01') as f \gset s1_
select assert_eq('S1 estado', :'s1_f'::jsonb ->> 'status', 'fundamento_preliminar');
select assert_eq('S1 una sola cita (la no citada no viaja)', jsonb_array_length(:'s1_f'::jsonb -> 'citations')::text, '1');
select assert_eq('S1 referencia legal', :'s1_f'::jsonb -> 'citations' -> 0 ->> 'reference', 'LOM > Artículo 59');
select assert_eq('S1 cita literal', :'s1_f'::jsonb -> 'citations' -> 0 ->> 'quoted_text', 'competencia municipal');
select assert_eq('S1 trae la fuente', :'s1_f'::jsonb -> 'citations' -> 0 ->> 'source_url', 'https://normas.gba.gob.ar/x');
select assert_eq('S1 texto técnico presente', :'s1_f'::jsonb ->> 'official_foundation', 'La conservación de calles es competencia del municipio (art. 59).');
select assert_eq('S1 está marcado como IA', :'s1_f'::jsonb ->> 'is_ai_generated', 'true');
select assert_eq('S1 lleva el aviso de que no es decisión administrativa', ((:'s1_f'::jsonb ->> 'disclaimer') like '%No es una decisión administrativa ni una resolución estatal%')::text, 'true');
select assert_eq('S1 jurisdicción', :'s1_f'::jsonb -> 'jurisdiction' ->> 'subdivision', 'Avellaneda');

-- S7 · NUNCA viaja el texto privado de la ciudadana ni el puntaje
select assert_eq('S7 sin citizen_feedback', (:'s1_f'::jsonb ? 'citizen_feedback')::text, 'false');
select assert_eq('S7 sin confidence_score', (:'s1_f'::jsonb ? 'confidence_score')::text, 'false');
select assert_eq('S7 el texto privado no aparece en ningún lado', (:'s1_f' like '%TEXTO PRIVADO%')::text, 'false');

-- S2 · una cita que NO es literal del fragmento no se presenta
select get_report_legal_foundation('00000000-0000-0000-0000-00000000aa02') as f \gset s2_
select assert_eq('S2 estado', :'s2_f'::jsonb ->> 'status', 'sin_fundamento_verificado');
select assert_eq('S2 sin citas', jsonb_array_length(:'s2_f'::jsonb -> 'citations')::text, '0');
select assert_eq('S2 sin texto jurídico', ((:'s2_f'::jsonb ->> 'official_foundation') is null)::text, 'true');
select assert_eq('S2 cuenta la excluida', :'s2_f'::jsonb -> 'verification' ->> 'citations_excluded', '1');

-- S3 · una norma de CABA para un reporte de Avellaneda no pasa, aunque la cita sea literal
select get_report_legal_foundation('00000000-0000-0000-0000-00000000aa03') as f \gset s3_
select assert_eq('S3 estado', :'s3_f'::jsonb ->> 'status', 'sin_fundamento_verificado');
select assert_eq('S3 sin citas', jsonb_array_length(:'s3_f'::jsonb -> 'citations')::text, '0');

-- S4 · escenario 2 del ticket: abstención del RAG -> «sin fundamento verificado», sin texto jurídico fabricado
select get_report_legal_foundation('00000000-0000-0000-0000-00000000aa04') as f \gset s4_
select assert_eq('S4 estado', :'s4_f'::jsonb ->> 'status', 'sin_fundamento_verificado');
select assert_eq('S4 motivo', :'s4_f'::jsonb ->> 'abstention_reason', 'No se halló norma suficiente en el corpus para este reclamo.');
select assert_eq('S4 sin citas aunque el análisis tenía evidencia', jsonb_array_length(:'s4_f'::jsonb -> 'citations')::text, '0');
select assert_eq('S4 el texto del análisis NO viaja', (:'s4_f' like '%texto que no debe viajar%')::text, 'false');

-- S5 · todavía sin análisis
select get_report_legal_foundation('00000000-0000-0000-0000-00000000aa05') as f \gset s5_
select assert_eq('S5 pendiente', :'s5_f'::jsonb ->> 'status', 'pendiente');

-- S6 · fuente que ya no está vigente: ante la duda no viaja
select get_report_legal_foundation('00000000-0000-0000-0000-00000000aa06') as f \gset s6_
select assert_eq('S6 estado', :'s6_f'::jsonb ->> 'status', 'sin_fundamento_verificado');

-- S8 · escenario 3 del ticket: un tercero que no es autor ni receptor autorizado no accede
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false) as a \gset
select assert_eq('S8 tercero: null', (get_report_legal_foundation('00000000-0000-0000-0000-00000000aa01') is null)::text, 'true');
select assert_eq('S8 tercero: tampoco ve un pendiente', (get_report_legal_foundation('00000000-0000-0000-0000-00000000aa05') is null)::text, 'true');
select set_config('test.uid', '', false) as a \gset
select assert_eq('S8 anónimo: null', (get_report_legal_foundation('00000000-0000-0000-0000-00000000aa01') is null)::text, 'true');

-- S9 · quien atiende el reporte sí accede (receptor autorizado)
select set_config('test.uid', '33333333-3333-3333-3333-333333333333', false) as a \gset
select assert_eq('S9 receptor autorizado', (get_report_legal_foundation('00000000-0000-0000-0000-00000000aa01') ->> 'status'), 'fundamento_preliminar');
select assert_eq('S9 pero NO el de un reporte que no atiende', (get_report_legal_foundation('00000000-0000-0000-0000-00000000aa02') is null)::text, 'true');

-- S10 · el servidor (REP-2801) accede
select set_config('test.uid', '', false) as a, set_config('test.role', 'service_role', false) as b \gset
select assert_eq('S10 service_role', (get_report_legal_foundation('00000000-0000-0000-0000-00000000aa01') ->> 'status'), 'fundamento_preliminar');

-- S11 · un reporte inexistente no revela nada
select assert_eq('S11 inexistente', (get_report_legal_foundation('00000000-0000-0000-0000-00000000ffff') is null)::text, 'true');

\echo
\echo 'REP-2902: todas las pruebas pasaron'
