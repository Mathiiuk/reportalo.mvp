import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock de MapLibre: en JSDOM no hay WebGL. Se espían la creación, la deriva y la limpieza.
const mapInstance = { once: vi.fn(), on: vi.fn(), off: vi.fn(), jumpTo: vi.fn(), remove: vi.fn() };
const MapMock = vi.fn(() => mapInstance);
vi.mock('maplibre-gl', () => ({ Map: MapMock, setWorkerUrl: vi.fn() }));
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: 'worker.js' }));
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

import { HeroMap } from '../components/common/HeroMap';

describe('REP-3802 · HeroMap (mapa de fondo de la portada)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn(() => ({ matches: false }));
  });

  it('UT-HM-01: crea un mapa real no interactivo con atribución', async () => {
    render(<HeroMap />);
    await waitFor(() => expect(MapMock).toHaveBeenCalledTimes(1));
    const opts = MapMock.mock.calls[0][0];
    expect(opts.interactive).toBe(false);
    expect(opts.attributionControl).toBeTruthy();
    expect(opts.style).toContain('openfreemap');
  });

  it('UT-HM-02: el mapa se desplaza (jumpTo) mientras la animación está activa', async () => {
    render(<HeroMap />);
    await waitFor(() => expect(mapInstance.jumpTo).toHaveBeenCalled());
  });

  it('UT-HM-03: con reduced-motion el mapa queda quieto', async () => {
    window.matchMedia = vi.fn(() => ({ matches: true }));
    render(<HeroMap />);
    await waitFor(() => expect(MapMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 80));
    expect(mapInstance.jumpTo).not.toHaveBeenCalled();
  });

  it('UT-HM-04: al desmontar libera el mapa', async () => {
    const { unmount } = render(<HeroMap />);
    await waitFor(() => expect(MapMock).toHaveBeenCalled());
    unmount();
    expect(mapInstance.remove).toHaveBeenCalled();
  });

  it('UT-HM-05: deja la textura de respaldo y el contenedor del mapa', () => {
    const { container } = render(<HeroMap />);
    expect(screen.getByTestId('hero-map')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
