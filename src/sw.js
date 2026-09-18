import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';

// Limpiar cachés antiguos (incluyendo los manuales anteriores)
cleanupOutdatedCaches();
clientsClaim();

// Toma el control inmediato sin esperar
self.skipWaiting();

precacheAndRoute(self.__WB_MANIFEST || []);


// =========================================================================
// Fallback de Navegación para SPA (Single Page Application) Offline
// =========================================================================
try {
  // Redirigir todas las peticiones de navegación al index.html precacheado
  const handler = createHandlerBoundToURL('/index.html');
  const navigationRoute = new NavigationRoute(handler, {
    denylist: [
      /^\/_\//,
      /\/[^/?]+\.[^/]+$/,
    ],
  });
  registerRoute(navigationRoute);
} catch (error) {
  console.warn('[SW] Error configurando fallback de navegación', error);
}


// =========================================================================
// Evento de Notificación Push en segundo plano (Web Push API) - Mantenido de Fase 0
// =========================================================================
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


