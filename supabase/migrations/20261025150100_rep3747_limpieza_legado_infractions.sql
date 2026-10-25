-- REP-3747 (limpieza) — Código heredado sin uso en la base
--
-- OK de Hernán (24/10/2026): «son código viejo de la base, no datos; se pueden eliminar sin tocar reportes ni
-- historial. Antes, fijate si alguien usa get_infraction_stats()».
--
-- Verificado en staging el 25/10/2026:
--   * audit_ia (trigger sobre infractions, desactivado desde V-01, 14/09) todavía guardaba en su definición una clave
--     service_role vieja. La clave ya estaba deshabilitada desde la rotación de setiembre (REP-2908-VERIF ronda 2),
--     pero seguía apareciendo en cada copia de la base. infractions tiene 0 filas. La función del trigger
--     (supabase_functions.http_request) es de Supabase y no se toca.
--   * get_infraction_stats(integer) es la única que llama a get_auth_user_jurisdiction(), que consulta
--     profiles.jurisdiction, una columna que no existe: falla siempre. Ninguna función, vista ni policy usa
--     get_infraction_stats, y en el repo no aparece en src/, Edge Functions ni migraciones.
--
-- Cierra P-12 (REP-2908-VERIF) y la deuda DT-12 en lo que respecta al trigger. Las tablas heredadas no se tocan.
--
-- ROLLBACK: las definiciones están en las copias de la base del 19/10 (no se reponen: estaban rotas o sin uso).
--
-- No se aplica sola: la migración se corre a mano en staging.

begin;

drop trigger if exists audit_ia on public.infractions;
drop function if exists public.get_infraction_stats(integer);
drop function if exists public.get_auth_user_jurisdiction();

commit;
