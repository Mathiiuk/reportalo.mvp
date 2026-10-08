-- REP-3822 — Trazabilidad por intento de la verificación visual y lotes de QA (Sprint 15)
--
-- report_image_analysis guarda UN resultado por foto. Para medir costo y performance hace falta además un registro
-- por CADA llamada al proveedor (incluidos los reintentos, el respaldo de modelo y los fallos) y una forma de decir
-- «estos reportes pertenecen al lote de QA X». Dos tablas nuevas, ambas solo de servidor:
--
--   1. visual_call_log: append-only, una fila por intento contra Gemini. Sin FK a report_images/citizen_reports a
--      propósito: el registro de lo que se pagó debe sobrevivir si se borra la foto o el reporte.
--   2. visual_qa_cases: asigna reportes a un lote (qa_batch_id) y a un caso (case_id) con el resultado esperado.
--      Se carga a mano ANTES de medir; no se marca retrospectivamente nada. El export une por report_id.
--
-- DECISIONES
--   * No se toca report_image_analysis (la lee la pantalla de REP-3820), ni el RAG textual, ni la cola.
--   * Sin policies para authenticated: ni el ciudadano ni quien atiende ven el modelo, los tokens ni los lotes.
--     Solo service_role (la Edge Function y el SQL Editor / export) lee y escribe.
--   * output_tokens sigue la misma definición que report_image_analysis: ya INCLUYE el thinking
--     (candidatesTokenCount + thoughtsTokenCount). thinking_tokens va aparte solo para poder separarlo: no se suma.
--   * Con un fallo del proveedor no hay usageMetadata: los tokens quedan en NULL (desconocido), nunca en 0.
--   * El texto de la foto y de la descripción nunca se guardan acá; error_message va truncado y sin claves.

begin;

-- 1) Un registro por intento contra el proveedor -------------------------------------------------------------
create table if not exists public.visual_call_log (
  call_id             uuid primary key default gen_random_uuid(),
  image_id            uuid not null,
  report_id           uuid not null,
  queue_message_id    bigint,
  -- 1.. dentro de una pasada de la función (hasta 4: modelo principal x2 + dos respaldos x1)
  attempt             integer not null check (attempt >= 1),
  stage               text not null default 'visual' check (stage in ('visual', 'textual', 'anonimizacion')),
  -- Commit/versión de la función que ejecutó la llamada (secret FUNCTION_COMMIT de la función; NULL si no se cargó)
  deployment_id       text,
  prompt_version      text not null,
  model_requested     text not null,
  -- modelVersion que informa la respuesta del proveedor; NULL si no hubo respuesta
  model_returned      text,
  started_at          timestamptz not null,
  finished_at         timestamptz not null,
  duration_ms         integer not null check (duration_ms >= 0),
  http_status         integer,
  status              text not null check (status in ('ok', 'http_error', 'network_error', 'timeout', 'blocked', 'incomplete', 'invalid_output')),
  error_code          text,
  error_message       text check (error_message is null or char_length(error_message) <= 400),
  input_tokens        integer,
  output_tokens       integer,
  thinking_tokens     integer,
  raw_usage_metadata  jsonb,
  -- coincide / no_coincide / no_concluyente solo si el intento devolvió una salida válida; el fallo técnico va en status
  visual_result       text check (visual_result is null or visual_result in ('coincide', 'no_coincide', 'no_concluyente')),
  created_at          timestamptz not null default now()
);

create index if not exists visual_call_log_report_id_idx on public.visual_call_log (report_id);
create index if not exists visual_call_log_image_id_idx  on public.visual_call_log (image_id);
create index if not exists visual_call_log_started_at_idx on public.visual_call_log (started_at);

alter table public.visual_call_log enable row level security;
revoke all on table public.visual_call_log from public, anon, authenticated;
grant all on table public.visual_call_log to service_role;

-- 2) Lotes y casos de QA --------------------------------------------------------------------------------------
create table if not exists public.visual_qa_cases (
  qa_batch_id  text not null check (char_length(qa_batch_id) between 1 and 80),
  case_id      text not null check (char_length(case_id) between 1 and 80),
  report_id    uuid not null references public.citizen_reports(id) on delete cascade,
  -- Se fija antes de ejecutar; NULL para el humo, donde solo se prueba que los campos se recuperan
  expected     text check (expected is null or expected in ('coincide', 'no_coincide', 'no_concluyente')),
  environment  text not null default 'staging' check (environment in ('staging', 'local', 'produccion')),
  notes        text,
  created_at   timestamptz not null default now(),
  primary key (qa_batch_id, case_id),
  -- Un reporte pertenece a un solo caso de un lote: el export no duplica intentos
  constraint visual_qa_cases_batch_report_key unique (qa_batch_id, report_id)
);

create index if not exists visual_qa_cases_report_id_idx on public.visual_qa_cases (report_id);

alter table public.visual_qa_cases enable row level security;
revoke all on table public.visual_qa_cases from public, anon, authenticated;
grant all on table public.visual_qa_cases to service_role;

-- 3) Escritura del registro (la usa la Edge Function con service_role) ---------------------------------------------
-- Misma forma que persist_visual_analysis: la función solo escribe por RPC, nunca con INSERT directo.
create or replace function public.log_visual_call(p_entry jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into visual_call_log (
    call_id, image_id, report_id, queue_message_id, attempt, stage, deployment_id, prompt_version,
    model_requested, model_returned, started_at, finished_at, duration_ms, http_status, status, error_code,
    error_message, input_tokens, output_tokens, thinking_tokens, raw_usage_metadata, visual_result)
  select coalesce(e.call_id, gen_random_uuid()), e.image_id, e.report_id, e.queue_message_id, e.attempt,
         coalesce(e.stage, 'visual'), e.deployment_id, e.prompt_version, e.model_requested, e.model_returned,
         e.started_at, e.finished_at, e.duration_ms, e.http_status, e.status, e.error_code,
         e.error_message, e.input_tokens, e.output_tokens, e.thinking_tokens, e.raw_usage_metadata, e.visual_result
  from jsonb_populate_record(null::public.visual_call_log, p_entry) e
  -- Un reintento de la misma llamada (mismo call_id) no se duplica
  on conflict (call_id) do nothing
  returning call_id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.log_visual_call(jsonb) from public, anon, authenticated;
grant  execute on function public.log_visual_call(jsonb) to service_role;

commit;
