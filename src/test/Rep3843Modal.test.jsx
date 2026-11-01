/**
 * @file Rep3843Modal.test.jsx
 * @description REP-3843: el modal «¿Dónde ocurrió?» sugiere calle y altura (Nominatim por el proxy), el vecino las
 * puede corregir o borrar, y la dirección viaja con la ubicación confirmada. Sin sugerencia, todo sigue igual.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({
        data: [{ id: 'loc-2', name: 'Piñeyro', subdivisions: { name: 'Avellaneda', states_provinces: { name: 'Buenos Aires' } } }],
        error: null,
      }),
    })),
  },
}));

vi.mock('maplibre-gl', () => ({
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
    getCenter: vi.fn(() => ({ lat: -34.6625, lng: -58.365 })),
  })),
  Marker: vi.fn(() => ({ setLngLat: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), remove: vi.fn() })),
}));

const suggestMock = vi.fn();
vi.mock('../services/geocodingService', async (importOriginal) => ({
  ...(await importOriginal()),
  suggestAddress: (...args) => suggestMock(...args),
}));

import { AdjustLocationModal } from '../components/report/AdjustLocationModal';

const elegirLocalidad = async () => {
  await waitFor(() => expect(screen.getByTestId('locality-selector-trigger')).not.toBeDisabled());
  fireEvent.click(screen.getByTestId('locality-selector-trigger'));
  fireEvent.click(await screen.findByTestId('locality-option-loc-2'));
};

describe('REP-3843 · dirección sugerida en «¿Dónde ocurrió?»', () => {
  beforeEach(() => suggestMock.mockReset());

  it('UT-3843-U1: sugiere calle y altura, muestra la atribución y las confirma con la ubicación', async () => {
    suggestMock.mockResolvedValue({ street: 'Avenida Bartolomé Mitre', number: '745', roadType: 'avenida' });
    const onConfirm = vi.fn();
    render(<AdjustLocationModal initialCoordinates={{ lat: -34.6625, lng: -58.365 }} onConfirm={onConfirm} onClose={vi.fn()} />);

    expect(await screen.findByDisplayValue('Avenida Bartolomé Mitre')).toBeInTheDocument();
    expect(screen.getByDisplayValue('745')).toBeInTheDocument();
    expect(screen.getByText(/openstreetmap contributors/i)).toBeInTheDocument();
    expect(suggestMock).toHaveBeenCalledWith({ lat: -34.6625, lng: -58.365 });

    await elegirLocalidad();
    fireEvent.click(screen.getByRole('button', { name: /confirmar ubicación/i }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        localityId: 'loc-2',
        address: { street: 'Avenida Bartolomé Mitre', number: '745', roadType: 'avenida', source: 'sugerida' },
      })
    );
  });

  it('UT-3843-U2: si el vecino corrige la calle, la dirección se confirma como corregida', async () => {
    suggestMock.mockResolvedValue({ street: 'Jean Jaures', number: null, roadType: 'secundaria' });
    const onConfirm = vi.fn();
    render(<AdjustLocationModal initialCoordinates={{ lat: -34.6625, lng: -58.365 }} onConfirm={onConfirm} onClose={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText(/calle/i), { target: { value: 'Av. Rivadavia' } });
    fireEvent.change(screen.getByLabelText(/altura/i), { target: { value: '3200' } });
    await elegirLocalidad();
    fireEvent.click(screen.getByRole('button', { name: /confirmar ubicación/i }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ address: { street: 'Av. Rivadavia', number: '3200', roadType: 'avenida', source: 'corregida' } })
    );
  });

  it('UT-3843-U3: sin sugerencia (sin conexión o falla) se puede confirmar igual, sin dirección', async () => {
    suggestMock.mockResolvedValue(null);
    const onConfirm = vi.fn();
    render(<AdjustLocationModal initialCoordinates={{ lat: -34.6625, lng: -58.365 }} onConfirm={onConfirm} onClose={vi.fn()} />);

    await waitFor(() => expect(suggestMock).toHaveBeenCalled());
    expect(screen.getByTestId('adjust-street-address')).toHaveTextContent('Punto marcado en el mapa');
    expect(screen.queryByText(/openstreetmap contributors/i)).not.toBeInTheDocument();
    await elegirLocalidad();
    fireEvent.click(screen.getByRole('button', { name: /confirmar ubicación/i }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ address: null }));
  });
});
