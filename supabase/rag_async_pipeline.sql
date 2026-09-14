-- ==============================================================================
-- rag_async_pipeline.sql — Bloque 1 de REP-2909: disparo asíncrono del análisis
-- ==============================================================================
--
-- ESTADO: escrito, NO ejecutado contra ningún proyecto Supabase real desde esta
-- tarea (sin Supabase CLI ni credenciales de servicio en este entorno). Requiere
-- autorización explícita de Matías para aplicarse, igual que rag_knowledge_schema.sql.
--
-- Implementa los pasos 2-3 del flujo de docs/REP-1009_RAG_de_punta_a_punta.docx §5:
--   2. Un trigger de la base detecta el reporte nuevo y deja un mensaje en una cola.
--   3. Cada pocos segundos, un proceso programado lee la cola y llama a la función
--      de análisis. Si falla, el mensaje reaparece y se reintenta solo.
-- Mismo patrón que "Automatic embeddings" de Supabase (trigger + pgmq + pg_cron +
-- pg_net), citado explícitamente en el docx como la referencia a seguir.
--
-- ORDEN DE APLICACIÓN: después de docs/REP-3769_seed_y_RAG.sql (necesita que
-- citizen_reports y locality_id existan y sean NOT NULL, ya cubierto por esa
-- migración) y después de supabase/rag_knowledge_schema.sql (necesita
-- knowledge_fragments y compañía para que analizar-reporte tenga algo que leer).
--
-- REQUIERE (fuera de esta tarea, a cargo de Matías/Hernán al aplicar):
--   - Las extensiones pgmq, pg_cron y pg_net habilitadas en el proyecto (Database
--     -> Extensions en el dashboard de Supabase).
--   - Un secret en Supabase Vault con la URL de la función y la clave de servicio,
--     referenciado más abajo — NUNCA se hardcodea una clave en este archivo.
-- ==============================================================================

begin;

create extension if not exists pgmq;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Cola de análisis pendientes. select pgmq.create() es idempotente en pgmq >= 1.0
-- (falla con "already exists" en versiones viejas; en ese caso no hacer nada).
do $$
begin
  perform pgmq.create('rag_analysis_queue');
exception when others then
  raise notice 'pgmq.create(rag_analysis_queue) — probablemente ya existe: %', sqlerrm;
end $$;

-- ----------------------------------------------------------------------------
-- Paso 2 del flujo: encolar un mensaje cuando se crea un reporte nuevo.
-- El mensaje lleva lo mínimo que necesita analizar-reporte para armar la
-- consulta (paso 4): descripción, categoría elegida y localidad. NO se
-- vectoriza ni se resuelve nada acá — eso es responsabilidad de la Edge
-- Function (pasos 5-9), nunca del trigger.
-- ----------------------------------------------------------------------------
create or replace function public.enqueue_rag_analysis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pgmq.send(
    'rag_analysis_queue',
    jsonb_build_object(
      'reportId', new.id,
      'description', new.description,
      'category', (select s.service_code from public.services s where s.id = new.service_id),
      'localityId', new.locality_id
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_enqueue_rag_analysis on public.citizen_reports;
create trigger trg_enqueue_rag_analysis
  after insert on public.citizen_reports
  for each row
  execute function public.enqueue_rag_analysis();

-- ----------------------------------------------------------------------------
-- Paso 3 del flujo: cada tick, leer un lote de mensajes con timeout de
-- visibilidad y disparar la Edge Function para cada uno. El mensaje NO se
-- borra acá — pgmq lo vuelve a hacer visible solo si nadie lo borró dentro
-- del vt (visibility timeout), que es exactamente el "si falla, el mensaje
-- reaparece y se reintenta solo" del docx. El borrado real (solo si la
-- persistencia del análisis tuvo éxito) lo hace analizar-reporte, en el
-- bloque 2 de REP-2909 — así "reintentar" y "guardar con éxito" quedan
-- atados al mismo hecho, sin una segunda pasada que reconcilie estado.
--
-- vt = 90s: tiene que ser mayor que el tiempo esperado de la Edge Function
-- (embedding + LLM, unos pocos segundos según el docx §5, con margen).
-- ----------------------------------------------------------------------------
create or replace function public.dispatch_rag_analysis_queue()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  msg record;
  function_url text;
  service_role_key text;
begin
  -- La URL de la función y la clave de servicio viven en Supabase Vault, no en
  -- este archivo. Matías crea estos secrets una sola vez al desplegar
  -- (Dashboard -> Project Settings -> Vault), con estos nombres exactos:
  select decrypted_secret into function_url
  from vault.decrypted_secrets where name = 'rag_analizar_reporte_url';
  select decrypted_secret into service_role_key
  from vault.decrypted_secrets where name = 'rag_service_role_key';

  if function_url is null or service_role_key is null then
    raise notice 'Faltan los secrets rag_analizar_reporte_url / rag_service_role_key en Vault: dispatch_rag_analysis_queue no puede llamar a la Edge Function.';
    return;
  end if;

  for msg in select * from pgmq.read('rag_analysis_queue', 90, 20) loop
    perform net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := msg.message || jsonb_build_object('queueMessageId', msg.msg_id)
    );
  end loop;
end;
$$;

-- Job de pg_cron. Sintaxis de 6 campos (con segundos) — si el pg_cron del
-- proyecto no la soporta, usar '* * * * *' (cada 1 minuto) como alternativa
-- documentada; queda peor que "pocos segundos" pero sigue siendo correcto.
-- DO en vez de un WHERE NOT EXISTS a nivel de SELECT: en un SELECT sin FROM,
-- la función del target list se evalúa igual aunque el WHERE termine
-- descartando la fila, así que un guard real necesita este bloque.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'rag-analysis-dispatch') then
    perform cron.schedule(
      'rag-analysis-dispatch',
      '*/10 * * * * *',
      $job$select public.dispatch_rag_analysis_queue();$job$
    );
  end if;
end $$;

commit;
