import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  getUserCoordinates,
  LOCATION_STATUS,
  DEFAULT_CITY_COORDINATES,
} from '../services/locationService';
import { CitizenMap } from '../components/map/CitizenMap';

// Mock de maplibre-gl
vi.mock('maplibre-gl', () => {
  return {
    supported: vi.fn(() => true),
    setWorkerUrl: vi.fn(),
    Map: vi.fn(() => ({
      on: vi.fn((event, cb) => {
        if (event === 'load' || event === 'style.load') cb();
      }),
      addControl: vi.fn(),
      remove: vi.fn(),
      resize: vi.fn(),
      flyTo: vi.fn(),
    })),
    GeolocateControl: vi.fn(),
    Marker: vi.fn(({ element } = {}) => {
      if (element && typeof document !== 'undefined') {
        document.body.appendChild(element);
      }
      return {
        setLngLat: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        remove: vi.fn(() => {
          if (element && element.parentNode) {
            element.parentNode.removeChild(element);
          }
        }),
      };
    }),
  };
});

describe('REP-2300: Detección y Gestión de Ubicación del Ciudadano', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('Servicio: locationService', () => {
    it('UT-LOC-01: getUserCoordinates retorna status GRANTED y coordenadas cuando el permiso es concedido', async () => {
      const mockCoords = {
        longitude: -58.4123,
        latitude: -34.6045,
        accuracy: 15,
      };

      global.navigator.geolocation = {
        getCurrentPosition: vi.fn((success) =>
          success({ coords: mockCoords })
        ),
      };

      const result = await getUserCoordinates();
      expect(result.status).toBe(LOCATION_STATUS.GRANTED);
      expect(result.coordinates).toEqual([-58.4123, -34.6045]);
      expect(result.accuracy).toBe(15);
    });

    it('UT-LOC-02: getUserCoordinates retorna status DENIED y coordenadas por defecto ante error de permiso', async () => {
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

    it('UT-LOC-06: getUserCoordinates retorna NOT_SUPPORTED si el navegador no tiene la API', async () => {
      const originalGeo = global.navigator.geolocation;
      delete global.navigator.geolocation;

      const result = await getUserCoordinates();
      expect(result.status).toBe(LOCATION_STATUS.NOT_SUPPORTED);
      expect(result.coordinates).toEqual(DEFAULT_CITY_COORDINATES);

      global.navigator.geolocation = originalGeo;
    });
  });

  describe('Componente: CitizenMap con Geolocalización', () => {
    it('UT-LOC-03: Renderiza el marcador de ubicación del usuario cuando se obtiene la posición', async () => {
      global.navigator.geolocation = {
        getCurrentPosition: vi.fn((success) =>
          success({
            coords: { longitude: -58.42, latitude: -34.62, accuracy: 10 },
          })
        ),
      };

      render(<CitizenMap autoLocate={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('user-location-marker')).toBeInTheDocument();
      });
    });

    it('UT-LOC-04: Muestra el banner no bloqueante cuando la ubicación es denegada o falla', async () => {
      global.navigator.geolocation = {
        getCurrentPosition: vi.fn((success, error) =>
          error({ code: 1, message: 'Denied' })
        ),
      };

      render(<CitizenMap autoLocate={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Ubicación desactivada/i)).toBeInTheDocument();
        expect(
          screen.getByText(/Mostrando CABA y Avellaneda por defecto/i)
        ).toBeInTheDocument();
      });
    });

    it('UT-LOC-05: El botón de geolocalización permite reintentar y actualizar posición', async () => {
      let isFirstCall = true;
      global.navigator.geolocation = {
        getCurrentPosition: vi.fn((success, error) => {
          if (isFirstCall) {
            isFirstCall = false;
            error({ code: 1, message: 'Denied' });
          } else {
            success({
              coords: { longitude: -58.39, latitude: -34.59, accuracy: 5 },
            });
          }
        }),
      };

      render(<CitizenMap autoLocate={true} />);

      // Primero falla y aparece el banner
      await waitFor(() => {
        expect(screen.getByText(/Ubicación desactivada/i)).toBeInTheDocument();
      });

      // Clic en botón Activar / Reintentar
      const activateBtn = screen.getByRole('button', { name: /Activar/i });
      fireEvent.click(activateBtn);

      // Ahora se concede y aparece el marcador
      await waitFor(() => {
        expect(screen.getByTestId('user-location-marker')).toBeInTheDocument();
        expect(screen.queryByText(/Ubicación desactivada/i)).not.toBeInTheDocument();
      });
    });
  });
});
