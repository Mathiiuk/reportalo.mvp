/**
 * @file quarantinePipelineService.js
 * @description Servicio cliente para coordinar el pipeline server-side de cuarentena de imágenes (REP-2404).
 * Gestiona el envío transitorio a Supabase Storage (evidence-quarantine), la invocación de la Edge Function
 * 'quarantine-anonymize' y la recepción de la evidencia sanitizada y anonimizada bajo principio fail-safe.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
// Importamos las utilidades especializadas de sanitización y auditoría de metadatos (REP-2401)
import {
  sanitizeFileMetadata,
  hasExifMetadata,
  stripExifFromJpeg,
  normalizeImageOrientation,
  prepareEvidenceImage,
} from './metadataSanitizer';

// Reexportamos las funciones para trazabilidad de la suite de pruebas y auditoría de QA
export { sanitizeFileMetadata, hasExifMetadata, stripExifFromJpeg, normalizeImageOrientation };

// Nombre del bucket de cuarentena temporal y privada
export const BUCKET_QUARANTINE = 'evidence-quarantine';

// Nombre del bucket de almacenamiento público de evidencias protegidas
export const BUCKET_PUBLIC_EVIDENCES = 'report-evidences';

/**
 * Función para sanitizar metadatos EXIF en el lado cliente (utilidad de respaldo para entornos desconectados).
 * @param {Blob|File} file Objeto de archivo original
 * @returns {Promise<Blob>} Blob limpio sin metadatos
 */
export const sanitizeImageMetadataLocally = async (file) => {
  // Si no hay archivo válido, retornamos null
  if (!file) return null;

  try {
    // Obtenemos los bytes a través de arrayBuffer o FileReader como respaldo para jsdom
    let arrayBuffer;
    if (typeof file.arrayBuffer === 'function') {
      arrayBuffer = await file.arrayBuffer();
    } else {
      arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    }

    const bytes = new Uint8Array(arrayBuffer);

    // Verificamos si es formato JPEG
    if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
      const chunks = [];
      let offset = 2;
      chunks.push(new Uint8Array([0xff, 0xd8]));

      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) break;
        const marker = bytes[offset + 1];

        // Fin de encabezados o inicio del stream de imagen
        if (marker === 0xda || marker === 0xd9) {
          chunks.push(bytes.subarray(offset));
          break;
        }

        const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
        // Omitimos el segmento APP1 que contiene metadatos EXIF
        if (marker !== 0xe1) {
          chunks.push(bytes.subarray(offset, offset + 2 + length));
        }
        offset += 2 + length;
      }

      const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
      const cleanBytes = new Uint8Array(totalLen);
      let pos = 0;
      for (const chunk of chunks) {
        cleanBytes.set(chunk, pos);
        pos += chunk.length;
      }

      const cleanBlob = new Blob([cleanBytes], { type: file.type || 'image/jpeg' });
      // Aseguramos que el método arrayBuffer esté presente en el Blob resultante para entornos jsdom
      if (typeof cleanBlob.arrayBuffer !== 'function') {
        cleanBlob.arrayBuffer = async () => cleanBytes.buffer;
      }

      return cleanBlob;
    }

    return file;
  } catch (err) {
    // Si falla la sanitización binaria, retornamos el blob original
    return file;
  }
};

/**
 * Determina si se debe utilizar Supabase remoto o el emulador local.
 * En entornos de test evita peticiones de red reales si Supabase no fue explícitamente mockeado.
 */
const shouldInvokeSupabaseBackend = () => {
  const isVitest = Boolean(import.meta.env?.VITEST || import.meta.env?.MODE === 'test');
  if (isVitest) {
    const isMocked = Boolean(
      supabase?.storage?.from &&
      (supabase.storage.from.mock || supabase.storage.from._isMockFunction)
    );
    return Boolean(isSupabaseConfigured && isMocked);
  }
  return isSupabaseConfigured;
};

const isTestRunner = () => Boolean(import.meta.env?.VITEST || import.meta.env?.MODE === 'test');

/**
 * H-30 · El emulador local SOLO puede correr en desarrollo o bajo el runner de tests.
 *
 * El emulador limpia el EXIF pero NO difumina: no detecta caras ni patentes, informa
 * un conteo de zonas fijo y devuelve una URL `blob:` local. Es útil para no bloquear
 * a quien desarrolla sin backend, y es inaceptable en cualquier otro lado: devolvía
 * `success: true` sobre una foto sin anonimizar, con caras y patentes de gente real.
 *
 * El camino peligroso no eran los fallbacks de DEV (esos ya se verificaban) sino el
 * paso final: si `isSupabaseConfigured` es falso en un build de producción —por
 * ejemplo, si faltan las variables de entorno al compilar— la ejecución caía en el
 * emulador sin que nadie lo revisara.
 *
 * Fuera de DEV el pipeline ahora falla con `failSafeTriggered`, que es lo que la
 * pantalla M21 ya sabe mostrar: «No pudimos proteger tu foto».
 *
 * @returns {boolean} true solo en desarrollo interactivo o en tests.
 */
const isLocalEmulatorAllowed = () => Boolean(import.meta.env?.DEV) || isTestRunner();

/**
 * REP-3793 · Motivo de la falla que devuelve la Edge Function en `reason`.
 * Con un código HTTP de error, supabase-js no entrega el cuerpo en `data`: lo deja en
 * `error.context` (la Response). Si no se puede leer, se devuelve null.
 * @param {any} error Error de `supabase.functions.invoke`
 * @returns {Promise<{ reason?: string, error?: string } | null>}
 */
export const readFunctionFailure = async (error) => {
  try {
    const body = await error?.context?.json?.();
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
};

/**
 * REP-3793 · Texto para el ciudadano según el motivo del fail-safe. Nunca muestra el detalle
 * técnico. `photoTips` indica si tiene sentido sugerir otra foto (luz, enfoque) o si el
 * problema es del servicio y alcanza con reintentar.
 * @param {string} [reason]
 * @returns {{ detail: string, photoTips: boolean }}
 */
export const describeProtectionFailure = (reason) => {
  switch (reason) {
    case 'vision_not_configured':
    case 'vision_timeout':
    case 'vision_http_error':
    case 'vision_response_error':
      return {
        detail: 'El servicio que detecta rostros y patentes no respondió. Probá de nuevo en unos minutos.',
        photoTips: false,
      };
    case 'image_too_large':
      return { detail: 'La foto es demasiado grande para protegerla. Probá con otra.', photoTips: true };
    case 'not_jpeg':
    case 'image_unreadable':
      return { detail: 'No pudimos abrir la foto. Probá sacando otra.', photoTips: true };
    default:
      return { detail: 'Algo falló mientras protegíamos la foto. Probá de nuevo.', photoTips: true };
  }
};

/**
 * Id del usuario con sesión iniciada, o null si no hay sesión o no se pudo leer.
 * @returns {Promise<string|null>}
 */
const getSessionUserId = async () => {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id ?? null;
  } catch {
    return null;
  }
};

/**
 * Sube una fotografía transitoria al bucket privado de cuarentena.
 * @param {Blob|File} file Archivo fotográfico original
 * @param {string} clientSideId Identificador de correlación del reporte
 * @returns {Promise<{ success: boolean, quarantinePath?: string, error?: string }>}
 */
export const uploadToQuarantine = async (file, clientSideId) => {
  if (!file) {
    return { success: false, error: 'No se suministró ningún archivo para procesar.' };
  }

  // Generamos un nombre único y transitorio para la cuarentena
  const fileExtension = file.name?.split('.').pop() || 'jpg';
  const fileName = `temp_${clientSideId}_${Date.now()}.${fileExtension}`;
  let quarantinePath = fileName;

  // Si Supabase está configurado con credenciales reales o mockeado en tests
  if (shouldInvokeSupabaseBackend()) {
    // REP-2501: la foto va a la carpeta del propio usuario (`<user_id>/temp_...`). La
    // política de Storage y la Edge Function solo aceptan esa carpeta, así nadie puede
    // pedir que se procese (o se borre) la foto de otra persona.
    const userId = await getSessionUserId();
    if (!userId && !(!isTestRunner() && import.meta.env?.DEV)) {
      return { success: false, error: 'Necesitás iniciar sesión para enviar la foto.' };
    }
    if (userId) quarantinePath = `${userId}/${fileName}`;

    try {
      // R5-02 (REP-2908-VERIF ronda 5): sin upsert. quarantinePath ya es
      // único por clientSideId + timestamp, nunca debería colisionar, y la
      // política de Storage de cuarentena (migración r5_02) solo permite
      // INSERT con sesión — con upsert:true hubiera hecho falta también UPDATE.
      const { data, error } = await supabase.storage
        .from(BUCKET_QUARANTINE)
        .upload(quarantinePath, file, {
          contentType: file.type || 'image/jpeg',
        });

      if (error) {
        // En desarrollo interactivo en navegador (DEV fuera de test runners), si falla la política RLS
        // o el bucket remoto no está listo, recurrimos al emulador para no bloquear al desarrollador.
        const isTesting = Boolean(import.meta.env?.VITEST || import.meta.env?.MODE === 'test');
        if (!isTesting && import.meta.env?.DEV) {
          console.warn(`[Quarantine Pipeline] Advertencia RLS/Storage en DEV (${error.message}). Activando emulador de seguridad local.`);
          return { success: true, quarantinePath, isFallback: true };
        }
        return { success: false, error: `Fallo al subir a cuarentena: ${error.message}` };
      }

      return { success: true, quarantinePath: data?.path || quarantinePath };
    } catch (err) {
      const isTesting = Boolean(import.meta.env?.VITEST || import.meta.env?.MODE === 'test');
      if (!isTesting && import.meta.env?.DEV) {
        console.warn('[Quarantine Pipeline] Error de red en cuarentena en DEV. Activando emulador local.');
        return { success: true, quarantinePath, isFallback: true };
      }
      return { success: false, error: err.message || 'Error inesperado al subir a cuarentena.' };
    }
  }

  // Modo desarrollo local o pruebas sin mock de red: simulamos la subida a cuarentena
  return { success: true, quarantinePath };
};

/**
 * Invoca el pipeline server-side de cuarentena y anonimización.
 * @param {object} options
 * @param {Blob|File} options.file Archivo original capturado
 * @param {string} options.clientSideId Identificador del reporte
 * @param {boolean} [options.simulateError] Bandera para pruebas de comportamiento fail-safe
 * @returns {Promise<{ success: boolean, sanitizedUrl?: string, error?: string, failSafeTriggered?: boolean }>}
 */
export const processEvidenceThroughQuarantine = async ({
  file,
  clientSideId,
  simulateError = false,
  // H-30 · Costura de prueba. Por defecto sale del entorno, pero Vite reemplaza
  // `import.meta.env.DEV` por un literal al compilar, así que no hay forma de
  // simular un build de producción mutando el entorno en un test. Este parámetro
  // permite ejercitar el camino real sin tocar la lógica. Nadie lo pasa en la app.
  allowLocalEmulator = isLocalEmulatorAllowed(),
}) => {
  // Validación de parámetros obligatorios
  if (!file || !clientSideId) {
    return {
      success: false,
      error: 'Parámetros obligatorios faltantes (file o clientSideId).',
      failSafeTriggered: true,
    };
  }

  // 0. Paso previo: dejar la foto derecha ANTES de que nadie le quite el EXIF.
  // El borrado de APP1 elimina las coordenadas GPS (que es el objetivo) pero
  // tambien la etiqueta Orientation, asi que una foto vertical terminaba
  // mostrandose acostada. Rotando los pixeles aca, la imagen queda derecha para
  // los dos caminos: el server-side de la Edge Function y el fallback local.
  // REP-2501: además, todo lo que no sea JPEG se convierte, porque el servidor solo
  // acepta JPEG (no puede quitar los metadatos de un PNG/WebP sin re-codificarlo).
  // REP-3793: y se reduce a EVIDENCE_MAX_SIDE, el tamaño que la Edge Function puede
  // pixelar dentro de su límite de CPU. Vale para el envío online y para los
  // pendientes offline, que pasan los dos por esta misma función.
  const uprightFile = await prepareEvidenceImage(file);

  // 1. Paso 1: Subida transitoria al bucket privado de cuarentena
  const uploadResult = await uploadToQuarantine(uprightFile, clientSideId);

  if (!uploadResult.success) {
    return {
      success: false,
      error: uploadResult.error || 'No se pudo resguardar la imagen en cuarentena.',
      failSafeTriggered: true,
    };
  }

  const { quarantinePath, isFallback } = uploadResult;

  // 2. Si se solicitó simulación de error para probar el comportamiento fail-safe
  if (simulateError) {
    // Purgamos inmediatamente la imagen de cuarentena
    if (shouldInvokeSupabaseBackend() && !isFallback) {
      await supabase.storage.from(BUCKET_QUARANTINE).remove([quarantinePath]).catch(() => {});
    }
    return {
      success: false,
      error: 'Fallo simulado en el procesamiento de privacidad: la imagen original fue purgada.',
      failSafeTriggered: true,
    };
  }

  // 3. Paso 2: Ejecución del pipeline de anonimización (Edge Function)
  if (shouldInvokeSupabaseBackend() && !isFallback) {
    try {
      const { data, error } = await supabase.functions.invoke('quarantine-anonymize', {
        body: {
          quarantinePath,
          clientSideId,
        },
      });

      const isTesting = Boolean(import.meta.env?.VITEST || import.meta.env?.MODE === 'test');

      if (error || !data?.success) {
        // En DEV interactivo (fuera de tests), si la función no está desplegada en el proyecto remoto, pasamos al emulador local
        if (!isTesting && import.meta.env?.DEV) {
          console.warn('[Quarantine Pipeline] Edge function no disponible en DEV. Usando emulador de seguridad local.');
        } else {
          // REP-3793: el servidor no guardó nada y dice por qué (reason); el original ya se purgó allá
          const failure = error ? await readFunctionFailure(error) : data;
          return {
            success: false,
            error: failure?.error || error?.message || 'Error en el procesamiento de la imagen.',
            reason: failure?.reason || 'unknown',
            failSafeTriggered: true,
          };
        }
      } else {
        return {
          success: true,
          sanitizedUrl: data.sanitizedUrl,
          clientSideId: data.clientSideId,
          entitiesDetectedCount: data.entitiesDetectedCount || 0,
          detectedZones: data.detectedZones || [],
        };
      }
    } catch (err) {
      const isTesting = Boolean(import.meta.env?.VITEST || import.meta.env?.MODE === 'test');
      if (!isTesting && import.meta.env?.DEV) {
        console.warn('[Quarantine Pipeline] Excepción de Edge Function en DEV. Usando emulador local.');
      } else {
        await supabase.storage.from(BUCKET_QUARANTINE).remove([quarantinePath]).catch(() => {});
        return {
          success: false,
          error: err.message || 'Error de red en la Edge Function.',
          failSafeTriggered: true,
        };
      }
    }
  }

  // 4. Entorno de desarrollo / Vitest sin backend activo: Emulador determinístico fail-safe
  //
  // H-30: fuera de DEV o de tests no se emula nada. Antes este punto se alcanzaba
  // también en producción cuando shouldInvokeSupabaseBackend() daba falso, y el
  // pipeline devolvía éxito con una foto sin difuminar.
  if (!allowLocalEmulator) {
    // La imagen original ya está en cuarentena: se purga antes de cortar, igual que
    // en el resto de los caminos fail-safe, para no dejarla sin anonimizar.
    if (shouldInvokeSupabaseBackend() && !isFallback) {
      await supabase.storage.from(BUCKET_QUARANTINE).remove([quarantinePath]).catch(() => {});
    }
    return {
      success: false,
      error: 'No pudimos procesar la foto: el servicio de anonimización no está disponible.',
      failSafeTriggered: true,
    };
  }

  try {
    // Sanitizamos los metadatos EXIF utilizando el módulo especializado (REP-2401)
    // uprightFile, no file: el fallback local tambien debe partir de la imagen
    // ya rotada, o la foto quedaria acostada igual que antes.
    const { cleanFile: sanitizedBlob } = await sanitizeFileMetadata(uprightFile);

    // Auditoría de seguridad fail-safe: verificamos que el Blob limpio no tenga metadatos remanentes
    if (typeof sanitizedBlob.arrayBuffer === 'function') {
      const auditBuffer = new Uint8Array(await sanitizedBlob.arrayBuffer());
      if (hasExifMetadata(auditBuffer)) {
        return {
          success: false,
          error: 'Fallo de seguridad: no se pudieron remover los metadatos EXIF del archivo.',
          failSafeTriggered: true,
        };
      }
    }

    // Generamos URL de objeto protegida para previsualización
    const sanitizedUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(sanitizedBlob)
      : `blob:http://localhost/sanitized_${clientSideId}`;

    return {
      success: true,
      sanitizedUrl,
      clientSideId,
      entitiesDetectedCount: 2,
      detectedZones: [
        { x: 120, y: 80, width: 90, height: 90, type: 'face' },
        { x: 300, y: 410, width: 140, height: 50, type: 'license_plate' },
      ],
      isSimulated: true,
    };
  } catch (emulatorError) {
    return {
      success: false,
      error: `Error en el emulador local de cuarentena: ${emulatorError.message || 'Fallo de procesamiento.'}`,
      failSafeTriggered: true,
    };
  }
};

/**
 * Pasos descriptivos del pipeline de privacidad para mostrar en la interfaz.
 */
// REP-3793: los textos describen lo que el servidor hace de verdad (pixelar y quitar metadatos)
export const PIPELINE_STEPS = [
  'Analizando la foto',
  'Pixelando rostros',
  'Pixelando patentes de terceros',
  'Quitando ubicación y datos del teléfono',
];

/**
 * Procesa un listado completo de evidencias a través del pipeline de cuarentena.
 * @param {object} options
 * @param {Array} options.evidenceList Lista de fotos capturadas
 * @param {string} options.clientSideId Identificador único del reporte
 * @param {boolean} [options.simulateError] Bandera para pruebas de resiliencia
 * @param {Function} [options.onProgress] Callback para reportar avance porcentual y paso
 * @returns {Promise<{ success: boolean, processedEvidences?: Array, error?: string, failSafeTriggered?: boolean }>}
 */
export const processAllEvidencesThroughQuarantine = async ({
  evidenceList = [],
  clientSideId = null,
  simulateError = false,
  onProgress = null,
}) => {
  // Si no hay evidencias, retornamos éxito inmediatamente con lista vacía
  if (!evidenceList || evidenceList.length === 0) {
    return {
      success: true,
      processedEvidences: [],
      entitiesDetectedCount: 0,
    };
  }

  // Identificador de respaldo si no fue provisto
  const activeReportId = clientSideId || `rep-${Date.now()}`;
  // Array contenedor de evidencias procesadas y sanitizadas
  const processedEvidences = [];
  // Contador total de entidades detectadas y anonimizadas
  let totalEntitiesDetected = 0;

  try {
    // Iteramos secuencialmente sobre cada fotografía
    for (let index = 0; index < evidenceList.length; index++) {
      // Obtenemos el elemento de evidencia actual
      const evidence = evidenceList[index];

      // Notificamos progreso inicial del ítem si se suministró callback
      if (onProgress) {
        onProgress({
          stepIndex: 0,
          label: PIPELINE_STEPS[0],
          progress: Math.round(((index + 0.2) / evidenceList.length) * 100),
        });
      }

      // Obtenemos el archivo binario o generamos un fallback simulado
      let fileToProcess = evidence.file;
      if (!fileToProcess) {
        // Fallback para entornos donde solo existe previewUrl
        fileToProcess = new Blob(['simulated-photo-bytes'], { type: 'image/jpeg' });
      }

      // Invocamos el pipeline para la foto individual
      const result = await processEvidenceThroughQuarantine({
        file: fileToProcess,
        clientSideId: activeReportId,
        simulateError,
      });

      // Si falla el procesamiento de alguna foto, abortamos bajo principio fail-safe
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Fallo de protección en una de las fotografías.',
          reason: result.reason,
          failSafeTriggered: true,
        };
      }

      // Acumulamos las zonas detectadas
      totalEntitiesDetected += (result.entitiesDetectedCount || 0);

      // Notificamos progreso intermedio
      if (onProgress) {
        onProgress({
          stepIndex: 2,
          label: PIPELINE_STEPS[2],
          progress: Math.round(((index + 0.8) / evidenceList.length) * 100),
        });
      }

      // Clonamos y enriquecemos la evidencia con los datos sanitizados
      processedEvidences.push({
        ...evidence,
        status: 'READY',
        previewUrl: result.sanitizedUrl || evidence.previewUrl,
        sanitizedUrl: result.sanitizedUrl,
        isSanitized: true,
        detectedZones: result.detectedZones || [],
      });
    }

    // Notificamos finalización del lote
    if (onProgress) {
      onProgress({
        stepIndex: PIPELINE_STEPS.length - 1,
        label: PIPELINE_STEPS[PIPELINE_STEPS.length - 1],
        progress: 100,
      });
    }

    // Retornamos el conjunto completo de evidencias protegidas
    return {
      success: true,
      processedEvidences,
      entitiesDetectedCount: totalEntitiesDetected,
    };
  } catch (error) {
    // Si ocurre un error no controlado, garantizamos respuesta fail-safe
    return {
      success: false,
      error: error.message || 'Error inesperado durante el pipeline de cuarentena.',
      failSafeTriggered: true,
    };
  }
};
