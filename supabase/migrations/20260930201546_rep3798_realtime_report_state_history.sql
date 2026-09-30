-- REP-3798 — Publicar report_state_history en Realtime (estados del reporte en vivo)
--
-- Contexto: los estados de un reporte (En revisión, Notificado, Resuelto, Descartado) los cambia quien
-- atiende el reporte, por fuera de la app del ciudadano. Para que el detalle se actualice sin recargar,
-- el frontend escucha las altas en report_state_history (hook useReportStateLive) y, como respaldo,
-- sondea citizen_reports.current_state_code.
--
-- Estado verificado en produccion (CiudadAR, 2026-09-30): la publicacion supabase_realtime contiene
-- `infractions` y `report_ai_analysis`. `report_state_history` no estaba.
--
-- DECISION DE SEGURIDAD: es el mismo criterio que en REP-3789 (report_ai_analysis). Realtime entrega los
-- cambios respetando RLS, y report_state_history tiene la policy `read own or attended` (solo el dueño del
-- reporte o quien lo atiende), asi que publicarla NO amplia la superficie de exposicion. citizen_reports,
-- que tiene `lectura_publica`, sigue fuera de la publicacion: el sondeo de respaldo cubre a quien mira un
-- reporte ajeno sin abrir el stream completo.
--
-- APLICADA en produccion (CiudadAR) el 30/09/2026, con aprobacion de Matias. La version quedo registrada como
-- 20260930201546; el archivo se renombro para coincidir. Probada antes en la base descartable, en transaccion.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'report_state_history'
  ) then
    alter publication supabase_realtime add table public.report_state_history;
  end if;
end $$;
