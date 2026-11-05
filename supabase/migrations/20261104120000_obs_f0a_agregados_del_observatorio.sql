-- =====================================================================================================================
-- OBS · F0a · Funciones de agregados del observatorio del vecino (post-MVP, rama feat/OBS-…)
--
-- Fuente funcional: docs/observatorio/plan_por_fases.md y el POC docs/observatorio/observatorio_v5.html (REP-3906 de
-- Hernán para los KPIs, REP-3907 de Iván para las pantallas). Decisiones de Matías (04/11/2026): solo con sesión
-- (nada para anon), con los reportes reales de la base.
--
-- Qué agrega:
--   1. observatorio_plazos: plazo en días por categoría (PO, 03/11): Infraestructura 90, Tránsito 7, Ambiente 7,
--      Comercio irregular 30.
--   2. obs_base(): los reportes que cuentan para el observatorio, filtrados por zona, período y categoría. Devuelve
--      filas por reporte, así que NO se otorga a nadie: solo la usan las funciones de abajo (mismo dueño).
--   3. Funciones que el vecino con sesión puede llamar, todas de solo agregados:
--        obs_zonas()          territorio (sin datos de reportes) para los selectores y las migas
--        obs_resumen(...)     reportes, resueltos, % resueltos, mediana y p90 de días, cumplimiento de plazo
--        obs_por_mes(...)     lo mismo por mes de creación
--        obs_por_categoria(...) reportes y resueltos por categoría
--        obs_hijos(...)       las zonas del nivel de abajo, con sus cifras
--
-- Reglas (las mismas del POC y de la metodología):
--   * Vulnerabilidad social no entra nunca (REP-3906: no se infiere de reportes).
--   * «Resuelto» es el estado actual RESUELTO (no «cerrado»: DESESTIMADO e INFORMADO también cierran).
--   * Días hasta resolver = primer RESUELTO en report_state_history − creación del reporte.
--   * Menos de 5 casos (obs_min_casos): la cantidad sale; el porcentaje y los días salen null. Para los días cuenta la
--     cantidad de resueltos con fecha, para el % la cantidad de reportes, para el cumplimiento la de elegibles.
--   * Cumplimiento = resueltos dentro del plazo ÷ reportes que ya tuvieron tiempo de cumplirlo (creación + plazo ≤ hoy).
--   * Ninguna función devuelve id de reporte, coordenadas, direcciones, descripciones ni fotos.
--
-- Niveles (p_nivel): 'pais' (p_zona null) · 'provincia' (states_provinces.id) · 'subdivision' (comuna o partido)
--                    · 'localidad' (barrio o localidad).
--
-- No se aplica sola: se corre a mano en staging con el OK de Matías.
--
-- REVERSIÓN:
--   drop function if exists public.obs_hijos(text, uuid, date, date, text);
--   drop function if exists public.obs_por_categoria(text, uuid, date, date);
--   drop function if exists public.obs_por_mes(text, uuid, date, date, text);
--   drop function if exists public.obs_resumen(text, uuid, date, date, text);
--   drop function if exists public.obs_zonas();
--   drop function if exists public.obs_base(text, uuid, date, date, text);
--   drop function if exists public.obs_min_casos();
--   drop table if exists public.observatorio_plazos;
-- =====================================================================================================================

begin;

-- 1) Plazos por categoría --------------------------------------------------------------------------------------------
create table if not exists public.observatorio_plazos (
  service_code text primary key,
  plazo_dias   integer not null check (plazo_dias > 0),
  fuente       text not null,
  updated_at   timestamptz not null default now()
);

insert into public.observatorio_plazos (service_code, plazo_dias, fuente) values
  ('INFRAESTRUCTURA',    90, 'PO, 03/11/2026'),
  ('TRANSITO',            7, 'PO, 03/11/2026'),
  ('AMBIENTE',            7, 'PO, 03/11/2026'),
  ('COMERCIO_IRREGULAR', 30, 'PO, 03/11/2026')
on conflict (service_code) do update set plazo_dias = excluded.plazo_dias, fuente = excluded.fuente, updated_at = now();

-- Lectura para cualquiera con sesión (la metodología los muestra); escritura solo service_role
alter table public.observatorio_plazos enable row level security;
drop policy if exists "Plazos del observatorio legibles con sesión" on public.observatorio_plazos;
create policy "Plazos del observatorio legibles con sesión" on public.observatorio_plazos
  for select to authenticated using (true);
revoke all on public.observatorio_plazos from anon;
grant select on public.observatorio_plazos to authenticated;

-- 2) Umbral de casos (un solo lugar para cambiarlo) --------------------------------------------------------------------
create or replace function public.obs_min_casos()
returns integer
language sql
immutable
as $$ select 5 $$;

-- 3) Base del observatorio: una fila por reporte. Solo para uso interno -----------------------------------------------
create or replace function public.obs_base(
  p_nivel     text,
  p_zona      uuid,
  p_desde     date,
  p_hasta     date,
  p_categoria text
)
returns table (
  created_at   timestamptz,
  state_code   text,
  service_code text,
  locality_id  uuid,
  subdivision_id uuid,
  province_id  uuid,
  resolved_at  timestamptz,
  plazo_dias   integer
)
language sql
stable
security definer
set search_path = public
as $$
  select r.created_at,
         r.current_state_code::text,
         s.service_code,
         l.id,
         sd.id,
         sd.state_province_id,
         -- Primer paso a RESUELTO, solo si hoy sigue resuelto
         case when r.current_state_code = 'RESUELTO' then
           (select min(h.changed_at) from report_state_history h
             where h.report_id = r.id and h.state_code = 'RESUELTO')
         end,
         pl.plazo_dias
    from citizen_reports r
    join services s          on s.id = r.service_id
    join localities l        on l.id = r.locality_id
    join subdivisions sd     on sd.id = l.subdivision_id
    left join observatorio_plazos pl on pl.service_code = s.service_code
   where s.service_code <> 'VULNERABILIDAD_SOCIAL'
     -- Zona
     and case p_nivel
           when 'pais'        then true
           when 'provincia'   then sd.state_province_id = p_zona
           when 'subdivision' then sd.id = p_zona
           when 'localidad'   then l.id = p_zona
           else false
         end
     -- Período (fechas de creación, inclusivas)
     and (p_desde is null or r.created_at >= p_desde)
     and (p_hasta is null or r.created_at < p_hasta + 1)
     -- Categoría
     and (p_categoria is null or s.service_code = p_categoria);
$$;

revoke execute on function public.obs_base(text, uuid, date, date, text) from public, anon, authenticated;

-- 4) Territorio para selectores y migas (sin datos de reportes) --------------------------------------------------------
create or replace function public.obs_zonas()
returns table (
  zona_id     uuid,
  nivel       text,
  nombre      text,
  tipo        text,
  padre_id    uuid,
  padre_nombre text,
  provincia_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select sp.id, 'provincia', sp.name, 'provincia', null::uuid, null::text, sp.id
    from states_provinces sp
  union all
  select sd.id, 'subdivision', sd.name, sd.type, sp.id, sp.name, sp.id
    from subdivisions sd join states_provinces sp on sp.id = sd.state_province_id
  union all
  select l.id, 'localidad', l.name, 'localidad', sd.id, sd.name, sd.state_province_id
    from localities l join subdivisions sd on sd.id = l.subdivision_id;
$$;

-- 5) Resumen de una zona ------------------------------------------------------------------------------------------------
create or replace function public.obs_resumen(
  p_nivel     text,
  p_zona      uuid default null,
  p_desde     date default null,
  p_hasta     date default null,
  p_categoria text default null
)
returns table (
  reportes        integer,
  resueltos       integer,
  pct_resueltos   numeric,
  mediana_dias    numeric,
  p90_dias        numeric,
  elegibles_plazo integer,
  en_plazo        integer,
  pct_en_plazo    numeric,
  abiertos        integer
)
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select *, extract(epoch from resolved_at - created_at) / 86400.0 as dias
      from public.obs_base(p_nivel, p_zona, p_desde, p_hasta, p_categoria)
  ), m as (
    select count(*)::integer                                            as n,
           count(*) filter (where state_code = 'RESUELTO')::integer     as res,
           count(dias)::integer                                         as res_con_fecha,
           percentile_cont(0.5) within group (order by dias)            as med,
           percentile_cont(0.9) within group (order by dias)            as p90,
           count(*) filter (where plazo_dias is not null
                              and created_at + make_interval(days => plazo_dias) <= now())::integer as eleg,
           count(*) filter (where plazo_dias is not null
                              and created_at + make_interval(days => plazo_dias) <= now()
                              and resolved_at <= created_at + make_interval(days => plazo_dias))::integer as cumple,
           count(*) filter (where state_code in (select code from report_states where open311_status = 'open'))::integer as ab
      from b
  )
  select n,
         res,
         case when n   >= public.obs_min_casos() then round(100.0 * res / n, 1) end,
         case when res_con_fecha >= public.obs_min_casos() then round(med::numeric, 1) end,
         case when res_con_fecha >= public.obs_min_casos() then round(p90::numeric, 1) end,
         eleg,
         cumple,
         case when eleg >= public.obs_min_casos() then round(100.0 * cumple / eleg, 1) end,
         ab
    from m;
$$;

-- 6) Por mes de creación ----------------------------------------------------------------------------------------------
create or replace function public.obs_por_mes(
  p_nivel     text,
  p_zona      uuid default null,
  p_desde     date default null,
  p_hasta     date default null,
  p_categoria text default null
)
returns table (
  mes           date,
  service_code  text,
  reportes      integer,
  resueltos     integer,
  pct_resueltos numeric
)
language sql
stable
security definer
set search_path = public
as $$
  -- Una fila por mes y categoría, más el total del mes (service_code null), para que el front no sume
  select date_trunc('month', created_at)::date,
         b.service_code,
         count(*)::integer,
         count(*) filter (where state_code = 'RESUELTO')::integer,
         case when count(*) >= public.obs_min_casos()
              then round(100.0 * count(*) filter (where state_code = 'RESUELTO') / count(*), 1) end
    from public.obs_base(p_nivel, p_zona, p_desde, p_hasta, p_categoria) b
   group by grouping sets ((date_trunc('month', created_at)::date, b.service_code),
                           (date_trunc('month', created_at)::date))
   order by 1, 2 nulls first;
$$;

-- 7) Por categoría (la torta: sin filtro de categoría, siempre las cuatro) ----------------------------------------------
create or replace function public.obs_por_categoria(
  p_nivel text,
  p_zona  uuid default null,
  p_desde date default null,
  p_hasta date default null
)
returns table (
  service_code  text,
  service_name  text,
  reportes      integer,
  resueltos     integer,
  pct_resueltos numeric,
  mediana_dias  numeric,
  plazo_dias    integer
)
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select *, extract(epoch from resolved_at - created_at) / 86400.0 as dias
      from public.obs_base(p_nivel, p_zona, p_desde, p_hasta, null)
  )
  select s.service_code,
         s.service_name,
         count(b.*)::integer,
         count(*) filter (where b.state_code = 'RESUELTO')::integer,
         case when count(b.*) >= public.obs_min_casos()
              then round(100.0 * count(*) filter (where b.state_code = 'RESUELTO') / count(b.*), 1) end,
         case when count(b.dias) >= public.obs_min_casos()
              then round((percentile_cont(0.5) within group (order by b.dias))::numeric, 1) end,
         pl.plazo_dias
    from services s
    left join b on b.service_code = s.service_code
    left join observatorio_plazos pl on pl.service_code = s.service_code
   where s.service_code <> 'VULNERABILIDAD_SOCIAL'
   group by s.service_code, s.service_name, pl.plazo_dias
   order by s.service_code;
$$;

-- 8) Zonas del nivel de abajo con sus cifras (orden alfabético: nunca ranking) -----------------------------------------
create or replace function public.obs_hijos(
  p_nivel     text,
  p_zona      uuid default null,
  p_desde     date default null,
  p_hasta     date default null,
  p_categoria text default null
)
returns table (
  zona_id       uuid,
  nivel         text,
  nombre        text,
  reportes      integer,
  resueltos     integer,
  pct_resueltos numeric,
  mediana_dias  numeric,
  abiertos      integer
)
language sql
stable
security definer
set search_path = public
as $$
  with hijos as (
    select sp.id, 'provincia'::text as nivel, sp.name as nombre
      from states_provinces sp where p_nivel = 'pais'
    union all
    select sd.id, 'subdivision', sd.name
      from subdivisions sd where p_nivel = 'provincia' and sd.state_province_id = p_zona
    union all
    select l.id, 'localidad', l.name
      from localities l where p_nivel = 'subdivision' and l.subdivision_id = p_zona
  ), b as (
    select *, extract(epoch from resolved_at - created_at) / 86400.0 as dias
      from public.obs_base(p_nivel, p_zona, p_desde, p_hasta, p_categoria)
  ), x as (
    select h.id, h.nivel, h.nombre,
           count(b.*)::integer as n,
           count(*) filter (where b.state_code = 'RESUELTO')::integer as res,
           count(b.dias)::integer as res_con_fecha,
           percentile_cont(0.5) within group (order by b.dias) as med,
           count(*) filter (where b.state_code in (select code from report_states where open311_status = 'open'))::integer as ab
      from hijos h
      left join b on case h.nivel
                       when 'provincia'   then b.province_id    = h.id
                       when 'subdivision' then b.subdivision_id = h.id
                       else                    b.locality_id    = h.id
                     end
     group by h.id, h.nivel, h.nombre
  )
  select id, nivel, nombre, n, res,
         case when n >= public.obs_min_casos() then round(100.0 * res / n, 1) end,
         case when res_con_fecha >= public.obs_min_casos() then round(med::numeric, 1) end,
         ab
    from x
   order by nombre;
$$;

-- 9) Permisos: solo con sesión ----------------------------------------------------------------------------------------
revoke execute on function public.obs_min_casos()                                  from public, anon;
revoke execute on function public.obs_zonas()                                      from public, anon;
revoke execute on function public.obs_resumen(text, uuid, date, date, text)        from public, anon;
revoke execute on function public.obs_por_mes(text, uuid, date, date, text)        from public, anon;
revoke execute on function public.obs_por_categoria(text, uuid, date, date)        from public, anon;
revoke execute on function public.obs_hijos(text, uuid, date, date, text)          from public, anon;
grant  execute on function public.obs_min_casos()                                  to authenticated;
grant  execute on function public.obs_zonas()                                      to authenticated;
grant  execute on function public.obs_resumen(text, uuid, date, date, text)        to authenticated;
grant  execute on function public.obs_por_mes(text, uuid, date, date, text)        to authenticated;
grant  execute on function public.obs_por_categoria(text, uuid, date, date)        to authenticated;
grant  execute on function public.obs_hijos(text, uuid, date, date, text)          to authenticated;

commit;
