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

const INITIAL_STATE_CODE = 'RECIBIDO';

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
    return { success: false, error: 'Supabase no está configurado.' };
  }
  if (!clientSideId || !userId || !localityId || !description) {
    return { success: false, error: 'Faltan datos obligatorios para crear el reporte.' };
  }

  const { data, error } = await supabase
    .from('citizen_reports')
    .upsert(
      {
        client_side_id: clientSideId,
        user_id: userId,
        service_id: serviceId ?? null,
        locality_id: localityId,
        description,
        latitud,
        longitud,
        current_state_code: INITIAL_STATE_CODE,
      },
      { onConflict: 'client_side_id', ignoreDuplicates: false }
    )
    .select('id, client_side_id')
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? 'No se pudo guardar el reporte.' };
  }

  return { success: true, data };
};

/**
 * Adjunta la evidencia ya sanitizada (nunca la original ni EXIF) al reporte
 * persistido. `sanitizedUrl` puede ser una URL pública real (ya subida a
 * report-evidences por la Edge Function quarantine-anonymize) o una URL local
 * `blob:` (fallback client-side) — las dos son fetch()-ables, así que se
 * re-sube siempre bajo el report_id real para que el path de storage quede
 * organizado de forma consistente.
 *
 * @param {object} params
 * @param {string} params.reportId UUID de citizen_reports.id ya persistido
 * @param {string} params.sanitizedUrl URL (http o blob:) del resultado sanitizado
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export const attachReportEvidence = async ({ reportId, sanitizedUrl }) => {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase no está configurado.' };
  }
  if (!reportId || !sanitizedUrl) {
    return { success: false, error: 'Faltan datos para adjuntar la evidencia.' };
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
 * "Mis reportes" — reemplaza demoReports en ReportsPage.jsx.
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
