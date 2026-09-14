-- ==============================================================================
-- 03_rag_schema_no_pgvector.sql — mismo esquema y mismo contrato de
-- match_knowledge_fragments que supabase/rag_knowledge_schema.sql, pero sin
-- depender de la extensión pgvector (no instalada en este Postgres nativo).
--
-- Qué cambia respecto de la versión real (rag_knowledge_schema.sql):
--   - fragment_embeddings.embedding es double precision[] en vez de vector(768).
--   - match_knowledge_fragments calcula similitud coseno a mano
--     (cosine_similarity_local_dev), en vez del operador <=> de pgvector.
-- Qué NO cambia: las tablas de conocimiento, la cascada jurisdiccional
-- (eligible_knowledge_sources), la firma del RPC que consume el código de
-- aplicación, ni el resultado esperado para un mismo par de vectores.
--
-- Cuando Docker Desktop se resuelva, usar supabase/rag_knowledge_schema.sql
-- (con pgvector real) en su lugar — esta variante es solo para desarrollo
-- local mientras tanto.
-- ==============================================================================

begin;

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

create table if not exists public.source_adhesions (
  source_id uuid not null references public.knowledge_sources(id),
  adhering_source_id uuid not null references public.knowledge_sources(id),
  scope_note text,
  verified_at timestamptz not null,
  primary key (source_id, adhering_source_id),
  constraint source_adhesions_not_self check (source_id <> adhering_source_id)
);

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

-- Única diferencia real de columna respecto de la versión con pgvector.
create table if not exists public.fragment_embeddings (
  fragment_id uuid not null references public.knowledge_fragments(id),
  model_code varchar not null references public.embedding_models(code),
  embedding double precision[] not null,
  created_at timestamptz default now(),
  primary key (fragment_id, model_code)
);

create table if not exists public.report_ai_evidence (
  analysis_id uuid not null references public.report_ai_analysis(id),
  fragment_id uuid not null references public.knowledge_fragments(id),
  rank int not null check (rank >= 1),
  similarity numeric not null,
  was_cited boolean not null default false,
  quoted_text text,
  primary key (analysis_id, fragment_id)
);

-- Cascada jurisdiccional: idéntica a la versión real (no depende de pgvector).
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

-- Reemplazo del operador <=> de pgvector: similitud coseno sobre arrays planos.
-- Solo para desarrollo local; en producción esto lo hace pgvector con índice.
create or replace function public.cosine_similarity_local_dev(a double precision[], b double precision[])
returns double precision
language plpgsql immutable
as $$
declare
  dot double precision := 0;
  norm_a double precision := 0;
  norm_b double precision := 0;
  i int;
begin
  if a is null or b is null or array_length(a, 1) <> array_length(b, 1) then
    return 0;
  end if;
  for i in 1..array_length(a, 1) loop
    dot := dot + (a[i] * b[i]);
    norm_a := norm_a + (a[i] * a[i]);
    norm_b := norm_b + (b[i] * b[i]);
  end loop;
  if norm_a = 0 or norm_b = 0 then
    return 0;
  end if;
  return greatest(0, least(1, dot / (sqrt(norm_a) * sqrt(norm_b))));
end;
$$;

-- Mismo nombre y misma firma lógica que el RPC real (query_embedding como
-- array en vez de vector(768): supabase-js manda un array JS en ambos casos,
-- así que el código de aplicación no distingue una variante de la otra).
create or replace function public.match_knowledge_fragments(
  query_embedding double precision[],
  p_locality_id uuid,
  p_model_code varchar,
  match_count int default 6
)
returns table (fragment_id uuid, source_id uuid, hierarchy_path text, content text, scope_level int, similarity double precision)
language sql stable
set search_path = public
as $$
  select f.id, f.source_id, f.hierarchy_path, f.content, e.scope_level,
         public.cosine_similarity_local_dev(fe.embedding, query_embedding)
  from eligible_knowledge_sources(p_locality_id) e
  join knowledge_fragments f  on f.source_id = e.source_id and f.is_current
  join fragment_embeddings fe on fe.fragment_id = f.id and fe.model_code = p_model_code
  order by public.cosine_similarity_local_dev(fe.embedding, query_embedding) desc
  limit match_count;
$$;
revoke execute on function public.match_knowledge_fragments(double precision[], uuid, varchar, int) from public, anon, authenticated;
grant  execute on function public.match_knowledge_fragments(double precision[], uuid, varchar, int) to service_role;

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
