/**
 * @file notificationService.js
 * @description Servicio cliente para gestión de notificaciones web y Web Push en PWA.
 * Administra el ciclo de vida de permisos del navegador, notificaciones locales
 * inmediatas y suscripción a Web Push en segundo plano con Service Worker.
 */

/**
 * Verifica si el navegador actual soporta la API de Notificaciones.
 * @returns {boolean}
 */
export const isNotificationSupported = () => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

/**
 * Verifica si el navegador soporta Service Workers y Web Push Manager.
 * @returns {boolean}
 */
export const isPushSupported = () => {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
};

/**
 * Obtiene el estado actual del permiso de notificaciones en el navegador.
 * @returns {'granted' | 'denied' | 'default' | 'unsupported'}
 */
export const getNotificationPermission = () => {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
};

/**
 * Solicita al usuario permiso para emitir notificaciones en el navegador / PWA.
 * @returns {Promise<'granted' | 'denied' | 'default' | 'unsupported'>}
 */
export const requestNotificationPermission = async () => {
  if (!isNotificationSupported()) {
    console.warn('[Notifications] Notification API no soportada en este entorno.');
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('[Notifications] Error al solicitar permisos de notificación:', err);
    return 'denied';
  }
};

/**
 * Emite una notificación nativa local en el dispositivo del usuario.
 * Intenta utilizar el Service Worker si está activo (óptimo para PWA / Android / iOS),
 * o recurre a la Notification API directa como fallback.
 * 
 * @param {object} options
 * @param {string} options.title Título de la notificación
 * @param {string} options.body Mensaje principal
 * @param {string} [options.icon='/logo-icon.webp'] Ícono de la aplicación
 * @param {string} [options.badge='/logo-icon.webp'] Ícono monocromático para barra de estado
 * @param {string} [options.url='/reportes'] Ruta a abrir al pulsar la notificación
 * @returns {Promise<boolean>} Indica si se pudo emitir la notificación
 */
export const sendLocalNotification = async ({
  title = 'Reportalo',
  body = 'Actualización en tu reporte ciudadano.',
  icon = '/logo-icon.webp',
  badge = '/logo-icon.webp',
  url = '/reportes',
}) => {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  // 1. Intentar mostrar la notificación a través del Service Worker (recomendado PWA)
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(title, {
          body,
          icon,
          badge,
          data: { url },
          vibrate: [100, 50, 100],
        });
        return true;
      }
    } catch (swErr) {
      console.warn('[Notifications] Service worker showNotification falló, usando fallback directo:', swErr);
    }
  }

  // 2. Fallback: Constructor directo de Notification
  try {
    const notification = new Notification(title, {
      body,
      icon,
      badge,
      data: { url },
    });

    notification.onclick = () => {
      window.focus();
      if (typeof window !== 'undefined' && url) {
        window.location.href = url;
      }
      notification.close();
    };

    return true;
  } catch (err) {
    console.error('[Notifications] Error al emitir notificación directa:', err);
    return false;
  }
};
