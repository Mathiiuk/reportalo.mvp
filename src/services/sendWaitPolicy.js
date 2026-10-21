/**
 * @file sendWaitPolicy.js
 * @description Cuánto se espera la protección de las fotos antes de dejar el reporte en Pendientes (REP-3846, parte C).
 *
 * Antes la espera era fija: 45 s para cualquier cantidad de fotos. La protección es secuencial y tarda unos
 * 11,3 s de mediana por foto (REP-3828: unos 49 s con cuatro), así que con 4 fotos y buena señal la espera
 * vencía siempre y el ciudadano volvía al mapa con «se enviará cuando recuperes señal» (QA REP-3833, O-01: 5 de 5).
 *
 * Ahora hay dos límites:
 * - **Aviso** (proporcional): pasado este tiempo la pantalla avisa que tarda más de lo habitual y ofrece dejarlo
 *   en Pendientes, pero sigue protegiendo las fotos. No corta nada.
 * - **Máximo** (proporcional, con techo): recién acá el reporte pasa a Pendientes solo.
 *
 * ⚠️ PROPUESTA PENDIENTE DE RATIFICACIÓN DEL PO (Hernán, REP-3846). Los valores salen de las mediciones de REP-3828
 * con un margen de algo más del doble sobre la mediana. Si se ratifican otros, se cambian solo acá.
 */

/** Mediana medida por foto en REP-3828 (referencia, no se usa en el cálculo). */
export const MEASURED_MEDIAN_PER_PHOTO_MS = 11300;

/** Aviso «tarda más de lo habitual»: base + por foto. Con 1, 2, 3 y 4 fotos: 30, 45, 60 y 75 s. */
export const SLOW_NOTICE_BASE_MS = 15000;
export const SLOW_NOTICE_PER_PHOTO_MS = 15000;

/** Espera máxima antes de pasar a Pendientes: base + por foto, con techo. Con 1, 2, 3 y 4 fotos: 50, 75, 100 y 120 s. */
export const MAX_WAIT_BASE_MS = 25000;
export const MAX_WAIT_PER_PHOTO_MS = 25000;
/** Límite máximo documentado para la UX, sea cual sea la cantidad de fotos. */
export const MAX_WAIT_CEILING_MS = 120000;

const photoCountOf = (count) => Math.max(1, Math.floor(Number(count) || 0));

/**
 * @param {number} photoCount cantidad de fotos del reporte (1 a 4)
 * @returns {{ slowNoticeMs: number, maxWaitMs: number }}
 */
export const getProtectionWait = (photoCount) => {
  const photos = photoCountOf(photoCount);
  const maxWaitMs = Math.min(MAX_WAIT_CEILING_MS, MAX_WAIT_BASE_MS + MAX_WAIT_PER_PHOTO_MS * photos);
  const slowNoticeMs = Math.min(maxWaitMs, SLOW_NOTICE_BASE_MS + SLOW_NOTICE_PER_PHOTO_MS * photos);
  return { slowNoticeMs, maxWaitMs };
};

/**
 * Por qué un reporte pasa a Pendientes. Define el mensaje (REP-3846, parte E): el aviso de «cuando recuperes señal»
 * se usa solo si se confirmó que no hay conexión.
 */
export const QUEUE_REASON = {
  /** El teléfono informa que no hay conexión (navigator.onLine === false o evento offline). */
  OFFLINE: 'offline',
  /** Hay conexión, pero la protección o el envío no terminaron dentro de la espera máxima. */
  SLOW: 'slow',
  /** El ciudadano eligió dejarlo en Pendientes mientras esperaba. */
  MANUAL: 'manual',
};

/**
 * Qué se le dice al ciudadano cuando el reporte queda en Pendientes, y adónde va (REP-3846, parte E).
 * Solo con conexión perdida se promete el envío «apenas recuperes señal» y se vuelve al mapa. Con señal (lento o
 * por elección) se dice que quedó pendiente y se abre Pendientes, donde el reporte se puede consultar.
 * Quien llama tiene que haber comprobado antes que el borrador reintentable existe.
 *
 * @param {{ reason: string, missingLocation?: boolean }} params
 * @returns {{ title: string, description: string, goTo: '/mapa' | '/pendientes' }}
 */
export const describeQueuedReport = ({ reason, missingLocation = false }) => {
  if (reason === QUEUE_REASON.OFFLINE) {
    return {
      title: 'Reporte guardado con éxito',
      description: missingLocation
        ? 'Cuando vuelva la señal, completá la ubicación en Pendientes para enviarlo.'
        : 'Se enviará automáticamente apenas recuperes señal.',
      goTo: '/mapa',
    };
  }
  return {
    title: 'Tu reporte quedó pendiente de envío',
    description: missingLocation
      ? 'Completá la ubicación en Pendientes para enviarlo.'
      : 'Podés consultarlo en Pendientes. Lo seguimos intentando solo.',
    goTo: '/pendientes',
  };
};

/** @returns {boolean} true solo si el navegador confirma que no hay conexión */
export const isConfirmedOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
