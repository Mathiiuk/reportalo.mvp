-- Bloqueado por el clasificador de permisos del entorno de Claude Code al
-- intentar aplicarlo via MCP (razon: "Protected-Scope IaC Apply" — crea un
-- trigger sobre citizen_reports y un cron job recurrente). Correr manualmente
-- en el SQL Editor de Supabase. Requiere que ya esten creados en Vault los
-- secrets rag_analizar_reporte_url (ya cargado) y rag_service_role_key (a
-- cargar por Matias). Ver supabase/rag_async_pipeline.sql (rama
-- feat/REP-2909-...) para el contexto completo y los comentarios originales.

begin;

do $$
begin
  perform pgmq.create('rag_analysis_queue');
exception when others then
  raise notice 'pgmq.create(rag_analysis_queue) - probablemente ya existe: %', sqlerrm;
end $$;

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
