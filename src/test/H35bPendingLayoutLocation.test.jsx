/**
 * @file H35bPendingLayoutLocation.test.jsx
 * @description Seguimiento de H-35: (1) el texto de la tarjeta de Pendientes ocupa todo el ancho, debajo del ícono, y
 * (2) un borrador al que le falta confirmar la ubicación se puede corregir desde la tarjeta, con el mismo modal que usa el
 * asistente, en vez de quedar solo con «Descartar».
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../services/offlineStorageService', () => ({
  getAllPendingSyncReports: vi.fn(),
  deleteDraftReport: vi.fn().mockResolvedValue(true),
  updateDraftReport: vi.fn(),
}));
// Se usan las reglas reales (getDraftProblems) y solo se simula el envío
vi.mock('../services/pendingSyncService', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, syncPendingReports: vi.fn() };
});
// El modal real dibuja un mapa; acá interesa qué recibe y qué devuelve
vi.mock('../components/report/AdjustLocationModal', () => ({
  AdjustLocationModal: ({ initialCoordinates, initialLocalityId, onConfirm, onClose }) => (
    <div
      data-testid="adjust-location-modal"
      data-coords={JSON.stringify(initialCoordinates)}
      data-locality={String(initialLocalityId ?? '')}
    >
      <button
        type="button"
        onClick={() =>
          onConfirm({ coordinates: { lat: -34.6, lng: -58.4 }, localityId: 'loc-9', localityLabel: 'Almagro', street: 'Av. Medrano' })
        }
      >
        Elegir Almagro
      </button>
      <button type="button" onClick={onClose}>
        Cerrar mapa
      </button>
    </div>
  ),
}));

import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { getAllPendingSyncReports, updateDraftReport } from '../services/offlineStorageService';
import { syncPendingReports } from '../services/pendingSyncService';
import { PendingReportsPage } from '../pages/PendingReportsPage';

const draft = (extra = {}) => ({
  client_side_id: 'draft-1',
  status: 'PENDING_SYNC',
  description: 'Camión de gran porte circulando por calle residencial',
  selectedCategory: { id: 'INFRAESTRUCTURA', name: 'Infraestructura vial', icon: 'construction', dbId: 'srv-1' },
  customLocation: { coordinates: { lat: -34.5874, lng: -58.4 }, localityId: null },
  geolocation: { lat: -34.5874, lng: -58.4 },
  evidenceList: [{ id: 'e1', blob: new Blob(['x'], { type: 'image/jpeg' }), name: 'f.jpg', mimeType: 'image/jpeg' }],
  updatedAt: '2026-09-22T15:00:00.000-03:00',
  ...extra,
});

const renderPage = () => render(<MemoryRouter><PendingReportsPage /></MemoryRouter>);
const setOnline = (value) => Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });

describe('H-35 (seguimiento): tarjeta de Pendientes a ancho completo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 'user-1' } });
    updateDraftReport.mockResolvedValue({});
    syncPendingReports.mockResolvedValue({ sent: 1, failed: 0, remaining: 0, offline: false, errors: [] });
    setOnline(true);
  });

  it('UT-H35B-01: el motivo y las acciones van debajo del ícono, fuera de la columna del título', async () => {
    getAllPendingSyncReports.mockResolvedValue([draft()]);
    renderPage();

    const header = await screen.findByTestId('pending-card-header');
    const body = screen.getByTestId('pending-card-body');

    // El encabezado (ícono + título) no contiene el motivo ni las acciones…
    expect(within(header).queryByTestId('pending-reason')).not.toBeInTheDocument();
    expect(within(header).queryByRole('button')).not.toBeInTheDocument();
    // …que viven en el cuerpo, a todo el ancho, y el cuerpo no está dentro del encabezado
    expect(within(body).getByTestId('pending-reason')).toBeInTheDocument();
    expect(within(body).getByRole('button', { name: /descartar/i })).toBeInTheDocument();
    expect(header.contains(body)).toBe(false);
  });
});

describe('H-35 (seguimiento): confirmar la ubicación de un borrador desde Pendientes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 'user-1' } });
    updateDraftReport.mockResolvedValue({});
    syncPendingReports.mockResolvedValue({ sent: 1, failed: 0, remaining: 0, offline: false, errors: [] });
    setOnline(true);
  });

  it('UT-H35B-02: sin localidad la tarjeta lo dice y ofrece confirmarla (no solo descartar)', async () => {
    getAllPendingSyncReports.mockResolvedValue([draft()]);
    renderPage();

    const item = await screen.findByTestId('pending-report-item');
    expect(within(item).getByTestId('pending-reason')).toHaveTextContent('Falta confirmar la ubicación del reporte.');
    expect(within(item).getByRole('button', { name: /^confirmar ubicación$/i })).toBeInTheDocument();
    expect(within(item).getByRole('button', { name: /descartar/i })).toBeInTheDocument();
    expect(within(item).queryByTestId('pending-description-input')).not.toBeInTheDocument();
  });

  it('UT-H35B-03: abre el modal del asistente con las coordenadas del borrador', async () => {
    getAllPendingSyncReports.mockResolvedValue([draft()]);
    renderPage();
    const item = await screen.findByTestId('pending-report-item');

    fireEvent.click(within(item).getByRole('button', { name: /^confirmar ubicación$/i }));

    const modal = await screen.findByTestId('adjust-location-modal');
    expect(JSON.parse(modal.dataset.coords)).toEqual({ lat: -34.5874, lng: -58.4 });
    expect(modal.dataset.locality).toBe('');
  });

  it('UT-H35B-04: si el borrador no tiene ubicación propia usa el GPS guardado', async () => {
    getAllPendingSyncReports.mockResolvedValue([draft({ customLocation: null, geolocation: { lat: -34.6044, lng: -58.38 } })]);
    renderPage();
    const item = await screen.findByTestId('pending-report-item');

    fireEvent.click(within(item).getByRole('button', { name: /^confirmar ubicación$/i }));

    const modal = await screen.findByTestId('adjust-location-modal');
    expect(JSON.parse(modal.dataset.coords)).toEqual({ lat: -34.6044, lng: -58.38 });
  });

  it('UT-H35B-05: al confirmar guarda la localidad elegida, cierra el modal y reintenta el envío', async () => {
    getAllPendingSyncReports.mockResolvedValue([draft()]);
    renderPage();
    const item = await screen.findByTestId('pending-report-item');

    fireEvent.click(within(item).getByRole('button', { name: /^confirmar ubicación$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /elegir almagro/i }));

    await waitFor(() =>
      expect(updateDraftReport).toHaveBeenCalledWith('draft-1', {
        customLocation: expect.objectContaining({
          localityId: 'loc-9',
          localityLabel: 'Almagro',
          coordinates: { lat: -34.6, lng: -58.4 },
          // Una elección manual deja de ser una sugerencia automática
          isAutoSuggested: false,
        }),
      })
    );
    await waitFor(() => expect(syncPendingReports).toHaveBeenCalledWith({ userId: 'user-1' }));
    expect(screen.queryByTestId('adjust-location-modal')).not.toBeInTheDocument();
  });

  it('UT-H35B-06: cerrar el modal no guarda nada', async () => {
    getAllPendingSyncReports.mockResolvedValue([draft()]);
    renderPage();
    const item = await screen.findByTestId('pending-report-item');

    fireEvent.click(within(item).getByRole('button', { name: /^confirmar ubicación$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /cerrar mapa/i }));

    expect(screen.queryByTestId('adjust-location-modal')).not.toBeInTheDocument();
    expect(updateDraftReport).not.toHaveBeenCalled();
    expect(syncPendingReports).not.toHaveBeenCalled();
  });

  it('UT-H35B-07: sin conexión guarda la ubicación, avisa que se enviará sola y no intenta enviar', async () => {
    setOnline(false);
    getAllPendingSyncReports.mockResolvedValue([draft()]);
    renderPage();
    const item = await screen.findByTestId('pending-report-item');

    fireEvent.click(within(item).getByRole('button', { name: /^confirmar ubicación$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /elegir almagro/i }));

    await waitFor(() => expect(updateDraftReport).toHaveBeenCalled());
    expect(syncPendingReports).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/ubicación guardada/i), expect.anything());
  });

  it('UT-H35B-08: si no se puede guardar la ubicación avisa y no reintenta el envío', async () => {
    updateDraftReport.mockRejectedValue(new Error('IndexedDB'));
    getAllPendingSyncReports.mockResolvedValue([draft()]);
    renderPage();
    const item = await screen.findByTestId('pending-report-item');

    fireEvent.click(within(item).getByRole('button', { name: /^confirmar ubicación$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /elegir almagro/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(syncPendingReports).not.toHaveBeenCalled();
  });

  it('UT-H35B-09: con la localidad ya confirmada no aparece el botón', async () => {
    getAllPendingSyncReports.mockResolvedValue([draft({ customLocation: { coordinates: { lat: -34.6, lng: -58.4 }, localityId: 'loc-1' } })]);
    renderPage();

    const item = await screen.findByTestId('pending-report-item');
    expect(within(item).queryByRole('button', { name: /^confirmar ubicación$/i })).not.toBeInTheDocument();
  });

  it('UT-H35B-10: si faltan la descripción y la ubicación, ofrece corregir las dos', async () => {
    getAllPendingSyncReports.mockResolvedValue([draft({ description: '' })]);
    renderPage();

    const item = await screen.findByTestId('pending-report-item');
    const reason = within(item).getByTestId('pending-reason');
    expect(reason).toHaveTextContent(/descripción/i);
    expect(reason).toHaveTextContent(/ubicación/i);
    expect(within(item).getByTestId('pending-description-input')).toBeInTheDocument();
    expect(within(item).getByRole('button', { name: /^confirmar ubicación$/i })).toBeInTheDocument();
  });

  it('UT-H35B-11: si falta la categoría no hay cómo corregirla acá: solo se puede descartar', async () => {
    getAllPendingSyncReports.mockResolvedValue([draft({ selectedCategory: null, customLocation: { localityId: 'loc-1' } })]);
    renderPage();

    const item = await screen.findByTestId('pending-report-item');
    expect(within(item).getByTestId('pending-reason')).toHaveTextContent(/categoría/i);
    expect(within(item).queryByRole('button', { name: /^confirmar ubicación$/i })).not.toBeInTheDocument();
    expect(within(item).queryByTestId('pending-description-input')).not.toBeInTheDocument();
    expect(within(item).getByRole('button', { name: /descartar/i })).toBeInTheDocument();
  });
});
