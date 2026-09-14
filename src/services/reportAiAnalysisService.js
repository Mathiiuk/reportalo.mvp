/**
 * @file reportAiAnalysisService.js
 * @description Lectura del análisis del RAG para la pantalla del ciudadano (REP-2909,
 * bloque 4). Usa el cliente Supabase normal (respeta RLS — supabase/rag_rls_policies.sql):
 * un ciudadano solo puede leer el análisis de sus propios reportes.
 */

/**
 * Trae el análisis más reciente de un reporte, con su evidencia y la ruta
 * jerárquica de cada fragmento citado (para mostrar "Ley X > Artículo Y").
 *
 * @param {object} supabaseClient Cliente Supabase (respeta RLS del usuario logueado)
 * @param {string} reportId UUID de citizen_reports.id
 * @returns {Promise<{ analysis: object|null, error: string|null }>}
 */
export const fetchReportAiAnalysis = async (supabaseClient, reportId) => {
  if (!reportId) {
    return { analysis: null, error: 'reportId es obligatorio.' };
  }

  const { data, error } = await supabaseClient
    .from('report_ai_analysis')
    .select(
      `
      id, result_status_code, citizen_feedback, confidence_score, created_at,
      report_ai_evidence (
        fragment_id, was_cited, quoted_text,
        knowledge_fragments ( hierarchy_path, foundation_type_code )
      )
    `
    )
    .eq('report_id', reportId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { analysis: null, error: error.message };
  }

  return { analysis: data, error: null };
};
