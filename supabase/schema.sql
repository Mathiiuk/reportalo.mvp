-- ==============================================================================
-- Reportalo™ — Esquema DDL de Referencia de PostgreSQL / Supabase
-- Proyecto: Reportalo (RAR-2026) · Sprint 10
-- Este archivo documenta la estructura oficial de las tablas ya existentes en la base de datos.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.countries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    iso_code VARCHAR NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.states_provinces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_id UUID NOT NULL REFERENCES public.countries(id),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subdivisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_province_id UUID NOT NULL REFERENCES public.states_provinces(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'municipio'::text,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.localities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subdivision_id UUID NOT NULL REFERENCES public.subdivisions(id),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    subdivision_id UUID NOT NULL REFERENCES public.subdivisions(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'ciudadano'::text,
    agency_id UUID REFERENCES public.agencies(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_code TEXT NOT NULL UNIQUE,
    service_name TEXT NOT NULL,
    group_name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_states (
    code VARCHAR PRIMARY KEY,
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.citizen_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_side_id UUID NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    service_id UUID REFERENCES public.services(id),
    locality_id UUID REFERENCES public.localities(id),
    latitud DOUBLE PRECISION NOT NULL,
    longitud DOUBLE PRECISION NOT NULL,
    description TEXT NOT NULL,
    current_state_code VARCHAR NOT NULL DEFAULT 'borrador'::character varying REFERENCES public.report_states(code),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.citizen_reports(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.terms_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    terms_version TEXT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    camera_permission BOOLEAN NOT NULL DEFAULT true,
    location_permission BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- BUCKETS DE STORAGE & POLÍTICAS DE CUARENTENA (REP-2404)
-- ==============================================================================

-- 1. Bucket privado de Cuarentena: aislamiento transitorio de imágenes originales no anonimizadas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'evidence-quarantine',
    'evidence-quarantine',
    false, -- Estrictamente privado: sin URLs públicas
    10485760, -- Máximo 10 MB por fotografía
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Bucket público de Evidencias Protegidas: destino exclusivo de imágenes ya anonimizadas y sanitizadas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'report-evidences',
    'report-evidences',
    true, -- Público para lectura ciudadana de reportes validados
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Políticas de seguridad para storage.objects en Cuarentena
-- Permitir subida a usuarios autenticados o con token activo
CREATE POLICY "Permitir subida transitoria a cuarentena"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'evidence-quarantine');

-- Bloquear toda lectura pública de imágenes crudas en cuarentena (solo service_role)
CREATE POLICY "Denegar lectura publica de fotos en cuarentena"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'evidence-quarantine' AND false);

-- Políticas de seguridad para storage.objects en Evidencias Protegidas
-- Lectura pública universal de evidencias ya procesadas y anonimizadas
CREATE POLICY "Lectura publica de evidencias anonimizadas"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'report-evidences');

