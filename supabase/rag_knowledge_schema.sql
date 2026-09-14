-- ============================================================================
-- rag_knowledge_schema.sql — Esquema del RAG jurídico de producción (REP-2908)
-- ============================================================================
--
-- ESTE ARCHIVO NO ES LA FUENTE DE VERDAD. Es una copia de referencia, para que
-- el contrato del RPC quede versionado junto al código de aplicación que lo
-- consume (src/services/legalRagService.js y supabase/functions/analizar-reporte).
--
-- La fuente de verdad es docs/REP-3769_seed_y_RAG.sql (PARTE 6), aprobada como
-- DER v3.2. Esa guía dice explícitamente "no edites el script": este archivo
-- copia su DDL sin modificarlo. Si hay una discrepancia entre este archivo y
-- docs/REP-3769_seed_y_RAG.sql, ese último gana siempre.
--
-- ESTADO: escrito, NO ejecutado contra ningún proyecto Supabase real desde la
-- tarea REP-2908 (sin credenciales de servicio ni Supabase CLI en ese entorno).
-- Para aplicarlo, correr docs/REP-3769_seed_y_RAG.sql completo (incluye este
-- bloque como su PARTE 6) siguiendo docs/REP-3769_guia_ejecucion_seeds_y_RAG.md.
--
-- Reemplaza a la tabla `normativas` y al RPC `match_normativas` del spike de
-- REP-2907 (supabase/rag_normativas.sql). Ese archivo no se borra todavía:
-- su DROP es la PARTE 9 de REP-3769, una decisión explícita de Matías.
-- ============================================================================

begin;

-- Catálogos
create table if not exists public.source_types       (code varchar primary key, description text not null);
create table if not exists public.document_types     (code varchar primary key, description text not null);
create table if not exists public.foundation_types   (code varchar primary key, description text not null);
create table if not exists public.ai_result_statuses (code varchar primary key, description text not null);

create table if not exists public.embedding_models (
  code varchar primary key,
  provider varchar not null,
  model_name text not null,
  dimensions int not null check (dimensions = 768),
  is_active boolean not null default false,
  retired_at date
);
create unique index if not exists embedding_models_one_active on public.embedding_models (is_active) where is_active;

create table if not exists public.generation_models (
  code varchar primary key,
  provider varchar not null,
  model_name text not null,
  is_active boolean not null default false,
  retired_at date
);
create unique index if not exists generation_models_one_active on public.generation_models (is_active) where is_active;

-- Fuentes: una fila por norma, anclada a exactamente UN nivel (arco exclusivo).
-- CK-1: nunca país + provincia + municipio a la vez (REP-2906 v2.1).
create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  source_type_code varchar not null references public.source_types(code),
  document_type_code varchar not null references public.document_types(code),
  document_number text,
  title text not null,
  issuing_authority text not null,
  country_id uuid references public.countries(id),
  state_province_id uuid references public.states_provinces(id),
  subdivision_id uuid references public.subdivisions(id),
  requires_adhesion boolean not null default false,
  source_url text not null,
  snapshot_path text,
  is_current boolean not null default true,
  verified_at timestamptz not null,
  last_amended_by text,
  created_at timestamptz default now(),
  constraint knowledge_sources_one_scope check (num_nonnulls(country_id, state_province_id, subdivision_id) = 1)
);

-- Adhesión: una norma que requiere adhesión (p.ej. Ley 24.449) solo aplica en
-- una jurisdicción si esa jurisdicción (o su provincia) adhirió explícitamente.
create table if not exists public.source_adhesions (
  source_id uuid not null references public.knowledge_sources(id),
  adhering_source_id uuid not null references public.knowledge_sources(id),
  scope_note text,
  verified_at timestamptz not null,
  primary key (source_id, adhering_source_id),
  constraint source_adhesions_not_self check (source_id <> adhering_source_id)
);

-- Fragmentos: un artículo o inciso; inmutables y versionados (replaces_fragment_id
-- conserva la trazabilidad cuando una norma se modifica, sin perder qué citó cada análisis viejo).
create table if not exists public.knowledge_fragments (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources(id),
  hierarchy_path text not null,
  article text,
  subsection text,
  content text not null,
  foundation_type_code varchar references public.foundation_types(code),
  is_current boolean not null default true,
  replaces_fragment_id uuid references public.knowledge_fragments(id),
  fts tsvector generated always as (to_tsvector('spanish', content)) stored,
  created_at timestamptz default now()
);
create unique index if not exists knowledge_fragments_current_uq
  on public.knowledge_fragments (source_id, article, subsection) nulls not distinct
  where is_current;
create index if not exists knowledge_fragments_fts_idx on public.knowledge_fragments using gin (fts);

create table if not exists public.fragment_services (
  fragment_id uuid not null references public.knowledge_fragments(id),
  service_id uuid not null references public.services(id),
  primary key (fragment_id, service_id)
);

-- Vectores: una fila por fragmento y por modelo. Probar un modelo nuevo o migrar
-- es cargar/activar filas, nunca cambiar columnas (docx §9).
create table if not exists public.fragment_embeddings (
  fragment_id uuid not null references public.knowledge_fragments(id),
  model_code varchar not null references public.embedding_models(code),
  embedding vector(768) not null,
  created_at timestamptz default now(),
  primary key (fragment_id, model_code)
);

-- Evidencia del análisis: qué se recuperó y qué se citó (append-only, nunca se edita).
create table if not exists public.report_ai_evidence (
  analysis_id uuid not null references public.report_ai_analysis(id),
  fragment_id uuid not null references public.knowledge_fragments(id),
  rank int not null check (rank >= 1),
  similarity numeric not null,
  was_cited boolean not null default false,
  quoted_text text,
  primary key (analysis_id, fragment_id)
);

-- ----------------------------------------------------------------------------
-- Cascada jurisdiccional: qué fuentes aplican en una localidad.
-- scope_level: 1 = municipio/comuna · 2 = provincia/CABA · 3 = nación.
-- Nunca se resuelve por texto: solo por claves geográficas y adhesiones reales.
-- ----------------------------------------------------------------------------
create or replace function public.eligible_knowledge_sources(p_locality_id uuid)
returns table (source_id uuid, scope_level int)
language sql stable
set search_path = public
as $$
  with geo as (
    select l.subdivision_id, s.state_province_id, sp.country_id
    from localities l
    join subdivisions s on s.id = l.subdivision_id
    join states_provinces sp on sp.id = s.state_province_id
    where l.id = p_locality_id
  )
  select ks.id,
         case when ks.subdivision_id is not null then 1
              when ks.state_province_id is not null then 2
              else 3 end
  from knowledge_sources ks cross join geo
  where ks.is_current
    and (ks.subdivision_id = geo.subdivision_id
      or ks.state_province_id = geo.state_province_id
      or ks.country_id = geo.country_id)
    and (not ks.requires_adhesion or exists (
          select 1
          from source_adhesions a
          join knowledge_sources ad on ad.id = a.adhering_source_id and ad.is_current
          where a.source_id = ks.id
            and (ad.subdivision_id = geo.subdivision_id
              or ad.state_province_id = geo.state_province_id)));
$$;

-- ----------------------------------------------------------------------------
-- Búsqueda por significado dentro de la cascada. Filtra primero (elegibilidad
-- geográfica + adhesión) y ordena después por similitud coseno de pgvector.
-- Restringido a service_role: el cliente/anon nunca llama a este RPC directamente,
-- solo la Edge Function analizar-reporte con la clave de servicio.
-- ----------------------------------------------------------------------------
create or replace function public.match_knowledge_fragments(
  query_embedding vector(768),
  p_locality_id uuid,
  p_model_code varchar,
  match_count int default 6
)
returns table (fragment_id uuid, source_id uuid, hierarchy_path text, content text, scope_level int, similarity double precision)
language sql stable
set search_path = public, extensions
as $$
  select f.id, f.source_id, f.hierarchy_path, f.content, e.scope_level,
         1 - (fe.embedding <=> query_embedding)
  from eligible_knowledge_sources(p_locality_id) e
  join knowledge_fragments f  on f.source_id = e.source_id and f.is_current
  join fragment_embeddings fe on fe.fragment_id = f.id and fe.model_code = p_model_code
  order by fe.embedding <=> query_embedding
  limit match_count;
$$;
revoke execute on function public.match_knowledge_fragments(vector, uuid, varchar, int) from public, anon, authenticated;
grant  execute on function public.match_knowledge_fragments(vector, uuid, varchar, int) to service_role;

-- RLS: lectura para usuarios autenticados en el corpus y catálogos (texto público);
-- escritura solo desde el servidor. Sin políticas en las tablas de modelos/embeddings/
-- evidencia: solo el servidor (service_role) las usa (report_ai_evidence: pendiente Q-6).
do $$
declare t text;
begin
  foreach t in array array['source_types','document_types','foundation_types','ai_result_statuses',
                           'knowledge_sources','source_adhesions','knowledge_fragments','fragment_services'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = t and policyname = 'read authenticated') then
      execute format('create policy "read authenticated" on public.%I for select to authenticated using (true)', t);
    end if;
  end loop;
  foreach t in array array['embedding_models','generation_models','fragment_embeddings','report_ai_evidence'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

commit;
