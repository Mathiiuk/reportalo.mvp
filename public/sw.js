// Service Worker para Reportalo MVP (Soporte PWA, Offline y Notificaciones Push)

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
  return;
});

// Evento de Notificación Push en segundo plano (Web Push API)
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {
      body: event.data ? event.data.text() : 'Actualización de tu reporte ciudadano',
    };
  }

  const title = payload.title || 'Reportalo — Estado de tu reporte';
  const options = {
    body: payload.body || 'Hay una novedad en el estado de tu reporte en la vía pública.',
    icon: payload.icon || '/logo-icon.webp',
    badge: payload.badge || '/logo-icon.webp',
    data: { url: payload.url || '/reportes' },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Manejo del clic en la notificación: abre o enfoca la app en la ruta correspondiente
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/reportes';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.navigate) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
