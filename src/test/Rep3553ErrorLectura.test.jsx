/**
 * @file Rep3553ErrorLectura.test.jsx
 * @description REP-3553 (hallazgo): si la lectura de «Mis reportes» falla, la pantalla decía «Todavía no enviaste reportes» y
 * ofrecía «Hacer mi primer reporte»: el ciudadano podía creer que había perdido sus reportes. Ahora distingue tres
 * situaciones (UJ v3.3 M26-M28): cargando, vacío de verdad y error de lectura, con la posibilidad de reintentar.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const { getMyReportsMock, getPendingMock } = vi.hoisted(() => ({ getMyReportsMock: vi.fn(), getPendingMock: vi.fn() }));
vi.mock('../services/reportSubmissionService', () => ({ getMyReports: getMyReportsMock }));
vi.mock('../services/offlineStorageService', () => ({
  getAllPendingSyncReports: getPendingMock,
  getActiveDraftReport: vi.fn().mockResolvedValue(null),
}));

import { ReportsPage } from '../pages/ReportsPage';

const Donde = () => <div data-testid="donde">{useLocation().pathname}</div>;
const auth = {
  session: { user: { id: 'u1' } },
  user: { id: 'u1', email: 'lucia@example.com', user_metadata: { full_name: 'Lucía' } },
  loading: false,
  signOut: vi.fn(),
};
const fila = { id: '00000001-aaaa-4bbb-8ccc-000000000001', description: 'd', current_state_code: 'EN_ANALISIS', created_at: '2026-08-09T10:00:00', services: { service_name: 'Tránsito' }, localities: { name: 'Wilde' } };

const montar = () =>
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/reportes']}>
        <Routes>
          <Route path="/reportes" element={<ReportsPage />} />
          <Route path="*" element={<Donde />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('REP-3553: error de lectura en Mis reportes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getPendingMock.mockResolvedValue([]);
  });

  it('UT-V3553-10: si la lectura falla no dice «todavía no enviaste reportes»: explica el problema y que no se perdió nada', async () => {
    getMyReportsMock.mockResolvedValue({ success: false, reports: [], error: 'sin red' });
    montar();

    const error = await screen.findByTestId('reports-error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(within(error).getByText(/no pudimos cargar tus reportes/i)).toBeInTheDocument();
    expect(within(error).getByText(/no se perdieron/i)).toBeInTheDocument();
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    expect(screen.queryByText(/todavía no enviaste reportes/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hacer mi primer reporte/i })).not.toBeInTheDocument();
  });

  it('UT-V3553-11: «Reintentar» vuelve a pedir la lista y, si ahora funciona, la muestra', async () => {
    getMyReportsMock.mockResolvedValueOnce({ success: false, reports: [], error: 'sin red' }).mockResolvedValueOnce({ success: true, reports: [fila] });
    montar();

    fireEvent.click(await within(await screen.findByTestId('reports-error')).findByRole('button', { name: /reintentar/i }));

    expect(await screen.findByTestId('report-row')).toBeInTheDocument();
    expect(getMyReportsMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('reports-error')).not.toBeInTheDocument();
  });

  it('UT-V3553-12: si el reintento también falla sigue mostrando el error (y si no hay ningún reporte, recién ahí el vacío)', async () => {
    getMyReportsMock.mockResolvedValueOnce({ success: false, reports: [], error: 'x' }).mockResolvedValueOnce({ success: false, reports: [], error: 'x' }).mockResolvedValueOnce({ success: true, reports: [] });
    montar();

    fireEvent.click(await within(await screen.findByTestId('reports-error')).findByRole('button', { name: /reintentar/i }));
    await waitFor(() => expect(getMyReportsMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('reports-error')).toBeInTheDocument();

    fireEvent.click(within(screen.getByTestId('reports-error')).getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('reports-error')).not.toBeInTheDocument();
  });

  it('UT-V3553-13: mientras reintenta muestra «Cargando» y no el error ni el vacío', async () => {
    getMyReportsMock.mockResolvedValueOnce({ success: false, reports: [], error: 'x' }).mockReturnValueOnce(new Promise(() => {}));
    montar();

    fireEvent.click(await within(await screen.findByTestId('reports-error')).findByRole('button', { name: /reintentar/i }));
    expect(await screen.findByText(/cargando tus reportes/i)).toBeInTheDocument();
    expect(screen.queryByTestId('reports-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
  });

  it('UT-V3553-14: con un error de lectura los borradores sin enviar siguen a la vista', async () => {
    getMyReportsMock.mockResolvedValue({ success: false, reports: [], error: 'sin red' });
    getPendingMock.mockResolvedValue([{ client_side_id: 'd1', description: 'Contenedor desbordado' }]);
    montar();

    expect(await screen.findByTestId('pending-draft-row')).toBeInTheDocument();
    expect(await screen.findByTestId('reports-error')).toBeInTheDocument();
  });

  it('UT-V3553-15: el error ofrece salida al mapa', async () => {
    getMyReportsMock.mockResolvedValue({ success: false, reports: [], error: 'sin red' });
    montar();
    fireEvent.click(await within(await screen.findByTestId('reports-error')).findByRole('button', { name: /ver el mapa/i }));
    expect(screen.getByTestId('donde')).toHaveTextContent('/mapa');
  });
});
