-- REP-3789 — Publicar report_ai_analysis en Realtime
--
-- Contexto: la pantalla de detalle del reporte tiene que pasar de "procesando"
-- a "fundamentado" sin que el ciudadano recargue. El analisis lo produce un
-- pipeline asincrono (pg_cron + pgmq + pg_net -> Edge Function analizar-reporte),
-- asi que el frontend necesita enterarse cuando la fila se inserta.
--
-- Estado verificado en produccion (CiudadAR, 2026-09-20): la publicacion
-- supabase_realtime contenia unicamente la tabla `infractions`. Sin esta
-- migracion, la suscripcion del cliente se establece pero no recibe eventos y
-- la pantalla depende enteramente del polling de respaldo.
--
-- DECISION DE SEGURIDAD — por que solo report_ai_analysis y no citizen_reports:
-- Realtime entrega los cambios respetando las policies de RLS de la tabla.
--   * report_ai_analysis tiene la policy `citizen reads own report ai analysis`
--     (el ciudadano solo ve el analisis de sus propios reportes), de modo que
--     publicarla no amplia la superficie de exposicion.
--   * citizen_reports, en cambio, tiene `lectura_publica` (rol public, qual
--     `true`) porque el mapa ciudadano necesita leer reportes ajenos.
--     Publicarla haria que cualquier cliente pudiera suscribirse al flujo
--     completo de reportes en vivo. Queda deliberadamente fuera: si mas
--     adelante se quiere el cambio de estado en vivo, conviene resolverlo con
--     una policy acotada y no abriendo el stream entero.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'report_ai_analysis'
  ) then
    alter publication supabase_realtime add table public.report_ai_analysis;
  end if;
end $$;
