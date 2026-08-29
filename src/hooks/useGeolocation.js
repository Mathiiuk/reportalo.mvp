import { useState, useEffect, useCallback } from 'react';
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

  // Consultar estado de permiso y posición
  const fetchLocation = useCallback(async (customOptions = {}) => {
    setIsLoading(true);
    setError(null);

    // Consultar estado proactivo de permisos si está disponible
    const perm = await getGeolocationPermissionState();
    setPermissionState(perm);

    const result = await getUserCoordinates(customOptions);
    setIsLoading(false);
    setStatus(result.status);
    setCoordinates(result.coordinates);

    if (result.status === LOCATION_STATUS.GRANTED) {
      setAccuracy(result.accuracy ?? null);
      setError(null);
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
