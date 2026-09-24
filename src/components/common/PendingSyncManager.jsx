import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { syncPendingReports } from '../../services/pendingSyncService';

// Evento global para que la pantalla de pendientes se actualice después de un envío en segundo plano
export const PENDING_SYNC_EVENT = 'reportalo:pending-sync';

// Evento que dispara el flujo de reporte cuando deja uno en la cola por falta de señal
export const PENDING_QUEUED_EVENT = 'reportalo:pending-queued';

// Cada cuánto se reintenta la cola mientras queden pendientes. Con señal débil el teléfono nunca
// pasa por «offline», así que esperar el evento de reconexión no alcanza.
export const PENDING_RETRY_INTERVAL_MS = 60000;

/**
 * Envío automático de la cola offline (UJ v3.3 · M20: «se envían solos al volver»).
 * Se monta una vez en App: corre al abrir la app con conexión, cada vez que vuelve la conexión,
 * al volver a la app desde otra y cada minuto mientras queden pendientes.
 * No dibuja nada; avisa con un toast cuando se envió algo.
 */
export const PendingSyncManager = () => {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  // Cada cambio dispara un nuevo intento de envío
  const [attempt, setAttempt] = useState(0);
  // Si el último intento dejó reportes en la cola, se programa el siguiente
  const [hasRemaining, setHasRemaining] = useState(false);

  useEffect(() => {
    if (!user?.id || !isOnline) return undefined;
    let cancelled = false;
    syncPendingReports({ userId: user.id }).then((result) => {
      if (cancelled || !result) return;
      setHasRemaining(result.remaining > 0);
      if (result.sent > 0) {
        toast.success(result.sent === 1 ? 'Se envió 1 reporte pendiente' : `Se enviaron ${result.sent} reportes pendientes`);
      }
      if (result.sent > 0 || result.failed > 0) {
        window.dispatchEvent(new Event(PENDING_SYNC_EVENT));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, isOnline, attempt]);

  // Reintento periódico mientras quede algo en la cola
  useEffect(() => {
    if (!user?.id || !isOnline || !hasRemaining) return undefined;
    const timer = setInterval(() => setAttempt((n) => n + 1), PENDING_RETRY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [user?.id, isOnline, hasRemaining]);

  // Al volver a la app (por ejemplo, después de sacar la foto y salir), se reintenta enseguida.
  // Si un reporte recién entró a la cola, se arranca el reintento periódico (sin reintentar ya:
  // la señal acaba de fallar).
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') setAttempt((n) => n + 1);
    };
    const handleQueued = () => setHasRemaining(true);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener(PENDING_QUEUED_EVENT, handleQueued);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener(PENDING_QUEUED_EVENT, handleQueued);
    };
  }, []);

  return null;
};

export default PendingSyncManager;
