-- =====================================================================
-- REP-3797 · PRECHECK del lote de corpus — Sprint 14
-- Reportalo (RAR-2026) · 28/09/2026
--
-- SOLO LECTURA. No escribe nada. Correr esto ANTES del lote y guardar la salida:
-- es el "antes" de la comparación antes/después que pide el ticket.
--
-- Si alguna consulta devuelve algo distinto de lo esperado, NO correr el lote
-- y avisar: significa que la base se movió respecto del volcado del 28/09/2026.
-- =====================================================================

\echo '=== P-1 · Estado actual de las tablas del corpus ==='
select 'knowledge_sources'   as tabla, count(*) as filas, 8  as esperado_antes from public.knowledge_sources
union all
select 'knowledge_fragments', count(*), 17 from public.knowledge_fragments
union all
select 'fragment_services',   count(*), 16 from public.fragment_services
union all
select 'fragment_embeddings', count(*), 17 from public.fragment_embeddings
union all
select 'document_types',      count(*), 3  from public.document_types
union all
select 'services',            count(*), 5  from public.services;

\echo '=== P-2 · Cobertura actual por categoría (las dos que están en cero son el motivo del lote) ==='
select s.service_code,
       count(fs.fragment_id) as fragmentos_mapeados
  from public.services s
  left join public.fragment_services fs on fs.service_id = s.id
 group by 1
 order by 2, 1;

\echo '=== P-3 · Precondiciones que el lote necesita (todas deben decir OK) ==='
select 'countries AR' as precondicion,
       case when exists (select 1 from public.countries where iso_code = 'AR')
            then 'OK' else 'FALTA' end as estado
union all
select 'states_provinces CABA + Buenos Aires',
       case when (select count(*) from public.states_provinces
                   where name in ('Ciudad Autónoma de Buenos Aires','Buenos Aires')) = 2
            then 'OK' else 'FALTA' end
union all
select 'subdivisions Avellaneda tipo partido (una sola)',
       case when (select count(*) from public.subdivisions
                   where name = 'Avellaneda' and type = 'partido') = 1
            then 'OK' else 'REVISAR' end
union all
select 'las 5 categorías en services',
       case when (select count(*) from public.services
                   where service_code in ('TRANSITO','INFRAESTRUCTURA','AMBIENTE',
                                          'COMERCIO_IRREGULAR','VULNERABILIDAD_SOCIAL')) = 5
            then 'OK' else 'FALTA' end
union all
select 'fuentes preexistentes LOM / Ley 451 / Ley 13.927',
       case when (select count(*) from public.knowledge_sources
                   where id in ('10000000-0000-4000-8000-000000000002',
                                '10000000-0000-4000-8000-000000000006',
                                '10000000-0000-4000-8000-000000000008')) = 3
            then 'OK' else 'FALTA' end
union all
select 'modelo de embeddings activo',
       coalesce((select code from public.embedding_models where is_active), 'NINGUNO')
union all
select 'ids del lote todavía libres (30000000-… y 40000000-…)',
       case when not exists (select 1 from public.knowledge_sources
                              where id::text like '30000000-0000-4000-8000-%')
             and not exists (select 1 from public.knowledge_fragments
                              where id::text like '40000000-0000-4000-8000-%')
            then 'OK' else 'YA HAY FILAS DEL LOTE (correrlo de nuevo no duplica)' end;

\echo '=== P-4 · El hueco que el lote corrige: fragmento sin categoría ==='
select kf.id, kf.article, kf.subsection, kf.hierarchy_path
  from public.knowledge_fragments kf
  left join public.fragment_services fs on fs.fragment_id = kf.id
 where kf.is_current
   and fs.fragment_id is null;

\echo '=== P-5 · Fila que el lote actualiza (única fila preexistente que se toca) ==='
select id, title, document_number, last_amended_by, verified_at
  from public.knowledge_sources
 where id = '10000000-0000-4000-8000-000000000008';

\echo '=== P-6 · Snapshot del corpus actual, para comparar después ==='
select ks.document_number,
       ks.title,
       coalesce(sp.name, sub.name, c.name) as ambito,
       count(kf.id) as fragmentos_vigentes
  from public.knowledge_sources ks
  left join public.knowledge_fragments kf on kf.source_id = ks.id and kf.is_current
  left join public.states_provinces sp on sp.id = ks.state_province_id
  left join public.subdivisions     sub on sub.id = ks.subdivision_id
  left join public.countries        c  on c.id  = ks.country_id
 group by 1,2,3
 order by 3,2;
