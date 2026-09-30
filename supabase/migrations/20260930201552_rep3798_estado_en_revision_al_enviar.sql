-- REP-3798 — Al enviar un reporte, pasa solo de «Enviado» a «En revisión»
--
-- Decisión de producto (Matías, 30/09/2026): apenas se envía el reporte la IA empieza a revisarlo para dar
-- una devolución al ciudadano, así que el estado pasa de RECIBIDO (Enviado) a EN_ANALISIS (En revisión).
-- Hasta ahora nada en la base cambiaba el estado: el reporte se quedaba en «Enviado» aunque la IA lo
-- estuviera analizando, y los demás estados los cambia quien atiende el reporte por fuera de la app.
--
-- Se hace en el mismo trigger que encola el análisis (trg_enqueue_rag_analysis, AFTER INSERT), para que el
-- cambio de estado y el encolado ocurran juntos o ninguno. No se toca nada más de la función: se conserva
-- exactamente el mensaje que se encola.
--
-- El paso a «Notificado al responsable» NO se automatiza: la notificación al organismo no está implementada.
-- «En revisión» no significa que una persona del municipio lo esté mirando: lo dice el texto del historial.
--
-- APLICADA en producción (CiudadAR) el 30/09/2026, con aprobación de Matías. La versión quedó registrada como
-- 20260930201552; el archivo se renombró para coincidir. Probada antes en la base descartable, en transacción.
-- Solo afecta a los reportes nuevos: los que ya estaban en «Enviado» no se tocan.

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

  -- La IA empieza a revisarlo: Enviado → En revisión, con su rastro en el historial
  update public.citizen_reports
     set current_state_code = 'EN_ANALISIS'
   where id = new.id
     and current_state_code = 'RECIBIDO';

  insert into public.report_state_history (report_id, state_code, notes)
  values (new.id, 'EN_ANALISIS', 'Análisis automático en curso');

  return new;
end;
$$;
