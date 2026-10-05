/**
 * @file Rep3812MinZoomMapaPrincipal.test.jsx
 * @description REP-3812 (seguimiento): /mapa tenía la misma combinación que «¿Dónde ocurrió?»: maxBounds de CABA y
 * Avellaneda (≈ 22 km de ancho) con un minZoom fijo de 11,5. En un monitor ancho, lo visible con la vista alejada superaba el
 * ancho del límite y MapLibre bloqueaba el desplazamiento horizontal. El mapa sigue cerrado en CABA y Avellaneda: solo
 * el zoom mínimo se calcula según el tamaño del contenedor.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { CABA_AVELLANEDA_BOUNDS } from '../services/locationService';

const { mapa } = vi.hoisted(() => ({ mapa: { opciones: null, manejadores: {}, setMinZoom: null } }));
vi.mock('maplibre-gl', () => ({
  supported: vi.fn(() => true),
  setWorkerUrl: vi.fn(),
  Map: vi.fn((opciones) => {
    mapa.opciones = opciones;
    mapa.manejadores = {};
    return {
      on: vi.fn((evento, cb) => {
        mapa.manejadores[evento] = cb;
      }),
      setMinZoom: mapa.setMinZoom,
      addControl: vi.fn(),
      remove: vi.fn(),
      resize: vi.fn(),
      flyTo: vi.fn(),
    };
  }),
  GeolocateControl: vi.fn(),
  Marker: vi.fn(() => ({ setLngLat: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), remove: vi.fn() })),
}));

import { CitizenMap } from '../components/map/CitizenMap';

describe('REP-3812: /mapa usa el zoom mínimo según el ancho del contenedor', () => {
  const medidas = { ancho: 1366, alto: 700 };

  beforeEach(() => {
    vi.clearAllMocks();
    mapa.opciones = null;
    mapa.setMinZoom = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => medidas.ancho });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => medidas.alto });
  });
  afterEach(() => {
    delete HTMLElement.prototype.clientWidth;
    delete HTMLElement.prototype.clientHeight;
  });

  const montar = () => render(<CitizenMap autoLocate={false} />);

  it('UT-3812-11: en un monitor de 1920 px el mapa se crea con un zoom mínimo que cubre todo el límite', () => {
    medidas.ancho = 1920;
    medidas.alto = 900;
    montar();
    expect(mapa.opciones.minZoom).toBeGreaterThanOrEqual(12.46);
  });

  it('UT-3812-12: el mapa sigue cerrado en CABA y Avellaneda (maxBounds sin cambios)', () => {
    medidas.ancho = 1920;
    medidas.alto = 900;
    montar();
    expect(mapa.opciones.maxBounds).toEqual(CABA_AVELLANEDA_BOUNDS);
  });

  it('UT-3812-13: en un teléfono el mapa se crea con el mínimo de siempre (11,5)', () => {
    medidas.ancho = 390;
    medidas.alto = 800;
    montar();
    expect(mapa.opciones.minZoom).toBe(11.5);
  });

  it('UT-3812-14: el zoom inicial nunca queda por debajo del mínimo calculado', () => {
    medidas.ancho = 2560;
    medidas.alto = 1000;
    montar();
    expect(mapa.opciones.zoom).toBeGreaterThanOrEqual(mapa.opciones.minZoom);
  });

  it('UT-3812-15: si la ventana cambia de ancho, el zoom mínimo se recalcula', () => {
    medidas.ancho = 390;
    medidas.alto = 800;
    montar();
    expect(mapa.manejadores.resize).toBeTypeOf('function');

    medidas.ancho = 1920;
    medidas.alto = 900;
    mapa.manejadores.resize();

    expect(mapa.setMinZoom.mock.calls.at(-1)[0]).toBeGreaterThanOrEqual(12.46);
  });
});
