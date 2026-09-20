import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getUserCoordinates,
  getGeolocationPermissionState,
  LOCATION_STATUS,
  DEFAULT_CITY_COORDINATES,
} from '../services/locationService';

/**
 * Hook de React para acceder reactivamente a la geolocalización del navegador (REP-2302).
 * @param {object} [options]
 * @param {boolean} [options.autoFetch=true] Si debe solicitar ubicación al montar
 * @returns {object} Estado reactivo de la ubicación y método refreshLocation
 */
export const useGeolocation = ({ autoFetch = true } = {}) => {
  const [coordinates, setCoordinates] = useState(DEFAULT_CITY_COORDINATES);
  const [accuracy, setAccuracy] = useState(null);
  const [status, setStatus] = useState(LOCATION_STATUS.PENDING);
  const [permissionState, setPermissionState] = useState('prompt');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Evita actualizar estado si el refinamiento llega después de desmontar.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Consultar estado de permiso y posición
  const fetchLocation = useCallback(async (customOptions = {}) => {
    setIsLoading(true);
    setError(null);

    // Consultar estado proactivo de permisos si está disponible
    const perm = await getGeolocationPermissionState();
    if (mountedRef.current) setPermissionState(perm);

    // 1ª etapa: fijación rápida y aproximada. Desbloquea la pantalla enseguida.
    const result = await getUserCoordinates(customOptions);
    if (!mountedRef.current) return result;

    setIsLoading(false);
    setStatus(result.status);
    setCoordinates(result.coordinates);

    if (result.status === LOCATION_STATUS.GRANTED) {
      setAccuracy(result.accuracy ?? null);
      setError(null);

      // 2ª etapa: refinamiento de alta precisión en segundo plano. No bloquea
      // nada: si llega, mejora las coordenadas; si falla o tarda, la lectura
      // aproximada ya sirvió. Solo se pide cuando quien llama no fijó la
      // precisión a mano, para no duplicar pedidos.
      if (customOptions.enableHighAccuracy === undefined) {
        getUserCoordinates({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
          .then((fine) => {
            if (!mountedRef.current) return;
            if (fine.status === LOCATION_STATUS.GRANTED) {
              setCoordinates(fine.coordinates);
              setAccuracy(fine.accuracy ?? null);
            }
          })
          .catch(() => {
            // El refinamiento es opcional: su fallo no degrada nada.
          });
      }
    } else {
      setError(result.error || 'No se pudo obtener la ubicación.');
    }

    return result;
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchLocation();
    }
  }, [autoFetch, fetchLocation]);

  return {
    coordinates,
    accuracy,
    status,
    permissionState,
    isLoading,
    error,
    isGranted: status === LOCATION_STATUS.GRANTED,
    isDenied: status === LOCATION_STATUS.DENIED,
    refreshLocation: fetchLocation,
  };
};
