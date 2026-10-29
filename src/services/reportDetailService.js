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
 * VISIBILIDAD (decision de Matías 30/09/2026; REP-3849, 19/10/2026):
 * el detalle de un reporte ajeno es publico para cualquier ciudadano con sesión
 * (categoría, descripción, localidad, estado y fecha), pero sin identificar al autor.
 * citizen_reports solo la lee el dueño (o quien atiende el reporte); el resumen ajeno
 * sale de la vista `public_citizen_reports`, que no tiene user_id ni client_side_id.
 * Lo que sigue siendo del dueño: las fotos (este servicio no las pide para un reporte
 * ajeno), el fundamento del RAG (`citizen reads own report ai analysis`) y el historial
 * (`read own or attended`). Ver isOwnedBy.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const EVIDENCE_BUCKET = 'report-evidences';
/**
 * REP-3849: vista con el resumen público de los reportes (sin user_id ni client_side_id). La usa todo lo que lee
 * reportes ajenos: el mapa, el detalle de un reporte ajeno y el sondeo de estado.
 */
export const PUBLIC_REPORTS_VIEW = 'public_citizen_reports';
/** Columnas del resumen que se muestran en el detalle, propio o ajeno (la vista también las tiene). */
const PUBLIC_REPORT_COLUMNS = `description, current_state_code, latitud, longitud, created_at, updated_at, address_street,
      services ( service_name, service_code ),
      localities ( name )`;
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

  // REP-3849: primero la fila propia. La RLS de citizen_reports solo la devuelve al dueño (o a quien atiende el
  // reporte), así que el user_id que viene acá nunca es el de otra persona. Sin sesión no hay fila propia posible.
  let data = null;
  if (userId) {
    const own = await supabase
      .from('citizen_reports')
      // REP-3843: la altura solo la lee el dueño (la vista pública no la tiene, REP-3876 §8)
      .select(`id, client_side_id, user_id, address_number, ${PUBLIC_REPORT_COLUMNS}`)
      .eq('id', reportId)
      .maybeSingle();
    if (own.error) {
      return { success: false, error: own.error.message };
    }
    data = own.data;
  }

  // Reporte ajeno: el resumen público, sin user_id ni client_side_id, y sin fotos (ni siquiera se consultan).
  if (!data) {
    const { data: publicReport, error } = await supabase
      .from(PUBLIC_REPORTS_VIEW)
      .select(`id, ${PUBLIC_REPORT_COLUMNS}`)
      .eq('id', reportId)
      .maybeSingle();
    if (error) {
      return { success: false, error: error.message };
    }
    if (!publicReport) {
      return { success: false, error: 'NOT_FOUND' };
    }
    return { success: true, data: { ...publicReport, report_images: [] } };
  }

  // Fila visible pero de otra persona (quien atiende el reporte): sin fotos en esta pantalla, como hasta ahora.
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
 * Sale de la vista pública (REP-3849), así que sirve igual para el dueño y para quien mira un reporte ajeno.
 *
 * @param {string} reportId UUID de citizen_reports.id
 * @returns {Promise<{ snapshot: { current_state_code: string, updated_at: string }|null, error?: string }>}
 */
export const getReportStateSnapshot = async (reportId) => {
  if (!isSupabaseConfigured || !reportId) return { snapshot: null, error: 'Falta el reporte.' };
  const { data, error } = await supabase
    .from(PUBLIC_REPORTS_VIEW)
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
    // REP-3001: escalated_to = a qué organismo o área lo pasó el operador (texto libre, sin envío real);
    // REP-3001: escalated_contact = su contacto, opcional
    .select('id, state_code, changed_at, notes, escalated_to, escalated_contact')
    .eq('report_id', reportId)
    .order('changed_at', { ascending: true });

  if (error) {
    return { success: false, history: [], error: error.message };
  }

  return { success: true, history: data ?? [] };
};

/**
 * REP-3001 · «El organismo tomó tu reporte»: el evento TOMADO_POR_ORGANISMO, con el nombre del organismo de prueba.
 * Lo lee el dueño por la policy `read own or attended` de report_events. No se pide quién lo tomó (actor_profile_id).
 * Si no se puede leer, la línea de tiempo sigue sin ese paso.
 *
 * @param {string} reportId UUID de citizen_reports.id
 * @returns {Promise<{ taken_at: string, agency: string|null }|null>}
 */
export const getReportTakenEvent = async (reportId) => {
  if (!isSupabaseConfigured || !reportId) return null;
  try {
    const { data, error } = await supabase
      .from('report_events')
      .select('occurred_at, agencies ( name )')
      .eq('report_id', reportId)
      .eq('event_type_code', 'TOMADO_POR_ORGANISMO')
      .order('occurred_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return { taken_at: data.occurred_at, agency: data.agencies?.name ?? null };
  } catch {
    return null;
  }
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
 *   DERIVADO     -> Notificado al responsable (REP-3001: hoy «Derivado», la misma etiqueta que el panel)
 *   RESUELTO     -> Resuelto
 *   DESESTIMADO  -> Descartado (cierre alternativo; REP-3001: hoy «Desestimado»)
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
