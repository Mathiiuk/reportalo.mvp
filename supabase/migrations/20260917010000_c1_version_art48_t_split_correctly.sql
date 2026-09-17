-- REP-2908-VERIF ronda 6, C-1 (REP-3777): la migración 20260916040000 había
-- editado el fragmento 20000000-0000-4000-8000-000000000008 EN EL LUGAR para
-- separar la cláusula de venta -- rompe la inmutabilidad del corpus
-- versionado: los análisis históricos que citaron ...008 ahora apuntan a un
-- texto distinto del que citaron. Hernán lo marcó en la ronda 6.
--
-- Se corrige creando un fragmento nuevo (...016) para la cláusula de
-- obstrucción vigente, restaurando ...008 a su texto literal original y
-- marcándolo is_current = false (histórico, nunca se vuelve a recuperar), y
-- versionando la cláusula de venta (b6717f77-...) contra ...008 con
-- replaces_fragment_id.
--
-- NOTA sobre el contenido de ...016: no es "Estorbar ... construcciones;"
-- (con punto y coma) sino "Estorbar ... construcciones," (con coma) -- el
-- punto y coma no es substring literal del texto original, que sigue con
-- ", instalarse o realizar venta...". Se corrigió tras verificar con la
-- consulta de literalidad de Hernán.
--
-- NOTA sobre el salto de línea: el script de Hernán usa \n en el literal
-- $f$...$f$; el resto del corpus (y el contenido real ya guardado en
-- CiudadAR) usa \r\n. Se normalizó a \r\n para consistencia -- el md5 no va
-- a coincidir con uno calculado asumiendo \n, pero el texto es idéntico.
--
-- Embeddings reales regenerados para ...016 (gemini-embedding-2@768).
-- El embedding de ...008 queda con el texto recortado que tuvo durante el
-- incidente: no se usa en ninguna búsqueda porque is_current = false, así
-- que no se regenera (documentado, no es un descarte silencioso).
begin;

do $$
declare
  original constant text := E'Está prohibido en la vía pública:\r\nt) Estorbar u obstaculizar de cualquier forma la calzada o la banquina y hacer construcciones, instalarse o realizar venta de productos en zona alguna del camino;';
begin
  if not exists (select 1 from public.knowledge_fragments where id = '20000000-0000-4000-8000-000000000008')
     or exists (select 1 from public.knowledge_fragments where id = '20000000-0000-4000-8000-000000000016') then
    raise notice 'C-1: nada que hacer (base vacia o ya corregida).';
    return;
  end if;

  insert into public.knowledge_fragments
    (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code, is_current, replaces_fragment_id)
  select '20000000-0000-4000-8000-000000000016', source_id,
         'Ley 24.449 — Ley de Tránsito > Artículo 48 (prohibiciones) > inciso t) (obstrucción)',
         '48', 't.obstruccion',
         E'Está prohibido en la vía pública:\r\nt) Estorbar u obstaculizar de cualquier forma la calzada o la banquina y hacer construcciones,',
         foundation_type_code, true, id
  from public.knowledge_fragments where id = '20000000-0000-4000-8000-000000000008';

  insert into public.fragment_services (fragment_id, service_id)
  select '20000000-0000-4000-8000-000000000016', s.id from public.services s where s.service_code = 'TRANSITO'
  on conflict do nothing;

  update public.knowledge_fragments
     set content = original, subsection = 't', is_current = false
   where id = '20000000-0000-4000-8000-000000000008';

  update public.knowledge_fragments
     set subsection = 't.venta', replaces_fragment_id = '20000000-0000-4000-8000-000000000008', is_current = true
   where id = 'b6717f77-c30e-4cca-985a-6346d741fe38';
end $$;

commit;
