import { useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { syncPendingReports } from '../../services/pendingSyncService';

// Evento global para que la pantalla de pendientes se actualice después de un envío en segundo plano
export const PENDING_SYNC_EVENT = 'reportalo:pending-sync';

/**
 * Envío automático de la cola offline (UJ v3.3 · M20: «se envían solos al volver»).
 * Se monta una vez en App: corre al abrir la app con conexión y cada vez que vuelve la conexión.
 * No dibuja nada; avisa con un toast cuando se envió algo.
 */
export const PendingSyncManager = () => {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    if (!user?.id || !isOnline) return undefined;
    let cancelled = false;
    syncPendingReports({ userId: user.id }).then((result) => {
      if (cancelled || !result) return;
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
  }, [user?.id, isOnline]);

  return null;
};

export default PendingSyncManager;
