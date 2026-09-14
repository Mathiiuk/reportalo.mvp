-- REP-2908-VERIF (V-01): el trigger heredado audit_ia (sobre infractions,
-- tabla sin filas) invocaba supabase_functions.http_request con un JWT
-- service_role en texto plano en el header Authorization. Se desactiva sin
-- borrar mientras se rota la clave desde el panel de Supabase (no versionable
-- por migracion: no se conoce ni se escribe el valor de la clave nueva aqui).
alter table public.infractions disable trigger audit_ia;
