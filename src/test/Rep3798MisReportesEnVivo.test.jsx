/**
 * @file Rep3798MisReportesEnVivo.test.jsx
 * @description REP-3798: Mis reportes se actualiza solo cuando cambia el estado de un reporte.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const { getMyReportsMock, getPendingMock, refreshMock } = vi.hoisted(() => ({
  getMyReportsMock: vi.fn(),
  getPendingMock: vi.fn(),
  refreshMock: vi.fn(),
}));
vi.mock('../services/reportSubmissionService', () => ({ getMyReports: getMyReportsMock }));
vi.mock('../services/offlineStorageService', () => ({
  getAllPendingSyncReports: getPendingMock,
  getActiveDraftReport: vi.fn().mockResolvedValue(null),
}));
vi.mock('../hooks/useUnreadNotifications', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, refreshUnreadCount: refreshMock };
});

import { ReportsPage, REPORTS_POLL_INTERVAL_MS } from '../pages/ReportsPage';

const auth = {
  session: { user: { id: 'u1' } },
  user: { id: 'u1', email: 'a@b.c', user_metadata: {} },
  loading: false,
  signOut: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithMagicLink: vi.fn(),
};

const row = (state) => ({
  id: 'a1b2c3d4-2048-4a2b-9c3d-00000000abcd',
  description: 'Bache',
  current_state_code: state,
  created_at: '2026-08-09T10:00:00',
  services: { service_name: 'Tránsito' },
  localities: { name: 'Wilde' },
});

const mount = () =>
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter><ReportsPage /></MemoryRouter>
    </AuthContext.Provider>
  );

describe('REP-3798 · Mis reportes en vivo', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    getPendingMock.mockResolvedValue([]);
    getMyReportsMock.mockResolvedValue({ success: true, reports: [row('RECIBIDO')] });
  });
  afterEach(() => vi.useRealTimers());

  it('UT-LIVE-11: si un reporte cambia de estado, la fila se actualiza sola y se refresca la campana', async () => {
    mount();
    const first = await screen.findByTestId('report-row');
    expect(within(first).getByText('Enviado')).toBeInTheDocument();

    getMyReportsMock.mockResolvedValue({ success: true, reports: [row('EN_ANALISIS')] });
    // El intervalo arranca unos ms después de montar: se avanza un poco de más
    await act(async () => { await vi.advanceTimersByTimeAsync(REPORTS_POLL_INTERVAL_MS + 2000); });

    const updated = await screen.findByText('En revisión');
    expect(updated).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalledWith('u1', { force: true });
  });

  it('UT-LIVE-12: si nada cambió, no toca la lista ni la campana', async () => {
    mount();
    await screen.findByTestId('report-row');
    await act(async () => { await vi.advanceTimersByTimeAsync(REPORTS_POLL_INTERVAL_MS * 2 + 2000); });
    expect(getMyReportsMock.mock.calls.length).toBeGreaterThan(1);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('UT-LIVE-13: si todos los reportes están cerrados no se sondea', async () => {
    getMyReportsMock.mockResolvedValue({ success: true, reports: [row('RESUELTO')] });
    mount();
    await screen.findByTestId('report-row');
    const calls = getMyReportsMock.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(REPORTS_POLL_INTERVAL_MS * 3); });
    expect(getMyReportsMock.mock.calls.length).toBe(calls);
  });
});
