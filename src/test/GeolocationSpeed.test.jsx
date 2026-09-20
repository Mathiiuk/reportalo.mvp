/**
 * @file GeolocationSpeed.test.jsx
 * @description Pruebas de la estrategia de dos etapas de geolocalizacion:
 * fijacion rapida aproximada primero, refinamiento de alta precision despues.
 *
 * Motivo del cambio: con enableHighAccuracy por defecto, en escritorio la
 * lectura fallaba y recien a los 8s caia a DEFAULT_CITY_COORDINATES, dejando
 * al ciudadano esperando y sin localidad preseleccionada.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { getUserCoordinates, LOCATION_STATUS, DEFAULT_CITY_COORDINATES } from '../services/locationService';
import { useGeolocation } from '../hooks/useGeolocation';

const COARSE = { coords: { longitude: -58.4436, latitude: -34.6187, accuracy: 800 } };
const FINE = { coords: { longitude: -58.4440, latitude: -34.6190, accuracy: 10 } };

describe('REP-2500-PRESEL: geolocalizacion en dos etapas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete global.navigator.geolocation;
  });

  it('UT-GEO-01: la primera lectura no exige alta precision', async () => {
    const getCurrentPosition = vi.fn((success) => success(COARSE));
    global.navigator.geolocation = { getCurrentPosition };

    await getUserCoordinates();

    const options = getCurrentPosition.mock.calls[0][2];
    expect(options.enableHighAccuracy).toBe(false);
    // Y no espera 8 segundos antes de rendirse.
    expect(options.timeout).toBeLessThanOrEqual(5000);
  });

  it('UT-GEO-02: quien pida alta precision explicitamente la sigue obteniendo', async () => {
    const getCurrentPosition = vi.fn((success) => success(FINE));
    global.navigator.geolocation = { getCurrentPosition };

    await getUserCoordinates({ enableHighAccuracy: true });

    expect(getCurrentPosition.mock.calls[0][2].enableHighAccuracy).toBe(true);
  });

  it('UT-GEO-03: el hook entrega la lectura rapida y luego refina con la fina', async () => {
    let call = 0;
    global.navigator.geolocation = {
      getCurrentPosition: vi.fn((success) => {
        call += 1;
        success(call === 1 ? COARSE : FINE);
      }),
    };

    const { result } = renderHook(() => useGeolocation({ autoFetch: true }));

    // Primero la aproximada: la pantalla ya es usable.
    await waitFor(() => expect(result.current.isGranted).toBe(true));
    // Despues el refinamiento mejora la precision sin intervencion del usuario.
    await waitFor(() => expect(result.current.accuracy).toBe(10));
    expect(result.current.coordinates).toEqual([-58.4440, -34.6190]);
  });

  it('UT-GEO-04: si el refinamiento falla, la lectura aproximada se conserva', async () => {
    let call = 0;
    global.navigator.geolocation = {
      getCurrentPosition: vi.fn((success, error) => {
        call += 1;
        if (call === 1) return success(COARSE);
        return error({ code: 3, message: 'timeout' });
      }),
    };

    const { result } = renderHook(() => useGeolocation({ autoFetch: true }));

    await waitFor(() => expect(result.current.isGranted).toBe(true));
    expect(result.current.coordinates).toEqual([-58.4436, -34.6187]);
  });

  it('UT-GEO-05: sin permiso no hay lectura real y quedan las coordenadas de respaldo', async () => {
    global.navigator.geolocation = {
      getCurrentPosition: vi.fn((success, error) => error({ code: 1, message: 'denied' })),
    };

    const { result } = renderHook(() => useGeolocation({ autoFetch: true }));

    await waitFor(() => expect(result.current.status).toBe(LOCATION_STATUS.DENIED));
    // isGranted en false es lo que impide preseleccionar una localidad desde
    // una ubicacion que en realidad es el centro de CABA por defecto.
    expect(result.current.isGranted).toBe(false);
    expect(result.current.coordinates).toEqual(DEFAULT_CITY_COORDINATES);
  });
});
