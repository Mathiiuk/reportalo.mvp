/**
 * @file pendingSyncService.js
 * @description Envío de los reportes guardados sin conexión (UJ v3.3 · M20 «Pendientes de envío» —
 * REP-3791 Bloque 4). Hasta este bloque, los borradores en PENDING_SYNC se guardaban en IndexedDB
 * pero ningún código los enviaba (H-29).
 *
 * Reutiliza el mismo recorrido que el envío con conexión (NewReportPage): protección de fotos en
 * el servidor → alta del reporte (upsert idempotente por client_side_id) → adjuntar evidencias →
 * borrar el borrador local. Regla de privacidad: solo se adjuntan fotos cuya URL protegida viene del
 * servidor (http/https). Si la protección no se completó, el borrador queda en la cola (H-30).
 */
import { getAllPendingSyncReports, deleteDraftReport } from './offlineStorageService';
import { processAllEvidencesThroughQuarantine } from './quarantinePipelineService';
import { createCitizenReport, attachReportEvidence, isServerProtectedUrl } from './reportSubmissionService';

// La regla de privacidad vive en reportSubmissionService: una sola definición
// para las dos vías de envío, la de la cola y la del envío con conexión (H-30).
const isServerUrl = isServerProtectedUrl;

const extractLatLng = (coords) => {
  if (Array.isArray(coords)) return { lng: coords[0], lat: coords[1] };
  if (coords && typeof coords === 'object') {
    return { lat: coords.lat ?? coords.latitude ?? null, lng: coords.lng ?? coords.longitude ?? null };
  }
  return { lat: null, lng: null };
};

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * Envía un borrador pendiente. Nunca lanza: devuelve { success, error?, reportId? }.
 */
export const sendPendingDraft = async (draft, userId) => {
  const storedEvidence = (draft?.evidenceList || []).filter((ev) => ev.blob);
  if (storedEvidence.length === 0) {
    return { success: false, error: 'El borrador no tiene fotos guardadas.' };
  }

  const previewUrls = [];
  const evidenceList = storedEvidence.map((ev) => {
    const previewUrl =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(ev.blob) : '';
    if (previewUrl) previewUrls.push(previewUrl);
    return { id: ev.id, file: ev.blob, name: ev.name, mimeType: ev.mimeType, previewUrl, geolocation: ev.geolocation };
  });

  try {
    const pipeline = await processAllEvidencesThroughQuarantine({ evidenceList, clientSideId: draft.client_side_id });
    if (!pipeline?.success) {
      return { success: false, error: pipeline?.error || 'No se pudo proteger la foto.' };
    }

    const protectedUrls = (pipeline.processedEvidences || []).map((ev) => ev.sanitizedUrl).filter(isServerUrl);
    if (protectedUrls.length !== evidenceList.length) {
      // Privacidad: nunca se adjunta una foto que no pasó por el difuminado del servidor
      return { success: false, error: 'La protección de las fotos no se completó en el servidor.' };
    }

    const { lat, lng } = extractLatLng(draft.customLocation?.coordinates || draft.geolocation);
    const creation = await createCitizenReport({
      clientSideId: draft.client_side_id,
      userId,
      serviceId: draft.selectedCategory?.dbId ?? null,
      localityId: draft.customLocation?.localityId ?? null,
      description: draft.description,
      latitud: lat,
      longitud: lng,
    });
    if (!creation.success) {
      return { success: false, error: creation.error };
    }

    for (const sanitizedUrl of protectedUrls) {
      // eslint-disable-next-line no-await-in-loop
      const attached = await attachReportEvidence({ reportId: creation.data.id, sanitizedUrl });
      if (!attached.success) {
        return { success: false, error: attached.error };
      }
    }

    await deleteDraftReport(draft.client_side_id);
    return { success: true, reportId: creation.data.id };
  } catch (err) {
    return { success: false, error: err?.message || 'Error inesperado al enviar el reporte.' };
  } finally {
    previewUrls.forEach((url) => URL.revokeObjectURL?.(url));
  }
};

let runningSync = null;

/**
 * Envía todos los pendientes, de a uno y en orden. Si ya hay un envío en curso, devuelve ese mismo.
 * @returns {Promise<{ sent: number, failed: number, remaining: number, offline: boolean, errors: Array }>}
 */
export const syncPendingReports = ({ userId } = {}) => {
  if (runningSync) return runningSync;

  runningSync = (async () => {
    const drafts = await getAllPendingSyncReports().catch(() => []);
    if (isOffline() || !userId) {
      return { sent: 0, failed: 0, remaining: drafts.length, offline: isOffline(), errors: [] };
    }

    let sent = 0;
    const errors = [];
    for (const draft of drafts) {
      if (isOffline()) break;
      // eslint-disable-next-line no-await-in-loop
      const result = await sendPendingDraft(draft, userId);
      if (result.success) sent += 1;
      else errors.push({ clientSideId: draft.client_side_id, error: result.error });
    }
    return { sent, failed: errors.length, remaining: drafts.length - sent, offline: isOffline(), errors };
  })().finally(() => {
    runningSync = null;
  });

  return runningSync;
};
