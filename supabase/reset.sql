-- ==============================================================================
-- Reportalo™ — Script de Reinicio y Regeneración de Datos de Prueba
-- Tarea Jira: REP-3471 (Implementar script SQL/seed del MVP en Supabase)
-- ==============================================================================

-- 1. Limpieza de tablas respetando restricciones de clave foránea
TRUNCATE TABLE public.report_evidences CASCADE;
TRUNCATE TABLE public.reports CASCADE;
TRUNCATE TABLE public.terms_consents CASCADE;
TRUNCATE TABLE public.organismos CASCADE;
TRUNCATE TABLE public.report_categories CASCADE;
TRUNCATE TABLE public.profiles CASCADE;

-- 2. Notificación de reinicio
DO $$
BEGIN
    RAISE NOTICE 'Base de datos de Reportalo reiniciada con éxito. Listo para ejecutar seed.sql.';
END $$;
