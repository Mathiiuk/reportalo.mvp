-- REP-3837 parte B — Volver atrás la carga de Ley 2628 y Ley 5688.
--
-- No se borra nada (indicación del PO): los análisis que hayan citado estos fragmentos los siguen referenciando.
-- Se bajan de vigencia los 5 fragmentos y las 2 fuentes; match_knowledge_fragments solo recupera vigentes, así que
-- el RAG deja de verlos en la consulta siguiente. Los vectores quedan guardados (no molestan: se filtran por vigencia).
--
-- Correr con la clave de servicio o desde el SQL Editor. Después, correr verificar_huellas.sql: las 5 filas tienen que
-- quedar sin fragment_id (no hay vigentes) y los totales volver a 132 vigentes.

begin;

with fuentes as (
  select ks.id
    from public.knowledge_sources ks
   where ks.document_type_code = 'ley'
     and ks.document_number in ('2628', '5688')
     and ks.state_province_id = (select id from public.states_provinces where name = 'Ciudad Autónoma de Buenos Aires')
     and ks.subdivision_id is null
     and ks.is_current
)
update public.knowledge_fragments f
   set is_current = false
  from fuentes
 where f.source_id = fuentes.id
   and f.is_current
   and ((f.article = '3' and f.subsection in ('3', '17')) or f.article in ('506', '507', '511'));

update public.knowledge_sources ks
   set is_current = false
 where ks.document_type_code = 'ley'
   and ks.document_number in ('2628', '5688')
   and ks.state_province_id = (select id from public.states_provinces where name = 'Ciudad Autónoma de Buenos Aires')
   and ks.subdivision_id is null
   and ks.is_current
   and not exists (select 1 from public.knowledge_fragments f where f.source_id = ks.id and f.is_current);

commit;
