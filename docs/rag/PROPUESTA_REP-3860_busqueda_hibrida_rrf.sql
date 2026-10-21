-- PROPUESTA (REP-3860, P2), NO APLICAR. Se guarda en docs/ y no en supabase/migrations/ para que nadie la aplique
-- antes de la puerta P1 y de medir P0 (REP-3859). Origen: worktree S16, commit 681eb25 (16/10/2026).

-- RAG Sprint 16 · Variante V3: búsqueda híbrida (vectores + texto completo) con
-- Reciprocal Rank Fusion. PROPUESTA PARA REVISIÓN: no aplicada en staging ni en
-- producción. Medición: docs/RAG-S16_busqueda_hibrida_bateria_81.md.
--
-- Qué hace: toma los mismos candidatos que match_knowledge_fragments (fuentes
-- elegibles por jurisdicción, fragmentos vigentes con vector del modelo pedido y,
-- si hay categoría, tageados con ese service_code) y los ordena por
--   rrf = 1 / (k + puesto_vectorial) + 1 / (k + puesto_texto)
-- donde puesto_texto es el orden por ts_rank sobre knowledge_fragments.fts (solo
-- los que tienen alguna coincidencia; el resto no suma por ese lado). Empates: gana
-- el mejor puesto vectorial.
--
-- Texto completo: la consulta son los lexemas de la descripción del ciudadano
-- (sin el «(categoría: X)» que se agrega al texto que se vectoriza) unidos con OR.
-- plainto_tsquery los une con AND y en textos largos casi nunca hay coincidencia;
-- la salida de plainto_tsquery es siempre un tsquery válido, así que reemplazar
-- ' & ' por ' | ' y volver a convertirlo no puede fallar. Si la descripción no
-- tiene lexemas (solo palabras vacías), el orden queda igual al vectorial.
--
-- Devuelve las mismas columnas que match_knowledge_fragments, con `similarity`
-- igual al coseno, para que el umbral de analizar-reporte (0,45) siga valiendo
-- igual; agrega vector_rank, text_rank y rrf_score para diagnóstico.
--
-- Es una función nueva (no reemplaza a match_knowledge_fragments): el cambio en
-- analizar-reporte es pasar a llamar a esta, con p_query_text = descripción, y
-- volver atrás es volver a llamar a la anterior.

create or replace function public.match_knowledge_fragments_hibrida(
  query_embedding vector,
  p_query_text text,
  p_locality_id uuid,
  p_model_code character varying,
  match_count integer default 8,
  p_service_code text default null,
  p_rrf_k integer default 60
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
  rrf_score double precision
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
         1.0 / (p_rrf_k + v.puesto) + coalesce(1.0 / (p_rrf_k + t.puesto), 0)
  from candidatos c
  join por_vector v on v.id = c.id
  left join por_texto t on t.id = c.id
  order by 9 desc, v.puesto
  limit match_count;
$$;

-- Igual que match_knowledge_fragments (R5-11): solo el servidor la invoca.
revoke execute on function public.match_knowledge_fragments_hibrida(vector, text, uuid, character varying, integer, text, integer)
  from public, anon, authenticated;
grant execute on function public.match_knowledge_fragments_hibrida(vector, text, uuid, character varying, integer, text, integer)
  to service_role;
