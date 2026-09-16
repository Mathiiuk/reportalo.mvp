-- P-02 (REP-2908-VERIF ronda 4): motivo estructurado para result_status_code
-- distinto de "fundamentado". No afecta la normalizacion: depende solo del
-- analisis, tal como propuso Hernan.
--
-- Respuesta a sus preguntas sobre los reportes demo 3 y 5 (indeterminado con
-- confianza 0.3 y 0.5): no hay umbral de confianza en el codigo que dispare
-- indeterminado -- confianza es un campo informativo que completa el LLM, no
-- se usa para decidir el estado. Esos dos casos son el LLM declarando
-- "indeterminado" por su propio criterio (la normativa recuperada no alcanza
-- para tipificar la infraccion), y su razonamiento ya queda en
-- citizen_feedback/official_legal_foundation -- no hay motivo perdido ahi.
--
-- El motivo que SI se perdia es el de los indeterminado que rechaza el
-- CODIGO antes de llamar al LLM (cita no literal, error de match_knowledge_fragments,
-- organismo_sugerido_id invalido, GEMINI_API_KEY faltante): ese texto vivia
-- solo en result.error y nunca se mapeaba a ninguna columna al persistir.
-- status_reason lo guarda a partir de ahora (ver buildAnalysisRow en
-- src/services/reportAiAnalysisPersistence.js y su espejo en
-- supabase/functions/analizar-reporte/index.ts).
alter table public.report_ai_analysis add column if not exists status_reason text;

comment on column public.report_ai_analysis.status_reason is
  'Motivo cuando el CODIGO rechaza el analisis antes de llamar al LLM (cita no literal, error de RPC, organismo invalido, etc.). Null cuando el LLM llega a un estado por su propio criterio: ahi el razonamiento ya esta en citizen_feedback/official_legal_foundation.';
