-- ==============================================================================
-- 01_minimal_schema.sql — Esquema mínimo para desarrollar el RAG en local
-- ==============================================================================
--
-- Este archivo NO es el DER completo de Reportalo (ese vive en el Supabase real
-- y en docs/REP-3769_seed_y_RAG.sql, que asume que ya existe). Acá recreamos
-- SOLO lo que el módulo RAG necesita para resolver sus foreign keys:
--   - el árbol geográfico (countries -> states_provinces -> subdivisions -> localities),
--     que es lo que usa eligible_knowledge_sources() para la cascada jurisdiccional;
--   - services, porque fragment_services referencia servicios;
--   - un stub mínimo de report_ai_analysis (solo id), porque
--     supabase/rag_knowledge_schema.sql le agrega columnas con ALTER TABLE.
-- No incluye auth.users, storage.* ni RLS de Supabase: este Postgres es un
-- motor liso, sin esos servicios. Sirve para probar SQL con psql, no para
-- correr la app completa contra él.
-- ==============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists vector;     -- ya viene en la imagen pgvector/pgvector

-- rag_knowledge_schema.sql da por sentados los roles de Supabase (anon,
-- authenticated, service_role) para las políticas RLS y el revoke/grant del
-- RPC. Un Postgres liso no los tiene: se crean acá como roles sin login, solo
-- para que ese script corra igual que en Supabase, sin tener que editarlo.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create table if not exists public.countries (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    iso_code varchar not null unique,
    created_at timestamptz default now()
);

create table if not exists public.states_provinces (
    id uuid primary key default gen_random_uuid(),
    country_id uuid not null references public.countries(id),
    name text not null,
    created_at timestamptz default now(),
    unique (country_id, name)
);

create table if not exists public.subdivisions (
    id uuid primary key default gen_random_uuid(),
    state_province_id uuid not null references public.states_provinces(id),
    name text not null,
    type text not null default 'municipio',
    created_at timestamptz default now(),
    unique (state_province_id, name)
);

create table if not exists public.localities (
    id uuid primary key default gen_random_uuid(),
    subdivision_id uuid not null references public.subdivisions(id),
    name text not null,
    created_at timestamptz default now(),
    unique (subdivision_id, name)
);

create table if not exists public.services (
    id uuid primary key default gen_random_uuid(),
    service_code text not null unique,
    service_name text not null,
    group_name text not null,
    description text,
    created_at timestamptz default now()
);

-- Stub: en el Supabase real esta tabla ya existe con muchas más columnas
-- (citizen_reports, evidencia, etc.). Acá solo alcanza para que
-- rag_knowledge_schema.sql pueda hacer ALTER TABLE ... ADD COLUMN y
-- report_ai_evidence pueda referenciarla por FK.
create table if not exists public.report_ai_analysis (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now()
);
