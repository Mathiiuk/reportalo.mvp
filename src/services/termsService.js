// Servicio de Gestión y Auditoría de Consentimiento de Términos y Privacidad (REP-3532)

export const CURRENT_TERMS_VERSION = '1.2';
export const TERMS_EFFECTIVE_DATE = '08/2026';
export const TERMS_STORAGE_KEY = 'reportalo_terms_consent';

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
