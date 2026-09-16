-- REP-2908-VERIF ronda 5, R5-08: decisión de Hernán sobre el hallazgo de
-- Prueba 2 (ver docs/REP-2908-VERIF_P01-corridas-post-filtro.md, addendum
-- 16/09) — "yo sacaria la clausula venta de transito".
--
-- El fragmento 20000000-0000-4000-8000-000000000008 (Ley 24.449 art. 48
-- inciso t)) mezclaba dos conductas distintas en un solo chunk tageado a
-- TRANSITO: "obstaculizar la calzada" (correcto para TRANSITO) y "venta de
-- productos en el camino" (el distractor: un reclamo de venta ambulante mal
-- categorizado como TRANSITO lo recuperaba y citaba válidamente, porque la
-- cita era literal aunque semánticamente incorrecta para el reclamo).
--
-- Se parte en dos fragmentos:
--   - ...008 (mismo id): queda solo con la cláusula de obstrucción. Sigue
--     tageado a TRANSITO en fragment_services (sin cambios ahí).
--   - b6717f77-c30e-4cca-985a-6346d741fe38 (nuevo, subsection 't-venta'
--     para no chocar con la restricción unique (source_id, article,
--     subsection) del inciso t) original): la cláusula de venta de
--     productos. NO se tagea a ninguna categoría (Hernán: "sacaria la
--     clausula venta de transito") -- no hay corpus de COMERCIO_IRREGULAR
--     hoy (ver Caso F/Prueba 1), así que queda sin categoría hasta que
--     Hernán decida dónde corresponde.
--
-- Los embeddings van en la migración siguiente
-- (20260916040100_r5_08_split_fragment_embeddings.sql).
begin;

update public.knowledge_fragments
set content = E'Está prohibido en la vía pública:\r\nt) Estorbar u obstaculizar de cualquier forma la calzada o la banquina y hacer construcciones;'
where id = '20000000-0000-4000-8000-000000000008';

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code, is_current)
select 'b6717f77-c30e-4cca-985a-6346d741fe38', source_id,
       'Ley 24.449 — Ley de Tránsito > Artículo 48 (prohibiciones) > inciso t) (venta de productos en el camino)',
       article, 't-venta',
       E'Está prohibido en la vía pública:\r\nt) instalarse o realizar venta de productos en zona alguna del camino;',
       foundation_type_code, true
from public.knowledge_fragments
where id = '20000000-0000-4000-8000-000000000008'
on conflict (id) do nothing;

commit;
