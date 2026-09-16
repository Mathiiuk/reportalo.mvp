-- V-09 (REP-2908-VERIF): match_knowledge_fragments filtraba solo por
-- jurisdiccion, nunca por la categoria que elige el ciudadano -- por eso
-- un reclamo de "comercio irregular" (sin fragmentos en fragment_services
-- para ese service_code) podia matchear por pura similitud lexica con una
-- norma de transito vehicular y citarla como si fundamentara el reclamo
-- (confirmado: Caso F, 5 de 5 corridas, Ley 24.449 art. 48 inc. t) citada
-- para un puesto ambulante sin habilitacion).
--
-- Se agrega el parametro opcional p_service_code: cuando el ciudadano elige
-- una categoria, solo se recuperan fragmentos tageados con ese service_code
-- en fragment_services. Si la categoria no tiene ningun fragmento cargado
-- (como COMERCIO_IRREGULAR hoy), no hay elegibles -> sin_normativa sin
-- llamar al LLM. Sin categoria (p_service_code null), el comportamiento es
-- igual al anterior.
--
-- Cambia la firma (4 args -> 5 args): se dropea la version vieja para que
-- PostgREST no vea dos funciones sobreescargadas con el mismo nombre.
drop function if exists public.match_knowledge_fragments(vector, uuid, character varying, integer);

create or replace function public.match_knowledge_fragments(
  query_embedding vector,
  p_locality_id uuid,
  p_model_code character varying,
  match_count integer default 6,
  p_service_code text default null
)
returns table(fragment_id uuid, source_id uuid, hierarchy_path text, content text, scope_level integer, similarity double precision)
language sql
stable
set search_path to 'public', 'extensions'
as $$
  select f.id, f.source_id, f.hierarchy_path, f.content, e.scope_level,
         1 - (fe.embedding <=> query_embedding)
  from eligible_knowledge_sources(p_locality_id) e
  join knowledge_fragments f  on f.source_id = e.source_id and f.is_current
  join fragment_embeddings fe on fe.fragment_id = f.id and fe.model_code = p_model_code
  where p_service_code is null or exists (
    select 1
    from fragment_services fs
    join services s on s.id = fs.service_id
    where fs.fragment_id = f.id and s.service_code = p_service_code
  )
  order by fe.embedding <=> query_embedding
  limit match_count;
$$;

revoke execute on function public.match_knowledge_fragments(vector, uuid, character varying, integer, text) from public;
