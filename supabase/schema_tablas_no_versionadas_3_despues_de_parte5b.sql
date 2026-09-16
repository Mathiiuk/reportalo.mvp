-- ==============================================================================
-- Reportalo — DDL de tablas no versionadas, parte 3 de 3 (P-08, REP-2908-VERIF
-- ronda 4). Ver orden completo de aplicación en la parte 1.
--
-- Va DESPUÉS de la PARTE 5B de docs/REP-3769_seed_y_RAG.sql: las 2 primeras
-- políticas de acá abajo llaman a profile_attends_report(profile, report),
-- que esa PARTE 5B define. Todo lo demás de este archivo no tiene esa
-- dependencia, pero se dejó acá junto para no fragmentar más el split.
--
-- Generado el 16/09/2026 consultando information_schema/pg_constraint/
-- pg_policies del proyecto real (CiudadAR) de solo lectura, y validado
-- aplicándolo de punta a punta contra un proyecto Supabase nuevo y
-- descartable. Ninguna clave ni dato de usuario se incluye acá.
--
-- NO se incluye el trigger `audit_ia` sobre `infractions`: su definición en
-- producción tiene una clave de servicio incrustada en texto plano (regla 2
-- de REP-2908-VERIF: nunca se escribe una clave en ningún lado). Ese trigger
-- ya está desactivado (migración 20260914231225) y P-12 propone eliminarlo
-- con el OK de Hernán -- si algún día hace falta recrear ese llamado HTTP,
-- tiene que sacar la clave de Vault, nunca inline.
--
-- infraction_types, infractions, high_priority_zones y notifications son
-- legado sin definir (REP-3443, guía REP-3769 §1 regla 7: "No tocar"). Se
-- documentan solo para que el esquema completo sea reconstruible. Necesitan
-- la extensión postgis (GEOGRAPHY) -- ver parte 1 -- que tampoco estaba
-- documentada en ningún archivo del repo.
--
-- OJO, hallazgo aparte para Hernán/Matías: 2 políticas de `infractions`
-- (lectura_inteligente, oficial_gestiona) llaman a get_auth_user_role(),
-- una función que TAMPOCO está versionada en ningún archivo del repo. No se
-- reprodujo acá porque excede el alcance del RAG (la tabla es legado sin
-- definir), pero puede haber más funciones de seguridad sin versionar
-- además de esta -- vale la pena un relevamiento aparte.
-- ==============================================================================

CREATE POLICY "citizen reads own report ai analysis" ON public.report_ai_analysis
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.citizen_reports cr WHERE cr.id = report_ai_analysis.report_id AND cr.user_id = auth.uid()));
CREATE POLICY "agency reads assigned report ai analysis" ON public.report_ai_analysis
  FOR SELECT TO authenticated
  USING (public.profile_attends_report(auth.uid(), report_id));

CREATE TABLE IF NOT EXISTS public.report_state_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.citizen_reports(id) DEFERRABLE,
    state_code VARCHAR NOT NULL REFERENCES public.report_states(code) DEFERRABLE,
    changed_by UUID REFERENCES public.profiles(id) DEFERRABLE,
    notes TEXT,
    changed_at TIMESTAMPTZ DEFAULT now(),
    actor_agency_id UUID REFERENCES public.agencies(id)
);
ALTER TABLE public.report_state_history ENABLE ROW LEVEL SECURITY;
-- Sin políticas en producción; el PR de P-04 agrega "read own or attended".

CREATE TABLE IF NOT EXISTS public.infraction_attribute_responses (
    report_id UUID NOT NULL REFERENCES public.citizen_reports(id) DEFERRABLE,
    attribute_id UUID NOT NULL REFERENCES public.service_attributes(id) DEFERRABLE,
    selected_value TEXT NOT NULL,
    PRIMARY KEY (report_id, attribute_id)
);
ALTER TABLE public.infraction_attribute_responses ENABLE ROW LEVEL SECURITY;
-- Sin políticas en producción; el PR de P-04 agrega "read own or attended" + "insert own".

CREATE TABLE IF NOT EXISTS public.report_learning_corpus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL UNIQUE REFERENCES public.citizen_reports(id) DEFERRABLE,
    final_outcome VARCHAR NOT NULL,
    municipality_notes TEXT,
    embedding VECTOR NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.report_learning_corpus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura_publica" ON public.report_learning_corpus FOR SELECT TO public USING (true);
CREATE POLICY "insert_publico" ON public.report_learning_corpus FOR INSERT TO public WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.report_outreach_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.citizen_reports(id) DEFERRABLE,
    contact_id UUID NOT NULL REFERENCES public.agency_contacts(id) DEFERRABLE,
    delivery_status VARCHAR NOT NULL,
    external_reference TEXT,
    payload_snapshot TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.report_outreach_logs ENABLE ROW LEVEL SECURITY;
-- Sin políticas en producción: solo el servidor. Correcto como está (P-04).

-- ------------------------------------------------------------------------------
-- Legado sin definir (REP-3443). No tocar sin decisión aparte (guía REP-3769 §1).
-- ------------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.infraction_status AS ENUM ('pendiente', 'en_revision', 'aprobada', 'rechazada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.infraction_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    severity_level INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);
ALTER TABLE public.infraction_types ENABLE ROW LEVEL SECURITY;
-- Sin políticas en producción.

CREATE TABLE IF NOT EXISTS public.infractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    location GEOGRAPHY,
    image_url TEXT NOT NULL,
    ocr_data JSONB,
    status public.infraction_status NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    type TEXT,
    description TEXT,
    provincia TEXT,
    municipio TEXT,
    direccion TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    acta_borrador TEXT,
    acta_generada_at TIMESTAMPTZ
);
ALTER TABLE public.infractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "infractions_select_all" ON public.infractions FOR SELECT TO authenticated USING (true);
CREATE POLICY "ciudadano_inserta" ON public.infractions FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ciudadano_inserta_infracciones" ON public.infractions FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "infractions_insert_own" ON public.infractions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "infractions_update_own" ON public.infractions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "infractions_delete_own" ON public.infractions FOR DELETE TO authenticated USING (auth.uid() = user_id);
-- "lectura_inteligente" y "oficial_gestiona" se omiten a propósito: dependen
-- de get_auth_user_role(), no versionada -- ver nota de cabecera.

CREATE TABLE IF NOT EXISTS public.high_priority_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_location GEOGRAPHY NOT NULL,
    infraction_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
ALTER TABLE public.high_priority_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura publica de high priority zones" ON public.high_priority_zones FOR SELECT TO public USING (true);
CREATE POLICY "Zonas publicas" ON public.high_priority_zones FOR SELECT TO public USING (true);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios ven sus notificaciones" ON public.notifications FOR SELECT TO public USING (auth.uid() = user_id);

-- normativas: tabla del spike de REP-2907, reemplazada por el módulo RAG
-- (C-6, knowledge_fragments/fragment_embeddings). Sigue viva en producción
-- porque P-12/PARTE 9 (retiro de normativas) todavía no se aplicó -- decide
-- Hernán. Se documenta para que exista si algo la referencia todavía.
CREATE TABLE IF NOT EXISTS public.normativas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subdivision_id UUID REFERENCES public.subdivisions(id) DEFERRABLE,
    tipo_documento VARCHAR NOT NULL DEFAULT 'ley',
    categoria TEXT,
    regla TEXT NOT NULL,
    embedding VECTOR NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    norma_codigo TEXT,
    titulo TEXT,
    jurisdiccion TEXT DEFAULT 'Municipal',
    autoridad TEXT DEFAULT 'Juzgado de Faltas',
    articulo TEXT,
    fuente_url TEXT,
    vigencia TEXT DEFAULT 'vigente',
    version TEXT DEFAULT '1.0',
    tipo_fundamento TEXT
);
ALTER TABLE public.normativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura publica de normativas" ON public.normativas FOR SELECT TO public USING (true);
CREATE POLICY "Gestion administrativa de normativas" ON public.normativas FOR ALL TO service_role USING (true) WITH CHECK (true);
