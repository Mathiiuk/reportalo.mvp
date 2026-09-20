-- Restituir el INSERT de evidencia para el dueño del reporte (report_images)
--
-- PROBLEMA (detectado el 20/09/2026 durante la validación de REP-3789):
-- report_images tiene RLS habilitado pero quedó con una única policy, de
-- SELECT (`lectura_publica`). No existe ninguna policy de INSERT, de modo que
-- todo intento de registrar una evidencia es denegado silenciosamente.
--
-- ORIGEN: la migración 20260916030100_r5_03_report_images_drop_insert_publico
-- (ronda 5 de endurecimiento) eliminó la policy de inserción pública —
-- correctamente, porque permitía a cualquiera insertar filas— pero no la
-- reemplazó por una acotada al ciudadano autenticado dueño del reporte.
--
-- IMPACTO MEDIDO: el bucket report-evidences acumula 27 objetos mientras que
-- report_images tiene apenas 2 filas. Las fotos se suben al storage pero
-- quedan huérfanas: sin fila que las vincule al reporte, no se muestran al
-- ciudadano, no se pueden auditar ni purgar. Roto desde el 16/09/2026.
--
-- CRITERIO: se concede INSERT únicamente sobre reportes propios, replicando el
-- patrón ya usado en `insert own report` de citizen_reports. Se usa
-- (select auth.uid()) en vez de auth.uid() para que la condición se evalúe una
-- sola vez por consulta y no por fila (advertencia auth_rls_initplan).

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'report_images'
      and policyname = 'insert own report images'
  ) then
    create policy "insert own report images" on public.report_images
      for insert to authenticated
      with check (
        exists (
          select 1 from public.citizen_reports r
          where r.id = report_images.report_id
            and r.user_id = (select auth.uid())
        )
      );
  end if;
end $$;
