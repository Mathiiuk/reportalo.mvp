/**
 * @file Rep3811PendientesSinFotos.test.jsx
 * @description REP-3811: un borrador sin fotos en Pendientes no puede ser un callejón sin salida. La tarjeta tiene
 * que permitir agregar una foto, y el aviso «Falta completar un dato» solo puede aparecer cuando la tarjeta ofrece
 * completar ese dato.
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

import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { getAllPendingSyncReports, updateDraftReport } from '../services/offlineStorageService';
import { syncPendingReports } from '../services/pendingSyncService';
import { PendingReportsPage } from '../pages/PendingReportsPage';

const draftSinFotos = (extra = {}) => ({
  client_side_id: 'draft-1',
  status: 'PENDING_SYNC',
  description: 'Persona durmiendo en la calle',
  selectedCategory: { id: 'VULNERABILIDAD_SOCIAL', name: 'Vulnerabilidad social', icon: 'eco', dbId: 'srv-1' },
  customLocation: { localityId: 'loc-1', localityLabel: 'Flores', coordinates: { lat: -34.63, lng: -58.46 } },
  evidenceList: [],
  updatedAt: '2026-10-02T01:27:00.000-03:00',
  ...extra,
});

const renderPage = () => render(<MemoryRouter><PendingReportsPage /></MemoryRouter>);
const setOnline = (value) => Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
const elegirFoto = (item, file) =>
  fireEvent.change(within(item).getByTestId('pending-photo-input'), { target: { files: [file] } });

describe('REP-3811: borrador sin fotos en Pendientes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 'user-1' } });
    updateDraftReport.mockResolvedValue({});
    syncPendingReports.mockResolvedValue({ sent: 1, failed: 0, remaining: 0, offline: false, errors: [] });
    setOnline(true);
    if (typeof URL.createObjectURL !== 'function') URL.createObjectURL = vi.fn(() => 'blob:mock');
    if (typeof URL.revokeObjectURL !== 'function') URL.revokeObjectURL = vi.fn();
  });

  it('UT-3811-01: la tarjeta dice que faltan las fotos y ofrece agregar una (ya no es un callejón sin salida)', async () => {
    getAllPendingSyncReports.mockResolvedValue([draftSinFotos()]);
    renderPage();

    const item = await screen.findByTestId('pending-report-item');
    expect(within(item).getByTestId('pending-reason')).toHaveTextContent(/no tiene fotos/i);
    expect(within(item).getByRole('button', { name: /agregar foto/i })).toBeInTheDocument();
    expect(within(item).getByTestId('pending-photo-input')).toHaveAttribute('accept', expect.stringMatching(/image\/jpeg/));
    // Sigue pudiendo descartarse
    expect(within(item).getByRole('button', { name: /descartar/i })).toBeInTheDocument();
  });

  it('UT-3811-02: agregar una foto la guarda en el borrador y reintenta el envío', async () => {
    getAllPendingSyncReports.mockResolvedValue([draftSinFotos()]);
    renderPage();
    const item = await screen.findByTestId('pending-report-item');
    const foto = new File(['bytes'], 'calle.jpg', { type: 'image/jpeg' });

    elegirFoto(item, foto);

    await waitFor(() =>
      expect(updateDraftReport).toHaveBeenCalledWith('draft-1', {
        evidenceList: [expect.objectContaining({ file: foto, name: 'calle.jpg', mimeType: 'image/jpeg' })],
      })
    );
    await waitFor(() => expect(syncPendingReports).toHaveBeenCalledWith({ userId: 'user-1' }));
  });

  it('UT-3811-03: un archivo que no es JPG, PNG o WebP no se guarda y avisa por qué', async () => {
    getAllPendingSyncReports.mockResolvedValue([draftSinFotos()]);
    renderPage();
    const item = await screen.findByTestId('pending-report-item');

    elegirFoto(item, new File(['gif'], 'animada.gif', { type: 'image/gif' }));

    expect(await within(item).findByRole('alert')).toHaveTextContent(/JPG, PNG o WebP/i);
    expect(updateDraftReport).not.toHaveBeenCalled();
    expect(syncPendingReports).not.toHaveBeenCalled();
  });

  it('UT-3811-04: una foto de más de 10 MB no se guarda', async () => {
    getAllPendingSyncReports.mockResolvedValue([draftSinFotos()]);
    renderPage();
    const item = await screen.findByTestId('pending-report-item');
    const pesada = new File(['x'], 'enorme.jpg', { type: 'image/jpeg' });
    Object.defineProperty(pesada, 'size', { value: 11 * 1024 * 1024 });

    elegirFoto(item, pesada);

    expect(await within(item).findByRole('alert')).toHaveTextContent(/10 MB/i);
    expect(updateDraftReport).not.toHaveBeenCalled();
  });

  it('UT-3811-05: sin conexión guarda la foto, avisa que se enviará sola y no intenta enviar', async () => {
    setOnline(false);
    getAllPendingSyncReports.mockResolvedValue([draftSinFotos()]);
    renderPage();
    const item = await screen.findByTestId('pending-report-item');

    elegirFoto(item, new File(['bytes'], 'calle.jpg', { type: 'image/jpeg' }));

    await waitFor(() => expect(updateDraftReport).toHaveBeenCalled());
    expect(syncPendingReports).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Foto agregada', expect.anything());
  });

  it('UT-3811-06: si no se puede guardar la foto, avisa y no reintenta', async () => {
    updateDraftReport.mockRejectedValue(new Error('IndexedDB lleno'));
    getAllPendingSyncReports.mockResolvedValue([draftSinFotos()]);
    renderPage();
    const item = await screen.findByTestId('pending-report-item');

    elegirFoto(item, new File(['bytes'], 'calle.jpg', { type: 'image/jpeg' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('No pudimos guardar la foto', expect.anything()));
    expect(syncPendingReports).not.toHaveBeenCalled();
  });

  it('UT-3811-07: un borrador que ya tiene fotos no ofrece agregar otra', async () => {
    getAllPendingSyncReports.mockResolvedValue([
      draftSinFotos({ evidenceList: [{ id: 'e1', blob: new Blob(['x'], { type: 'image/jpeg' }), name: 'f.jpg', mimeType: 'image/jpeg' }] }),
    ]);
    renderPage();

    const item = await screen.findByTestId('pending-report-item');
    expect(within(item).queryByRole('button', { name: /agregar foto/i })).not.toBeInTheDocument();
  });

  it('UT-3811-08: «Falta completar un dato» sí aparece si el dato es la foto, porque la tarjeta la permite cargar', async () => {
    getAllPendingSyncReports.mockResolvedValue([draftSinFotos()]);
    syncPendingReports.mockResolvedValue({
      sent: 0, failed: 1, remaining: 1, offline: false,
      errors: [{ clientSideId: 'draft-1', error: 'El borrador no tiene fotos guardadas.', code: 'PHOTOS', kind: 'invalid' }],
    });
    renderPage();
    const item = await screen.findByTestId('pending-report-item');

    fireEvent.click(screen.getByRole('button', { name: /reintentar ahora/i }));

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('Falta completar un dato', expect.anything()));
    expect(within(item).getByRole('button', { name: /agregar foto/i })).toBeInTheDocument();
  });

  it('UT-3811-09: si lo que falta NO se puede completar en la tarjeta (categoría), no se pide completarlo', async () => {
    getAllPendingSyncReports.mockResolvedValue([draftSinFotos({ selectedCategory: null, evidenceList: [{ id: 'e1', blob: new Blob(['x']), name: 'f.jpg', mimeType: 'image/jpeg' }] })]);
    syncPendingReports.mockResolvedValue({
      sent: 0, failed: 1, remaining: 1, offline: false,
      errors: [{ clientSideId: 'draft-1', error: 'Falta la categoría del reporte.', code: 'CATEGORY', kind: 'invalid' }],
    });
    renderPage();
    await screen.findByTestId('pending-report-item');

    fireEvent.click(screen.getByRole('button', { name: /reintentar ahora/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Algunos reportes no se pudieron enviar', expect.anything()));
    expect(toast.warning).not.toHaveBeenCalledWith('Falta completar un dato', expect.anything());
  });
});
