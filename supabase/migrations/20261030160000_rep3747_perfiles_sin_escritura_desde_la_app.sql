-- REP-3747 · La app no puede escribir en profiles (revisión de seguridad del 30/10)
--
-- Ser operador depende de profiles.role = 'organismo' y profiles.agency_id, que asigna una persona del equipo. Hoy un
-- vecino no puede cambiarlos solo porque profiles no tiene ninguna política de escritura (solo «read own profile»).
-- Pero anon y authenticated conservan los permisos por defecto de Supabase, INSERT, UPDATE, DELETE y hasta TRUNCATE,
-- que se saltea la RLS. Si mañana se agrega una política «el usuario edita su perfil», cualquiera se podría poner de
-- operador. Se les quita todo permiso salvo leer.
--
-- No rompe nada:
--   · la app nunca escribe en profiles (test UT-3747-S2);
--   · el perfil lo crea el trigger handle_new_user (SECURITY DEFINER, corre como el dueño de la tabla);
--   · service_role y postgres conservan sus permisos (el equipo asigna operadores con SQL);
--   · la lectura del perfil propio (OperatorRoute) sigue igual.
--
-- Rollback: grant insert, update, delete, truncate, references, trigger on public.profiles to anon, authenticated;

revoke insert, update, delete, truncate, references, trigger on public.profiles from anon, authenticated;
