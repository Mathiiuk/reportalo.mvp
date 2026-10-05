/**
 * @file Rep3812MinZoomUbicacion.test.jsx
 * @description REP-3812: en «¿Dónde ocurrió?» el mapa con la vista alejada solo se movía en vertical en pantallas
 * anchas. maxBounds (≈ 22 km) + minZoom fijo en 11,5 hacían que, en un contenedor ancho, lo visible superara el ancho
 * del límite y MapLibre bloqueara el eje horizontal. El zoom mínimo ahora se calcula según el tamaño del contenedor.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { getMinZoomToContainBounds, CABA_AVELLANEDA_BOUNDS } from '../services/locationService';

// Mock de maplibre-gl: guarda las opciones del Map y los manejadores de eventos para dispararlos desde el test
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
      getCenter: vi.fn(() => ({ lat: -34.6625, lng: -58.365 })),
    };
  }),
  Marker: vi.fn(() => ({ setLngLat: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), remove: vi.fn() })),
}));
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: [], error: null }) })) },
}));

import { AdjustLocationModal } from '../components/report/AdjustLocationModal';

describe('REP-3812: getMinZoomToContainBounds (cálculo del zoom mínimo)', () => {
  const calcular = (width, height) =>
    getMinZoomToContainBounds({ bounds: CABA_AVELLANEDA_BOUNDS, width, height, baseMinZoom: 11.5 });

  it('UT-3812-01: en 1366 px de ancho el zoom mínimo permite ver todo el límite (≈ 12)', () => {
    const zoom = calcular(1366, 700);
    expect(zoom).toBeGreaterThanOrEqual(11.97);
    expect(zoom).toBeLessThan(12.2);
  });

  it('UT-3812-02: en 1920 px de ancho hace falta más zoom (≈ 12,5), que era justo donde se trababa', () => {
    const zoom = calcular(1920, 900);
    expect(zoom).toBeGreaterThanOrEqual(12.46);
    expect(zoom).toBeLessThan(12.7);
  });

  it('UT-3812-03: cuanto más ancho el contenedor, mayor el zoom mínimo', () => {
    expect(calcular(2560, 1000)).toBeGreaterThan(calcular(1920, 1000));
    expect(calcular(1920, 1000)).toBeGreaterThan(calcular(1366, 1000));
  });

  it('UT-3812-04: en un teléfono no cambia nada: se mantiene el mínimo de siempre (11,5)', () => {
    expect(calcular(390, 800)).toBe(11.5);
  });

  it('UT-3812-05: un contenedor muy alto también se contempla (eje vertical)', () => {
    // 600 px de ancho no obliga nada en horizontal, pero 4000 px de alto sí en vertical
    expect(calcular(600, 4000)).toBeGreaterThan(11.5);
  });

  it('UT-3812-06: con un tamaño inválido (contenedor sin medir) devuelve el mínimo base', () => {
    expect(calcular(0, 0)).toBe(11.5);
    expect(calcular(NaN, 500)).toBe(11.5);
    expect(calcular(undefined, undefined)).toBe(11.5);
  });
});

describe('REP-3812: AdjustLocationModal usa el zoom mínimo según el ancho del contenedor', () => {
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

  const montar = () => render(<AdjustLocationModal initialCoordinates={[-58.42, -34.62]} onConfirm={vi.fn()} onClose={vi.fn()} />);

  it('UT-3812-07: en un monitor de 1920 px el mapa se crea con un zoom mínimo que cubre todo el límite', () => {
    medidas.ancho = 1920;
    medidas.alto = 900;
    montar();
    expect(mapa.opciones.minZoom).toBeGreaterThanOrEqual(12.46);
    // El límite territorial sigue siendo el mismo
    expect(mapa.opciones.maxBounds).toEqual(CABA_AVELLANEDA_BOUNDS);
  });

  it('UT-3812-08: en 1366 px el mínimo también se adapta', () => {
    medidas.ancho = 1366;
    medidas.alto = 700;
    montar();
    expect(mapa.opciones.minZoom).toBeGreaterThanOrEqual(11.97);
  });

  it('UT-3812-09: en un teléfono el mapa se crea con el mínimo de siempre', () => {
    medidas.ancho = 390;
    medidas.alto = 800;
    montar();
    expect(mapa.opciones.minZoom).toBe(11.5);
  });

  it('UT-3812-10: si la ventana cambia de ancho, el zoom mínimo se recalcula', () => {
    medidas.ancho = 390;
    medidas.alto = 800;
    montar();
    expect(mapa.manejadores.resize).toBeTypeOf('function');

    medidas.ancho = 1920;
    medidas.alto = 900;
    mapa.manejadores.resize();

    expect(mapa.setMinZoom).toHaveBeenCalledWith(expect.any(Number));
    expect(mapa.setMinZoom.mock.calls.at(-1)[0]).toBeGreaterThanOrEqual(12.46);
  });
});
