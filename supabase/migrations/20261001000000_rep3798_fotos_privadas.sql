-- REP-3798 — Fotos privadas: solo las ve el dueño del reporte (y quien lo atiende)
--
-- Decisión de producto (Matías, 30/09/2026; Leo, PM, pidió «avanzar con la migración de RLS y el cambio de
-- bucket»): cualquier ciudadano puede ver el resumen de un reporte ajeno, pero NO sus fotos. Hasta ahora eso
-- solo lo garantizaba el frontend (no las pedía): la base las dejaba leer a cualquiera.
--   * report_images tenía la policy `lectura_publica` (SELECT, qual true).
--   * El bucket report-evidences era público, con la policy de storage «Lectura publica de evidencias
--     anonimizadas».
--
-- Cambios:
--   1. report_images: SELECT solo para el dueño del reporte o quien lo atiende (profile_attends_report, la misma
--      regla que report_state_history).
--   2. report-evidences pasa a privado y su lectura queda para el dueño o quien atiende el reporte. En storage
--      el reporte se identifica por la primera carpeta de la ruta, que es el client_side_id
--      (`<client_side_id>/<archivo>`), igual que la policy de INSERT de report_images.
--
-- LO QUE CAMBIA PARA EL FRONTEND (ya hecho en la rama): la URL guardada en report_images.image_url, de formato
-- `.../object/public/report-evidences/...`, deja de abrirse sin sesión. Se conserva como formato de almacenamiento
-- (la policy de INSERT lo exige) y el detalle del reporte la reemplaza por una URL firmada y temporal. La Edge
-- Function quarantine-anonymize devuelve además `previewUrl` (URL firmada) para la vista previa previa al envío.
--
-- ORDEN DE APLICACIÓN: primero desplegar quarantine-anonymize y el frontend nuevo, después esta migración. Con
-- la migración aplicada y un frontend viejo en caché (PWA), las fotos no se verían hasta que la app se actualice.
--
-- quarantine-anonymize y las demás funciones usan service_role, que no depende de estas policies.
-- Los objetos huérfanos del bucket (sin reporte asociado) quedan sin lectura para los ciudadanos.
--
-- Probada en la base descartable con usuarios simulados, dentro de una transacción que se deshace:
-- el dueño ve su foto; otro ciudadano y un anónimo no ven nada; el bucket queda privado.

-- 1) report_images: lectura solo del dueño o de quien atiende el reporte
drop policy if exists "lectura_publica" on public.report_images;
drop policy if exists "read own or attended report images" on public.report_images;
create policy "read own or attended report images"
  on public.report_images for select
  to authenticated
  using (
    exists (
      select 1 from public.citizen_reports r
      where r.id = report_images.report_id
        and r.user_id = (select auth.uid())
    )
    or public.profile_attends_report((select auth.uid()), report_images.report_id)
  );

-- 2) Bucket privado y lectura acotada
update storage.buckets set public = false where id = 'report-evidences';

drop policy if exists "Lectura publica de evidencias anonimizadas" on storage.objects;
drop policy if exists "Lectura de evidencias propias o atendidas" on storage.objects;
create policy "Lectura de evidencias propias o atendidas"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'report-evidences'
    and exists (
      select 1 from public.citizen_reports r
      where r.client_side_id::text = (storage.foldername(name))[1]
        and (
          r.user_id = (select auth.uid())
          or public.profile_attends_report((select auth.uid()), r.id)
        )
    )
  );
