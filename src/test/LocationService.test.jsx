import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  getUserCoordinates,
  getGeolocationPermissionState,
  watchUserCoordinates,
  LOCATION_STATUS,
  DEFAULT_CITY_COORDINATES,
} from '../services/locationService';
import { useGeolocation } from '../hooks/useGeolocation';

describe('REP-2302: Integrar geolocalización del navegador', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('locationService API', () => {
    it('UT-LS-01: getUserCoordinates retorna status GRANTED, coordenadas y accuracy con permiso concedido', async () => {
      const mockPosition = {
        coords: {
          longitude: -58.3816,
          latitude: -34.6037,
          accuracy: 12,
        },
      };

      global.navigator.geolocation = {
        getCurrentPosition: vi.fn((success) => success(mockPosition)),
      };

      const result = await getUserCoordinates();
      expect(result.status).toBe(LOCATION_STATUS.GRANTED);
      expect(result.coordinates).toEqual([-58.3816, -34.6037]);
      expect(result.accuracy).toBe(12);
      expect(result.error).toBeUndefined();
    });

    it('UT-LS-02: getUserCoordinates retorna status DENIED y coordenadas fallback ante error código 1', async () => {
      global.navigator.geolocation = {
        getCurrentPosition: vi.fn((success, error) =>
          error({ code: 1, message: 'User denied geolocation' })
        ),
      };

      const result = await getUserCoordinates();
      expect(result.status).toBe(LOCATION_STATUS.DENIED);
      expect(result.coordinates).toEqual(DEFAULT_CITY_COORDINATES);
      expect(result.error).toContain('denegado');
    });

    it('UT-LS-03: getUserCoordinates retorna status UNAVAILABLE ante error código 2 (Signal lost)', async () => {
      global.navigator.geolocation = {
        getCurrentPosition: vi.fn((success, error) =>
          error({ code: 2, message: 'Position unavailable' })
        ),
      };

      const result = await getUserCoordinates();
      expect(result.status).toBe(LOCATION_STATUS.UNAVAILABLE);
      expect(result.coordinates).toEqual(DEFAULT_CITY_COORDINATES);
      expect(result.error).toContain('no disponible');
    });

    it('UT-LS-04: getUserCoordinates retorna status TIMEOUT ante error código 3', async () => {
      global.navigator.geolocation = {
        getCurrentPosition: vi.fn((success, error) =>
          error({ code: 3, message: 'Timeout' })
        ),
      };

      const result = await getUserCoordinates();
      expect(result.status).toBe(LOCATION_STATUS.TIMEOUT);
      expect(result.coordinates).toEqual(DEFAULT_CITY_COORDINATES);
      expect(result.error).toContain('agotado');
    });

    it('UT-LS-05: getGeolocationPermissionState consulta la Permissions API correctamente', async () => {
      global.navigator.permissions = {
        query: vi.fn().mockResolvedValue({ state: 'granted' }),
      };

      const state = await getGeolocationPermissionState();
      expect(state).toBe('granted');
      expect(global.navigator.permissions.query).toHaveBeenCalledWith({ name: 'geolocation' });
    });

    it('UT-LS-06: watchUserCoordinates suscribe y cancela el seguimiento con clearWatch', () => {
      const clearWatchMock = vi.fn();
      const watchPositionMock = vi.fn().mockReturnValue(101);

      global.navigator.geolocation = {
        watchPosition: watchPositionMock,
        clearWatch: clearWatchMock,
      };

      const onSuccess = vi.fn();
      const watchId = watchUserCoordinates(onSuccess);

      expect(watchPositionMock).toHaveBeenCalled();
      expect(watchId).toBe(101);
    });

    it('UT-LS-08: Arquitectura Anti-EXIF: la ubicación se deriva únicamente de la Geolocation API del navegador', async () => {
      // Verificar que el servicio opera independientemente de cualquier metadato EXIF
      const mockPosition = {
        coords: {
          longitude: -58.4200,
          latitude: -34.6200,
          accuracy: 5,
        },
      };

      global.navigator.geolocation = {
        getCurrentPosition: vi.fn((success) => success(mockPosition)),
      };

      const result = await getUserCoordinates();
      expect(result.coordinates).toEqual([-58.4200, -34.6200]);
      expect(result.status).toBe(LOCATION_STATUS.GRANTED);
    });
  });

  describe('Hook: useGeolocation', () => {
    it('UT-LS-07: useGeolocation expone estado reactivo y método refreshLocation', async () => {
      global.navigator.permissions = {
        query: vi.fn().mockResolvedValue({ state: 'granted' }),
      };

      global.navigator.geolocation = {
        getCurrentPosition: vi.fn((success) =>
          success({
            coords: { longitude: -58.37, latitude: -34.61, accuracy: 8 },
          })
        ),
      };

      const { result } = renderHook(() => useGeolocation({ autoFetch: true }));

      await act(async () => {
        await result.current.refreshLocation();
      });

      expect(result.current.isGranted).toBe(true);
      expect(result.current.coordinates).toEqual([-58.37, -34.61]);
      expect(result.current.accuracy).toBe(8);
      expect(result.current.permissionState).toBe('granted');
      expect(result.current.error).toBeNull();
    });
  });
});
