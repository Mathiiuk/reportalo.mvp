-- ==============================================================================
-- 01_minimal_schema.sql (variante sin pgvector) — ver README.md de esta carpeta
-- ==============================================================================
create extension if not exists pgcrypto;   -- gen_random_uuid()
-- Nota: sin "create extension vector" — no está instalada en este Postgres nativo.

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

create table if not exists public.report_ai_analysis (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now()
);
