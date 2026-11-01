-- REP-3843 · Reportes anteriores a la cola de geocodificación
-- APLICADA en staging el 30/10/2026 (versión 20261030125132): 484 reportes en la cola.
--
-- La geocodificación en la base (20261029131108) solo encola los reportes nuevos. Los guardados antes quedaron sin calle
-- y el panel los muestra como «Dirección no disponible» (revisión del diseño de Iván, 30/10). Entran a la misma cola:
--   · solo los que no tienen calle y sí coordenadas; dispatch_report_geocoding vuelve a revisar al atender y nunca pisa
--     lo que cargó el vecino;
--   · la cola atiende por created_at: estos van con fecha de mañana para que un reporte nuevo nunca espere detrás de
--     ellos, y entre ellos, primero los más nuevos;
--   · al mismo ritmo, un pedido cada 10 segundos: unos 480 reportes, alrededor de 80 minutos.
--
-- Rollback: delete from public.report_geocoding where status in ('pendiente', 'error') and report_id in (los encolados acá);
-- las calles ya completadas quedan con address_source = 'geocodificada'.

insert into public.report_geocoding (report_id, created_at)
-- Después de cualquier reporte nuevo; el más nuevo de los anteriores (orden 1), primero
select q.id, now() + interval '1 day' + q.orden * interval '1 millisecond'
  from (
    select r.id, row_number() over (order by r.created_at desc) as orden
      from public.citizen_reports r
     where r.address_street is null
       and r.latitud is not null
       and r.longitud is not null
  ) q
on conflict (report_id) do nothing;
