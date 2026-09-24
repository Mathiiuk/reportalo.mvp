/**
 * @file H35PendingStuckDrafts.test.jsx
 * @description H-35: un borrador trabado en Pendientes debe poder completarse (si falta la descripción) o
 * descartarse, y la tarjeta tiene que decir el motivo real en vez de «requiere conexión».
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
vi.mock('../services/pendingSyncService', () => ({ syncPendingReports: vi.fn() }));

import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { getAllPendingSyncReports, deleteDraftReport, updateDraftReport } from '../services/offlineStorageService';
import { syncPendingReports } from '../services/pendingSyncService';
import { PendingReportsPage } from '../pages/PendingReportsPage';

const draft = (extra = {}) => ({
  client_side_id: 'draft-1',
  status: 'PENDING_SYNC',
  description: 'Contenedor desbordado en la esquina',
  selectedCategory: { id: 'AMBIENTE', name: 'Ambiente', icon: 'eco', dbId: 'srv-1' },
  customLocation: { localityId: 'loc-1', localityLabel: 'Avellaneda' },
  evidenceList: [{ id: 'e1', blob: new Blob(['x'], { type: 'image/jpeg' }), name: 'f.jpg', mimeType: 'image/jpeg' }],
  updatedAt: '2026-09-22T15:00:00.000-03:00',
  ...extra,
});

const renderPage = () => render(<MemoryRouter><PendingReportsPage /></MemoryRouter>);
const setOnline = (value) => Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });

describe('H-35: Pendientes con borradores trabados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 'user-1' } });
    deleteDraftReport.mockResolvedValue(true);
    updateDraftReport.mockResolvedValue({});
    syncPendingReports.mockResolvedValue({ sent: 1, failed: 0, remaining: 0, offline: false, errors: [] });
    setOnline(true);
  });

  it('UT-H35-16: con la descripción vacía la tarjeta dice el motivo real y ofrece completarla', async () => {
    getAllPendingSyncReports.mockResolvedValue([draft({ description: '' })]);
    renderPage();

    const item = await screen.findByTestId('pending-report-item');
    expect(within(item).getByTestId('pending-reason')).toHaveTextContent(/descripción/i);
    expect(within(item).queryByText(/requiere conexión/i)).not.toBeInTheDocument();
    expect(within(item).getByTestId('pending-description-input')).toBeInTheDocument();
    expect(within(item).getByTestId('pending-description-input')).toHaveAttribute('maxlength', '280');
  });

  it('UT-H35-17: completar la descripción la guarda recortada y reintenta el envío', async () => {
    getAllPendingSyncReports.mockResolvedValue([draft({ description: '' })]);
    renderPage();
    const item = await screen.findByTestId('pending-report-item');

    fireEvent.change(within(item).getByTestId('pending-description-input'), { target: { value: '  Contenedor desbordado  ' } });
    fireEvent.click(within(item).getByRole('button', { name: /guardar y reintentar/i }));

    await waitFor(() => expect(updateDraftReport).toHaveBeenCalledWith('draft-1', { description: 'Contenedor desbordado' }));
    await waitFor(() => expect(syncPendingReports).toHaveBeenCalledWith({ userId: 'user-1' }));
  });

  it('UT-H35-18: una descripción de menos de 10 caracteres no se guarda y dice el mínimo', async () => {
    getAllPendingSyncReports.mockResolvedValue([draft({ description: '' })]);
    renderPage();
    const item = await screen.findByTestId('pending-report-item');

    fireEvent.change(within(item).getByTestId('pending-description-input'), { target: { value: 'bache' } });
    fireEvent.click(within(item).getByRole('button', { name: /guardar y reintentar/i }));

    expect(await within(item).findByRole('alert')).toHaveTextContent(/al menos 10/i);
    expect(updateDraftReport).not.toHaveBeenCalled();
    expect(syncPendingReports).not.toHaveBeenCalled();
  });

  it('UT-H35-19: sin conexión guarda la descripción, avisa que se enviará sola y no intenta enviar', async () => {
    setOnline(false);
    getAllPendingSyncReports.mockResolvedValue([draft({ description: '' })]);
    renderPage();
    const item = await screen.findByTestId('pending-report-item');

    fireEvent.change(within(item).getByTestId('pending-description-input'), { target: { value: 'Contenedor desbordado' } });
    fireEvent.click(within(item).getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(updateDraftReport).toHaveBeenCalledWith('draft-1', { description: 'Contenedor desbordado' }));
    expect(syncPendingReports).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/guardamos|guardada|guardó/i), expect.anything());
  });

  it('UT-H35-20: un borrador sano sigue mostrando el estado de siempre y sin editor', async () => {
    getAllPendingSyncReports.mockResolvedValue([draft()]);
    renderPage();

    const item = await screen.findByTestId('pending-report-item');
    expect(within(item).getByText('Falta protegerse la foto: requiere conexión.')).toBeInTheDocument();
    expect(within(item).queryByTestId('pending-description-input')).not.toBeInTheDocument();
  });

  it('UT-H35-21: si el último intento falló por otro dato, muestra ese motivo y no ofrece el editor', async () => {
    getAllPendingSyncReports.mockResolvedValue([
      draft({ lastSyncError: { code: 'LOCATION', kind: 'invalid', message: 'Falta confirmar la ubicación del reporte.', at: '2026-09-23T10:00:00Z' } }),
    ]);
    renderPage();

    const item = await screen.findByTestId('pending-report-item');
    expect(within(item).getByTestId('pending-reason')).toHaveTextContent('Falta confirmar la ubicación del reporte.');
    expect(within(item).queryByText(/requiere conexión/i)).not.toBeInTheDocument();
    expect(within(item).queryByTestId('pending-description-input')).not.toBeInTheDocument();
    // La salida en este caso es descartar
    expect(within(item).getByRole('button', { name: /descartar/i })).toBeInTheDocument();
  });

  it('UT-H35-22: un fallo reintentable (servidor) muestra el mensaje guardado, en castellano', async () => {
    getAllPendingSyncReports.mockResolvedValue([
      draft({ lastSyncError: { code: 'CREATE', kind: 'retry', message: 'No pudimos guardar tu reporte. Tu borrador sigue guardado: probá de nuevo en unos segundos.', at: '2026-09-23T10:00:00Z' } }),
    ]);
    renderPage();

    const item = await screen.findByTestId('pending-report-item');
    expect(within(item).getByTestId('pending-reason')).toHaveTextContent(/borrador sigue guardado/i);
  });

  it('UT-H35-23: descartar pide confirmación y Cancelar no borra nada', async () => {
    getAllPendingSyncReports.mockResolvedValue([draft()]);
    renderPage();
    const item = await screen.findByTestId('pending-report-item');

    fireEvent.click(within(item).getByRole('button', { name: /^descartar/i }));
    expect(within(item).getByText(/¿Descartar este reporte\?/i)).toBeInTheDocument();
    expect(deleteDraftReport).not.toHaveBeenCalled();

    fireEvent.click(within(item).getByRole('button', { name: /cancelar/i }));
    expect(within(item).queryByText(/¿Descartar este reporte\?/i)).not.toBeInTheDocument();
    expect(deleteDraftReport).not.toHaveBeenCalled();
  });

  it('UT-H35-24: confirmar el descarte borra el borrador y actualiza la lista', async () => {
    getAllPendingSyncReports.mockResolvedValueOnce([draft()]).mockResolvedValue([]);
    renderPage();
    const item = await screen.findByTestId('pending-report-item');

    fireEvent.click(within(item).getByRole('button', { name: /^descartar/i }));
    fireEvent.click(within(item).getByRole('button', { name: /sí, descartar/i }));

    await waitFor(() => expect(deleteDraftReport).toHaveBeenCalledWith('draft-1'));
    expect(await screen.findByText(/no hay reportes pendientes/i)).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalled();
  });

  it('UT-H35-25: si no se puede descartar, avisa y el borrador sigue en la lista', async () => {
    deleteDraftReport.mockRejectedValue(new Error('IndexedDB'));
    getAllPendingSyncReports.mockResolvedValue([draft()]);
    renderPage();
    const item = await screen.findByTestId('pending-report-item');

    fireEvent.click(within(item).getByRole('button', { name: /^descartar/i }));
    fireEvent.click(within(item).getByRole('button', { name: /sí, descartar/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByTestId('pending-report-item')).toBeInTheDocument();
  });
});
