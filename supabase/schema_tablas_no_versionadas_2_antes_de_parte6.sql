-- ==============================================================================
-- Reportalo — DDL de tablas no versionadas, parte 2 de 3 (P-08, REP-2908-VERIF
-- ronda 4). Ver orden completo de aplicación en la parte 1.
--
-- report_ai_analysis es la tabla central del RAG (REP-2908/REP-2909) y, antes
-- de este archivo, no tenía NINGÚN CREATE TABLE versionado en el repositorio.
--
-- Va ANTES de supabase/rag_knowledge_schema.sql (= PARTE 6) a propósito:
-- esa PARTE 6 crea report_ai_evidence con una FK a report_ai_analysis(id),
-- así que report_ai_analysis tiene que existir primero. Verificado con el
-- error real al intentar el orden "documentado" (PARTE 6 antes de todo):
--   ERROR: 42P01: relation "public.report_ai_analysis" does not exist
--
-- Los 3 catálogos de abajo (ai_result_statuses, embedding_models,
-- generation_models) se duplican a propósito con lo que ya crea
-- rag_knowledge_schema.sql más adelante: usan CREATE TABLE IF NOT EXISTS,
-- así que cuando ese archivo corra después, esos tres no-opean sin error.
-- Es la única forma de romper la dependencia circular sin editar
-- rag_knowledge_schema.sql (la guía REP-3769 §1 regla 2 prohíbe editarlo).
--
-- Las 2 políticas de report_ai_analysis (dueño / funcionario que atiende)
-- NO van acá: dependen de profile_attends_report(), que recién existe
-- después de la PARTE 5B del seed. Van en la parte 3 de este split.
-- ==============================================================================

create table if not exists public.ai_result_statuses (code varchar primary key, description text not null);

create table if not exists public.embedding_models (
  code varchar primary key,
  provider varchar not null,
  model_name text not null,
  dimensions int not null check (dimensions = 768),
  is_active boolean not null default false,
  retired_at date
);
create unique index if not exists embedding_models_one_active on public.embedding_models (is_active) where is_active;

create table if not exists public.generation_models (
  code varchar primary key,
  provider varchar not null,
  model_name text not null,
  is_active boolean not null default false,
  retired_at date
);
create unique index if not exists generation_models_one_active on public.generation_models (is_active) where is_active;

CREATE TABLE IF NOT EXISTS public.report_ai_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL UNIQUE REFERENCES public.citizen_reports(id) DEFERRABLE,
    result_status_code VARCHAR NOT NULL REFERENCES public.ai_result_statuses(code),
    is_infraction BOOLEAN NOT NULL DEFAULT false,
    suggested_service_id UUID REFERENCES public.services(id),
    suggested_agency_id UUID REFERENCES public.agencies(id) DEFERRABLE,
    citizen_feedback TEXT,
    official_legal_foundation TEXT,
    confidence_score NUMERIC NOT NULL,
    embedding_model_code VARCHAR NOT NULL REFERENCES public.embedding_models(code),
    generation_model_code VARCHAR REFERENCES public.generation_models(code),
    prompt_version TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    -- P-02 (ronda 4): columna agregada por 20260916020000_p02_status_reason.sql,
    -- no existía en producción al momento de este dump (16/09). Se incluye
    -- acá para que este archivo quede consistente con esa migración.
    status_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.report_ai_analysis ENABLE ROW LEVEL SECURITY;
-- Políticas de lectura: ver parte 3 de este split (necesitan profile_attends_report).
