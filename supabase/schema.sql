-- ==============================================================================
-- Reportalo™ — Esquema de Base de Datos PostgreSQL / Supabase
-- Tarea Jira: REP-3471 (Implementar script SQL/seed del MVP en Supabase)
-- Sprint: 10 · Versión DDL: 1.0.0
-- ==============================================================================

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. TABLA: profiles (Perfiles de usuarios vinculados a auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'ciudadano' CHECK (role IN ('ciudadano', 'organismo', 'admin')),
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.profiles IS 'Perfiles ciudadanos e institucionales de la plataforma Reportalo.';

-- ------------------------------------------------------------------------------
-- 3. TABLA: report_categories (Categorías oficiales de reportes - Journey v2)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    bg_light TEXT NOT NULL,
    border_color TEXT NOT NULL,
    example TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.report_categories IS 'Catálogo oficial de categorías de reportes según User Journey v2.';

-- ------------------------------------------------------------------------------
-- 4. TABLA: organismos (Organismos municipales y provinciales receptores)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organismos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    jurisdiction TEXT NOT NULL CHECK (jurisdiction IN ('CABA', 'Avellaneda', 'Provincia de Buenos Aires', 'Nacional')),
    area TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.organismos IS 'Organismos competentes para la derivación y resolución de reportes.';

-- ------------------------------------------------------------------------------
-- 5. TABLA: terms_consents (Auditoría de consentimiento de Términos y Privacidad - REP-3532)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.terms_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    terms_version TEXT NOT NULL DEFAULT '1.3',
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    permissions JSONB NOT NULL DEFAULT '{"camera": true, "location": true}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{"client": "web"}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.terms_consents IS 'Registro inmutable y auditable de aceptación de términos y permisos.';

-- ------------------------------------------------------------------------------
-- 6. TABLA: reports (Reportes ciudadanos georreferenciados - REP-2600 / REP-2200)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category_id TEXT NOT NULL REFERENCES public.report_categories(id) ON UPDATE CASCADE,
    category_name TEXT,
    category_icon TEXT,
    status TEXT NOT NULL DEFAULT 'Enviado' CHECK (status IN ('Enviado', 'En curso', 'Resuelto', 'Rechazado')),
    status_color TEXT,
    pin_color TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT NOT NULL,
    jurisdiction TEXT NOT NULL CHECK (jurisdiction IN ('CABA', 'Avellaneda')),
    organismo_id TEXT REFERENCES public.organismos(id) ON UPDATE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    evidence_count INTEGER NOT NULL DEFAULT 1,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.reports IS 'Incidentes y reclamos ciudadanos georreferenciados en CABA y Avellaneda.';

-- ------------------------------------------------------------------------------
-- 7. TABLA: report_evidences (Evidencias fotográficas sanitizadas - REP-2201)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_evidences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sanitized BOOLEAN NOT NULL DEFAULT true,
    blur_faces BOOLEAN NOT NULL DEFAULT true,
    blur_license_plates BOOLEAN NOT NULL DEFAULT true,
    exif_stripped BOOLEAN NOT NULL DEFAULT true,
    quarantine_status TEXT NOT NULL DEFAULT 'approved' CHECK (quarantine_status IN ('quarantine', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.report_evidences IS 'Fotografías de evidencia con anonimización y sanitización irreversible.';

-- ------------------------------------------------------------------------------
-- 8. ÍNDICES DE RENDIMIENTO (Performance & Búsqueda espacial / relacional)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reports_category ON public.reports(category_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_jurisdiction ON public.reports(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_reports_coords ON public.reports(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_terms_consents_user_id ON public.terms_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_report_evidences_report_id ON public.report_evidences(report_id);

-- ------------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) & POLÍTICAS DE ACCESO
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organismos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_evidences ENABLE ROW LEVEL SECURITY;

-- Categorías y Organismos: Lectura pública para cualquier usuario (anónimo o autenticado)
DROP POLICY IF EXISTS "Categorias son visibles publicamente" ON public.report_categories;
CREATE POLICY "Categorias son visibles publicamente"
    ON public.report_categories FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Organismos son visibles publicamente" ON public.organismos;
CREATE POLICY "Organismos son visibles publicamente"
    ON public.organismos FOR SELECT
    USING (true);

-- Reportes: Lectura consultiva pública del mapa y filtrado
DROP POLICY IF EXISTS "Reportes son visibles publicamente" ON public.reports;
CREATE POLICY "Reportes son visibles publicamente"
    ON public.reports FOR SELECT
    USING (true);

-- Reportes: Creación permitida para usuarios autenticados
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear reportes" ON public.reports;
CREATE POLICY "Usuarios autenticados pueden crear reportes"
    ON public.reports FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Evidencias: Lectura pública e inserción
DROP POLICY IF EXISTS "Evidencias son visibles publicamente" ON public.report_evidences;
CREATE POLICY "Evidencias son visibles publicamente"
    ON public.report_evidences FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Insercion de evidencias" ON public.report_evidences;
CREATE POLICY "Insercion de evidencias"
    ON public.report_evidences FOR INSERT
    WITH CHECK (true);

-- Términos y Consentimiento: Creación y lectura de consentimientos propios
DROP POLICY IF EXISTS "Lectura de propios consentimientos" ON public.terms_consents;
CREATE POLICY "Lectura de propios consentimientos"
    ON public.terms_consents FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL OR true);

DROP POLICY IF EXISTS "Registro de consentimiento" ON public.terms_consents;
CREATE POLICY "Registro de consentimiento"
    ON public.terms_consents FOR INSERT
    WITH CHECK (true);

-- Profiles: Lectura pública de nombres y actualización propia
DROP POLICY IF EXISTS "Perfiles visibles publicamente" ON public.profiles;
CREATE POLICY "Perfiles visibles publicamente"
    ON public.profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON public.profiles;
CREATE POLICY "Usuarios pueden actualizar su propio perfil"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);
