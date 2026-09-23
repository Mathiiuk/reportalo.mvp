/**
 * Marca local de «había una sesión iniciada» (UJ v3.3 · M23 «Tu sesión venció» — REP-3791 Bloque 4).
 *
 * Permite distinguir una sesión que venció (la marca sigue) de un cierre de sesión voluntario
 * (signOut borra la marca) o de un primer ingreso (no hay marca). Guarda el email para ofrecer
 * «Enviarme un enlace» sin volver a pedirlo, y la pantalla donde estaba para retomarla.
 */
const MARKER_KEY = 'reportalo_session_marker';
const RESUME_KEY = 'reportalo_resume_path';

const safeStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

export const markSessionActive = (email) => {
  const storage = safeStorage();
  if (!storage) return;
  storage.setItem(MARKER_KEY, JSON.stringify({ email: email || null, markedAt: new Date().toISOString() }));
};

export const getSessionMarker = () => {
  const raw = safeStorage()?.getItem(MARKER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const clearSessionMarker = () => {
  safeStorage()?.removeItem(MARKER_KEY);
};

export const saveResumePath = (path) => {
  if (path) safeStorage()?.setItem(RESUME_KEY, path);
};

// Se lee sin borrar (los renders dobles de StrictMode no la pierden) y se borra al llegar
export const getResumePath = () => safeStorage()?.getItem(RESUME_KEY) || null;

export const clearResumePath = () => {
  safeStorage()?.removeItem(RESUME_KEY);
};
