-- ==============================================================================
-- Reportalo — DDL de tablas no versionadas, parte 1 de 3 (P-08, REP-2908-VERIF
-- ronda 4). Ver contexto completo en la parte 2.
--
-- ORDEN DE APLICACIÓN VALIDADO el 16/09/2026 contra un proyecto Supabase
-- nuevo y descartable (creado y borrado en esta misma verificación):
--   1. supabase/schema.sql
--   2. create extension if not exists vector;
--      create extension if not exists postgis;  -- también sin documentar:
--      necesaria para GEOGRAPHY en infractions/high_priority_zones (legado).
--   3. ESTE ARCHIVO
--   4. docs/REP-3769_seed_y_RAG.sql — PARTE 0, 1, 2
--      (PARTE 2 inserta en agency_contacts/agency_subscriptions/service_attributes:
--      por eso este archivo va ANTES, no después como se asumía originalmente)
--   5. Parte 2 de este split (schema_tablas_no_versionadas_2_antes_de_parte6.sql)
--   6. supabase/rag_knowledge_schema.sql (= PARTE 6, sin editar)
--   7. docs/REP-3769_seed_y_RAG.sql — PARTE 5, 5B, 7 en adelante
--   8. Parte 3 de este split (schema_tablas_no_versionadas_3_despues_de_parte5b.sql)
--   9. supabase/migrations/*.sql (17 migraciones, en orden de fecha)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.agency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) DEFERRABLE,
    contact_channel VARCHAR NOT NULL,
    contact_value TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE public.agency_contacts ENABLE ROW LEVEL SECURITY;
-- Sin políticas en producción: solo el servidor (service_role) accede. Correcto como está (P-04).

CREATE TABLE IF NOT EXISTS public.agency_subscriptions (
    agency_id UUID PRIMARY KEY REFERENCES public.agencies(id) DEFERRABLE,
    plan_type VARCHAR NOT NULL DEFAULT 'free_tier',
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.agency_subscriptions ENABLE ROW LEVEL SECURITY;
-- Sin políticas en producción: solo el servidor. Correcto como está (P-04).

CREATE TABLE IF NOT EXISTS public.service_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.services(id) DEFERRABLE,
    attribute_code TEXT NOT NULL,
    data_type TEXT NOT NULL,
    required BOOLEAN NOT NULL DEFAULT false,
    datatype_description TEXT,
    description TEXT,
    sort_order INTEGER
);
ALTER TABLE public.service_attributes ENABLE ROW LEVEL SECURITY;
-- Sin políticas en producción; el PR de P-04 agrega "read authenticated".

CREATE TABLE IF NOT EXISTS public.service_attribute_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attribute_id UUID NOT NULL REFERENCES public.service_attributes(id) DEFERRABLE,
    value_key TEXT NOT NULL,
    value_name TEXT NOT NULL
);
ALTER TABLE public.service_attribute_values ENABLE ROW LEVEL SECURITY;
-- Sin políticas en producción; el PR de P-04 agrega "read authenticated".
