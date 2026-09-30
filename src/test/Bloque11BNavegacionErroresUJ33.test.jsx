/**
 * REP-3791 Bloque 11-B · Navegación global y errores (UJ v3.3 · D16, D17, D19, M30/D36, M32/D38).
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { AppLayout, AppDesktopHeader } from '../components/layout/AppLayout';
import { NotFoundReportPage } from '../pages/NotFoundReportPage';
import { ForbiddenPage } from '../pages/ForbiddenPage';
import { ReportSuccessScreen } from '../components/report/ReportSuccessScreen';

const mockMatchMedia = (matches) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

const withSession = {
  session: { user: { id: 'usr-1', email: 'lucia@example.com' } },
  user: { id: 'usr-1', email: 'lucia@example.com', user_metadata: { full_name: 'Lucía Fernández' } },
  loading: false,
};

// Muestra la ruta actual para verificar a dónde lleva cada acción
const CurrentPath = () => {
  const location = useLocation();
  return <span data-testid="current-path">{location.pathname}</span>;
};

describe('REP-3791 Bloque 11-B · Navegación global y errores', () => {
  afterEach(() => {
    delete window.matchMedia;
  });

  it('UT-B11B-01: la barra de escritorio tiene campana y lleva a Notificaciones (D19)', () => {
    render(
      <AuthContext.Provider value={withSession}>
        <MemoryRouter initialEntries={['/reportes']}>
          <AppDesktopHeader activeTab="reportes" />
          <Routes>
            <Route path="*" element={<CurrentPath />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    const header = screen.getByTestId('app-desktop-header');
    expect(within(header).getByRole('link', { name: 'Mis reportes' })).toHaveAttribute('aria-current', 'page');
    expect(within(header).getByText('LF')).toBeInTheDocument();

    fireEvent.click(within(header).getByRole('button', { name: /ver notificaciones/i }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('/notificaciones');
  });

  it('UT-B11B-02: en /notificaciones no queda marcada la pestaña «Novedades»', () => {
    render(
      <MemoryRouter initialEntries={['/notificaciones']}>
        <AppLayout activeTab="alertas">
          <div>Notificaciones</div>
        </AppLayout>
      </MemoryRouter>
    );

    const tabs = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(within(tabs).queryByRole('button', { current: 'page' })).not.toBeInTheDocument();
    const desktopNav = screen.getByRole('navigation', { name: 'Secciones' });
    expect(within(desktopNav).queryByRole('link', { current: 'page' })).not.toBeInTheDocument();
  });

  it('UT-B11B-03: M30 con sesión vuelve al mapa y conserva las pestañas', () => {
    render(
      <AuthContext.Provider value={withSession}>
        <MemoryRouter initialEntries={['/r/RP-1907']}>
          <Routes>
            <Route path="/r/:id" element={<NotFoundReportPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByRole('heading', { name: 'Este reporte ya no está' })).toBeInTheDocument();
    expect(screen.getByText('reportalo.ar/r/RP-1907')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/mapa');
    expect(screen.getByRole('link', { name: 'Ir a mis reportes' })).toHaveAttribute('href', '/reportes');
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();
  });

  it('UT-B11B-04: M30 sin sesión no muestra pestañas y vuelve a la bienvenida', () => {
    render(
      <MemoryRouter initialEntries={['/r/RP-1907']}>
        <Routes>
          <Route path="/r/:id" element={<NotFoundReportPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument();
  });

  it('UT-B11B-05: D36 en escritorio con sesión usa la barra global', () => {
    mockMatchMedia(true);
    render(
      <AuthContext.Provider value={withSession}>
        <MemoryRouter initialEntries={['/r/RP-1907']}>
          <Routes>
            <Route path="/r/:id" element={<NotFoundReportPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    const header = screen.getByTestId('app-desktop-header');
    expect(within(header).getByRole('link', { name: 'Mapa' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: 'Volver' })).not.toBeInTheDocument();
  });

  it('UT-B11B-06: M32 sigue el diseño y con sesión conserva las pestañas', () => {
    render(
      <AuthContext.Provider value={withSession}>
        <MemoryRouter initialEntries={[{ pathname: '/acceso-restringido', state: { from: '/municipio/avellaneda', sectionLabel: 'Panel del municipio' } }]}>
          <Routes>
            <Route path="/acceso-restringido" element={<ForbiddenPage />} />
            <Route path="/mapa" element={<CurrentPath />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByRole('heading', { name: 'Error 403 - Acceso Denegado' })).toBeInTheDocument();
    expect(screen.getByText('Panel del municipio')).toBeInTheDocument();
    expect(screen.getByText('/municipio/avellaneda')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('/mapa');
  });

  it('UT-B11B-07: D16 muestra la barra global solo en escritorio', () => {
    const topBar = <div data-testid="barra-global">Barra</div>;

    mockMatchMedia(false);
    const { unmount } = render(<ReportSuccessScreen onViewReport={vi.fn()} onReturnToMap={vi.fn()} desktopTopBar={topBar} />);
    expect(screen.queryByTestId('barra-global')).not.toBeInTheDocument();
    unmount();

    mockMatchMedia(true);
    render(<ReportSuccessScreen onViewReport={vi.fn()} onReturnToMap={vi.fn()} desktopTopBar={topBar} />);
    expect(screen.getByTestId('barra-global')).toBeInTheDocument();
    // Los botones de escritorio siguen dentro de la tarjeta
    expect(screen.getByRole('button', { name: 'Ver el reporte' })).toBeInTheDocument();
  });
});
