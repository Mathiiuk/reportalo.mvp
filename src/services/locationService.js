// Servicio de Detección y Gestión de Ubicación del Ciudadano (REP-2300)

export const DEFAULT_CITY_COORDINATES = [-58.4200, -34.6200]; // Centro CABA / Avellaneda

export const LOCATION_STATUS = {
  PENDING: 'PENDING',
  GRANTED: 'GRANTED',
  DENIED: 'DENIED',
  UNAVAILABLE: 'UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  NOT_SUPPORTED: 'NOT_SUPPORTED',
};

/**
 * Verifica si el navegador soporta la API de Geolocalización.
 * @returns {boolean}
 */
export const isGeolocationSupported = () => {
  return typeof navigator !== 'undefined' && Boolean(navigator.geolocation);
};

/**
 * Obtiene la ubicación geográfica actual del dispositivo.
 * @param {object} [options]
 * @returns {Promise<{ status: string, coordinates: [number, number], accuracy?: number, error?: string }>}
 */
export const getUserCoordinates = (options = {}) => {
  return new Promise((resolve) => {
    if (!isGeolocationSupported()) {
      return resolve({
        status: LOCATION_STATUS.NOT_SUPPORTED,
        coordinates: DEFAULT_CITY_COORDINATES,
        error: 'Tu navegador o dispositivo no soporta geolocalización.',
      });
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 60000,
      ...options,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude, accuracy } = position.coords;
        resolve({
          status: LOCATION_STATUS.GRANTED,
          coordinates: [longitude, latitude],
          accuracy,
        });
      },
      (error) => {
        let status = LOCATION_STATUS.UNAVAILABLE;
        let errorMessage = 'No se pudo obtener la ubicación actual.';

        if (error.code === 1) { // PERMISSION_DENIED
          status = LOCATION_STATUS.DENIED;
          errorMessage = 'Permiso de ubicación denegado.';
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
          status = LOCATION_STATUS.UNAVAILABLE;
          errorMessage = 'Señal de GPS o ubicación no disponible.';
        } else if (error.code === 3) { // TIMEOUT
          status = LOCATION_STATUS.TIMEOUT;
          errorMessage = 'Tiempo de espera agotado al consultar ubicación.';
        }

        resolve({
          status,
          coordinates: DEFAULT_CITY_COORDINATES,
          error: errorMessage,
        });
      },
      defaultOptions
    );
  });
};
