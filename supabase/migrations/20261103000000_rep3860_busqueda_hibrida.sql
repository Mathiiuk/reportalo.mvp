-- REP-3860 (RAG P2) · Búsqueda híbrida: vectores + texto completo con Reciprocal Rank Fusion (RRF).
--
-- ⚠ NO APLICADA. Por pedido de Leo (REP-3860, 02/11/2026) no se aplican migraciones nuevas en staging mientras se
-- compara P1 con P2. M1 se mide con el runner (scripts/rag-local-dev/rep-diag-variantes), que no necesita esta
-- función. Se aplica recién con la autorización de PO y PM (REP-3880); aun aplicada, no cambia nada hasta que
-- analizar-reporte tenga RAG_BUSQUEDA=hibrida. Al aplicarla, renombrar el archivo a la versión registrada.
--
-- Base: docs/rag/PROPUESTA_REP-3860_busqueda_hibrida_rrf.sql (S16, commit 681eb25), medida en
-- docs/RAG-S16_busqueda_hibrida_bateria_81.md. Cambios respecto de la propuesta, pedidos en REP-3860:
--   · p_forced_ids: fragmentos que entran primero (para la inclusión forzada de P5). En P2 va vacío y el resultado es
--     idéntico al de la propuesta.
--   · procedencia: de dónde viene cada fragmento ('vector', 'vector+texto' o 'forzado'), para auditar el ranking.
--
-- Qué hace: toma los mismos candidatos que match_knowledge_fragments (fuentes elegibles por jurisdicción, fragmentos
-- vigentes con vector del modelo pedido y, si hay categoría, con ese service_code) y los ordena por
--   rrf = 1 / (k + puesto_vectorial) + 1 / (k + puesto_texto)
-- donde puesto_texto es el orden por ts_rank sobre knowledge_fragments.fts, solo de los que tienen alguna
-- coincidencia (el resto no suma por ese lado). Empates: gana el mejor puesto vectorial.
--
-- Texto completo: los lexemas de la descripción del vecino (sin el «(categoría: X)» que se agrega al texto que se
-- vectoriza) unidos con OR. plainto_tsquery los une con AND y en textos largos casi nunca hay coincidencia; su salida
-- es siempre un tsquery válido, así que pasar ' & ' a ' | ' no puede fallar. Sin lexemas (solo palabras vacías, o
-- texto con errores como «ay un vache enorme en lacalle»), el orden queda igual al vectorial.
--
-- Devuelve las columnas de match_knowledge_fragments, con `similarity` igual al coseno para que el umbral de
-- analizar-reporte (0,45) valga igual, y agrega vector_rank, text_rank, rrf_score y procedencia.
--
-- Es una función nueva: match_knowledge_fragments no se toca. Volver atrás es RAG_BUSQUEDA=vectorial (o sacar la
-- variable); si además se quiere borrar la función:
--   drop function if exists public.match_knowledge_fragments_hibrida(vector, text, uuid, character varying, integer, text, integer, uuid[]);

create or replace function public.match_knowledge_fragments_hibrida(
  query_embedding vector,
  p_query_text text,
  p_locality_id uuid,
  p_model_code character varying,
  match_count integer default 8,
  p_service_code text default null,
  p_rrf_k integer default 60,
  p_forced_ids uuid[] default '{}'
)
returns table(
  fragment_id uuid,
  source_id uuid,
  hierarchy_path text,
  content text,
  scope_level integer,
  similarity double precision,
  vector_rank integer,
  text_rank integer,
  rrf_score double precision,
  procedencia text
)
language sql
stable
set search_path to 'public', 'extensions'
as $$
  with candidatos as (
    -- Mismo filtro que match_knowledge_fragments (V-09), sin el límite.
    select f.id, f.source_id, f.hierarchy_path, f.content, f.fts, e.scope_level,
           fe.embedding <=> query_embedding as distancia
    from eligible_knowledge_sources(p_locality_id) e
    join knowledge_fragments f  on f.source_id = e.source_id and f.is_current
    join fragment_embeddings fe on fe.fragment_id = f.id and fe.model_code = p_model_code
    where p_service_code is null or exists (
      select 1
      from fragment_services fs
      join services s on s.id = fs.service_id
      where fs.fragment_id = f.id and s.service_code = p_service_code
    )
  ),
  consulta as (
    select nullif(replace(plainto_tsquery('spanish', coalesce(p_query_text, ''))::text, ' & ', ' | '), '')::tsquery as q
  ),
  por_vector as (
    select c.id, row_number() over (order by c.distancia, c.id)::integer as puesto
    from candidatos c
  ),
  por_texto as (
    select c.id, row_number() over (order by ts_rank(c.fts, consulta.q) desc, c.id)::integer as puesto
    from candidatos c cross join consulta
    where consulta.q is not null and c.fts @@ consulta.q
  )
  select c.id, c.source_id, c.hierarchy_path, c.content, c.scope_level,
         1 - c.distancia,
         v.puesto,
         t.puesto,
         1.0 / (p_rrf_k + v.puesto) + coalesce(1.0 / (p_rrf_k + t.puesto), 0),
         case when c.id = any(coalesce(p_forced_ids, '{}')) then 'forzado'
              when t.puesto is not null then 'vector+texto'
              else 'vector' end
  from candidatos c
  join por_vector v on v.id = c.id
  left join por_texto t on t.id = c.id
  -- Los forzados (vacío en P2) entran primero, y solo si pasan los mismos filtros de jurisdicción y categoría
  order by (c.id = any(coalesce(p_forced_ids, '{}'))) desc, 9 desc, v.puesto
  limit match_count;
$$;

-- Igual que match_knowledge_fragments (R5-11): solo el servidor la invoca.
revoke execute on function public.match_knowledge_fragments_hibrida(vector, text, uuid, character varying, integer, text, integer, uuid[])
  from public, anon, authenticated;
grant execute on function public.match_knowledge_fragments_hibrida(vector, text, uuid, character varying, integer, text, integer, uuid[])
  to service_role;
