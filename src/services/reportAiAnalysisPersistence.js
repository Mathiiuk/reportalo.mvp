/**
 * @file reportAiAnalysisPersistence.js
 * @description Lógica pura de armado de filas para persistir el resultado del RAG
 * (REP-2909, bloque 2). Separada del I/O a propósito: la Edge Function
 * analizar-reporte usa la misma forma de fila (documentada acá y replicada en
 * supabase/functions/analizar-reporte/index.ts), y este módulo se prueba con
 * Vitest sin necesitar una base real.
 *
 * Mapeo de campos según docs/REP-1009_RAG_de_punta_a_punta.docx sección 6:
 *   estado -> result_status_code · es_infraccion -> is_infraction ·
 *   categoria -> suggested_service_id (vía lookup de services.service_code) ·
 *   organismo_sugerido_id -> suggested_agency_id ·
 *   fundamento_ciudadano/fundamento_oficial -> citizen_feedback/official_legal_foundation ·
 *   confianza -> confidence_score · citas[] -> report_ai_evidence (was_cited=true, quoted_text)
 *
 * NOTA: el nombre y la forma exactos de las columnas "base" de report_ai_analysis
 * (id, report_id, is_infraction, citizen_feedback, official_legal_foundation,
 * confidence_score, suggested_agency_id) surgen del mapeo documentado en el docx,
 * no de una inspección directa de la tabla real (no hay acceso a Supabase desde
 * esta sesión) — Matías debe confirmarlos contra la base real antes de desplegar.
 */

/**
 * Arma la fila para report_ai_analysis a partir del resultado de analyzeReport.
 *
 * @param {object} params
 * @param {string} params.reportId UUID del reporte (citizen_reports.id)
 * @param {object} params.result Resultado de analyzeReport (legalRagService.js)
 * @param {string|null} [params.suggestedServiceId] UUID de services, ya resuelto por el llamador
 * @returns {object} Fila lista para insertar en report_ai_analysis
 */
export const buildAnalysisRow = ({ reportId, result, suggestedServiceId = null }) => {
  if (!reportId) {
    throw new Error('[reportAiAnalysisPersistence] buildAnalysisRow requiere reportId.');
  }
  if (!result || typeof result.estado !== 'string') {
    throw new Error('[reportAiAnalysisPersistence] buildAnalysisRow requiere un result con estado.');
  }

  return {
    report_id: reportId,
    result_status_code: result.estado,
    is_infraction: result.es_infraccion ?? null,
    suggested_service_id: suggestedServiceId,
    suggested_agency_id: result.organismo_sugerido_id ?? null,
    citizen_feedback: result.fundamento_ciudadano ?? null,
    official_legal_foundation: result.fundamento_oficial ?? null,
    confidence_score: result.confianza ?? null,
    embedding_model_code: result.embeddingModelCode ?? null,
    generation_model_code: result.generationModelCode ?? null,
    prompt_version: result.promptVersion ?? null,
    input_tokens: result.inputTokens ?? null,
    output_tokens: result.outputTokens ?? null,
    latency_ms: result.latencyMs !== undefined ? Math.round(result.latencyMs) : null,
  };
};

/**
 * Arma las filas para report_ai_evidence: una por fragmento recuperado (no
 * solo los citados), marcando cuáles se citaron y con qué texto exacto — así
 * queda registro completo de lo que el LLM tuvo disponible, no solo lo que usó.
 *
 * @param {object} params
 * @param {string} params.analysisId UUID de la fila de report_ai_analysis ya insertada
 * @param {Array<object>} params.retrievedFragments Fragmentos recuperados (con fragment_id, similarity)
 * @param {Array<{fragment_id: string, cita_textual: string}>} [params.citas] Citas del LLM ya validadas
 * @returns {Array<object>} Filas listas para insertar en report_ai_evidence
 */
export const buildEvidenceRows = ({ analysisId, retrievedFragments, citas = [] }) => {
  if (!analysisId) {
    throw new Error('[reportAiAnalysisPersistence] buildEvidenceRows requiere analysisId.');
  }
  if (!Array.isArray(retrievedFragments)) {
    return [];
  }

  const citaByFragmentId = new Map(citas.map((c) => [c.fragment_id, c.cita_textual]));

  return retrievedFragments.map((fragment, index) => {
    const quotedText = citaByFragmentId.get(fragment.fragment_id);
    return {
      analysis_id: analysisId,
      fragment_id: fragment.fragment_id,
      rank: index + 1,
      similarity: fragment.similarity ?? 0,
      was_cited: citaByFragmentId.has(fragment.fragment_id),
      quoted_text: quotedText ?? null,
    };
  });
};
