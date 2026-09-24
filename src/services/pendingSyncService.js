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
import { getAllPendingSyncReports, deleteDraftReport, recordDraftSyncError } from './offlineStorageService';
import { processAllEvidencesThroughQuarantine } from './quarantinePipelineService';
import { resolveServiceDbId } from './categoriesService';
import { validateDescription } from './reportDescription';
import {
  createCitizenReport,
  attachReportEvidence,
  isServerProtectedUrl,
  getAttachedEvidenceUrls,
} from './reportSubmissionService';

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
 * H-35 · Todo lo que le impide a este borrador salir de la cola, en el orden del asistente.
 * Es la única fuente de estas reglas: la usan la validación previa al envío y la pantalla de Pendientes
 * (para decir qué falta y qué se puede corregir ahí), así que no pueden contradecirse.
 * @returns {Array<{ code: 'DESCRIPTION'|'CATEGORY'|'LOCATION'|'PHOTOS', error: string }>} vacío si está completo
 */
export const getDraftProblems = (draft) => {
  const problems = [];
  const description = validateDescription(draft?.description);
  if (!description.valid) problems.push({ code: 'DESCRIPTION', error: description.error });
  if (!draft?.selectedCategory) problems.push({ code: 'CATEGORY', error: 'Falta la categoría del reporte.' });
  if (!draft?.customLocation?.localityId) {
    problems.push({ code: 'LOCATION', error: 'Falta confirmar la ubicación del reporte.' });
  }
  if (!(draft?.evidenceList || []).some((ev) => ev.blob)) {
    problems.push({ code: 'PHOTOS', error: 'El borrador no tiene fotos guardadas.' });
  }
  return problems;
};

/**
 * H-35 · ¿Este borrador puede llegar a enviarse? Se valida ANTES de tocar la red: un borrador que nunca va a
 * poder salir (descripción vacía o corta, sin categoría, sin ubicación, sin fotos) no debe procesar las fotos.
 * Hacerlo dejaba, en cada apertura de la app, una copia pública sin reporte en el bucket de evidencias.
 * @returns {{ valid: true } | { valid: false, code: string, error: string }} con el primer problema
 */
export const validateDraftForSync = (draft) => {
  const [first] = getDraftProblems(draft);
  return first ? { valid: false, code: first.code, error: first.error } : { valid: true };
};

/**
 * Registra por qué falló el envío (para mostrarlo en Pendientes) y devuelve el resultado.
 * kind: 'invalid' = hay que cambiar el borrador; 'retry' = se puede reintentar tal cual.
 * Guardar el diagnóstico nunca debe romper la cola: si falla, se ignora.
 */
const failWith = async (draft, { code, kind, message }) => {
  try {
    await recordDraftSyncError(draft?.client_side_id, { code, kind, message });
  } catch {
    // El diagnóstico es accesorio
  }
  return { success: false, error: message, code, kind };
};

/**
 * Envía un borrador pendiente. Nunca lanza: devuelve { success, error?, code?, kind?, reportId? }.
 */
export const sendPendingDraft = async (draft, userId) => {
  // H-35: primero se valida; recién después se toca la red
  const validation = validateDraftForSync(draft);
  if (!validation.valid) {
    return failWith(draft, { code: validation.code, kind: 'invalid', message: validation.error });
  }

  // REP-2204: un borrador guardado sin conexión usa las categorías de respaldo (sin dbId). Se resuelve por
  // código ANTES de procesar las fotos (H-35) y, si no se puede, no se envía sin categoría: queda pendiente.
  const serviceId = await resolveServiceDbId(draft.selectedCategory);
  if (!serviceId) {
    return failWith(draft, {
      code: 'CATEGORY_UNRESOLVED',
      kind: 'retry',
      message: 'No pudimos identificar la categoría. Se reintenta cuando haya conexión.',
    });
  }

  const storedEvidence = (draft.evidenceList || []).filter((ev) => ev.blob);
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
      return failWith(draft, { code: 'PROTECTION', kind: 'retry', message: pipeline?.error || 'No se pudo proteger la foto.' });
    }

    const protectedUrls = (pipeline.processedEvidences || []).map((ev) => ev.sanitizedUrl).filter(isServerUrl);
    if (protectedUrls.length !== evidenceList.length) {
      // Privacidad: nunca se adjunta una foto que no pasó por el difuminado del servidor
      return failWith(draft, {
        code: 'PROTECTION',
        kind: 'retry',
        message: 'La protección de las fotos no se completó en el servidor.',
      });
    }

    const { lat, lng } = extractLatLng(draft.customLocation?.coordinates || draft.geolocation);

    const creation = await createCitizenReport({
      clientSideId: draft.client_side_id,
      userId,
      serviceId,
      localityId: draft.customLocation?.localityId ?? null,
      description: draft.description,
      latitud: lat,
      longitud: lng,
    });
    if (!creation.success) {
      // El ciudadano ve el mensaje pensado para él, no el detalle técnico (REP-2204)
      return failWith(draft, {
        code: 'CREATE',
        kind: 'retry',
        message: creation.userMessage || creation.error || 'No pudimos guardar tu reporte.',
      });
    }

    // El alta es idempotente por client_side_id, pero adjuntar no lo es: si un intento
    // anterior alcanzó a registrar algunas fotos y falló en otra, este recorrido las
    // duplicaría. Se saltean las que ya están.
    const alreadyAttached = await getAttachedEvidenceUrls(creation.data.id);
    for (const sanitizedUrl of protectedUrls) {
      if (alreadyAttached.has(sanitizedUrl)) continue;
      // eslint-disable-next-line no-await-in-loop
      const attached = await attachReportEvidence({ reportId: creation.data.id, sanitizedUrl });
      if (!attached.success) {
        return failWith(draft, { code: 'ATTACH', kind: 'retry', message: attached.error || 'No se pudo adjuntar la foto.' });
      }
    }

    await deleteDraftReport(draft.client_side_id);
    return { success: true, reportId: creation.data.id };
  } catch (err) {
    return failWith(draft, { code: 'UNEXPECTED', kind: 'retry', message: err?.message || 'Error inesperado al enviar el reporte.' });
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
      else errors.push({ clientSideId: draft.client_side_id, error: result.error, code: result.code, kind: result.kind });
    }
    return { sent, failed: errors.length, remaining: drafts.length - sent, offline: isOffline(), errors };
  })().finally(() => {
    runningSync = null;
  });

  return runningSync;
};
