/**
 * Carga diferida de MapLibre.
 *
 * MapLibre pesa ~966 kB (255 kB gzip) y evaluarlo bloqueaba el hilo principal más de un
 * segundo en un teléfono de gama media (Lighthouse mobile: TBT 1030 ms en /mapa, con una
 * tarea larga de 752 ms dentro del bundle de maplibre-gl). Importarlo de forma estática
 * hacía que ese costo cayera antes del primer pintado de la pantalla.
 *
 * Con este cargador la pantalla (cabecera, filtros, barra inferior) se pinta primero y el
 * motor del mapa se baja y se evalúa después. Lo usan CitizenMap y AdjustLocationModal;
 * comparten una sola promesa, así que el motor se pide una única vez.
 */
let maplibrePromise = null;

/**
 * Trae MapLibre (más su worker y su CSS) y deja configurada la URL del worker.
 * Si falla la descarga, se descarta la promesa para que el próximo intento reintente.
 *
 * @returns {Promise<typeof import('maplibre-gl')>} El módulo maplibre-gl
 */
export const loadMapLibre = () => {
  if (!maplibrePromise) {
    maplibrePromise = Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ])
      .then(([maplibre, worker]) => {
        // Configurar URL del Web Worker de MapLibre para Vite
        const workerUrl = worker?.default;
        if (typeof maplibre.setWorkerUrl === 'function' && workerUrl) {
          try {
            maplibre.setWorkerUrl(workerUrl);
          } catch (e) {
            console.warn('[MapLibre Worker Init]:', e);
          }
        }
        return maplibre;
      })
      .catch((error) => {
        maplibrePromise = null;
        throw error;
      });
  }
  return maplibrePromise;
};

/**
 * Ejecuta `callback` cuando el navegador ya pintó el primer cuadro, en una tarea aparte.
 * Sirve para no meter el arranque del mapa en la misma tarea que el render de React.
 *
 * @param {Function} callback Trabajo a diferir
 * @returns {Function} Cancela la ejecución si todavía no ocurrió
 */
export const runAfterFirstPaint = (callback) => {
  let cancelled = false;
  let timerId = null;
  let frameId = null;

  const run = () => {
    timerId = setTimeout(() => {
      if (!cancelled) callback();
    }, 0);
  };

  if (typeof requestAnimationFrame === 'function') {
    frameId = requestAnimationFrame(run);
  } else {
    run();
  }

  return () => {
    cancelled = true;
    if (frameId !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameId);
    if (timerId !== null) clearTimeout(timerId);
  };
};

export default loadMapLibre;
