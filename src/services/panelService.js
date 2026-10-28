import { supabase } from '../lib/supabaseClient';

/**
 * REP-3000 · Bandeja del organismo de prueba.
 *
 * La base decide qué reportes entran (get_panel_inbox filtra con profile_attends_report: jurisdicción, borrador
 * generado y estado del circuito del panel). La respuesta no trae descripción, identidad ni fotos.
 *
 * @returns {Promise<{ success: boolean, reports: Array<object>, error?: string }>}
 */
export const getPanelInbox = async () => {
  const { data, error } = await supabase.rpc('get_panel_inbox');
  if (error) return { success: false, reports: [], error: error.message };
  return { success: true, reports: data ?? [] };
};

/**
 * REP-3749 · Detalle de un reporte para quien lo atiende.
 *
 * get_panel_report_detail devuelve null si el operador no atiende el reporte o si no existe (no distingue los dos
 * casos). La descripción ya viene sin correos ni teléfonos y no trae identidad del vecino.
 *
 * @param {string} reportId
 * @returns {Promise<{ status: 'ok'|'not_available'|'error', report?: object }>}
 */
export const getPanelReportDetail = async (reportId) => {
  const { data, error } = await supabase.rpc('get_panel_report_detail', { p_report_id: reportId });
  if (error) return { status: 'error' };
  if (!data) return { status: 'not_available' };
  return { status: 'ok', report: data };
};

/** Número de caso legible (Hernán D4): «Caso N° 00042». */
export const formatCaseNumber = (caseNumber) =>
  caseNumber == null ? null : `Caso N° ${String(caseNumber).padStart(5, '0')}`;
