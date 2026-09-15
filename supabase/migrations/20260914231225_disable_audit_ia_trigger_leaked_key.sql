-- V-01: el trigger heredado audit_ia (sobre infractions, tabla sin filas)
-- tiene un JWT service_role en texto plano en su definicion (header
-- Authorization del supabase_functions.http_request). Se desactiva sin
-- borrar mientras se rota la clave desde el panel de Supabase (no versionable
-- por migracion: no se conoce ni se escribe el valor de la clave nueva aqui).
alter table public.infractions disable trigger audit_ia;
