/**
 * Recarga tras un deploy.
 *
 * Cada pantalla se baja aparte (React.lazy) con un nombre de archivo que cambia en cada versión. Con un deploy nuevo,
 * el service worker se activa solo (skipWaiting + clientsClaim) y borra los archivos de la versión anterior
 * (cleanupOutdatedCaches). Una pestaña que quedó abierta con la versión vieja y entra a otra pantalla pide un archivo
 * que ya no existe: la carga falla y aparecía «Oops, hubo un problema».
 *
 * La salida es recargar **una vez**: el service worker nuevo entrega el index.html nuevo, que apunta a los archivos
 * nuevos. Una marca en sessionStorage evita el bucle si la falla es otra (por ejemplo, sin conexión de verdad).
 */

export const CHUNK_RELOAD_KEY = 'reportalo_chunk_reload_at';
// Si ya se recargó hace menos de esto, la falla no es de versión: se muestra el error
const RELOAD_WINDOW_MS = 30_000;

// Mensajes de Chrome, Firefox y Safari cuando falla la carga de un archivo de la app
const CHUNK_ERROR = /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|is not a valid javascript mime type|chunkloaderror|loading chunk \d+ failed/i;

/** Recarga de la página. Está en un objeto para poder reemplazarla en los tests (jsdom no recarga). */
export const reloader = {
  reload() {
    window.location.reload();
  },
};

/** @returns {boolean} true si el error es de un archivo de la app que no se pudo cargar */
export const isChunkLoadError = (error) => CHUNK_ERROR.test(String(error?.message ?? error ?? ''));

/**
 * Recarga una sola vez por ventana de tiempo.
 * @returns {boolean} true si recargó; false si ya había recargado hace poco o no puede guardar la marca
 */
export const reloadOnceForNewVersion = ({
  storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
  now = Date.now(),
  reload = () => reloader.reload(),
} = {}) => {
  if (!storage) return false;
  let last = 0;
  try {
    last = Number(storage.getItem(CHUNK_RELOAD_KEY)) || 0;
  } catch {
    return false;
  }
  if (last && now - last < RELOAD_WINDOW_MS) return false;
  try {
    storage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    // Sin poder guardar la marca no se sabría si ya se recargó: mejor mostrar el error que entrar en bucle
    return false;
  }
  reload();
  return true;
};

/**
 * Vite avisa con `vite:preloadError` cuando falla la carga de una pantalla. Si se recarga, se cancela el evento
 * para que el error no llegue a la pantalla.
 */
export const installChunkReloadHandler = (target = typeof window !== 'undefined' ? window : null) => {
  target?.addEventListener('vite:preloadError', (event) => {
    if (reloadOnceForNewVersion()) event.preventDefault();
  });
};
