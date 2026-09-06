/**
 * @file useNetworkStatus.js
 * @description Hook reactivo para detectar el estado de conexión a internet (online / offline)
 * y reaccionar a cambios de conectividad en tiempo real (REP-2703).
 */

import { useState, useEffect } from 'react';

/**
 * Hook para monitorear el estado de red del navegador.
 * @returns {object} { isOnline, wasOffline }
 */
export const useNetworkStatus = () => {
  // Inicializamos el estado con el valor actual de navigator.onLine (por defecto true si no está definido)
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true
  );

  // Bandera para identificar si el usuario estuvo offline y acaba de reconectarse
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // Si no estamos en un entorno con objeto window (SSR), no ejecutamos listeners
    if (typeof window === 'undefined') return;

    // Manejador del evento cuando se recupera la conexión
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
    };

    // Manejador del evento cuando se interrumpe la conexión
    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    // Suscribimos los escuchadores de eventos globales en window
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Limpieza de los escuchadores al desmontar el hook
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    wasOffline,
  };
};

export default useNetworkStatus;
