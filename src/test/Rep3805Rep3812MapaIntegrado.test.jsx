/**
 * @file Rep3805Rep3812MapaIntegrado.test.jsx
 * @description Integración de REP-3805 (carga por zona visible) y REP-3812 (zoom mínimo según el contenedor) en CitizenMap:
 * ambas colgaban del evento 'resize' del mapa y conviven sin pisarse.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

const { mapa } = vi.hoisted(() => ({ mapa: { handlers: {}, setMinZoom: null } }));

vi.mock('maplibre-gl', () => ({
  supported: vi.fn(() => true),
  setWorkerUrl: vi.fn(),
  Map: vi.fn(() => {
    mapa.handlers = {};
    return {
      on: vi.fn((event, cb) => { mapa.handlers[event] = cb; }),
      setMinZoom: mapa.setMinZoom,
      getBounds: vi.fn(() => ({ getWest: () => -58.45, getSouth: () => -34.65, getEast: () => -58.35, getNorth: () => -34.58 })),
      addControl: vi.fn(), remove: vi.fn(), resize: vi.fn(), flyTo: vi.fn(),
    };
  }),
  GeolocateControl: vi.fn(),
  Marker: vi.fn(() => ({ setLngLat: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), remove: vi.fn() })),
}));

import { CitizenMap } from '../components/map/CitizenMap';

describe('REP-3805 + REP-3812: CitizenMap al cambiar el tamaño del mapa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mapa.setMinZoom = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1920 });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 900 });
  });
  afterEach(() => {
    delete HTMLElement.prototype.clientWidth;
    delete HTMLElement.prototype.clientHeight;
  });

  it('UT-V3805-32: un cambio de tamaño recalcula el zoom mínimo Y avisa la nueva zona visible', () => {
    const onViewportChange = vi.fn();
    render(<CitizenMap autoLocate={false} onViewportChange={onViewportChange} />);
    onViewportChange.mockClear();

    act(() => mapa.handlers.resize());

    expect(mapa.setMinZoom).toHaveBeenCalledTimes(1);
    expect(mapa.setMinZoom.mock.calls[0][0]).toBeGreaterThanOrEqual(12.46);
    expect(onViewportChange).toHaveBeenCalledWith({ west: -58.45, south: -34.65, east: -58.35, north: -34.58 });
  });

  it('UT-V3805-33: el zoom mínimo se actualiza antes de avisar la zona (la zona ya refleja el zoom corregido)', () => {
    const orden = [];
    mapa.setMinZoom = vi.fn(() => orden.push('zoom'));
    render(<CitizenMap autoLocate={false} onViewportChange={() => orden.push('zona')} />);
    orden.length = 0;

    act(() => mapa.handlers.resize());
    expect(orden).toEqual(['zoom', 'zona']);
  });
});
