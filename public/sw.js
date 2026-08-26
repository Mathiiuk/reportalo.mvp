// Service Worker para Reportalo MVP (Optimizado para no interceptar módulos Vite ni HMR en desarrollo)

const CACHE_NAME = 'reportalo-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// En desarrollo o peticiones locales, delegar 100% a la red sin interceptar
self.addEventListener('fetch', (event) => {
  // Dejar que el navegador y Vite gestionen las solicitudes directamente
  return;
});
