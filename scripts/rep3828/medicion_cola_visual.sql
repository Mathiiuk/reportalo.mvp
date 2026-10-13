-- REP-3828 (D8) · Medición de cola y tiempos de la verificación visual por tamaño de lote.
--
-- SOLO LECTURA. Se corre en el SQL Editor de Supabase (staging) con service_role. No escribe ni modifica nada.
-- Horarios en UTC (ART = UTC-3).
--
-- Etapas que separa (por foto):
--   espera_cola_s : report_images.created_at (evidencia persistida y encolada por el trigger)
--                   -> primer intento contra el proveedor (visual_call_log.started_at)
--                   Incluye la espera hasta el próximo tick del cron `visual-analysis-dispatch` (cada minuto).
--   ejecucion_s   : primer intento -> resultado guardado (report_image_analysis.created_at)
--                   Incluye las llamadas a Gemini, sus reintentos y el espaciado entre ellos.
--   total_s       : persistencia de la evidencia -> resultado guardado.
-- No mide lo que pasa ANTES de persistir la evidencia (reducción/anonimización/subida en el dispositivo): no hay
-- marcas de tiempo en el backend para eso. Ver «Datos que faltan» en el informe.
--
-- Para acotar a un lote de QA (REP-3822) agregar al final de cada consulta:
--   and ia.report_id in (select report_id from visual_qa_cases where qa_batch_id = 'REP-XXXX-QA-01')

-- 1) Resumen por cantidad de fotos del reporte ------------------------------------------------------------------
with fc as (
  select image_id,
         min(started_at)                      as primer_intento,
         count(*)                             as intentos,
         count(*) filter (where status <> 'ok') as intentos_fallidos
  from visual_call_log
  where stage = 'visual'
  group by 1
), x as (
  select ia.report_id,
         ri.created_at                        as evidencia_persistida,
         fc.primer_intento,
         ia.created_at                        as resultado_guardado,
         fc.intentos_fallidos,
         (select count(*) from report_images r2 where r2.report_id = ia.report_id) as fotos
  from report_image_analysis ia
  join report_images ri on ri.id = ia.image_id
  join fc on fc.image_id = ia.image_id
)
select fotos,
       count(*)                                                                                   as imagenes,
       count(distinct report_id)                                                                  as reportes,
       round(avg(extract(epoch from primer_intento - evidencia_persistida))::numeric, 1)          as espera_cola_prom_s,
       round(min(extract(epoch from primer_intento - evidencia_persistida))::numeric, 1)          as espera_cola_min_s,
       round(percentile_cont(0.5) within group (order by extract(epoch from primer_intento - evidencia_persistida))::numeric, 1) as espera_cola_p50_s,
       round(max(extract(epoch from primer_intento - evidencia_persistida))::numeric, 1)          as espera_cola_max_s,
       round(avg(extract(epoch from resultado_guardado - primer_intento))::numeric, 1)            as ejecucion_prom_s,
       round(max(extract(epoch from resultado_guardado - primer_intento))::numeric, 1)            as ejecucion_max_s,
       round(avg(extract(epoch from resultado_guardado - evidencia_persistida))::numeric, 1)      as total_prom_s,
       round(max(extract(epoch from resultado_guardado - evidencia_persistida))::numeric, 1)      as total_max_s,
       sum(intentos_fallidos)                                                                     as intentos_fallidos
from x
group by fotos
order by fotos;

-- 2) Una fila por reporte: tiempo hasta la ÚLTIMA foto analizada (lo que percibe el ciudadano) --------------------
select n.report_id::text,
       n.fotos,
       to_char(n.primera_evidencia at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')                     as creado_utc,
       round(extract(epoch from (min(fc.primer_intento) - n.ultima_evidencia))::numeric, 1)         as espera_hasta_primer_intento_s,
       round(extract(epoch from (max(ia.created_at) - n.primera_evidencia))::numeric, 1)            as hasta_ultimo_resultado_s,
       sum(fc.intentos)                                                                             as intentos,
       sum(fc.intentos_fallidos)                                                                    as fallidos,
       string_agg(distinct ia.coherence, ',')                                                       as resultado_visual
from (
  select report_id, count(*) as fotos, min(created_at) as primera_evidencia, max(created_at) as ultima_evidencia
  from report_images group by 1
) n
join report_image_analysis ia on ia.report_id = n.report_id
join (
  select image_id, min(started_at) as primer_intento, count(*) as intentos,
         count(*) filter (where status <> 'ok') as intentos_fallidos
  from visual_call_log where stage = 'visual' group by 1
) fc on fc.image_id = ia.image_id
group by n.report_id, n.fotos, n.primera_evidencia, n.ultima_evidencia
order by n.primera_evidencia;

-- 3) Detalle de los intentos de UN reporte (cambiar el id) --------------------------------------------------------
select ri.id::text                                                                 as image_id,
       to_char(ri.created_at at time zone 'UTC', 'HH24:MI:SS.MS')                  as evidencia_persistida,
       l.attempt,
       to_char(l.started_at at time zone 'UTC', 'HH24:MI:SS.MS')                   as inicio_intento,
       l.duration_ms, l.status, l.model_requested, l.input_tokens, l.output_tokens, l.thinking_tokens,
       to_char(ia.created_at at time zone 'UTC', 'HH24:MI:SS.MS')                  as resultado_guardado,
       ia.coherence
from report_images ri
left join visual_call_log l on l.image_id = ri.id and l.stage = 'visual'
left join report_image_analysis ia on ia.image_id = ri.id
where ri.report_id = '2061a6b5-c306-4556-85d5-f20057f7bdba'
order by ri.created_at, l.started_at;

-- 4) Estado actual de la cola (si hay mensajes acumulados, el cuello es el despacho, no el cron) -------------------
select count(*) as mensajes_en_cola,
       round(max(extract(epoch from now() - enqueued_at))::numeric, 1) as mensaje_mas_viejo_s,
       max(read_ct) as lecturas_max
from pgmq.q_visual_analysis_queue;
