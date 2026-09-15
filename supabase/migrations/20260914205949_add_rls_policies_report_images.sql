-- REP-2500: report_images tenia RLS habilitado sin ninguna politica (bloqueaba
-- toda lectura/escritura de evidencia pese a que la tabla y el bucket
-- report-evidences ya estaban listos). Se agregan politicas publicas, mismo
-- patron que citizen_reports (insert_publico / lectura_publica) -- coherente
-- con que los reportes ya son publicos por diseno.
begin;

drop policy if exists "insert_publico" on public.report_images;
create policy "insert_publico"
on public.report_images for insert
to public
with check (true);

drop policy if exists "lectura_publica" on public.report_images;
create policy "lectura_publica"
on public.report_images for select
to public
using (true);

commit;
