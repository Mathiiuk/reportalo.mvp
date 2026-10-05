/**
 * @file reportImageAnalysisService.js
 * @description Lectura de la verificación visual de las fotos de un reporte (REP-3820). Usa el cliente Supabase normal:
 * respeta RLS (report_image_analysis, REP-3817): lo lee el dueño del reporte o quien lo atiende.
 *
 * Es distinto del análisis jurídico (reportAiAnalysisService): otra tabla, otro resultado y otra pantalla. Un resultado
 * por foto, sin fusionarlos.
 *
 * Columnas elegidas a propósito: no se piden `confidence_score` (solo observabilidad, nunca se muestra), ni modelo,
 * tokens, latencia, versión de prompt ni `status_reason` (trazabilidad interna). Tampoco se necesita la fila para
 * decidir nada del reporte: esta lectura es solo para mostrar.
 */

/**
 * @param {object} supabaseClient Cliente Supabase (respeta RLS del usuario logueado)
 * @param {string} reportId UUID de citizen_reports.id
 * @returns {Promise<{ results: Array<object>, error: string|null }>}
 */
export const fetchReportImageAnalyses = async (supabaseClient, reportId) => {
  if (!reportId) {
    return { results: [], error: 'reportId es obligatorio.' };
  }

  const { data, error } = await supabaseClient
    .from('report_image_analysis')
    .select(
      `
      image_id, status, scene_summary, coherence, quality_flags, created_at,
      services:suggested_service_id ( service_name )
    `
    )
    .eq('report_id', reportId)
    .order('created_at', { ascending: true });

  if (error) {
    return { results: [], error: error.message };
  }

  return { results: data ?? [], error: null };
};
