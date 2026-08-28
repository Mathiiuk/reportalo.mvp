// Servicio de Gestión y Auditoría de Consentimiento de Términos y Privacidad (REP-3532)

export const CURRENT_TERMS_VERSION = '1.3';
export const TERMS_EFFECTIVE_DATE = '09/2026';
export const TERMS_STORAGE_KEY = 'reportalo_terms_consent';
export const TERMS_REJECTION_STORAGE_KEY = 'reportalo_terms_rejection';
export const TERMS_NOTICES_STORAGE_KEY = 'reportalo_terms_notices';

/**
 * Formatea una fecha ISO a formato de fecha 'DD/MM/YYYY'
 * @param {string} [isoString]
 * @returns {string}
 */
export const formatAcceptedDate = (isoString) => {
  if (!isoString) return '14/08/2026';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '14/08/2026';
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  } catch {
    return '14/08/2026';
  }
};

/**
 * Obtiene el estado de actualización si el usuario tiene una versión previa.
 * @param {string} [userId]
 * @returns {object}
 */
export const getTermsUpdateStatus = (userId) => {
  try {
    const record = getTermsRecord(userId);
    if (!record || !record.terms_version || record.terms_version === CURRENT_TERMS_VERSION) {
      return { isOutdated: false, currentVersion: CURRENT_TERMS_VERSION, isBlocked: false };
    }

    let noticesLeft = 2;
    if (typeof window !== 'undefined') {
      const storedNotices = localStorage.getItem(TERMS_NOTICES_STORAGE_KEY);
      if (storedNotices !== null) {
        const parsed = parseInt(storedNotices, 10);
        if (!isNaN(parsed)) noticesLeft = parsed;
      }
    }

    const isBlocked = noticesLeft < 0;
    const isLastNotice = noticesLeft === 0;

    let noticesLeftText = 'quedan 2 avisos';
    if (noticesLeft === 1) {
      noticesLeftText = 'queda 1 aviso';
    } else if (isLastNotice) {
      noticesLeftText = 'último aviso';
    } else if (isBlocked) {
      noticesLeftText = 'bloqueado';
    }

    return {
      isOutdated: true,
      currentVersion: CURRENT_TERMS_VERSION,
      previousVersion: record.terms_version || '1.2',
      acceptedDate: formatAcceptedDate(record.accepted_at),
      noticesLeftCount: noticesLeft,
      noticesLeftText,
      isLastNotice,
      isBlocked,
    };
  } catch (e) {
    console.warn('[termsService getTermsUpdateStatus error]:', e);
    return { isOutdated: false, currentVersion: CURRENT_TERMS_VERSION, isBlocked: false };
  }
};

/**
 * Registra la postergación de la actualización reduciendo los avisos restantes.
 * @param {string} [userId]
 * @returns {number} Avisos restantes
 */
export const postponeTermsUpdate = (userId) => {
  try {
    const currentStatus = getTermsUpdateStatus(userId);
    const newCount = currentStatus.noticesLeftCount - 1;
    if (typeof window !== 'undefined') {
      localStorage.setItem(TERMS_NOTICES_STORAGE_KEY, String(newCount));
    }
    return newCount;
  } catch (e) {
    console.warn('[termsService postponeTermsUpdate error]:', e);
    return -1;
  }
};

/**
 * Verifica si el usuario tiene bloqueado el uso de la app por agotar las prórrogas.
 * @param {string} [userId]
 * @returns {boolean}
 */
export const isTermsConsentBlocked = (userId) => {
  const status = getTermsUpdateStatus(userId);
  return Boolean(status.isBlocked);
};

/**
 * Formatea una fecha ISO a formato local 'DD/MM/YYYY a las H:MM'
 * @param {string} [isoString]
 * @returns {string}
 */
export const formatRejectionDate = (isoString) => {
  const date = isoString ? new Date(isoString) : new Date();
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const h = date.getHours();
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${d}/${m}/${y} a las ${h}:${min}`;
};

/**
 * Obtiene el registro de rechazo de términos de un usuario.
 * @param {string} [userId]
 * @returns {object|null}
 */
export const getTermsRejectionRecord = (userId) => {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(TERMS_REJECTION_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (userId && data.userId && data.userId !== userId) {
      return null;
    }
    return data;
  } catch (e) {
    console.warn('[termsService getTermsRejectionRecord error]:', e);
    return null;
  }
};

/**
 * Registra el rechazo de los términos vigentes.
 * @param {string} [userId]
 * @returns {object} Registro de rechazo guardado
 */
export const recordTermsRejection = (userId) => {
  const rejectionRecord = {
    userId: userId || 'auth_user',
    terms_version: CURRENT_TERMS_VERSION,
    rejected_at: new Date().toISOString(),
    status: 'rejected',
  };

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TERMS_REJECTION_STORAGE_KEY, JSON.stringify(rejectionRecord));
      localStorage.removeItem(TERMS_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('[termsService recordTermsRejection error]:', e);
  }

  return rejectionRecord;
};

/**
 * Obtiene el registro de consentimiento de un usuario.
 * @param {string} [userId]
 * @returns {object|null}
 */
export const getTermsRecord = (userId) => {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(TERMS_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (userId && data.userId && data.userId !== userId) {
      return null;
    }
    return data;
  } catch (e) {
    console.warn('[termsService getTermsRecord error]:', e);
    return null;
  }
};

/**
 * Verifica si el usuario aceptó la versión vigente actual (v1.2).
 * @param {string} [userId]
 * @returns {boolean}
 */
export const hasAcceptedCurrentTerms = (userId) => {
  const record = getTermsRecord(userId);
  if (!record) return false;
  return Boolean(
    record.terms_version === CURRENT_TERMS_VERSION && record.accepted_at
  );
};

/**
 * Registra de forma auditable y persistente la aceptación de los términos y permisos.
 * @param {string} [userId]
 * @param {object} [permissions]
 * @returns {object} Registro guardado
 */
export const recordTermsAcceptance = (
  userId,
  permissions = { camera: true, location: true }
) => {
  const consentRecord = {
    userId: userId || 'auth_user',
    terms_version: CURRENT_TERMS_VERSION,
    accepted_at: new Date().toISOString(),
    permissions: {
      camera: Boolean(permissions.camera),
      location: Boolean(permissions.location),
    },
  };

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TERMS_STORAGE_KEY, JSON.stringify(consentRecord));
      localStorage.removeItem(TERMS_REJECTION_STORAGE_KEY);
      localStorage.removeItem(TERMS_NOTICES_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('[termsService recordTermsAcceptance error]:', e);
  }

  return consentRecord;
};

/**
 * Texto legal íntegro para el modal de lectura completa.
 */
export const FULL_TERMS_AND_CONDITIONS = `
TÉRMINOS Y CONDICIONES DE USO Y POLÍTICA DE PRIVACIDAD — REPORTALO
Versión 1.2 · Vigente desde Agosto de 2026

1. IDENTIDAD Y FINALIDAD
Reportalo es una plataforma cívica digital diseñada para facilitar el reporte ciudadano y la trazabilidad de reclamos en la vía pública ante los organismos municipales y provinciales competentes.

2. TRATAMIENTO SERVER-SIDE DE IMÁGENES Y ANONIMIZACIÓN IRREVERSIBLE
2.1. Las fotografías capturadas o provistas por el ciudadano son transmitidas de forma cifrada mediante protocolos TLS a un entorno seguro de cuarentena.
2.2. En dicho entorno, modelos automatizados de procesamiento de visión artificial aplican difuminado irreversible sobre rostros y patentes vehiculares, asegurando que ninguna persona u objeto privado sea identificable.
2.3. La imagen fotográfica original sin procesar NUNCA es persistida en bases de datos ni almacenada en discos permanentes. Es descartada inmediatamente tras concluir la anonimización. Solo la versión sanitizada y anonimizada es guardada.

3. PRIVACIDAD Y PROTECCIÓN DE DATOS PERSONALES (LEY 25.326)
3.1. En cumplimiento de la Ley Nacional N° 25.326 de Protección de los Datos Personales de la República Argentina, los datos de registro del ciudadano (como correo electrónico) se mantienen bajo estricto secreto.
3.2. La identidad del ciudadano jamás se comparte ni se divulga ante el organismo receptor o terceros al momento de gestionar el reclamo.
3.3. El titular de los datos tiene la facultad de ejercer el derecho de acceso, rectificación, actualización y supresión de sus datos personales.

4. PERMISOS DE DISPOSITIVO (CÁMARA Y GEOLOCALIZACIÓN)
4.1. El permiso de cámara es requerido exclusivamente al momento de capturar la fotografía de la anomalía o incidente.
4.2. El permiso de ubicación es utilizado para georreferenciar con precisión el lugar exacto del reporte en el mapa oficial.

5. VIGENCIA Y MODIFICACIONES
Reportalo se reserva el derecho de actualizar los presentes términos. Ante cualquier cambio de versión sustancial, se solicitará un nuevo consentimiento explícito antes de permitir la emisión de nuevos reportes.
`.trim();
