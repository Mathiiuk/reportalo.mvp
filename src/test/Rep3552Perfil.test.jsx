/**
 * @file Rep3552Perfil.test.jsx
 * @description REP-3552 · «Consultar mi perfil» (con REP-3556): pruebas de integración de /perfil contra los criterios de la
 * historia. La pantalla ya estaba hecha (REP-3532, REP-3791 Bloque 6); lo que faltaba era el acceso a ayuda/FAQ (entregado en
 * REP-3554) y la verificación integrada de la navegación y el cierre de sesión.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), default: vi.fn() } }));
vi.mock('../services/reportSubmissionService', () => ({
  getMyReports: vi.fn().mockResolvedValue({ success: true, reports: [{ id: 'r1', current_state_code: 'RECIBIDO' }] }),
}));
vi.mock('../services/offlineStorageService', () => ({ getAllPendingSyncReports: vi.fn().mockResolvedValue([]) }));

import { ProfilePage } from '../pages/ProfilePage';

const Donde = () => <div data-testid="donde">{useLocation().pathname}</div>;

const signOut = vi.fn().mockResolvedValue(undefined);
const auth = {
  session: { user: { id: 'u1' } },
  user: { id: 'u1', email: 'lucia.f@mail.com', user_metadata: { full_name: 'Lucía Fernández' } },
  loading: false,
  signOut,
};

const montar = () =>
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/perfil']}>
        <Routes>
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="*" element={<Donde />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('REP-3552: Mi perfil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    signOut.mockResolvedValue(undefined);
  });

  it('UT-V3552-01: muestra la información básica de la cuenta disponible para el MVP (nombre, correo, iniciales y métricas)', async () => {
    montar();

    expect(screen.getByRole('heading', { name: /mi perfil/i })).toBeInTheDocument();
    expect(screen.getByText('Lucía Fernández')).toBeInTheDocument();
    expect(screen.getByText('lucia.f@mail.com')).toBeInTheDocument();
    expect(screen.getAllByText('LF').length).toBeGreaterThanOrEqual(1);
    await waitFor(() => expect(screen.getByTestId('profile-stat-total')).toHaveTextContent('1'));
  });

  it('UT-V3552-02: es una pestaña de la navegación principal y aparece como la pantalla actual', () => {
    montar();

    const barra = screen.getByRole('navigation', { name: /navegación principal/i });
    expect(within(barra).getByRole('button', { name: 'Perfil' })).toHaveAttribute('aria-current', 'page');
    expect(within(barra).getByRole('button', { name: 'Mapa' })).not.toHaveAttribute('aria-current');
  });

  it('UT-V3552-03: desde el perfil se puede volver a /mapa', () => {
    montar();
    const barra = screen.getByRole('navigation', { name: /navegación principal/i });

    fireEvent.click(within(barra).getByRole('button', { name: 'Mapa' }));
    expect(screen.getByTestId('donde')).toHaveTextContent('/mapa');
  });

  it('UT-V3552-04: desde el perfil se accede a Mis reportes', () => {
    montar();
    const barra = screen.getByRole('navigation', { name: /navegación principal/i });

    fireEvent.click(within(barra).getByRole('button', { name: 'Mis reportes' }));
    expect(screen.getByTestId('donde')).toHaveTextContent('/reportes');
  });

  it('UT-V3552-05: contempla el acceso a ayuda y preguntas frecuentes', () => {
    montar();
    fireEvent.click(screen.getByTestId('profile-faq-btn'));
    expect(screen.getByTestId('donde')).toHaveTextContent('/faq');
  });

  it('UT-V3552-06: ofrece las acciones de la cuenta, incluido el cierre de sesión ya resuelto por REP-3520', async () => {
    montar();

    expect(screen.getByRole('button', { name: /descargar mis datos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /eliminar mi cuenta/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('donde')).toHaveTextContent('/login'));
  });

  it.each([
    ['profile-news-btn', '/alertas'],
    ['profile-permissions-btn', '/permisos'],
    ['profile-terms-btn', '/terminos'],
  ])('UT-V3552-07: el menú del perfil (%s) lleva a %s', (testId, ruta) => {
    montar();
    fireEvent.click(screen.getByTestId(testId));
    expect(screen.getByTestId('donde')).toHaveTextContent(ruta);
  });
});
