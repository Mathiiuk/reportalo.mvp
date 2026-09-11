import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProfilePage } from '../pages/ProfilePage';
import { AuthContext } from '../context/AuthContext';
import * as notificationService from '../services/notificationService';

// Mock de sonner
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    default: vi.fn(),
  },
}));

describe('REP-3532: Pantalla de Perfil Ciudadano y Gestión de Notificaciones PWA', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  const mockAuthContext = {
    session: { user: { id: 'usr-123', email: 'lucia.f@mail.com', user_metadata: { full_name: 'Lucía F.' } } },
    user: { id: 'usr-123', email: 'lucia.f@mail.com', user_metadata: { full_name: 'Lucía F.' } },
    loading: false,
    signOut: vi.fn(),
  };

  it('UT-PF-01: Renderiza los datos del usuario, avatar con iniciales y métricas de reportes', () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter initialEntries={['/perfil']}>
          <ProfilePage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getAllByText('LF').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Lucía F.')).toBeInTheDocument();
    expect(screen.getByText('lucia.f@mail.com')).toBeInTheDocument();

    // Métricas
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('REPORTES')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('RESUELTOS')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('SIN ENVIAR')).toBeInTheDocument();
  });

  it('UT-PF-02: El menú contiene Notificaciones, Novedades (con ícono newspaper), Permisos de la app y Descargar datos', () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter initialEntries={['/perfil']}>
          <ProfilePage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Notificaciones')).toBeInTheDocument();
    expect(screen.getByText('Avisos del estado de tus reportes')).toBeInTheDocument();
    expect(screen.getAllByText('Novedades').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('newspaper')).toBeInTheDocument();
    expect(screen.getByText('Permisos de la app')).toBeInTheDocument();
    expect(screen.getByText('Descargar mis datos')).toBeInTheDocument();
  });

  it('UT-PF-03: Toggle de notificaciones refleja el permiso del navegador cuando está concedido y permite alternar', async () => {
    vi.spyOn(notificationService, 'getNotificationPermission').mockReturnValue('granted');
    vi.spyOn(notificationService, 'isNotificationsEnabled').mockReturnValue(true);

    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter initialEntries={['/perfil']}>
          <ProfilePage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    const toggleBtn = screen.getByRole('switch', { name: /Notificaciones/i });
    expect(toggleBtn).toHaveAttribute('aria-checked', 'true');

    // Desactivar notificaciones en la app
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem('reportalo_perm_notifications')).toBe('false');

    // Reactivar notificaciones en la app
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('reportalo_perm_notifications')).toBe('true');
  });

  it('UT-PF-04: Si las notificaciones están bloqueadas en el SO/navegador, abre ajustes del sistema y muestra modal instructivo', async () => {
    vi.spyOn(notificationService, 'getNotificationPermission').mockReturnValue('denied');
    vi.spyOn(notificationService, 'isNotificationPermissionBlocked').mockReturnValue(true);
    const settingsSpy = vi.spyOn(notificationService, 'openSystemNotificationSettings').mockReturnValue(true);
    const requestSpy = vi.spyOn(notificationService, 'requestNotificationPermission');

    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter initialEntries={['/perfil']}>
          <ProfilePage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    const toggleBtn = screen.getByRole('switch', { name: /Notificaciones/i });
    expect(toggleBtn).toHaveAttribute('aria-checked', 'false');

    // Clic al toggle con permiso bloqueado
    fireEvent.click(toggleBtn);

    // No debe intentar forzar el diálogo de requestPermission que el SO ignoraría
    expect(requestSpy).not.toHaveBeenCalled();
    // Debe intentar abrir los ajustes del SO
    expect(settingsSpy).toHaveBeenCalled();

    // Debe mostrar el modal explicativo
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Notificaciones bloqueadas en tu dispositivo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abrir ajustes del SO/i })).toBeInTheDocument();
  });

  it('UT-PF-05: Si las notificaciones están en estado default, solicita permiso al usuario', async () => {
    vi.spyOn(notificationService, 'getNotificationPermission').mockReturnValue('default');
    vi.spyOn(notificationService, 'isNotificationsEnabled').mockReturnValue(false);
    const requestSpy = vi.spyOn(notificationService, 'requestNotificationPermission').mockResolvedValue('granted');
    const localNotifSpy = vi.spyOn(notificationService, 'sendLocalNotification').mockResolvedValue(true);

    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter initialEntries={['/perfil']}>
          <ProfilePage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    const toggleBtn = screen.getByRole('switch', { name: /Notificaciones/i });
    expect(toggleBtn).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(requestSpy).toHaveBeenCalled();
      expect(localNotifSpy).toHaveBeenCalled();
      expect(toggleBtn).toHaveAttribute('aria-checked', 'true');
    });
  });

  it('UT-PF-06: Clic en Novedades navega a /alertas y cede la campana a Notificaciones', async () => {
    const NewsDestination = () => <div data-testid="news-view">Vista de Novedades</div>;

    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter initialEntries={['/perfil']}>
          <Routes>
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/alertas" element={<NewsDestination />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    const newsBtn = screen.getByTestId('profile-news-btn');
    fireEvent.click(newsBtn);

    await waitFor(() => {
      expect(screen.getByTestId('news-view')).toBeInTheDocument();
    });
  });

  it('UT-PF-07: Clic en Permisos de la app navega a /permisos', async () => {
    const PermissionsDestination = () => <div data-testid="permissions-view">Vista de Permisos</div>;

    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter initialEntries={['/perfil']}>
          <Routes>
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/permisos" element={<PermissionsDestination />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    const permBtn = screen.getByTestId('profile-permissions-btn');
    fireEvent.click(permBtn);

    await waitFor(() => {
      expect(screen.getByTestId('permissions-view')).toBeInTheDocument();
    });
  });

  it('UT-PF-08: Clic en Descargar mis datos genera la exportación del historial ciudadano', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter initialEntries={['/perfil']}>
          <ProfilePage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    const downloadBtn = screen.getByRole('button', { name: /Descargar mis datos/i });
    fireEvent.click(downloadBtn);

    expect(appendSpy).toHaveBeenCalled();
  });

  it('UT-PF-09: Tarjeta de términos muestra versión v1.3 y navega a /terminos en modo consulta', async () => {
    const TermsDestination = () => <div data-testid="terms-view">Vista de Términos</div>;

    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter initialEntries={['/perfil']}>
          <Routes>
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/terminos" element={<TermsDestination />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText(/Términos aceptados/i)).toBeInTheDocument();
    expect(screen.getByText(/v1.3/i)).toBeInTheDocument();

    const termsBtn = screen.getByRole('button', { name: /Ver el texto aceptado/i });
    fireEvent.click(termsBtn);

    await waitFor(() => {
      expect(screen.getByTestId('terms-view')).toBeInTheDocument();
    });
  });
});
