-- REP-3774: loader reproducible del corpus RAG desde archivos .md verificados.
--
-- Sprint 12 dejo el modelo de datos completo (knowledge_sources,
-- knowledge_fragments, fragment_embeddings, vigencia/versionado). Esta
-- migracion NO lo rediseña: agrega lo unico que faltaba para poder cargar una
-- norma sin escribir SQL fila por fila.
--
--   1. El bucket privado `corpus-fuentes`, donde queda el snapshot del .md que
--      se cargo, para poder auditar despues contra que texto se genero cada
--      fragmento.
--   2. Dos RPC que encapsulan la escritura, para que el loader no tenga que
--      replicar en JavaScript las reglas de vigencia. Son la parte que necesita
--      atomicidad: el indice `knowledge_fragments_current_uq` prohibe dos
--      fragmentos vigentes con el mismo (source_id, article, subsection), asi
--      que bajar el viejo y subir el nuevo tiene que pasar en una sola
--      transaccion; el cliente supabase-js no puede abrir una.
--
-- Ambos RPC son idempotentes: cargar dos veces el mismo .md no duplica nada ni
-- crea versiones nuevas. Solo un cambio real de texto genera una version nueva.
--
-- Repetible: dropea antes de crear.
begin;

-- ---------------------------------------------------------------------------
-- 1. Bucket privado de snapshots
-- ---------------------------------------------------------------------------
-- Privado a proposito. El texto de las normas es publico, pero el snapshot es
-- material de auditoria: tiene que poder probarse que nadie lo edito desde
-- afuera. Se escribe y se lee solo con clave de servicio (el loader), que no
-- pasa por RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('corpus-fuentes', 'corpus-fuentes', false, 10485760,
        array['text/markdown', 'text/plain', 'application/pdf'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Sin politicas para anon/authenticated: ninguna sesion del navegador tiene por
-- que tocar este bucket. Se dropean por si una corrida previa las dejo.
drop policy if exists "Lectura de corpus-fuentes"   on storage.objects;
drop policy if exists "Escritura de corpus-fuentes" on storage.objects;

-- ---------------------------------------------------------------------------
-- 2. Alta/actualizacion de la fuente (una norma)
-- ---------------------------------------------------------------------------
-- La identidad de una norma es (document_type_code, document_number, ambito):
-- no se usa el titulo, que cambia de redaccion entre fuentes. Si ya existe, se
-- refresca la metadata verificable (URL, fecha de verificacion, snapshot,
-- ultima modificacion) y se devuelve el id existente, sin duplicar.
create or replace function public.upsert_knowledge_source(
  p_source_type_code   varchar,
  p_document_type_code varchar,
  p_document_number    text,
  p_title              text,
  p_issuing_authority  text,
  p_country_id         uuid,
  p_state_province_id  uuid,
  p_subdivision_id     uuid,
  p_requires_adhesion  boolean,
  p_source_url         text,
  p_snapshot_path      text,
  p_verified_at        timestamptz,
  p_last_amended_by    text default null
)
returns table (source_id uuid, action text)
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  select ks.id into v_id
  from knowledge_sources ks
  where ks.document_type_code = p_document_type_code
    and ks.document_number is not distinct from p_document_number
    and ks.country_id        is not distinct from p_country_id
    and ks.state_province_id is not distinct from p_state_province_id
    and ks.subdivision_id    is not distinct from p_subdivision_id
    and ks.is_current;

  if v_id is null then
    insert into knowledge_sources
      (source_type_code, document_type_code, document_number, title, issuing_authority,
       country_id, state_province_id, subdivision_id, requires_adhesion,
       source_url, snapshot_path, is_current, verified_at, last_amended_by)
    values
      (p_source_type_code, p_document_type_code, p_document_number, p_title, p_issuing_authority,
       p_country_id, p_state_province_id, p_subdivision_id, coalesce(p_requires_adhesion, false),
       p_source_url, p_snapshot_path, true, p_verified_at, p_last_amended_by)
    returning id into v_id;

    return query select v_id, 'created'::text;
  end if;

  update knowledge_sources ks
     set title             = p_title,
         issuing_authority = p_issuing_authority,
         source_type_code  = p_source_type_code,
         requires_adhesion = coalesce(p_requires_adhesion, ks.requires_adhesion),
         source_url        = p_source_url,
         snapshot_path     = coalesce(p_snapshot_path, ks.snapshot_path),
         verified_at       = p_verified_at,
         last_amended_by   = coalesce(p_last_amended_by, ks.last_amended_by)
   where ks.id = v_id;

  return query select v_id, 'updated'::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Alta/versionado de un fragmento (un articulo o inciso)
-- ---------------------------------------------------------------------------
-- Los fragmentos son inmutables: si el texto de un articulo cambia, NO se
-- actualiza la fila. Se baja la vigencia de la vieja y se inserta una nueva
-- apuntando a ella con replaces_fragment_id, para que un analisis viejo siga
-- citando exactamente el texto que existia cuando se emitio.
--
-- Devuelve action:
--   'unchanged' -> ya estaba cargado con el mismo texto (no hay que re-embeber)
--   'created'   -> primera carga de ese articulo/inciso
--   'versioned' -> el texto cambio: se creo una version nueva
create or replace function public.upsert_knowledge_fragment(
  p_source_id            uuid,
  p_hierarchy_path       text,
  p_article              text,
  p_subsection           text,
  p_content              text,
  p_foundation_type_code varchar,
  p_service_codes        text[] default '{}'
)
returns table (fragment_id uuid, action text)
language plpgsql
set search_path = public
as $$
declare
  v_current_id      uuid;
  v_current_content text;
  v_new_id          uuid;
  v_action          text;
begin
  select f.id, f.content into v_current_id, v_current_content
  from knowledge_fragments f
  where f.source_id  = p_source_id
    and f.article    is not distinct from p_article
    and f.subsection is not distinct from p_subsection
    and f.is_current;

  if v_current_id is not null and v_current_content = p_content then
    v_new_id := v_current_id;
    v_action := 'unchanged';

    -- La jerarquia y el tipo de fundamento son metadata, no el texto citado:
    -- corregirlos no justifica una version nueva.
    update knowledge_fragments f
       set hierarchy_path       = p_hierarchy_path,
           foundation_type_code = coalesce(p_foundation_type_code, f.foundation_type_code)
     where f.id = v_current_id;
  else
    if v_current_id is not null then
      update knowledge_fragments set is_current = false where id = v_current_id;
      v_action := 'versioned';
    else
      v_action := 'created';
    end if;

    insert into knowledge_fragments
      (source_id, hierarchy_path, article, subsection, content,
       foundation_type_code, is_current, replaces_fragment_id)
    values
      (p_source_id, p_hierarchy_path, p_article, p_subsection, p_content,
       p_foundation_type_code, true, v_current_id)
    returning id into v_new_id;
  end if;

  -- Categorias (services) del fragmento: se reescriben siempre, son un mapeo
  -- de producto y no forman parte del texto citado.
  delete from fragment_services fs where fs.fragment_id = v_new_id;
  insert into fragment_services (fragment_id, service_id)
  select v_new_id, s.id
  from unnest(coalesce(p_service_codes, '{}')) as code
  join services s on s.service_code = code
  on conflict do nothing;

  return query select v_new_id, v_action;
end;
$$;

-- Igual que match_knowledge_fragments: escribir el corpus es una operacion de
-- servidor. Ni el navegador ni un usuario autenticado la invocan.
revoke execute on function public.upsert_knowledge_source(varchar, varchar, text, text, text, uuid, uuid, uuid, boolean, text, text, timestamptz, text)
  from public, anon, authenticated;
grant  execute on function public.upsert_knowledge_source(varchar, varchar, text, text, text, uuid, uuid, uuid, boolean, text, text, timestamptz, text)
  to service_role;

revoke execute on function public.upsert_knowledge_fragment(uuid, text, text, text, text, varchar, text[])
  from public, anon, authenticated;
grant  execute on function public.upsert_knowledge_fragment(uuid, text, text, text, text, varchar, text[])
  to service_role;

commit;
