/**
 * @file useUnreadNotifications.js
 * @description Cantidad de notificaciones sin leer para el contador de la campana (REP-3798 · H-40).
 *
 * Antes la campana mostraba un «2» fijo. El dato real ya lo calcula `getMyNotifications` (cambios de
 * estado de los reportes del ciudadano y borradores sin enviar, contra lo leído guardado en el
 * dispositivo). Este hook lo comparte entre las dos campanas que hay en el DOM (teléfono y
 * escritorio) para no hacer dos consultas por pantalla.
 */
import { useEffect, useState } from 'react';
import { getMyNotifications, NOTIFICATIONS_READ_EVENT } from '../services/notificationsService';

// Mismos nombres que PENDING_SYNC_EVENT y PENDING_QUEUED_EVENT de PendingSyncManager. Se repiten acá a
// propósito: importar ese componente arrastraría el envío de pendientes a cada pantalla con campana.
const PENDING_SYNC_EVENT = 'reportalo:pending-sync';
const PENDING_QUEUED_EVENT = 'reportalo:pending-queued';

// Mientras el dato es reciente no se vuelve a pedir: cada pantalla con pestañas monta la campana de nuevo
const MIN_REFRESH_MS = 15000;

let cache = { userId: null, count: 0, fetchedAt: 0 };
let inFlight = null;
const listeners = new Set();

const publish = (count) => {
  cache = { ...cache, count };
  listeners.forEach((listener) => listener(count));
};

/**
 * Pide el conteo real. Nunca lanza: ante cualquier error el contador queda como estaba.
 * @param {string|undefined} userId Usuario en sesión
 * @param {{ force?: boolean }} [options] force ignora el dato reciente
 */
export const refreshUnreadCount = async (userId, { force = false } = {}) => {
  if (!userId) {
    cache = { userId: null, count: 0, fetchedAt: 0 };
    listeners.forEach((listener) => listener(0));
    return;
  }
  const isFresh = cache.userId === userId && Date.now() - cache.fetchedAt < MIN_REFRESH_MS;
  if (!force && isFresh) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { unreadCount } = await getMyNotifications(userId);
      cache = { userId, count: unreadCount, fetchedAt: Date.now() };
      listeners.forEach((listener) => listener(unreadCount));
    } catch {
      // Sin red o sin acceso: el contador se queda como estaba
    }
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
};

/** Solo para tests: vuelve el dato compartido a cero. */
export const resetUnreadCountCache = () => {
  cache = { userId: null, count: 0, fetchedAt: 0 };
  inFlight = null;
};

/**
 * @param {string|undefined} userId Usuario en sesión
 * @returns {number} Cantidad de notificaciones sin leer (0 si no hay sesión)
 */
export const useUnreadNotifications = (userId) => {
  const [count, setCount] = useState(() => (cache.userId === userId ? cache.count : 0));

  useEffect(() => {
    listeners.add(setCount);
    return () => listeners.delete(setCount);
  }, []);

  useEffect(() => {
    refreshUnreadCount(userId);
    // Se vuelve a pedir al marcar como leídas y al volver a la pestaña del navegador
    const onRead = () => refreshUnreadCount(userId, { force: true });
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshUnreadCount(userId);
    };
    // Un borrador que entra o sale de la cola de pendientes cambia el conteo
    const onQueue = () => refreshUnreadCount(userId, { force: true });
    window.addEventListener(NOTIFICATIONS_READ_EVENT, onRead);
    window.addEventListener(PENDING_SYNC_EVENT, onQueue);
    window.addEventListener(PENDING_QUEUED_EVENT, onQueue);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(NOTIFICATIONS_READ_EVENT, onRead);
      window.removeEventListener(PENDING_SYNC_EVENT, onQueue);
      window.removeEventListener(PENDING_QUEUED_EVENT, onQueue);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

  return userId ? count : 0;
};

export default useUnreadNotifications;
