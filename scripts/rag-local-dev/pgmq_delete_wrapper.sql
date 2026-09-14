-- Wrapper publico para pgmq.delete: el schema pgmq no esta expuesto en la
-- API de datos de Supabase (por defecto solo 'public' lo esta), asi que
-- supabaseAdmin.schema('pgmq').rpc('delete', ...) desde analizar-reporte
-- fallaba con "Invalid schema: pgmq" -- el mensaje se guardaba el analisis
-- pero nunca se borraba de la cola, reprocesando cada minuto para siempre.
-- SECURITY DEFINER: se ejecuta con los privilegios del dueño (acceso a pgmq),
-- sin necesidad de exponer todo el schema pgmq (con sus demas funciones de
-- administracion de colas) a la superficie publica de la API.
--
-- Aplicado contra Supabase real el 2026-09-14 (REP-DEPLOY-RAG-SUPABASE).
-- Este archivo es el registro versionado de esa migracion.

create or replace function public.pgmq_delete_message(queue_name text, msg_id bigint)
returns boolean
language sql
security definer
set search_path = public, pgmq
as $$
  select pgmq.delete(queue_name, msg_id);
$$;

revoke all on function public.pgmq_delete_message(text, bigint) from public, anon, authenticated;
grant execute on function public.pgmq_delete_message(text, bigint) to service_role;
