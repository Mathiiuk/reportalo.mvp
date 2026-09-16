-- REP-2500 hotfix: `states_provinces` tenía RLS activado sin ninguna policy
-- (una de las 14 tablas "RLS habilitado sin policy" pendientes de clasificar
-- de V-03, REP-2908-VERIF). Sin policy, PostgREST deniega todo SELECT por
-- default aunque el GRANT de tabla permita SELECT a anon/authenticated.
--
-- El selector de localidad (LocalitySelector, REP-2500) hace:
--   select ... from localities, subdivisions!inner(name, states_provinces!inner(name))
-- El !inner sobre states_provinces exige que el rol autenticado tenga acceso
-- de lectura a esa tabla también; al no tenerlo, PostgREST filtra en
-- silencio todas las filas (sin error) y la lista de localidades queda
-- siempre vacía — el ciudadano nunca puede elegir una localidad ni confirmar
-- el envío del reporte.
--
-- Verificado el bug reproduciéndolo con `set local role anon;` antes de este
-- fix (0 filas visibles) y confirmando que localities/subdivisions ya tenían
-- la misma policy "lectura_publica" desde antes.

begin;

create policy "lectura_publica"
  on public.states_provinces
  for select
  to public
  using (true);

commit;
