/**
 * Estados del ciclo de vida de la evidencia fotográfica.
 * CAPTURED_LOCAL -> PENDING_SYNC -> UPLOADING -> PROCESSING_PRIVACY -> READY
 */
export const EVIDENCE_STATUS = {
  CAPTURED_LOCAL: 'CAPTURED_LOCAL', // Foto tomada/seleccionada en el cliente
  PENDING_SYNC: 'PENDING_SYNC',     // Guardada localmente para sincronización (Sprint 11)
  UPLOADING: 'UPLOADING',           // En proceso de subida segura al backend
  PROCESSING_PRIVACY: 'PROCESSING_PRIVACY', // Vision + Sharp + EXIF en backend
  READY: 'READY',                   // Anonimizada y lista para visualización/persistencia
};

/**
 * Tipos MIME admitidos para captura de evidencia ciudadana.
 */
export const ALLOWED_EVIDENCE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

/**
 * Tamaño máximo permitido para captura en cliente (10MB).
 */
export const MAX_EVIDENCE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Factory para instanciar un objeto de evidencia desacoplado (REP-2201).
 * @param {File|Blob} file Objeto File o Blob obtenido desde cámara o galería
 * @param {object} [geolocation] Coordenadas GPS del momento de captura { lat, lng, accuracy }
 * @returns {object} EvidenceItem normalizado
 */
export const createEvidenceItem = (file, geolocation = null) => {
  if (!file) {
    throw new Error('Se requiere un archivo de imagen para generar la evidencia.');
  }

  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `evd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const previewUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
    ? URL.createObjectURL(file)
    : '';

  return {
    id,
    file,
    name: file.name || `evidencia-${Date.now()}.jpg`,
    mimeType: file.type || 'image/jpeg',
    sizeBytes: file.size || 0,
    capturedAt: new Date().toISOString(),
    status: EVIDENCE_STATUS.CAPTURED_LOCAL,
    previewUrl,
    geolocation: geolocation
      ? {
          lat: geolocation.lat ?? geolocation.latitude ?? null,
          lng: geolocation.lng ?? geolocation.longitude ?? null,
          accuracy: geolocation.accuracy ?? null,
        }
      : null,
  };
};
