-- REP-2500: states_provinces tenia RLS activado sin ninguna policy (una de
-- las 14 tablas "RLS sin policy" pendientes de V-03/P-04). El selector de
-- localidad hacia un join !inner sobre esta tabla y PostgREST filtraba en
-- silencio TODAS las filas sin error visible, dejando el selector vacio.
-- Aplicado a mano contra CiudadAR el 16/09 (commit 29be229); se versiona
-- aqui, con la version y el nombre reales que quedaron en
-- supabase_migrations.schema_migrations, para que una base vacia se
-- reconstruya igual (R5-09, REP-2908-VERIF ronda 5).
drop policy if exists "lectura_publica" on public.states_provinces;
create policy "lectura_publica"
  on public.states_provinces
  for select
  to public
  using (true);
