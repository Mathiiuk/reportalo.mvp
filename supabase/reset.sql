-- ==============================================================================
-- Reportalo™ — Script de Reinicio y Regeneración de Datos de Prueba
-- Tarea Jira: REP-3471 (Implementar script SQL/seed del MVP en Supabase)
-- ==============================================================================

-- 1. Limpieza de tablas respetando restricciones de clave foránea
TRUNCATE TABLE public.report_images CASCADE;
TRUNCATE TABLE public.citizen_reports CASCADE;
TRUNCATE TABLE public.infraction_attribute_responses CASCADE;
TRUNCATE TABLE public.report_state_history CASCADE;
TRUNCATE TABLE public.report_outreach_logs CASCADE;
TRUNCATE TABLE public.report_ai_analysis CASCADE;
TRUNCATE TABLE public.report_learning_corpus CASCADE;
TRUNCATE TABLE public.terms_consents CASCADE;
TRUNCATE TABLE public.agency_subscriptions CASCADE;
TRUNCATE TABLE public.agency_contacts CASCADE;
TRUNCATE TABLE public.profiles CASCADE;
TRUNCATE TABLE public.agencies CASCADE;
TRUNCATE TABLE public.service_attribute_values CASCADE;
TRUNCATE TABLE public.service_attributes CASCADE;
TRUNCATE TABLE public.services CASCADE;
TRUNCATE TABLE public.report_states CASCADE;
TRUNCATE TABLE public.localities CASCADE;
TRUNCATE TABLE public.subdivisions CASCADE;
TRUNCATE TABLE public.states_provinces CASCADE;
TRUNCATE TABLE public.countries CASCADE;

-- 2. Notificación de reinicio
DO $$
BEGIN
    RAISE NOTICE 'Base de datos de Reportalo reiniciada con éxito. Listo para ejecutar seed.sql.';
END $$;
