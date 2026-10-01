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
 * VISIBILIDAD (verificado contra produccion el 20/09/2026; decision de Matías 30/09/2026):
 * citizen_reports tiene una policy `lectura_publica` (rol public, qual `true`)
 * porque el mapa ciudadano necesita leer reportes ajenos, y el detalle es publico
 * para cualquier ciudadano con sesión: categoría, descripción, localidad, estado y fecha.
 * Lo que sigue siendo del dueño: las fotos (este servicio no las pide para un reporte
 * ajeno), el fundamento del RAG (`citizen reads own report ai analysis`) y el historial
 * (`read own or attended`). Ver isOwnedBy.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const EVIDENCE_BUCKET = 'report-evidences';
/** Cuánto vive una URL firmada de las fotos del reporte. Se vuelve a pedir cada vez que se abre el detalle. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Ruta dentro del bucket a partir de la URL canónica guardada en report_images.image_url
 * (`.../object/public/report-evidences/<client_side_id>/<archivo>`).
 * @param {string} imageUrl
 * @returns {string|null} `<client_side_id>/<archivo>` o null si la URL no es del bucket de evidencias
 */
export const getEvidencePathFromUrl = (imageUrl) => {
  const marker = `/${EVIDENCE_BUCKET}/`;
  const url = String(imageUrl ?? '');
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = url.slice(index + marker.length).split('?')[0];
  try {
    return decodeURIComponent(path) || null;
  } catch {
    return path || null;
  }
};

/**
 * El bucket de evidencias es privado (REP-3798): la URL canónica no se abre sin sesión, así que al dueño se le
 * entregan URLs firmadas y temporales. Si no se puede firmar una, se deja la original (la pantalla muestra el
 * marcador de foto no disponible) y nunca se rompe el detalle.
 * @param {Array<{ id: string, image_url: string }>} images
 * @returns {Promise<Array<object>>}
 */
export const signEvidenceImages = async (images) => {
  const rows = images ?? [];
  const paths = rows.map((row) => getEvidencePathFromUrl(row.image_url));
  const toSign = paths.filter(Boolean);
  if (toSign.length === 0 || typeof supabase?.storage?.from !== 'function') return rows;
  try {
    const { data, error } = await supabase.storage.from(EVIDENCE_BUCKET).createSignedUrls(toSign, SIGNED_URL_TTL_SECONDS);
    if (error || !Array.isArray(data)) return rows;
    const signedByPath = new Map(data.filter((item) => item?.signedUrl).map((item) => [item.path, item.signedUrl]));
    return rows.map((row, index) => {
      const signed = paths[index] ? signedByPath.get(paths[index]) : null;
      return signed ? { ...row, image_url: signed } : row;
    });
  } catch {
    return rows;
  }
};

/**
 * Trae el reporte con su categoría y localidad. La evidencia (fotos) solo se pide si el
 * reporte es del usuario en sesión: en un reporte ajeno no se descarga ninguna imagen.
 *
 * @param {string} reportId UUID de citizen_reports.id
 * @param {string} [userId] auth.uid() del usuario en sesión, para decidir si se piden las fotos
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export const getReportDetail = async (reportId, userId) => {
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
      localities ( name )
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

  // Reporte ajeno: sin fotos, y ni siquiera se consultan.
  if (!isOwnedBy(data, userId)) {
    return { success: true, data: { ...data, report_images: [] } };
  }

  const { data: images, error: imagesError } = await supabase
    .from('report_images')
    .select('id, image_url, created_at')
    .eq('report_id', reportId);

  if (imagesError) {
    return { success: false, error: imagesError.message };
  }

  return { success: true, data: { ...data, report_images: await signEvidenceImages(images ?? []) } };
};

/**
 * Indica si el reporte pertenece al usuario dado. Decide qué se muestra: el dueño ve fotos,
 * fundamento jurídico e historial; cualquier otro ciudadano ve solo el resumen público
 * (ver nota de visibilidad del encabezado).
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
 * Estado actual de un reporte: una sola fila por id, barata para sondear (REP-3798, estados en vivo).
 * citizen_reports es de lectura pública, así que sirve también para quien mira un reporte ajeno.
 *
 * @param {string} reportId UUID de citizen_reports.id
 * @returns {Promise<{ snapshot: { current_state_code: string, updated_at: string }|null, error?: string }>}
 */
export const getReportStateSnapshot = async (reportId) => {
  if (!isSupabaseConfigured || !reportId) return { snapshot: null, error: 'Falta el reporte.' };
  const { data, error } = await supabase
    .from('citizen_reports')
    .select('current_state_code, updated_at')
    .eq('id', reportId)
    .maybeSingle();
  if (error) return { snapshot: null, error: error.message };
  return { snapshot: data ?? null };
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
