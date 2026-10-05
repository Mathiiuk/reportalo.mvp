/**
 * @file Rep3553MisReportes.test.jsx
 * @description REP-3553 · «Consultar mis reportes» (con REP-3559 y REP-3571): pruebas de integración de /reportes contra los
 * criterios de la historia. La pantalla y el componente EmptyState ya estaban hechos (REP-3791 Bloques 6 y 9); estas
 * pruebas dejan verificado, de punta a punta en la pantalla real, lo que antes solo se probaba por partes.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const { getMyReportsMock, getPendingMock } = vi.hoisted(() => ({
  getMyReportsMock: vi.fn(),
  getPendingMock: vi.fn(),
}));
vi.mock('../services/reportSubmissionService', () => ({ getMyReports: getMyReportsMock }));
vi.mock('../services/offlineStorageService', () => ({
  getAllPendingSyncReports: getPendingMock,
  getActiveDraftReport: vi.fn().mockResolvedValue(null),
}));

import { ReportsPage } from '../pages/ReportsPage';

const Donde = () => <div data-testid="donde">{useLocation().pathname}</div>;

const auth = {
  session: { user: { id: 'u1' } },
  user: { id: 'u1', email: 'lucia@example.com', user_metadata: { full_name: 'Lucía Fernández' } },
  loading: false,
  signOut: vi.fn(),
};

const fila = (n, estado, extra = {}) => ({
  id: `0000000${n}-aaaa-4bbb-8ccc-00000000000${n}`,
  description: `Descripción del reporte ${n}`,
  current_state_code: estado,
  created_at: '2026-08-09T10:00:00',
  services: { service_name: 'Tránsito' },
  localities: { name: 'Wilde' },
  ...extra,
});

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

describe('REP-3553: Mis reportes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getPendingMock.mockResolvedValue([]);
    getMyReportsMock.mockResolvedValue({ success: true, reports: [] });
  });

  it('UT-V3553-01: lista los reportes del ciudadano autenticado (se piden con su propio id) con número, categoría, lugar y estado', async () => {
    getMyReportsMock.mockResolvedValue({ success: true, reports: [fila(1, 'EN_ANALISIS'), fila(2, 'RESUELTO', { services: { service_name: 'Ambiente' } })] });
    montar();

    const filas = await screen.findAllByTestId('report-row');
    expect(getMyReportsMock).toHaveBeenCalledWith('u1');
    expect(filas).toHaveLength(2);
    expect(within(filas[0]).getByTestId('report-row-code')).toHaveTextContent('#RP-00000001');
    expect(within(filas[0]).getByTestId('report-row-category')).toHaveTextContent('Tránsito');
    expect(filas[0]).toHaveTextContent('Wilde');
    expect(filas[0]).toHaveTextContent(/en revisión/i);
    expect(filas[1]).toHaveTextContent('Ambiente');
    expect(filas[1]).toHaveTextContent(/resuelto/i);
  });

  it('UT-V3553-02: tocar un reporte abre su detalle', async () => {
    getMyReportsMock.mockResolvedValue({ success: true, reports: [fila(1, 'EN_ANALISIS')] });
    montar();

    fireEvent.click(await screen.findByTestId('report-row'));
    expect(screen.getByTestId('donde')).toHaveTextContent('/reportes/00000001-aaaa-4bbb-8ccc-000000000001');
  });

  it('UT-V3553-03: los filtros cuentan y separan «En curso» de «Resueltos»', async () => {
    getMyReportsMock.mockResolvedValue({ success: true, reports: [fila(1, 'RECIBIDO'), fila(2, 'EN_ANALISIS'), fila(3, 'RESUELTO')] });
    montar();
    await screen.findAllByTestId('report-row');

    expect(screen.getByRole('button', { name: 'Todos · 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'En curso · 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resueltos · 1' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Resueltos · 1' }));
    expect(screen.getAllByTestId('report-row')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'En curso · 2' }));
    expect(screen.getAllByTestId('report-row')).toHaveLength(2);
  });

  it('UT-V3553-04: sin reportes muestra el estado vacío (componente reutilizable) con su acción y su salida al mapa', async () => {
    montar();

    const vacio = await screen.findByTestId('empty-state');
    expect(within(vacio).getByRole('heading', { name: /todavía no enviaste reportes/i })).toBeInTheDocument();
    expect(screen.queryByTestId('report-row')).not.toBeInTheDocument();

    fireEvent.click(within(vacio).getByRole('button', { name: /hacer mi primer reporte/i }));
    expect(screen.getByTestId('donde')).toHaveTextContent('/nuevo-reporte');
  });

  it('UT-V3553-05: desde el estado vacío se puede volver al mapa', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /ver el mapa de la zona/i }));
    expect(screen.getByTestId('donde')).toHaveTextContent('/mapa');
  });

  it('UT-V3553-06: mientras carga no se dice «todavía no enviaste reportes»', async () => {
    getMyReportsMock.mockReturnValue(new Promise(() => {})); // nunca resuelve
    montar();

    expect(await screen.findByText(/cargando tus reportes/i)).toBeInTheDocument();
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
  });

  it('UT-V3553-07: con un borrador sin enviar y ningún reporte NO se muestra el estado vacío (no se contradice lo que se ve)', async () => {
    getPendingMock.mockResolvedValue([{ client_side_id: 'd1', description: 'Contenedor desbordado' }]);
    montar();

    expect(await screen.findByTestId('pending-draft-row')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/cargando tus reportes/i)).not.toBeInTheDocument());
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
  });

  it('UT-V3553-08: el borrador sin enviar lleva a Pendientes de envío', async () => {
    getPendingMock.mockResolvedValue([{ client_side_id: 'd1', description: 'Contenedor desbordado' }]);
    montar();
    fireEvent.click(await screen.findByTestId('pending-draft-row'));
    expect(screen.getByTestId('donde')).toHaveTextContent('/pendientes');
  });

  it('UT-V3553-09: la navegación de la app permite volver a /mapa y seguir (y está en Mis reportes)', async () => {
    montar();
    await screen.findByTestId('empty-state');

    const barra = screen.getByRole('navigation', { name: /navegación principal/i });
    expect(within(barra).getByRole('button', { name: 'Mis reportes' })).toBeInTheDocument();
    fireEvent.click(within(barra).getByRole('button', { name: 'Mapa' }));
    expect(screen.getByTestId('donde')).toHaveTextContent('/mapa');
  });
});
