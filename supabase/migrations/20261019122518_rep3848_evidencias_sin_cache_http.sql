-- REP-3848 — O-02 (QA REP-3832, casos C-11, C-15, C-15b, C-15d y C-15f): la caché HTTP del navegador le servía una
-- foto privada a otra cuenta en el mismo navegador
--
-- Qué pasó: la cuenta A bajó la foto de su reporte (descarga autenticada de report-evidences). Storage la devolvió con
-- `Cache-Control: max-age=3600`, el valor por defecto porque ningún upload lo fijaba, y sin `Vary: Authorization`.
-- El navegador la guardó por URL, y al pedir la misma ruta con la sesión de B la entregó desde la caché sin preguntarle
-- al servidor. Con parámetro anti-caché el servidor negó el acceso: la RLS del bucket estaba bien, el problema era la
-- copia guardada en el cliente.
--
-- Estado verificado en la base el 19/10/2026: los 508 objetos de report-evidences tienen
-- metadata.cacheControl = 'max-age=3600'. evidence-quarantine (fotos originales, sin difuminar, de vida corta) está
-- vacío ahora.
--
-- Corrección:
--   * Subidas nuevas (frontend y Edge Function quarantine-anonymize): `cacheControl: '0, private, no-store'`.
--     supabase-js antepone `max-age=`, así que el objeto queda con `max-age=0, private, no-store`.
--   * Objetos ya subidos (esta migración): Storage responde el Cache-Control que guarda en metadata.cacheControl,
--     así que se reescribe ese campo en los dos buckets privados de evidencia. No cambia ni el archivo, ni la ruta,
--     ni las policies.
--   * El Service Worker (Workbox, injectManifest) solo guarda de antemano los archivos de la app: no guarda fotos.
--
-- Con `no-store` el navegador no guarda la respuesta, así que cada vez que se abre el detalle las fotos se vuelven a
-- bajar (hasta 4 por reporte, unos 120 KB cada una).
--
-- ORDEN DE APLICACIÓN: indistinto respecto del frontend. Las fotos que un navegador ya tenga guardadas con el valor
-- viejo vencen solas en menos de una hora (max-age=3600).
--
-- APLICADA en la base Reportalo el 19/10/2026, con aprobación de Matías, después de redesplegar quarantine-anonymize
-- (versión 30, verify_jwt = false como antes). La versión quedó registrada como 20261019122518; el archivo se renombró
-- para coincidir. Verificado: los 508 objetos de report-evidences quedaron con 'max-age=0, private, no-store', el
-- bucket sigue privado y la policy de lectura sin cambios.

begin;

update storage.objects
set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{cacheControl}', '"max-age=0, private, no-store"'::jsonb)
where bucket_id in ('report-evidences', 'evidence-quarantine')
  and coalesce(metadata ->> 'cacheControl', '') <> 'max-age=0, private, no-store';

commit;
