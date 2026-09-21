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
/*
 * NOTA DE MIGRACIÓN (REP-3791 Bloque 3, 21/09/2026)
 *
 * Acá vivían REPORT_STATE_META, getStateMeta, TIMELINE_LABELS, buildTimeline y
 * buildShortCode, agregados por REP-3789. Se retiraron porque sus códigos de
 * estado ('RECIBIDO', 'EN_ANALISIS', 'DERIVADO', 'RESUELTO', 'DESESTIMADO') no
 * existen en public.report_states, cuyo catálogo real es:
 *
 *   borrador · enviado · en_curso · resuelto · rechazado
 *
 * y citizen_reports.current_state_code tiene FK contra esa tabla, así que esos
 * códigos no pueden aparecer nunca en un reporte real. La consecuencia era que
 * getStateMeta siempre caía al valor por defecto: la píldora mostraba "EN CURSO"
 * para todos los reportes, incluidos resueltos y rechazados, y la línea de
 * tiempo no marcaba bien los pasos alcanzados.
 *
 * El origen del desvío es el seed de demostración
 * 20260915160000_v04_seed_demo_profiles_and_reports.sql, que inserta códigos en
 * mayúscula en report_state_history, tabla que no tiene FK. Conviene alinear ese
 * seed también.
 *
 * La taxonomía vigente es src/components/report/reportStatus.js, que sigue el
 * §10 del UJ v3.3 y traduce los códigos de la base (en_curso -> en_revision,
 * rechazado -> descartado). El formato del número de reporte pasó a
 * formatReportCode (8 caracteres), como pide el UJ.
 *
 * Definir el modelo definitivo de estados es la observación H-23, a cargo del PO.
 */
