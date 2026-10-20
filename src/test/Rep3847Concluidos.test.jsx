/**
 * @file Rep3847Concluidos.test.jsx
 * @description REP-3847 (BUG-Q1 de la QA REP-3832): un reporte de vulnerabilidad social cerrado como INFORMADO
 * aparecía en «Resueltos · 1» (Mis reportes) y «1 RESUELTOS» (Perfil), como si un organismo hubiera resuelto el
 * problema. El grupo de cerrados pasa a llamarse «Concluidos» (decisión del PO, propuesta de Iván). Las insignias de
 * cada reporte no cambian: «Resuelto» queda para un reporte que un organismo cerró como RESUELTO.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
import { ProfilePage } from '../pages/ProfilePage';

const auth = {
  session: { user: { id: 'u1' } },
  user: { id: 'u1', email: 'lucia@example.com', user_metadata: { full_name: 'Lucía Fernández' } },
  loading: false,
  signOut: vi.fn(),
};

const fila = (n, estado) => ({
  id: `0000000${n}-aaaa-4bbb-8ccc-00000000000${n}`,
  description: `Descripción del reporte ${n}`,
  current_state_code: estado,
  created_at: '2026-10-15T10:00:00',
  services: { service_name: 'Vulnerabilidad social' },
  localities: { name: 'Parque Chacabuco' },
});

// Un abierto y los tres cerrados: INFORMADO (el caso del bug), RESUELTO y DESESTIMADO
const REPORTES = [fila(1, 'EN_ANALISIS'), fila(2, 'INFORMADO'), fila(3, 'RESUELTO'), fila(4, 'DESESTIMADO')];

const montar = (pagina) =>
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>{pagina}</MemoryRouter>
    </AuthContext.Provider>
  );

describe('REP-3847 · «Concluidos» en lugar de «Resueltos»', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getPendingMock.mockResolvedValue([]);
    getMyReportsMock.mockResolvedValue({ success: true, reports: REPORTES });
  });

  it('UT-3847-01 (CA-Q1-1): los filtros son Todos, En curso y Concluidos, y Concluidos agrupa INFORMADO, RESUELTO y DESESTIMADO', async () => {
    montar(<ReportsPage />);
    await screen.findAllByTestId('report-row');

    expect(screen.getByRole('button', { name: 'Todos · 4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'En curso · 1' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Concluidos · 3' }));
    expect(screen.getAllByTestId('report-row')).toHaveLength(3);
  });

  it('UT-3847-02 (CA-Q1-3): las insignias de cada reporte no cambian; un INFORMADO no se rotula «Resuelto»', async () => {
    montar(<ReportsPage />);
    const filas = await screen.findAllByTestId('report-row');

    expect(filas[1]).toHaveTextContent(/informado/i);
    expect(filas[1]).not.toHaveTextContent(/resuelt/i);
    expect(filas[2]).toHaveTextContent(/resuelto/i);
  });

  it('UT-3847-03 (CA-Q1-2): el contador de Perfil se llama CONCLUIDOS y cuenta lo mismo que el filtro', async () => {
    montar(<ProfilePage />);

    await waitFor(() => expect(screen.getByTestId('profile-stat-closed')).toHaveTextContent('3'));
    const tarjeta = screen.getByTestId('profile-stat-closed').parentElement;
    expect(within(tarjeta).getByText('CONCLUIDOS')).toBeInTheDocument();
  });

  it('UT-3847-04 (CA-Q1-4): «Resueltos» no aparece como nombre de grupo ni de contador', async () => {
    const { unmount } = montar(<ReportsPage />);
    await screen.findAllByTestId('report-row');
    expect(screen.queryByText(/resueltos/i)).not.toBeInTheDocument();
    unmount();

    montar(<ProfilePage />);
    await waitFor(() => expect(screen.getByTestId('profile-stat-closed')).toHaveTextContent('3'));
    expect(screen.queryByText(/resueltos/i)).not.toBeInTheDocument();
  });
});
