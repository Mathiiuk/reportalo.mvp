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
  // Con el diseño de Iván, el código sale en el error de carga («Error {código} · dd/mm · hh:mm»)
  if (error) return { success: false, reports: [], error: error.message, code: error.code || error.status || null };
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

// REP-3001 · Mensajes claros para cada rechazo de la base (escenario 4)
const ACTION_ERRORS = {
  sin_permiso: 'No tenés permiso para cambiar este reporte.',
  transicion_no_definida: 'El reporte ya cambió de estado y esa acción no está disponible. Actualizamos la pantalla.',
  mismo_estado: 'El reporte ya cambió de estado y esa acción no está disponible. Actualizamos la pantalla.',
  estado_no_permite: 'El reporte ya cambió de estado y esa acción no está disponible. Actualizamos la pantalla.',
  motivo_requerido: 'Escribí el motivo.',
  destino_requerido: 'Indicá a qué organismo o área corresponde.',
  reporte_inexistente: 'Este reporte no está disponible para tu organismo.',
};
const GENERIC_ERROR = 'No pudimos guardar el cambio. Revisá tu conexión y volvé a intentar.';

const toActionResult = ({ data, error }) => {
  if (error) return { ok: false, message: GENERIC_ERROR };
  if (!data?.ok) return { ok: false, code: data?.code, message: ACTION_ERRORS[data?.code] ?? GENERIC_ERROR };
  return { ok: true, data };
};

/**
 * REP-3001 · «Tomar el caso»: el reporte sigue Derivado y queda quién y cuándo (evento TOMADO_POR_ORGANISMO).
 * La base no duplica el evento si se toma dos veces.
 *
 * @param {string} reportId
 * @returns {Promise<{ ok: boolean, code?: string, message?: string, data?: object }>}
 */
export const takeReport = async (reportId) => toActionResult(await supabase.rpc('take_report', { p_report_id: reportId }));

/**
 * REP-3001 · Rechazar (Escalado, Desestimado, En discrepancia) o marcar Resuelto. change_report_state valida el
 * catálogo, el motivo y, en el escalado, a quién; si rechaza, el estado no cambia y queda registrado el intento.
 *
 * @param {string} reportId
 * @param {{ toState: string, reason: string, escalatedTo?: string|null, escalatedContact?: string|null }} accion
 *   escalatedContact: contacto opcional del destino del escalado (diseño de Iván, decisión 3A)
 * @returns {Promise<{ ok: boolean, code?: string, message?: string, data?: object }>}
 */
export const changePanelReportState = async (reportId, { toState, reason, escalatedTo = null, escalatedContact = null }) =>
  toActionResult(
    await supabase.rpc('change_report_state', {
      p_report_id: reportId,
      p_to_state: toState,
      p_reason: reason,
      p_escalated_to: escalatedTo,
      p_escalated_contact: escalatedContact,
    })
  );
