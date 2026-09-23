-- REP-2501: conservar solo la evidencia anonimizada, vinculada a su reporte.
--
-- 1) report_images: la política de INSERT solo comprobaba que el reporte fuera del usuario;
--    image_url podía ser cualquier URL (otra foto pública, un archivo de otro reporte).
--    Ahora la URL debe apuntar al bucket 'report-evidences', dentro de la carpeta del
--    client_side_id de ese mismo reporte (que es donde quarantine-anonymize deposita).
-- 2) Cuarentena: el ciudadano solo puede subir dentro de su propia carpeta (<uid>/...).
--    quarantine-anonymize verifica esa misma regla antes de procesar.
-- 3) Purga programada: elimina de 'evidence-quarantine' lo que lleve más de 1 hora, para
--    que una foto original nunca quede guardada si el cliente no llegó a procesarla.
--
-- ORDEN DE DESPLIEGUE: aplicar DESPUÉS de publicar el frontend que sube a <uid>/temp_...
-- Con la política nueva, la versión vieja de la app (sube a la raíz) recibiría un 403.
--
-- Repetible: dropea antes de crear.
begin;

-- ---------------------------------------------------------------------------
-- 1) report_images: solo evidencia del bucket de evidencias, de su propio reporte
-- ---------------------------------------------------------------------------
drop policy if exists "insert own report images" on public.report_images;
create policy "insert own report images" on public.report_images
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.citizen_reports r
      where r.id = report_images.report_id
        and r.user_id = (select auth.uid())
        -- .../object/public/report-evidences/<client_side_id>/<archivo>
        and report_images.image_url like
          '%/storage/v1/object/public/report-evidences/' || r.client_side_id::text || '/%'
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Cuarentena: subida solo a la carpeta del propio usuario
-- ---------------------------------------------------------------------------
drop policy if exists "Subida a cuarentena con sesion" on storage.objects;
create policy "Subida a cuarentena con sesion" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidence-quarantine'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- 3) Purga programada de la cuarentena
-- ---------------------------------------------------------------------------
-- Mismo patrón que dispatch_rag_analysis_queue: la URL de la función y la clave de
-- servicio viven en Vault, no en este archivo. Hace falta crear UNA VEZ el secret
-- 'quarantine_purge_url' (la URL de la Edge Function quarantine-purge); se reutiliza
-- 'rag_service_role_key'. Si faltan, la función avisa y no falla.
create or replace function public.dispatch_quarantine_purge()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  function_url text;
  service_role_key text;
begin
  select decrypted_secret into function_url
  from vault.decrypted_secrets where name = 'quarantine_purge_url';
  select decrypted_secret into service_role_key
  from vault.decrypted_secrets where name = 'rag_service_role_key';

  if function_url is null or service_role_key is null then
    raise notice 'Faltan los secrets quarantine_purge_url / rag_service_role_key en Vault: la purga de cuarentena no se ejecuta.';
    return;
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := '{}'::jsonb
  );
end;
$$;

-- Solo el propio job (rol postgres) debe poder invocarla
revoke execute on function public.dispatch_quarantine_purge() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'quarantine-purge') then
    perform cron.schedule(
      'quarantine-purge',
      '*/15 * * * *',
      $job$select public.dispatch_quarantine_purge();$job$
    );
  end if;
end;
$$;

commit;
