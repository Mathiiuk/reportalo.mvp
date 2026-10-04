/**
 * @file reportSubmissionService.js
 * @description Persistencia real del envío de un reporte (REP-2500). Reemplaza
 * el flujo "mock" anterior: crea la fila real en citizen_reports, adjunta la
 * evidencia ya sanitizada (nunca la foto original ni EXIF) y expone la lectura
 * de "mis reportes".
 *
 * Funciones puras/testeables, mismo patrón que reportAiAnalysisPersistence.js:
 * separan el armado de datos del I/O donde tiene sentido, y devuelven
 * { success, data, error } en vez de lanzar, para que el llamador decida qué
 * mostrar sin try/catch en cada punto de uso.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { BUCKET_PUBLIC_EVIDENCES } from './quarantinePipelineService';
import { validateDescription } from './reportDescription';

/**
 * E-3: arma la fila de citizen_reports. Idempotente por client_side_id — si
 * el ciudadano reintenta un envío que sí llegó a guardarse (ej. se cortó la
 * conexión justo después), el conflicto se resuelve recuperando el reporte
 * existente en vez de duplicarlo o mostrar error (ADR-009).
 *
 * @param {object} params
 * @param {string} params.clientSideId UUID generado en el dispositivo (offlineStorageService)
 * @param {string} params.userId auth.uid() del ciudadano
 * @param {string} params.serviceId UUID de services (categoría elegida)
 * @param {string} params.localityId UUID de localities (selector manual, R-1 a R-5)
 * @param {string} params.description
 * @param {number} params.latitud
 * @param {number} params.longitud
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
/**
 * REP-2204: mensajes para el ciudadano. El texto técnico de Supabase (RLS, constraints,
 * "Failed to fetch") no le sirve a nadie: va al log, y a la pantalla llega una frase que
 * dice qué pasó y que el borrador sigue guardado.
 */
const MESSAGE_NETWORK =
  'Parece que hay un problema de conexión. Tu borrador sigue guardado: probá de nuevo cuando tengas señal.';
const MESSAGE_GENERIC =
  'No pudimos guardar tu reporte. Tu borrador sigue guardado: probá de nuevo en unos segundos.';
const MESSAGE_MISSING_DATA =
  'Faltan datos para enviar el reporte. Revisá la foto, la categoría, la descripción y la ubicación.';

export const isNetworkFailure = (message) =>
  /failed to fetch|networkerror|network request failed|load failed|timeout|timed out/i.test(String(message ?? ''));

const toCitizenMessage = (technicalMessage) =>
  isNetworkFailure(technicalMessage) ? MESSAGE_NETWORK : MESSAGE_GENERIC;

/**
 * REP-3810: el motivo técnico de una falla de alta. Antes solo viajaba el texto y el llamador lo
 * descartaba, así que con lo que guardaba la app no se podía saber qué rechazó la base (RLS, un
 * constraint, un límite). Se conservan solo los campos de diagnóstico del error de Supabase: nunca
 * el contenido del reporte (descripción, coordenadas) ni datos de la cuenta.
 * @param {object|null} error Error de PostgREST/Supabase o excepción
 * @param {number} [status] Código HTTP de la respuesta, si lo hubo
 * @returns {{ message: string, code: string|null, details: string|null, hint: string|null, status: number|null }}
 */
const toTechnicalError = (error, status) => ({
  message: error?.message ?? 'No se pudo guardar el reporte.',
  code: error?.code ?? null,
  details: error?.details ?? null,
  hint: error?.hint ?? null,
  status: status ?? error?.status ?? null,
});

/** REP-3810: deja el motivo técnico en el log (consola) para que el equipo pueda diagnosticar el alta fallida. */
const logCreationFailure = (clientSideId, technical) => {
  console.error('[createCitizenReport] No se pudo crear el reporte:', { clientSideId, ...technical });
};

export const createCitizenReport = async ({
  clientSideId,
  userId,
  serviceId,
  localityId,
  description,
  latitud,
  longitud,
}) => {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase no está configurado.', userMessage: MESSAGE_GENERIC };
  }
  if (!clientSideId || !userId || !localityId || !description) {
    return {
      success: false,
      error: 'Faltan datos obligatorios para crear el reporte.',
      userMessage: MESSAGE_MISSING_DATA,
    };
  }

  // REP-2203: misma regla que el formulario (10 a 280 caracteres), por si el envío
  // llega por otro camino (borrador offline, sincronización) sin pasar por el paso 2
  const descriptionCheck = validateDescription(description);
  if (!descriptionCheck.valid) {
    // Este texto ya está escrito para el ciudadano
    return { success: false, error: descriptionCheck.error, userMessage: descriptionCheck.error };
  }
  const cleanDescription = description.trim();

  // REP-2204: una excepción de red no debe romper la pantalla ni perder el borrador
  let data;
  let error;
  let status;
  try {
    ({ data, error, status } = await supabase
      .from('citizen_reports')
      .upsert(
        {
          client_side_id: clientSideId,
          user_id: userId,
          service_id: serviceId ?? null,
          locality_id: localityId,
          description: cleanDescription,
          latitud,
          longitud,
          // Sin current_state_code a propósito: al insertar la base usa su valor por defecto (RECIBIDO) y,
          // si el envío se reintenta (mismo client_side_id), el upsert no pisa el estado que el reporte ya
          // tenga (al enviarse pasa solo a En revisión, REP-3798).
        },
        // REP-3810: ignoreDuplicates (ON CONFLICT DO NOTHING) en vez de DO UPDATE. El ciudadano solo tiene
        // policy de INSERT en citizen_reports: ante un client_side_id ya existente, DO UPDATE lo rechazaba
        // siempre con 42501 y el reintento nunca se resolvía. Con DO NOTHING no devuelve fila y el reporte
        // existente se recupera abajo, sin modificarlo.
        { onConflict: 'client_side_id', ignoreDuplicates: true }
      )
      .select('id, client_side_id')
      .maybeSingle());
  } catch (thrown) {
    const technical = toTechnicalError(thrown);
    logCreationFailure(clientSideId, technical);
    return {
      success: false,
      error: technical.message,
      technical,
      userMessage: toCitizenMessage(thrown?.message),
    };
  }

  if (error) {
    const technical = toTechnicalError(error, status);
    logCreationFailure(clientSideId, technical);
    return { success: false, error: technical.message, technical, userMessage: toCitizenMessage(technical.message) };
  }

  if (!data) {
    // Sin fila devuelta = ya existía un reporte con este client_side_id (reintento): se recupera
    return recoverExistingReport({ clientSideId, userId });
  }

  return { success: true, data };
};

/**
 * REP-3810: recupera el reporte que ya existe para este client_side_id. Pasa cuando el alta llegó al servidor
 * pero la respuesta se perdió (corte, timeout) y el borrador se reintenta. Solo lo devuelve si es del mismo
 * ciudadano: un client_side_id repetido entre cuentas distintas no debe unir el reporte de una con las fotos
 * de otra. No modifica nada.
 */
const recoverExistingReport = async ({ clientSideId, userId }) => {
  const fail = (technical) => {
    logCreationFailure(clientSideId, technical);
    return { success: false, error: technical.message, technical, userMessage: MESSAGE_GENERIC };
  };

  let existing;
  let error;
  let status;
  try {
    ({ data: existing, error, status } = await supabase
      .from('citizen_reports')
      .select('id, client_side_id, user_id')
      .eq('client_side_id', clientSideId)
      .maybeSingle());
  } catch (thrown) {
    return fail(toTechnicalError(thrown));
  }

  if (error) return fail(toTechnicalError(error, status));
  if (!existing) {
    // El alta no devolvió fila y tampoco se la encuentra: no se puede dar por creado
    return fail({
      message: 'El alta no devolvió el reporte y no se pudo recuperar por client_side_id.',
      code: 'REPORT_NOT_FOUND',
      details: null,
      hint: null,
      status: status ?? null,
    });
  }
  if (existing.user_id !== userId) {
    return fail({
      message: 'El client_side_id ya pertenece al reporte de otra cuenta.',
      code: 'CLIENT_ID_CONFLICT',
      details: null,
      hint: null,
      status: null,
    });
  }

  return { success: true, data: { id: existing.id, client_side_id: existing.client_side_id }, recovered: true };
};

/**
 * Indica si la URL ya apunta a un objeto del bucket público de evidencias, es
 * decir, si la Edge Function quarantine-anonymize ya subió ahí la imagen
 * sanitizada y solo resta registrarla.
 *
 * @param {string} url
 * @returns {boolean}
 */
const isAlreadyInPublicBucket = (url) =>
  typeof url === 'string' &&
  /^https?:\/\//i.test(url) &&
  url.includes(`/${BUCKET_PUBLIC_EVIDENCES}/`);

/**
 * Regla de privacidad unica para decidir si una evidencia se puede adjuntar (H-30).
 *
 * El pipeline de cuarentena tiene un camino "emulador" que se activa cuando
 * uploadToQuarantine devuelve isFallback, cuando shouldInvokeSupabaseBackend() es
 * falso, o en DEV si falla la Edge Function. Ese camino SOLO limpia el EXIF: no
 * difumina nada, informa 2 zonas ficticias y devuelve exito con una URL blob:
 * local. Adjuntar esa foto significa subir al bucket publico una imagen sin
 * difuminar, con caras de gente real.
 *
 * Una URL http(s) solo puede haberla generado el servidor, asi que es la senal de
 * que la foto si paso por el difuminado. La usan las dos vias de envio: el envio
 * con conexion (NewReportPage) y la cola offline (pendingSyncService).
 *
 * @param {string} url URL de la evidencia ya procesada
 * @returns {boolean} true si la protegio el servidor y se puede adjuntar
 */
export const isServerProtectedUrl = (url) => /^https?:\/\//i.test(String(url ?? ''));

/**
 * URLs de evidencia ya registradas para un reporte.
 *
 * `createCitizenReport` es idempotente por `client_side_id`, pero `attachReportEvidence`
 * no lo es: si un reintento vuelve a recorrer la lista entera, las fotos que sí habían
 * entrado se duplican en `report_images`. Consultar lo ya adjuntado permite saltearlas.
 *
 * @param {string} reportId
 * @returns {Promise<Set<string>>} URLs ya adjuntas; vacío si no se pueden leer.
 */
export const getAttachedEvidenceUrls = async (reportId) => {
  if (!isSupabaseConfigured || !reportId) return new Set();
  try {
    const { data, error } = await supabase
      .from('report_images')
      .select('image_url')
      .eq('report_id', reportId);
    if (error || !data) return new Set();
    return new Set(data.map((row) => row.image_url));
  } catch {
    // Ante la duda se devuelve vacío: se prefiere un posible duplicado antes que
    // perder una evidencia por no adjuntarla.
    return new Set();
  }
};

/**
 * Adjunta la evidencia ya sanitizada (nunca la original ni EXIF) al reporte
 * persistido.
 *
 * IMPORTANTE (corregido el 20/09/2026): el cliente NO puede —ni debe— escribir
 * en el bucket público `report-evidences`. storage.objects no tiene policy de
 * INSERT para ese bucket, y eso es deliberado: solo la Edge Function, con
 * service role, deposita ahí imágenes, y es justamente esa restricción la que
 * garantiza que al bucket público únicamente llegue material ya anonimizado.
 *
 * Antes esta función re-descargaba la URL sanitizada y la volvía a subir bajo
 * otra ruta, lo que producía un 403 ("new row violates row-level security
 * policy") y dejaba el reporte sin evidencia registrada. Ahora, cuando la
 * imagen ya está en el bucket público, se registra directamente esa URL.
 *
 * El camino de subida se conserva solo para el fallback client-side (`blob:`),
 * donde no hubo procesamiento server-side. Ese caso hoy también será rechazado
 * por RLS; queda pendiente de definición en REP-2404 qué hacer con la evidencia
 * cuando la Edge Function no está disponible.
 *
 * @param {object} params
 * @param {string} params.reportId UUID de citizen_reports.id ya persistido
 * @param {string} params.sanitizedUrl URL (http del bucket público, o blob:)
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export const attachReportEvidence = async ({ reportId, sanitizedUrl }) => {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase no está configurado.' };
  }
  if (!reportId || !sanitizedUrl) {
    return { success: false, error: 'Faltan datos para adjuntar la evidencia.' };
  }

  // Camino normal: la Edge Function ya subió la imagen anonimizada. Solo se
  // registra la fila, sin volver a mover bytes.
  if (isAlreadyInPublicBucket(sanitizedUrl)) {
    const { data, error } = await supabase
      .from('report_images')
      .insert({ report_id: reportId, image_url: sanitizedUrl })
      .select('id, image_url')
      .single();

    if (error || !data) {
      return { success: false, error: error?.message ?? 'No se pudo registrar la evidencia.' };
    }
    return { success: true, data };
  }

  let blob;
  try {
    const response = await fetch(sanitizedUrl);
    if (!response.ok) {
      throw new Error(`No se pudo leer la evidencia sanitizada (${response.status}).`);
    }
    blob = await response.blob();
  } catch (err) {
    return { success: false, error: `Fallo al leer la evidencia sanitizada: ${err.message}` };
  }

  // Generar UUID seguro (crypto.randomUUID solo disponible en Secure Contexts / HTTPS)
  const fileId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const storagePath = `${reportId}/${fileId}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_PUBLIC_EVIDENCES)
    .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: false });

  if (uploadError) {
    return { success: false, error: `No se pudo subir la evidencia: ${uploadError.message}` };
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET_PUBLIC_EVIDENCES).getPublicUrl(storagePath);

  const { data, error: insertError } = await supabase
    .from('report_images')
    .insert({ report_id: reportId, image_url: publicUrlData.publicUrl })
    .select('id, image_url')
    .single();

  if (insertError || !data) {
    return { success: false, error: insertError?.message ?? 'No se pudo registrar la evidencia.' };
  }

  return { success: true, data };
};

/**
 * Reportes enviados por el usuario, para "Mis reportes" y las métricas del Perfil.
 * @param {string} userId
 * @returns {Promise<{ success: boolean, reports: Array<object>, error?: string }>}
 */
export const getMyReports = async (userId) => {
  if (!isSupabaseConfigured || !userId) {
    return { success: false, reports: [], error: 'Falta el usuario o Supabase no está configurado.' };
  }

  const { data, error } = await supabase
    .from('citizen_reports')
    .select(
      'id, client_side_id, description, current_state_code, created_at, services(service_name), localities(name)'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, reports: [], error: error.message };
  }

  return { success: true, reports: data ?? [] };
};
