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
 * buildShortCode, agregados por REP-3789. Se retiraron porque el UJ v3.3 define
 * su propia taxonomía de estados (§10) y tener dos era pedir que divergieran.
 *
 * La fuente de verdad pasó a ser src/components/report/reportStatus.js, que
 * traduce los códigos de la base a las etiquetas del §10:
 *
 *   RECIBIDO     -> Enviado
 *   EN_ANALISIS  -> En revisión
 *   DERIVADO     -> Notificado al responsable
 *   RESUELTO     -> Resuelto
 *   DESESTIMADO  -> Descartado (cierre alternativo)
 *
 * Esos cinco son los códigos REALES de public.report_states en producción
 * (proyecto CiudadAR), verificados contra la base el 21/09/2026: 17 reportes,
 * todos con esos valores, y el historial igual. Los que declara `supabase/seed.sql`
 * (borrador / enviado / en_curso / resuelto / rechazado) **no existen en la base**:
 * ese archivo quedó desactualizado y conviene alinearlo, porque es lo que hace
 * pensar que el frontend está equivocado cuando no lo está.
 *
 * El formato del número de reporte pasó a formatReportCode (8 caracteres), como
 * pide el UJ, también en el acuse de envío para que no diverjan.
 */
