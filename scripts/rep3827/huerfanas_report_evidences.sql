-- REP-3827 · Fotos protegidas sin reporte («huérfanas») en el bucket report-evidences.
--
-- SOLO LECTURA. Se corre en el SQL Editor de Supabase (staging). No borra ni modifica nada.
--
-- Cada vez que se procesa una foto, `quarantine-anonymize` guarda una copia protegida con un nombre nuevo
-- (`<client_side_id>/<epoch_ms>_sanitized.jpg`). Si el mismo borrador se procesa dos veces (por ejemplo, la
-- pantalla de procesamiento vence a los 45 s, el reporte pasa a la cola y la cola vuelve a procesar todo), la
-- primera tanda queda guardada sin ninguna fila en report_images que la use. Esta consulta las cuenta.
--
-- «Referenciada» = alguna fila de report_images tiene esa ruta dentro de image_url.

-- 1) Resumen global ---------------------------------------------------------------------------------------------
with o as (
  select split_part(name, '/', 1) as carpeta, name, created_at,
         exists (select 1 from public.report_images ri where ri.image_url like '%' || storage.objects.name || '%') as referenciada
  from storage.objects
  where bucket_id = 'report-evidences'
)
select count(*)                                                   as objetos,
       count(*) filter (where not referenciada)                   as sin_referencia,
       count(distinct carpeta) filter (where not referenciada)    as borradores_con_huerfanas,
       count(*) filter (where not referenciada
                          and exists (select 1 from public.citizen_reports r where r.client_side_id::text = carpeta))
                                                                  as huerfanas_de_borradores_que_si_llegaron_a_reporte,
       count(*) filter (where not referenciada
                          and not exists (select 1 from public.citizen_reports r where r.client_side_id::text = carpeta))
                                                                  as huerfanas_de_borradores_que_nunca_llegaron_a_reporte
from o;

-- 2) Por borrador: cuántas fotos se guardaron frente a cuántas quedaron adjuntas -----------------------------------
select left(r.client_side_id::text, 8)                                                        as borrador,
       left(r.id::text, 8)                                                                    as reporte,
       to_char(r.created_at at time zone 'UTC', 'MM-DD HH24:MI:SS')                           as reporte_creado_utc,
       (select count(*) from public.report_images i where i.report_id = r.id)                 as fotos_adjuntas,
       (select count(*) from storage.objects o
         where o.bucket_id = 'report-evidences' and o.name like r.client_side_id::text || '/%') as objetos_en_bucket
from public.citizen_reports r
where (select count(*) from storage.objects o
        where o.bucket_id = 'report-evidences' and o.name like r.client_side_id::text || '/%')
      > (select count(*) from public.report_images i where i.report_id = r.id)
order by r.created_at;

-- 3) Línea de tiempo de UN borrador (cambiar el prefijo): cuándo se guardó cada copia y cuál quedó adjunta -------------
select to_char(o.created_at at time zone 'UTC', 'HH24:MI:SS.MS')                  as guardada_utc,
       (o.metadata ->> 'size')::int                                               as bytes,
       exists (select 1 from public.report_images ri where ri.image_url like '%' || o.name || '%') as adjunta
from storage.objects o
where o.bucket_id = 'report-evidences'
  and o.name like '32efe42e%'
order by o.created_at;
