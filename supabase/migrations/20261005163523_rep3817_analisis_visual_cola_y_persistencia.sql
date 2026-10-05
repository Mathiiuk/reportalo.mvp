-- REP-3817 — Persistir y encolar el análisis visual por evidencia (Sprint 15)
--
-- Infraestructura asíncrona de la verificación visual por fotografía, SEPARADA del circuito RAG textual: no se
-- modifica rag_analysis_queue, enqueue_rag_analysis, persist_rag_analysis ni dispatch_rag_analysis_queue.
-- Es el espejo del patrón del RAG (cola pgmq + trigger + despachador + cron + Vault), con un resultado por foto.
--
--   1. report_image_analysis: un resultado por evidencia (UNIQUE image_id). Lectura para el dueño del reporte y
--      para quien lo atiende; escritura solo server-side (service_role).
--   2. visual_analysis_queue (pgmq) y trigger AFTER INSERT en report_images: una fila nueva = una unidad procesable.
--   3. persist_visual_analysis: guarda el resultado de forma idempotente (on conflict do nothing).
--   4. dispatch_visual_analysis_queue + cron de cada minuto: llama a la Edge Function de REP-3818.
--
-- DECISIONES
--   * El mensaje de la cola lleva solo imageId y reportId. La función de REP-3818 lee la foto del bucket y la
--     descripción y la categoría de la base: nada de lo que viaje en el mensaje es de confianza.
--   * Un fallo al encolar NO rompe el alta de la evidencia: el trigger captura el error y avisa (warning).
--   * Si faltan los secrets de Vault, el despachador no hace nada (no consume mensajes ni gasta reintentos).
--   * No se crea ningún secret en esta migración. El secret de la URL (visual_analizar_imagen_url) se carga cuando
--     se despliegue analizar-imagen-reporte (REP-3818): con la URL cargada y la función inexistente, cada foto
--     terminaría en 'fallido' tras los reintentos.
--   * suggested_service_id referencia services (el modelo devuelve un código y la función lo traduce a este id).
--   * model_code es texto libre (no FK a generation_models): el respaldo de modelo (gemini-3.7-flash, 3.5-flash-lite)
--     no está cargado en esa tabla y el resultado siempre debe poder guardar con qué modelo se obtuvo.
--
-- REQUIERE en Vault (solo nombres; los valores se cargan a mano y no se versionan):
--   - visual_analizar_imagen_url : URL de la Edge Function analizar-imagen-reporte (REP-3818).
--   - visual_dispatch_token      : token que la función exige en el header x-visual-dispatch-token.
--   - rag_service_role_key       : ya existe (clave service_role del despacho del RAG); se reutiliza.
--
-- NO se agrega a la publicación de Realtime (REP-3820 lo decide si hace falta).
-- No hay backfill: solo las evidencias nuevas generan análisis.

begin;

-- 1) Resultado del análisis visual, uno por evidencia ---------------------------------------------------------
create table if not exists public.report_image_analysis (
  id                    uuid primary key default gen_random_uuid(),
  image_id              uuid not null references public.report_images(id) on delete cascade,
  -- Desnormalizado de report_images.report_id para que RLS y las consultas por reporte no necesiten un join
  report_id             uuid not null references public.citizen_reports(id),
  -- completado = resultado válido del modelo; omitido = no corresponde analizar; fallido = error o validación
  -- fallida tras los reintentos (falla cerrada: el reporte sigue su curso)
  status                text not null,
  scene_summary         text,
  coherence             text,
  suggested_service_id  uuid references public.services(id),
  quality_flags         text[] not null default '{}',
  -- Solo observabilidad: nunca se usa como probabilidad operativa (REP-3816)
  confidence_score      numeric,
  model_code            text,
  prompt_version        text,
  input_tokens          integer,
  output_tokens         integer,
  latency_ms            integer,
  status_reason         text,
  created_at            timestamptz not null default now(),
  constraint report_image_analysis_image_id_key unique (image_id),
  constraint report_image_analysis_status_check check (status in ('completado', 'omitido', 'fallido')),
  constraint report_image_analysis_coherence_check check (coherence is null or coherence in ('coincide', 'no_coincide', 'no_concluyente')),
  constraint report_image_analysis_quality_flags_check check (quality_flags <@ array['oscura', 'borrosa', 'no_se_ve_el_hecho', 'sin_contexto_de_lugar']),
  constraint report_image_analysis_confidence_check check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  constraint report_image_analysis_summary_length check (scene_summary is null or char_length(scene_summary) <= 600),
  -- Un resultado «completado» siempre trae resumen y coherencia
  constraint report_image_analysis_completed_check check (status <> 'completado' or (scene_summary is not null and coherence is not null))
);

create index if not exists report_image_analysis_report_id_idx on public.report_image_analysis (report_id);

alter table public.report_image_analysis enable row level security;

-- Lectura: dueño del reporte o quien lo atiende (misma regla que report_images y report_ai_analysis).
-- No hay policies de INSERT/UPDATE/DELETE: solo service_role (que no depende de RLS) escribe.
drop policy if exists "read own or attended image analysis" on public.report_image_analysis;
create policy "read own or attended image analysis"
  on public.report_image_analysis for select
  to authenticated
  using (
    exists (
      select 1 from public.citizen_reports r
      where r.id = report_image_analysis.report_id
        and r.user_id = (select auth.uid())
    )
    or public.profile_attends_report((select auth.uid()), report_image_analysis.report_id)
  );

revoke all on table public.report_image_analysis from public, anon, authenticated;
grant select on table public.report_image_analysis to authenticated;
grant all on table public.report_image_analysis to service_role;

-- 2) Cola y trigger -------------------------------------------------------------------------------------------
do $$
begin
  perform pgmq.create('visual_analysis_queue');
exception when others then
  raise notice 'pgmq.create(visual_analysis_queue) - probablemente ya existe: %', sqlerrm;
end $$;

create or replace function public.enqueue_visual_analysis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform pgmq.send(
      'visual_analysis_queue',
      jsonb_build_object('imageId', new.id, 'reportId', new.report_id)
    );
  exception when others then
    -- La evidencia ya es válida: no se la rechaza porque falló el encolado del análisis
    raise warning 'enqueue_visual_analysis: no se pudo encolar image_id=%: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_enqueue_visual_analysis on public.report_images;
create trigger trg_enqueue_visual_analysis
  after insert on public.report_images
  for each row
  execute function public.enqueue_visual_analysis();

-- 3) Persistencia idempotente (la usa la Edge Function con service_role) --------------------------------------
create or replace function public.persist_visual_analysis(p_analysis jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_image_id uuid := (p_analysis ->> 'image_id')::uuid;
  v_report_id uuid;
  v_id uuid;
begin
  -- El reporte sale de la evidencia, no del parámetro: no puede quedar inconsistente
  select report_id into v_report_id from report_images where id = v_image_id;
  if v_report_id is null then
    raise exception 'persist_visual_analysis: la evidencia % no existe', v_image_id;
  end if;

  insert into report_image_analysis (
    image_id, report_id, status, scene_summary, coherence, suggested_service_id, quality_flags,
    confidence_score, model_code, prompt_version, input_tokens, output_tokens, latency_ms, status_reason)
  select v_image_id, v_report_id, a.status, a.scene_summary, a.coherence, a.suggested_service_id,
         coalesce(a.quality_flags, '{}'), a.confidence_score, a.model_code, a.prompt_version,
         a.input_tokens, a.output_tokens, a.latency_ms, a.status_reason
  from jsonb_populate_record(null::public.report_image_analysis, p_analysis) a
  on conflict (image_id) do nothing
  returning id into v_id;

  if v_id is null then
    -- Ya existía un análisis para esa evidencia (reintento): no se duplica ni se pisa
    select id into v_id from report_image_analysis where image_id = v_image_id;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.persist_visual_analysis(jsonb) from public, anon, authenticated;
grant  execute on function public.persist_visual_analysis(jsonb) to service_role;

-- 4) Despachador y cron -----------------------------------------------------------------------------------------
create or replace function public.dispatch_visual_analysis_queue()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  msg record;
  function_url text;
  service_role_key text;
  dispatch_token text;
  max_retries constant int := 3;
begin
  select decrypted_secret into function_url     from vault.decrypted_secrets where name = 'visual_analizar_imagen_url';
  select decrypted_secret into service_role_key from vault.decrypted_secrets where name = 'rag_service_role_key';
  select decrypted_secret into dispatch_token   from vault.decrypted_secrets where name = 'visual_dispatch_token';

  -- Sin secrets no se lee la cola: los mensajes quedan intactos y no se gastan reintentos
  if function_url is null or service_role_key is null or dispatch_token is null then
    raise notice 'Faltan secrets en Vault (visual_analizar_imagen_url / rag_service_role_key / visual_dispatch_token): no se despacha el análisis visual.';
    return;
  end if;

  for msg in select * from pgmq.read('visual_analysis_queue', 90, 20) loop
    begin  -- cada mensaje aislado: un error no corta la corrida
      if exists (select 1 from public.report_image_analysis where image_id = (msg.message ->> 'imageId')::uuid) then
        -- Ya tiene resultado (la función no alcanzó a borrar el mensaje): no se paga otra llamada al modelo
        perform pgmq.delete('visual_analysis_queue', msg.msg_id);
      elsif msg.read_ct > max_retries then
        perform pgmq.archive('visual_analysis_queue', msg.msg_id);
        begin
          insert into public.report_image_analysis (image_id, report_id, status, status_reason)
          values (
            (msg.message ->> 'imageId')::uuid,
            (msg.message ->> 'reportId')::uuid,
            'fallido',
            format('Se superó el límite de %s reintentos; mensaje archivado (msg_id=%s).', max_retries, msg.msg_id))
          on conflict (image_id) do nothing;
        exception when others then
          raise warning 'dispatch_visual_analysis_queue: no se pudo registrar el fallido de msg_id=%: %', msg.msg_id, sqlerrm;
        end;
      else
        perform net.http_post(
          url := function_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_role_key,
            'x-visual-dispatch-token', dispatch_token),
          body := msg.message || jsonb_build_object('queueMessageId', msg.msg_id));
      end if;
    exception when others then
      raise warning 'dispatch_visual_analysis_queue: msg_id=% falló: %', msg.msg_id, sqlerrm;
    end;
  end loop;
end;
$$;

revoke execute on function public.dispatch_visual_analysis_queue() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'visual-analysis-dispatch') then
    perform cron.schedule(
      'visual-analysis-dispatch',
      '* * * * *',
      $job$select public.dispatch_visual_analysis_queue();$job$
    );
  end if;
end $$;

commit;
