/**
 * @file Rep3805MapaComponente.test.jsx
 * @description REP-3805: CitizenMap avisa la zona visible, informa cuando la zona llegó al tope de reportes y conserva la
 * ficha abierta aunque se mueva el mapa (los reportes ahora se piden por zona).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

const { mapa } = vi.hoisted(() => ({ mapa: { handlers: {}, bounds: null } }));

vi.mock('maplibre-gl', () => ({
  supported: vi.fn(() => true),
  setWorkerUrl: vi.fn(),
  Map: vi.fn(() => {
    mapa.handlers = {};
    return {
      on: vi.fn((event, cb) => {
        mapa.handlers[event] = cb;
        if (event === 'load') cb();
      }),
      getBounds: vi.fn(() => ({
        getWest: () => mapa.bounds.west,
        getSouth: () => mapa.bounds.south,
        getEast: () => mapa.bounds.east,
        getNorth: () => mapa.bounds.north,
      })),
      addControl: vi.fn(),
      remove: vi.fn(),
      resize: vi.fn(),
      flyTo: vi.fn(),
    };
  }),
  GeolocateControl: vi.fn(),
  Marker: vi.fn(({ element } = {}) => {
    if (element) document.body.appendChild(element);
    return {
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(() => element?.parentNode?.removeChild(element)),
    };
  }),
}));

import { CitizenMap } from '../components/map/CitizenMap';

const reporte = (id, stateCode = 'EN_ANALISIS', extra = {}) => ({
  id,
  title: `Reporte ${id}`,
  description: `Descripción del reporte ${id}.`,
  category: 'Tránsito',
  categoryIcon: 'car_crash',
  status: 'En revisión',
  stateCode,
  pinColor: '#1E6FCB',
  coordinates: [-58.4, -34.6],
  address: 'Almagro',
  date: '01 Sep 2026',
  ...extra,
});

const ZONA = { west: -58.45, south: -34.65, east: -58.35, north: -34.58 };

describe('REP-3805: CitizenMap por zona visible', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    mapa.bounds = ZONA;
  });

  it('UT-V3805-25: avisa la zona visible una vez al inicio', () => {
    const onViewportChange = vi.fn();
    render(<CitizenMap autoLocate={false} onViewportChange={onViewportChange} />);

    expect(onViewportChange).toHaveBeenCalledTimes(1);
    expect(onViewportChange).toHaveBeenCalledWith(ZONA);
  });

  it('UT-V3805-26: al terminar de mover o acercar el mapa (moveend) avisa la nueva zona', () => {
    const onViewportChange = vi.fn();
    render(<CitizenMap autoLocate={false} onViewportChange={onViewportChange} />);
    onViewportChange.mockClear();

    mapa.bounds = { west: -58.42, south: -34.62, east: -58.38, north: -34.60 };
    act(() => mapa.handlers.moveend());

    expect(onViewportChange).toHaveBeenCalledWith({ west: -58.42, south: -34.62, east: -58.38, north: -34.60 });
  });

  it('UT-V3805-27: sin onViewportChange no hace nada especial (el componente sigue funcionando solo con reportes)', () => {
    expect(() => render(<CitizenMap autoLocate={false} reports={[reporte('a')]} />)).not.toThrow();
    expect(() => act(() => mapa.handlers.moveend())).not.toThrow();
  });

  it('UT-V3805-28: cuando la zona llegó al tope avisa que se acerque el mapa; si no, no muestra nada', () => {
    const { rerender } = render(<CitizenMap autoLocate={false} reports={[reporte('a')]} />);
    expect(screen.queryByTestId('map-truncation-notice')).not.toBeInTheDocument();

    rerender(<CitizenMap autoLocate={false} reports={[reporte('a')]} truncated />);
    const aviso = screen.getByTestId('map-truncation-notice');
    expect(aviso).toHaveAttribute('role', 'status');
    expect(aviso).toHaveTextContent(/hay muchos reportes en esta zona/i);
    expect(aviso).toHaveTextContent(/acercá el mapa para ver todos/i);

    rerender(<CitizenMap autoLocate={false} reports={[reporte('a')]} truncated={false} />);
    expect(screen.queryByTestId('map-truncation-notice')).not.toBeInTheDocument();
  });

  it('UT-V3805-29: los marcadores siguen siendo los de la lista que recibe (selección y detalle como antes)', () => {
    const onOpenReport = vi.fn();
    render(<CitizenMap autoLocate={false} reports={[reporte('a'), reporte('b')]} onOpenReport={onOpenReport} />);

    fireEvent.click(screen.getByTestId('marker-a'));
    expect(screen.getByRole('heading', { name: 'Reporte a' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ver el reporte/i }));
    expect(onOpenReport).toHaveBeenCalledWith('a');
  });

  it('UT-V3805-30: mover el mapa y que el reporte seleccionado deje de venir en la lista NO le cierra la ficha', async () => {
    const { rerender } = render(<CitizenMap autoLocate={false} reports={[reporte('a'), reporte('b')]} />);
    fireEvent.click(screen.getByTestId('marker-a'));
    expect(screen.getByRole('heading', { name: 'Reporte a' })).toBeInTheDocument();

    // El mapa se movió: la nueva zona trae otros reportes y ya no incluye al seleccionado
    rerender(<CitizenMap autoLocate={false} reports={[reporte('c')]} />);
    // Se espera más que la animación de salida de la ficha: si se hubiera cerrado, ya no estaría
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 700)); });

    expect(screen.getByRole('heading', { name: 'Reporte a' })).toBeInTheDocument();
    expect(screen.queryByTestId('marker-a')).not.toBeInTheDocument();
    expect(screen.getByTestId('marker-c')).toBeInTheDocument();
  });

  it('UT-V3805-31: el filtro sigue cerrando la ficha de un reporte que ya no coincide', async () => {
    render(<CitizenMap autoLocate={false} reports={[reporte('a', 'EN_ANALISIS'), reporte('b', 'RESUELTO')]} />);
    fireEvent.click(screen.getByTestId('marker-a'));
    expect(screen.getByRole('heading', { name: 'Reporte a' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /filtros del mapa/i }));
    fireEvent.click(screen.getByRole('button', { name: /resuelto/i }));

    // La ficha sale con una animación de salida
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Reporte a' })).not.toBeInTheDocument());
    expect(screen.getByTestId('marker-b')).toBeInTheDocument();
    expect(screen.queryByTestId('marker-a')).not.toBeInTheDocument();
  });
});
