/**
 * @file reportDetailService.js
 * @description Lectura del detalle de un reporte para la pantalla del ciudadano
 * (REP-3789). Complementa a reportAiAnalysisService.js: este módulo trae el
 * reporte en sí (categoría, localidad, evidencia), y aquel trae el análisis
 * jurídico del RAG.
 *
 * Mismo contrato { success, data, error } que reportSubmissionService.js: no
 * lanza excepciones, devuelve el error para que la pantalla decida qué mostrar.
 *
 * NOTA DE SEGURIDAD (verificado contra produccion el 20/09/2026):
 * citizen_reports tiene una policy `lectura_publica` (rol public, qual `true`)
 * porque el mapa ciudadano necesita leer reportes ajenos. Es decir: la fila del
 * reporte NO está restringida al dueño. El análisis del RAG sí lo está
 * (`citizen reads own report ai analysis`). Por eso esta pantalla valida la
 * pertenencia en el cliente además de apoyarse en RLS — ver isOwnedBy.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

/**
 * Trae el reporte con su categoría, localidad y evidencia sanitizada.
 *
 * @param {string} reportId UUID de citizen_reports.id
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export const getReportDetail = async (reportId) => {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase no está configurado.' };
  }
  if (!reportId) {
    return { success: false, error: 'Falta el identificador del reporte.' };
  }

  const { data, error } = await supabase
    .from('citizen_reports')
    .select(
      `
      id, client_side_id, user_id, description, current_state_code,
      latitud, longitud, created_at, updated_at,
      services ( service_name ),
      localities ( name ),
      report_images ( id, image_url, created_at )
    `
    )
    .eq('id', reportId)
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }
  if (!data) {
    return { success: false, error: 'NOT_FOUND' };
  }

  return { success: true, data };
};

/**
 * Indica si el reporte pertenece al usuario dado. Se usa para no mostrarle a un
 * ciudadano el detalle privado de un reporte ajeno, dado que la policy de
 * citizen_reports es de lectura pública (ver nota de seguridad del encabezado).
 *
 * @param {object|null} report Fila devuelta por getReportDetail
 * @param {string|undefined} userId auth.uid() del usuario en sesión
 * @returns {boolean}
 */
export const isOwnedBy = (report, userId) => {
  if (!report || !userId) return false;
  return report.user_id === userId;
};

/**
 * Historial de estados del reporte, base de la línea de tiempo (REP-3789).
 * Protegido por la policy `read own or attended` de report_state_history: solo
 * lo ve el dueño del reporte o quien lo atiende.
 *
 * @param {string} reportId UUID de citizen_reports.id
 * @returns {Promise<{ success: boolean, history: Array<object>, error?: string }>}
 */
export const getReportStateHistory = async (reportId) => {
  if (!isSupabaseConfigured || !reportId) {
    return { success: false, history: [], error: 'Falta el reporte o Supabase no está configurado.' };
  }

  const { data, error } = await supabase
    .from('report_state_history')
    .select('id, state_code, changed_at, notes')
    .eq('report_id', reportId)
    .order('changed_at', { ascending: true });

  if (error) {
    return { success: false, history: [], error: error.message };
  }

  return { success: true, history: data ?? [] };
};

/**
 * Fuente única de verdad de los estados de un reporte (REP-3789).
 *
 * Los códigos son los de public.report_states en producción (verificado el
 * 20/09/2026); las etiquetas, las aprobadas en el mockup del User Journey v3.2.
 *
 * Existía un mapeo por pantalla y eso ya había divergido: ReportsPage esperaba
 * un código 'DESCARTADO' que no existe en la base, de modo que un reporte
 * desestimado se mostraba como "En curso" en la lista y como "Desestimado" en
 * el detalle. Centralizarlo evita que vuelva a pasar.
 *
 *   badge    -> insignia del encabezado del detalle
 *   step     -> paso en la línea de tiempo
 *   isClosed -> si el reporte ya terminó su recorrido (agrupa la lista)
 */
export const REPORT_STATE_META = {
  RECIBIDO: { badge: 'RECIBIDO', step: 'Enviado', isClosed: false },
  EN_ANALISIS: { badge: 'EN REVISIÓN', step: 'En revisión', isClosed: false },
  DERIVADO: { badge: 'DERIVADO', step: 'Notificado al responsable', isClosed: false },
  RESUELTO: { badge: 'RESUELTO', step: 'Resuelto', isClosed: true },
  DESESTIMADO: { badge: 'DESESTIMADO', step: 'Desestimado', isClosed: true },
};

/** Un estado desconocido nunca se asume cerrado: se muestra como en curso. */
export const getStateMeta = (code) =>
  REPORT_STATE_META[code] ?? { badge: 'EN CURSO', step: code ?? 'Sin estado', isClosed: false };

/** Etiquetas de la línea de tiempo, derivadas del mapa central. */
export const TIMELINE_LABELS = Object.fromEntries(
  Object.entries(REPORT_STATE_META).map(([code, meta]) => [code, meta.step])
);

const HAPPY_PATH = ['RECIBIDO', 'EN_ANALISIS', 'DERIVADO', 'RESUELTO'];
const REJECTED_PATH = ['RECIBIDO', 'EN_ANALISIS', 'DESESTIMADO'];

/**
 * Arma los pasos de la línea de tiempo combinando el historial real con el
 * estado actual del reporte. Función pura: se prueba sin base de datos.
 *
 * Por qué no basta el historial: hoy la mayoría de los reportes en producción no
 * tiene ninguna fila en report_state_history (solo 18 filas para 65 reportes).
 * Para esos casos el primer paso se deriva de created_at del reporte, y los
 * alcanzados se infieren de la posición de current_state_code en el recorrido.
 * Así la pantalla nunca queda vacía ni inventa fechas.
 *
 * @param {object} params
 * @param {Array<object>} [params.history] Filas de report_state_history
 * @param {string} params.currentStateCode Estado actual del reporte
 * @param {string} [params.createdAt] created_at del reporte (respaldo del primer paso)
 * @returns {Array<{code: string, label: string, reached: boolean, at: string|null, notes: string|null, isCurrent: boolean}>}
 */
export const buildTimeline = ({ history = [], currentStateCode, createdAt = null }) => {
  const rows = Array.isArray(history) ? history : [];

  // Último cambio registrado por estado (si hubiera repetidos, gana el más reciente).
  const byCode = new Map();
  for (const row of rows) {
    if (!row?.state_code) continue;
    const previous = byCode.get(row.state_code);
    if (!previous || new Date(row.changed_at) >= new Date(previous.changed_at)) {
      byCode.set(row.state_code, row);
    }
  }

  const isRejected = currentStateCode === 'DESESTIMADO' || byCode.has('DESESTIMADO');
  const path = isRejected ? REJECTED_PATH : HAPPY_PATH;

  const currentIndex = path.indexOf(currentStateCode);

  return path.map((code, index) => {
    const row = byCode.get(code) || null;
    // Alcanzado si hay registro explícito o si el estado actual ya lo dejó atrás.
    const reached = Boolean(row) || (currentIndex >= 0 && index <= currentIndex);

    let at = row?.changed_at ?? null;
    if (!at && code === 'RECIBIDO' && reached) {
      at = createdAt; // el envío del reporte es su propia marca temporal
    }

    return {
      code,
      label: TIMELINE_LABELS[code] ?? code,
      reached,
      at,
      notes: row?.notes ?? null,
      isCurrent: code === currentStateCode,
    };
  });
};

/**
 * Código corto y estable para mostrar en el encabezado (el mockup usa "#RP-2048").
 * Se deriva del UUID real, no de un contador: no hay columna de número
 * correlativo en citizen_reports y no se inventa una acá.
 *
 * @param {string} reportId UUID
 * @returns {string} Por ejemplo "#RP-3F2A"
 */
export const buildShortCode = (reportId) => {
  if (!reportId || typeof reportId !== 'string') return '#RP-----';
  const compact = reportId.replace(/-/g, '').toUpperCase();
  return `#RP-${compact.slice(0, 4)}`;
};
