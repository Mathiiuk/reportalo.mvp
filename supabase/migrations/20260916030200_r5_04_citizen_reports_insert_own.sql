-- REP-2908-VERIF ronda 5, R5-04: citizen_reports.insert_publico
-- (with_check true, rol public) permite a cualquier visitante sin sesion
-- crear reportes a nombre de otro user_id -- suplantacion de identidad, mas
-- costo real de Gemini por cada insercion (el captcha protege la pantalla,
-- no la API).
--
-- Precondicion verificada: la app crea reportes con sesion iniciada y con
-- user_id igual al usuario de la sesion (incluida la sincronizacion sin
-- conexion, que reintenta el insert ya autenticado al reconectar).
--
-- La lectura publica (`lectura_publica`) queda [DECISION HERNAN] -- no se
-- toca en esta migracion: expone user_id junto a coordenadas exactas y
-- requiere definir permisos por columna + que el mapa deje de pedir
-- columnas implicitas.
drop policy if exists "insert_publico" on public.citizen_reports;
create policy "insert own report" on public.citizen_reports
  for insert to authenticated
  with check (user_id = (select auth.uid()));
