import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

export const usePwaUpdate = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (import.meta.env.DEV) {
        console.log('[PWA] Service Worker registrado:', r);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Error al registrar Service Worker:', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      toast.info('Nueva versión disponible', {
        description: 'Actualiza para obtener las últimas mejoras y funciones.',
        duration: Infinity,
        position: 'bottom-center',
        action: {
          label: 'Actualizar',
          onClick: () => updateServiceWorker(true),
        },
        onDismiss: () => setNeedRefresh(false),
      });
    }
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return { needRefresh, updateServiceWorker };
};
