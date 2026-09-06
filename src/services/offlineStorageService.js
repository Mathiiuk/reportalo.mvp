/**
 * @file offlineStorageService.js
 * @description Servicio de persistencia local en IndexedDB para la gestión de borradores
 * de reportes ciudadanos y almacenamiento de evidencias fotográficas en modo offline (REP-2703).
 */

import { EVIDENCE_STATUS } from '../types/evidence';

// Nombre de la base de datos local en IndexedDB
export const DB_NAME = 'reportalo_offline_db';

// Versión del esquema de IndexedDB
export const DB_VERSION = 1;

// Nombre del almacén de objetos (Object Store) para los borradores de reportes
export const STORE_DRAFTS = 'draft_reports';

// Estados posibles del borrador local
export const DRAFT_STATUS = {
  DRAFT_LOCAL: 'DRAFT_LOCAL',   // Borrador activo en edición
  PENDING_SYNC: 'PENDING_SYNC', // Guardado localmente esperando conexión para sincronizarse
  SYNCED: 'SYNCED',             // Sincronizado exitosamente con el backend
};

/**
 * Fallback en memoria en caso de que el entorno no soporte IndexedDB (ej. modo incógnito restrictivo o pruebas).
 */
const inMemoryFallbackStore = new Map();

/**
 * Verifica si la API de IndexedDB se encuentra disponible en el entorno de ejecución actual.
 * @returns {boolean} True si IndexedDB está disponible
 */
export const isIndexedDBAvailable = () => {
  // Comprobamos la existencia del objeto global window y la propiedad indexedDB
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
};

/**
 * Abre o inicializa la conexión con la base de datos IndexedDB de Reportalo.
 * @returns {Promise<IDBDatabase>} Instancia de la base de datos abierta
 */
export const openDatabase = () => {
  // Retornamos una promesa para manejar la naturaleza asíncrona basada en eventos de IndexedDB
  return new Promise((resolve, reject) => {
    // Si no está disponible en el entorno, rechazamos con aviso específico
    if (!isIndexedDBAvailable()) {
      return reject(new Error('IndexedDB no está disponible en este entorno.'));
    }

    // Solicitamos la apertura de la base de datos con el nombre y la versión definida
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    // Evento disparado cuando la base de datos no existe o la versión se incrementa
    request.onupgradeneeded = (event) => {
      // Obtenemos la referencia a la base de datos en proceso de actualización
      const db = event.target.result;

      // Si el almacén de borradores no existe todavía, lo creamos
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        // Creamos el object store con 'client_side_id' como clave primaria única
        const store = db.createObjectStore(STORE_DRAFTS, { keyPath: 'client_side_id' });

        // Índice para buscar rápidamente borradores por su estado (DRAFT_LOCAL, PENDING_SYNC)
        store.createIndex('by_status', 'status', { unique: false });

        // Índice para ordenar y filtrar por fecha de última actualización
        store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
      }
    };

    // Evento disparado cuando la conexión se abre de manera exitosa
    request.onsuccess = (event) => {
      // Resolvemos la promesa con la instancia de base de datos lista para operar
      resolve(event.target.result);
    };

    // Evento disparado si ocurre algún error durante la apertura
    request.onerror = (event) => {
      // Rechazamos la promesa propagando el error reportado por IndexedDB
      reject(event.target.error || new Error('Error desconocido al abrir IndexedDB'));
    };
  });
};

/**
 * Guarda o actualiza un borrador de reporte ciudadano en IndexedDB.
 * Almacena las fotografías originales (Blob/File) sin convertirlas a Base64.
 * @param {object} draftData Datos del borrador a persistir
 * @returns {Promise<object>} Borrador normalizado y guardado
 */
export const saveDraftReport = async (draftData) => {
  // Si no se proporcionó el identificador de cliente, generamos uno nuevo con UUID v4
  const client_side_id = draftData.client_side_id || (
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );

  // Fecha y hora actual en formato ISO para trazabilidad
  const now = new Date().toISOString();

  // Procesamos la lista de evidencias para almacenar el Blob/File binario directamente
  const normalizedEvidence = (draftData.evidenceList || []).map((ev) => ({
    id: ev.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `evd-${Date.now()}`),
    name: ev.name || ev.file?.name || `evidencia-${Date.now()}.jpg`,
    mimeType: ev.mimeType || ev.file?.type || 'image/jpeg',
    sizeBytes: ev.sizeBytes || ev.file?.size || 0,
    capturedAt: ev.capturedAt || now,
    status: draftData.status === DRAFT_STATUS.PENDING_SYNC
      ? EVIDENCE_STATUS.PENDING_SYNC
      : (ev.status || EVIDENCE_STATUS.CAPTURED_LOCAL),
    geolocation: ev.geolocation || null,
    // Guardamos el objeto binario original (Blob o File)
    blob: ev.file || ev.blob || null,
  }));

  // Estructura normalizada del borrador a persistir
  const recordToSave = {
    client_side_id,
    status: draftData.status || DRAFT_STATUS.DRAFT_LOCAL,
    currentStep: draftData.currentStep || 1,
    evidenceList: normalizedEvidence,
    selectedCategory: draftData.selectedCategory || null,
    description: draftData.description || '',
    customLocation: draftData.customLocation || null,
    geolocation: draftData.geolocation || null,
    address: draftData.address || '',
    // La imagen almacenada localmente NO se considera procesada ni anonimizada por el backend
    isProcessedByBackend: false,
    createdAt: draftData.createdAt || now,
    updatedAt: now,
  };

  // Si IndexedDB está disponible, persistimos en la base de datos del navegador
  if (isIndexedDBAvailable()) {
    try {
      // Abrimos la conexión
      const db = await openDatabase();

      // Retornamos una promesa para la transacción de escritura
      return new Promise((resolve, reject) => {
        // Iniciamos una transacción de lectura y escritura (readwrite) en el almacén de borradores
        const transaction = db.transaction([STORE_DRAFTS], 'readwrite');
        // Obtenemos el object store
        const store = transaction.objectStore(STORE_DRAFTS);
        // Insertamos o actualizamos (put) el registro
        const putRequest = store.put(recordToSave);

        // Al finalizar la operación de guardado
        putRequest.onsuccess = () => {
          resolve(recordToSave);
        };

        // Si ocurre un error al escribir el registro
        putRequest.onerror = (e) => {
          reject(e.target.error);
        };
      });
    } catch (err) {
      // Si falla IndexedDB, usamos el almacén en memoria como salvaguarda
      inMemoryFallbackStore.set(client_side_id, recordToSave);
      return recordToSave;
    }
  } else {
    // Si no hay IndexedDB, guardamos en la memoria de respaldo
    inMemoryFallbackStore.set(client_side_id, recordToSave);
    return recordToSave;
  }
};

/**
 * Obtiene un borrador de reporte por su identificador único (client_side_id).
 * @param {string} clientSideId ID único del borrador
 * @returns {Promise<object|null>} Datos del borrador o null si no existe
 */
export const getDraftReport = async (clientSideId) => {
  // Si no se proporcionó identificador, retornamos null
  if (!clientSideId) return null;

  // Verificamos si IndexedDB está disponible
  if (isIndexedDBAvailable()) {
    try {
      // Abrimos la base de datos
      const db = await openDatabase();

      // Promesa de lectura
      return new Promise((resolve, reject) => {
        // Transacción en modo de solo lectura (readonly)
        const transaction = db.transaction([STORE_DRAFTS], 'readonly');
        const store = transaction.objectStore(STORE_DRAFTS);
        // Solicitamos el registro por clave primaria
        const getRequest = store.get(clientSideId);

        // Al completarse la lectura
        getRequest.onsuccess = (event) => {
          resolve(event.target.result || null);
        };

        // En caso de error
        getRequest.onerror = (event) => {
          reject(event.target.error);
        };
      });
    } catch (err) {
      // En caso de error consultamos el almacén en memoria
      return inMemoryFallbackStore.get(clientSideId) || null;
    }
  }

  // Si no hay IndexedDB, buscamos en memoria
  return inMemoryFallbackStore.get(clientSideId) || null;
};

/**
 * Obtiene el borrador activo más reciente que aún no haya sido enviado ni cerrado.
 * Útil para restaurar la sesión ante recarga de página o navegación accidental.
 * @returns {Promise<object|null>} Borrador activo más reciente o null
 */
export const getActiveDraftReport = async () => {
  // Si IndexedDB está disponible
  if (isIndexedDBAvailable()) {
    try {
      const db = await openDatabase();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_DRAFTS], 'readonly');
        const store = transaction.objectStore(STORE_DRAFTS);
        // Utilizamos el índice de updatedAt en orden descendente (prev) mediante un cursor
        const index = store.index('by_updatedAt');
        const cursorRequest = index.openCursor(null, 'prev');

        cursorRequest.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const draft = cursor.value;
            // Retornamos el primer borrador no sincronizado encontrado
            if (draft.status === DRAFT_STATUS.DRAFT_LOCAL || draft.status === DRAFT_STATUS.PENDING_SYNC) {
              return resolve(draft);
            }
            cursor.continue();
          } else {
            // No se encontraron borradores pendientes
            resolve(null);
          }
        };

        cursorRequest.onerror = (event) => {
          reject(event.target.error);
        };
      });
    } catch (err) {
      // Fallback a memoria
      const drafts = Array.from(inMemoryFallbackStore.values())
        .filter((d) => d.status === DRAFT_STATUS.DRAFT_LOCAL || d.status === DRAFT_STATUS.PENDING_SYNC)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      return drafts[0] || null;
    }
  }

  // Búsqueda en memoria
  const drafts = Array.from(inMemoryFallbackStore.values())
    .filter((d) => d.status === DRAFT_STATUS.DRAFT_LOCAL || d.status === DRAFT_STATUS.PENDING_SYNC)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return drafts[0] || null;
};

/**
 * Marca un borrador y todas sus evidencias fotográficas con el estado explícito PENDING_SYNC.
 * Se invoca ante pérdida de conectividad o falla en la transmisión online.
 * @param {string} clientSideId ID único del borrador
 * @returns {Promise<object|null>} Borrador actualizado con estado PENDING_SYNC
 */
export const markDraftPendingSync = async (clientSideId) => {
  // Obtenemos el borrador actual
  const existingDraft = await getDraftReport(clientSideId);
  if (!existingDraft) return null;

  // Actualizamos el estado del reporte a PENDING_SYNC
  existingDraft.status = DRAFT_STATUS.PENDING_SYNC;

  // Actualizamos el estado de cada evidencia en la lista a PENDING_SYNC
  if (Array.isArray(existingDraft.evidenceList)) {
    existingDraft.evidenceList = existingDraft.evidenceList.map((ev) => ({
      ...ev,
      status: EVIDENCE_STATUS.PENDING_SYNC,
    }));
  }

  // Guardamos el registro con su nuevo estado
  return await saveDraftReport(existingDraft);
};

/**
 * Elimina un borrador de reporte de IndexedDB.
 * Se ejecuta cuando el usuario cancela voluntariamente el flujo o cuando
 * el backend confirma la sincronización y anonimización de la evidencia (REP-2404).
 * @param {string} clientSideId ID único del borrador a eliminar
 * @returns {Promise<boolean>} True si fue eliminado exitosamente
 */
export const deleteDraftReport = async (clientSideId) => {
  // Si no se proporcionó identificador, retornamos false
  if (!clientSideId) return false;

  // Eliminamos del almacén en memoria
  inMemoryFallbackStore.delete(clientSideId);

  // Si IndexedDB está disponible, procedemos a borrar del almacén local
  if (isIndexedDBAvailable()) {
    try {
      const db = await openDatabase();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_DRAFTS], 'readwrite');
        const store = transaction.objectStore(STORE_DRAFTS);
        const deleteRequest = store.delete(clientSideId);

        deleteRequest.onsuccess = () => {
          resolve(true);
        };

        deleteRequest.onerror = (event) => {
          reject(event.target.error);
        };
      });
    } catch (err) {
      return true;
    }
  }

  return true;
};

/**
 * Obtiene todos los borradores almacenados localmente que se encuentran en estado PENDING_SYNC.
 * @returns {Promise<Array<object>>} Lista de borradores pendientes de sincronización
 */
export const getAllPendingSyncReports = async () => {
  if (isIndexedDBAvailable()) {
    try {
      const db = await openDatabase();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_DRAFTS], 'readonly');
        const store = transaction.objectStore(STORE_DRAFTS);
        const index = store.index('by_status');
        // Consultamos todos los registros cuyo estado sea exactamente PENDING_SYNC
        const getRequest = index.getAll(DRAFT_STATUS.PENDING_SYNC);

        getRequest.onsuccess = (event) => {
          resolve(event.target.result || []);
        };

        getRequest.onerror = (event) => {
          reject(event.target.error);
        };
      });
    } catch (err) {
      return Array.from(inMemoryFallbackStore.values()).filter(
        (d) => d.status === DRAFT_STATUS.PENDING_SYNC
      );
    }
  }

  return Array.from(inMemoryFallbackStore.values()).filter(
    (d) => d.status === DRAFT_STATUS.PENDING_SYNC
  );
};

/**
 * Limpia todos los borradores de IndexedDB (utilidad para tests y reseteo).
 * @returns {Promise<boolean>} True al finalizar la limpieza
 */
export const clearAllDrafts = async () => {
  inMemoryFallbackStore.clear();

  if (isIndexedDBAvailable()) {
    try {
      const db = await openDatabase();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_DRAFTS], 'readwrite');
        const store = transaction.objectStore(STORE_DRAFTS);
        const clearRequest = store.clear();

        clearRequest.onsuccess = () => {
          resolve(true);
        };

        clearRequest.onerror = (event) => {
          reject(event.target.error);
        };
      });
    } catch (err) {
      return true;
    }
  }

  return true;
};
