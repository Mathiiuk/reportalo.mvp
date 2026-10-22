-- REP-3863 · P4 · PROPUESTA de migración (NO APLICAR todavía)
-- Está fuera de supabase/migrations a propósito. Se aplica después de medir P0 (REP-3859), con el OK del LT, y se
-- verifica con las consultas de docs/rag/REP-3863_auditoria_y_diseno_P4.md §6.
-- No cambia match_knowledge_fragments, RLS ni el routing.

begin;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Esquema (idempotente)
-- ---------------------------------------------------------------------------------------------------------------

-- 1.a Vocabulario por prestación. La tabla está vacía y nadie la lee: no afecta ni la búsqueda ni el routing.
alter table public.service_keywords
  add column if not exists attribute_value_id uuid references public.service_attribute_values(id),
  add column if not exists origin text;
alter table public.service_keywords drop constraint if exists service_keywords_origin_check;
alter table public.service_keywords add constraint service_keywords_origin_check
  check (origin is null or origin in ('suaci', 'norma', 'pruebas_s15', 'po'));
alter table public.service_keywords drop constraint if exists service_keywords_pkey;
create unique index if not exists service_keywords_uq
  on public.service_keywords (service_id, lower(keyword),
                              coalesce(attribute_value_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 1.b Vínculo norma ↔ prestación. match_knowledge_fragments solo pregunta si EXISTE un par
--     (fragmento, categoría): agregar filas con prestación a un par que ya existe no cambia lo que recupera.
alter table public.fragment_services
  add column if not exists attribute_value_id uuid references public.service_attribute_values(id),
  add column if not exists tipo_fundamento text;
alter table public.fragment_services drop constraint if exists fragment_services_pkey;
create unique index if not exists fragment_services_uq
  on public.fragment_services (fragment_id, service_id,
                               coalesce(attribute_value_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists fragment_services_attribute_value_idx on public.fragment_services (attribute_value_id);

-- Huella de la búsqueda ANTES de cargar: los pares distintos (fragmento, categoría)
create temporary table p4_pares_antes on commit drop as
  select distinct fragment_id, service_id from public.fragment_services;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Prestaciones: las 70 nuevas van al loader de REP-2800 (supabase/catalogo/rep2800_carga_catalogo_destinos.sql),
--    como filas de c_prest generadas desde scripts/rep3863/dataset/prestaciones.csv. Ese loader ya es idempotente y
--    arma agency_services por grupo de destino (c_ruta), así que no se duplican organismos ni canales.
--    Las 37 actuales conservan clave y nombre (incluida situacion_de_calle_ninez, que usa «No sé» de REP-3841).
-- ---------------------------------------------------------------------------------------------------------------

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Vínculos norma ↔ prestación (desde vinculos_norma.csv, ya resueltos a fragment_id por el script de carga)
-- ---------------------------------------------------------------------------------------------------------------
create temporary table p4_vinculo (fragment_id uuid, categoria text, grupo text, tipo_fundamento text) on commit drop;
-- insert into p4_vinculo values (...);   -- las generará scripts/rep3863 (48 filas con artículo identificado)

-- Solo pares (fragmento, categoría) que YA existen. Lo demás va a excepciones del informe, no a la base.
insert into public.fragment_services (fragment_id, service_id, attribute_value_id, tipo_fundamento)
select v.fragment_id, s.id, av.id, v.tipo_fundamento
  from p4_vinculo v
  join public.services s on s.service_code = v.categoria
  join public.service_attributes sa on sa.service_id = s.id and sa.attribute_code = 'prestacion'
  join public.service_attribute_values av on av.attribute_id = sa.id
  join p4_prestacion_grupo pg on pg.value_key = av.value_key and pg.grupo = v.grupo   -- tabla del paso 2
 where exists (select 1 from p4_pares_antes p where p.fragment_id = v.fragment_id and p.service_id = s.id)
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Vocabulario (176 términos, desde vocabulario.csv)
-- ---------------------------------------------------------------------------------------------------------------
create temporary table p4_termino (termino text, prestacion_oficial text, origen text) on commit drop;
-- insert into p4_termino values (...);   -- las generará scripts/rep3863

insert into public.service_keywords (service_id, keyword, attribute_value_id, origin)
select sa.service_id, t.termino, av.id, t.origen
  from p4_termino t
  join p4_prestacion_grupo pg on pg.nombre_oficial = t.prestacion_oficial
  join public.service_attribute_values av on av.value_key = pg.value_key
  join public.service_attributes sa on sa.id = av.attribute_id and sa.attribute_code = 'prestacion'
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Control: la búsqueda no puede cambiar
-- ---------------------------------------------------------------------------------------------------------------
do $$
begin
  if exists (select distinct fragment_id, service_id from public.fragment_services
             except select fragment_id, service_id from p4_pares_antes) then
    raise exception 'P4 agregó un par (fragmento, categoría) nuevo: cambiaría match_knowledge_fragments';
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------------------------------------------
-- ROLLBACK (solo lo que cargó P4; no borra nada que referencie un análisis)
-- ---------------------------------------------------------------------------------------------------------------
-- begin;
-- delete from public.fragment_services where attribute_value_id is not null;
-- delete from public.service_keywords  where attribute_value_id is not null;
-- drop index if exists public.fragment_services_uq;
-- drop index if exists public.fragment_services_attribute_value_idx;
-- alter table public.fragment_services add constraint fragment_services_pkey primary key (fragment_id, service_id);
-- alter table public.fragment_services drop column if exists attribute_value_id, drop column if exists tipo_fundamento;
-- drop index if exists public.service_keywords_uq;
-- alter table public.service_keywords add constraint service_keywords_pkey primary key (service_id, keyword);
-- alter table public.service_keywords drop constraint if exists service_keywords_origin_check;
-- alter table public.service_keywords drop column if exists attribute_value_id, drop column if exists origin;
-- -- Prestaciones nuevas: solo si ningún reporte las usa
-- --   delete from agency_services where attribute_value_id in (<70 nuevas>);
-- --   delete from service_attribute_values where id in (<70 nuevas>)
-- --     and not exists (select 1 from infraction_attribute_responses r where r.selected_value = value_key);
-- commit;
