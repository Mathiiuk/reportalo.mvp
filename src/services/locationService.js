/**
 * Servicio de Detección, Gestión de Permisos y Geolocalización del Navegador (REP-2302 / REP-2300)
 *
 * NOTA ARQUITECTÓNICA OBLIGATORIA (Anti-EXIF Rule):
 * En cumplimiento con los requerimientos técnicos y la Ley Nacional 25.326 de Protección de Datos Personales,
 * la ubicación funcional de Reportalo se obtiene de forma exclusiva mediante la API de Geolocalización del
 * navegador/dispositivo del usuario (GPS/Red). NUNCA se extraen ni utilizan metadatos EXIF de fotografías
 * como fuente de ubicación funcional.
 */

export const DEFAULT_CITY_COORDINATES = [-58.4200, -34.6200]; // Centro CABA / Avellaneda

// Bounding Box oficial para limitar las operaciones a CABA y Avellaneda
// [[lngMin, latMin], [lngMax, latMax]]
export const CABA_AVELLANEDA_BOUNDS = [
  [-58.5500, -34.7300], // Sudoeste: límite Gral. Paz / Liniers y Sur de Avellaneda / Wilde
  [-58.3100, -34.5200], // Noreste: Río de la Plata, Nuñez y Costanera Avellaneda
];

/**
 * Valida si un punto geográfico se encuentra dentro de los límites de CABA o Avellaneda.
 * @param {[number, number] | { lat: number, lng: number } | null} coords
 * @returns {boolean}
 */
export const isCoordinatesInBounds = (coords) => {
  let lng, lat;
  if (Array.isArray(coords)) {
    [lng, lat] = coords;
  } else if (coords && typeof coords === 'object') {
    lat = coords.lat ?? coords.latitude;
    lng = coords.lng ?? coords.longitude;
  }
  if (typeof lat !== 'number' || typeof lng !== 'number') return true;
  return (
    lng >= CABA_AVELLANEDA_BOUNDS[0][0] &&
    lng <= CABA_AVELLANEDA_BOUNDS[1][0] &&
    lat >= CABA_AVELLANEDA_BOUNDS[0][1] &&
    lat <= CABA_AVELLANEDA_BOUNDS[1][1]
  );
};

export const LOCATION_STATUS = {
  PENDING: 'PENDING',
  GRANTED: 'GRANTED',
  DENIED: 'DENIED',
  UNAVAILABLE: 'UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  NOT_SUPPORTED: 'NOT_SUPPORTED',
};

/**
 * Verifica si el entorno del navegador soporta la API de Geolocalización.
 * @returns {boolean}
 */
export const isGeolocationSupported = () => {
  return typeof navigator !== 'undefined' && Boolean(navigator.geolocation);
};

/**
 * Consulta proactivamente el estado del permiso de geolocalización mediante la Permissions API.
 * @returns {Promise<'granted' | 'denied' | 'prompt' | 'unsupported'>}
 */
export const getGeolocationPermissionState = async () => {
  if (
    typeof navigator === 'undefined' ||
    !navigator.permissions ||
    typeof navigator.permissions.query !== 'function'
  ) {
    return 'prompt';
  }

  try {
    const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
    return permissionStatus.state || 'prompt';
  } catch (err) {
    console.warn('[locationService getGeolocationPermissionState warning]:', err);
    return 'prompt';
  }
};

/**
 * Obtiene la ubicación geográfica actual del dispositivo mediante la Geolocation API del navegador.
 * @param {object} [options] Opciones de PositionOptions
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

/**
 * Suscribe un observador a cambios continuos de posición geográfica del dispositivo.
 * @param {(position: { coordinates: [number, number], accuracy: number }) => void} onSuccess
 * @param {(error: { status: string, error: string }) => void} [onError]
 * @param {object} [options]
 * @returns {number | null} ID del watch para cancelar con navigator.geolocation.clearWatch
 */
export const watchUserCoordinates = (onSuccess, onError, options = {}) => {
  if (!isGeolocationSupported() || typeof navigator.geolocation.watchPosition !== 'function') {
    if (onError) {
      onError({
        status: LOCATION_STATUS.NOT_SUPPORTED,
        error: 'Geolocalización no soportada.',
      });
    }
    return null;
  }

  const defaultOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 30000,
    ...options,
  };

  return navigator.geolocation.watchPosition(
    (pos) => {
      if (onSuccess) {
        onSuccess({
          coordinates: [pos.coords.longitude, pos.coords.latitude],
          accuracy: pos.coords.accuracy,
        });
      }
    },
    (err) => {
      let status = LOCATION_STATUS.UNAVAILABLE;
      if (err.code === 1) status = LOCATION_STATUS.DENIED;
      if (err.code === 3) status = LOCATION_STATUS.TIMEOUT;

      if (onError) {
        onError({
          status,
          error: err.message || 'Error en seguimiento de ubicación.',
        });
      }
    },
    defaultOptions
  );
};

/**
 * Retorna una etiqueta amigable y legible para el ciudadano a partir de coordenadas GPS.
 * @param {[number, number] | { lat: number, lng: number } | null} coords Coordenadas [lng, lat] o {lat, lng}
 * @returns {string} Dirección o coordenadas legibles
 */
export const getFriendlyLocationLabel = (coords) => {
  if (!coords) return 'Ubicación GPS no detectada';

  let lng, lat;
  if (Array.isArray(coords)) {
    [lng, lat] = coords;
  } else if (typeof coords === 'object') {
    lat = coords.lat ?? coords.latitude;
    lng = coords.lng ?? coords.longitude;
  }

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return 'Ubicación GPS no detectada';
  }

  // Si está cerca de las zonas conocidas de CABA / Avellaneda, dar referencia amigable
  const isAvellaneda = lat < -34.645 && lat > -34.730 && lng > -58.410 && lng < -58.330;
  const isCaba = lat >= -34.710 && lat <= -34.530 && lng >= -58.530 && lng <= -58.350;

  const latStr = lat.toFixed(4);
  const lngStr = lng.toFixed(4);

  if (isAvellaneda) {
    return `Avellaneda · GPS (${latStr}, ${lngStr})`;
  } else if (isCaba) {
    return `CABA · GPS (${latStr}, ${lngStr})`;
  }

  return `GPS (${latStr}, ${lngStr})`;
};

/**
 * Describe el punto marcado en el mapa a partir de coordenadas, sin inventar
 * una dirección postal (E-1, REP-2500): Reportalo no hace geocodificación
 * inversa, así que no puede saber la calle real de ese punto. La localidad
 * real la elige el ciudadano mediante el selector manual (LocalitySelector,
 * R-1 a R-5) — este helper solo describe el pin del mapa.
 * @param {[number, number] | { lat: number, lng: number } | null} coords
 * @returns {{ street: string, locality: string, accuracy: number, fullLabel: string }}
 */
export const resolveAddressDetails = (coords) => {
  let lat, lng;
  if (Array.isArray(coords)) {
    [lng, lat] = coords;
  } else if (coords && typeof coords === 'object') {
    lat = coords.lat ?? coords.latitude;
    lng = coords.lng ?? coords.longitude;
  }

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return {
      street: 'Punto marcado en el mapa',
      locality: 'Seleccioná la localidad debajo',
      accuracy: 10,
      fullLabel: 'Punto marcado en el mapa',
    };
  }

  const label = `Punto marcado en el mapa (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  return {
    street: label,
    locality: 'Seleccioná la localidad debajo',
    accuracy: 10,
    fullLabel: label,
  };
};
