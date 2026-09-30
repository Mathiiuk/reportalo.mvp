/**
 * REP-3791 Bloque 11-D · Ajustes finos del UJ v3.3 (M17 · D18, M19 · D20, M23, M27).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

import { formatListDate } from '../components/report/reportStatus';
import { ReportsPage } from '../pages/ReportsPage';
import { ProfilePage } from '../pages/ProfilePage';
import { NewsPage } from '../pages/NewsPage';
import { SessionExpiredPage } from '../pages/SessionExpiredPage';

const auth = {
  session: { user: { id: 'u1' } },
  user: { id: 'u1', email: 'lucia@example.com', user_metadata: { full_name: 'Lucía Fernández' } },
  loading: false,
  signOut: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithMagicLink: vi.fn(),
};

const withAuth = (ui) => render(
  <AuthContext.Provider value={auth}>
    <MemoryRouter>{ui}</MemoryRouter>
  </AuthContext.Provider>
);

describe('REP-3791 Bloque 11-D · Ajustes finos', () => {
  beforeEach(() => {
    localStorage.clear();
    getPendingMock.mockResolvedValue([]);
    getMyReportsMock.mockResolvedValue({ success: true, reports: [] });
  });

  it('UT-B11D-01: formatListDate usa «hoy», «ayer» o la fecha corta, como M17', () => {
    const now = new Date('2026-09-29T15:00:00');
    expect(formatListDate('2026-09-29T14:32:00', now)).toBe('hoy 14:32');
    expect(formatListDate('2026-09-28T19:40:00', now)).toBe('ayer 19:40');
    expect(formatListDate('2026-08-09T10:00:00', now)).toBe('09/08');
    expect(formatListDate(null, now)).toBe('');
  });

  it('UT-B11D-02: M17 identifica cada fila por número y categoría, y abajo el lugar con la fecha', async () => {
    getMyReportsMock.mockResolvedValue({
      success: true,
      reports: [{
        id: 'a1b2c3d4-2048-4a2b-9c3d-00000000abcd',
        description: 'Bache profundo en la esquina',
        current_state_code: 'EN_ANALISIS',
        created_at: '2026-08-09T10:00:00',
        services: { service_name: 'Tránsito' },
        localities: { name: 'Wilde' },
      }],
    });
    withAuth(<ReportsPage />);

    const row = await screen.findByTestId('report-row');
    expect(row).toHaveTextContent('#RP-A1B2C3D4 · Tránsito');
    expect(row).toHaveTextContent('Wilde · 09/08');
    // La descripción no es el título de la fila (queda como texto de ayuda)
    expect(row).not.toHaveTextContent('Bache profundo en la esquina');
  });

  it('UT-B11D-03: M19 marca «Sin aceptar» cuando todavía no se aceptaron los términos', async () => {
    withAuth(<ProfilePage />);
    expect(await screen.findByText('Sin aceptar')).toBeInTheDocument();
    expect(screen.getByTestId('profile-terms-detail')).toHaveTextContent(/todavía no los aceptaste/i);
  });

  it('UT-B11D-04: M27 sin publicaciones no muestra los filtros', async () => {
    withAuth(<NewsPage />);
    expect(await screen.findByRole('heading', { name: /todavía no hay publicaciones/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Municipio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerca mío' })).not.toBeInTheDocument();
  });

  it('UT-B11D-05: M23 conserva las dos salidas sobre el mapa atenuado', () => {
    render(
      <AuthContext.Provider value={{ ...auth, session: null, user: null }}>
        <MemoryRouter><SessionExpiredPage /></MemoryRouter>
      </AuthContext.Provider>
    );
    expect(screen.getByRole('heading', { name: 'Tu sesión venció' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviarme un enlace/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument();
  });
});
