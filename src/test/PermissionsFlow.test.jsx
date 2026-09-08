import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PermissionsPage } from '../pages/PermissionsPage';
import * as notificationService from '../services/notificationService';

describe('REP-3532: Flujo de Activación de Permisos Ciudadanos (Cámara, Ubicación, Notificaciones PWA)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('UT-PM-01: Renderiza los 3 permisos con sus switches y el banner de privacidad seguro', () => {
    render(
      <MemoryRouter>
        <PermissionsPage />
      </MemoryRouter>
    );

    // Título y descripción
    expect(screen.getByRole('heading', { name: /Activá los permisos/i, level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText(/Cámara y ubicación se usan al reportar; las notificaciones, para seguir tu reporte/i)
    ).toBeInTheDocument();

    // 3 permisos
    expect(screen.getByText('Cámara')).toBeInTheDocument();
    expect(screen.getByText(/Para capturar la foto que sirve de evidencia/i)).toBeInTheDocument();

    expect(screen.getByText('Ubicación')).toBeInTheDocument();
    expect(screen.getByText(/Para georreferenciar el reporte en el mapa/i)).toBeInTheDocument();

    expect(screen.getByText('Notificaciones')).toBeInTheDocument();
    expect(screen.getByText(/Para avisarte cuando cambie el estado de tu reporte/i)).toBeInTheDocument();

    // Banner verde de privacidad
    expect(
      screen.getByText(/Tu foto se procesa de forma segura: los rostros y patentes se difuminan automáticamente/i)
    ).toBeInTheDocument();

    // Botones de acción
    expect(screen.getByRole('button', { name: /Continuar/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Ahora no/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('UT-PM-02: Permite alternar (toggle) los switches de Cámara y Ubicación', () => {
    render(
      <MemoryRouter>
        <PermissionsPage />
      </MemoryRouter>
    );

    const cameraSwitch = screen.getByRole('switch', { name: /Permiso de cámara/i });
    expect(cameraSwitch).toHaveAttribute('aria-checked', 'true');

    // Apagar cámara
    fireEvent.click(cameraSwitch);
    expect(cameraSwitch).toHaveAttribute('aria-checked', 'false');

    // Encender cámara nuevamente
    fireEvent.click(cameraSwitch);
    expect(cameraSwitch).toHaveAttribute('aria-checked', 'true');
  });

  it('UT-PM-03: Al activar Notificaciones solicita permiso al servicio y actualiza el switch', async () => {
    vi.spyOn(notificationService, 'isNotificationSupported').mockReturnValue(true);
    const requestSpy = vi
      .spyOn(notificationService, 'requestNotificationPermission')
      .mockResolvedValue('granted');

    const sendLocalSpy = vi
      .spyOn(notificationService, 'sendLocalNotification')
      .mockResolvedValue(true);

    render(
      <MemoryRouter>
        <PermissionsPage />
      </MemoryRouter>
    );

    const notifSwitch = screen.getByRole('switch', { name: /Permiso de notificaciones/i });
    expect(notifSwitch).toHaveAttribute('aria-checked', 'false');

    // Clic para encender notificaciones
    fireEvent.click(notifSwitch);

    await waitFor(() => {
      expect(requestSpy).toHaveBeenCalled();
      expect(sendLocalSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Notificaciones activadas'),
        })
      );
      expect(notifSwitch).toHaveAttribute('aria-checked', 'true');
    });
  });

  it('UT-PM-04: Botón "Continuar" guarda la configuración en localStorage y redirige a /mapa', async () => {
    const MapDestination = () => <div data-testid="map-screen">Citizen Map Screen</div>;

    render(
      <MemoryRouter initialEntries={['/permisos']}>
        <Routes>
          <Route path="/permisos" element={<PermissionsPage />} />
          <Route path="/mapa" element={<MapDestination />} />
        </Routes>
      </MemoryRouter>
    );

    const continueBtn = screen.getByRole('button', { name: /Continuar/i });
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(localStorage.getItem('reportalo_permissions_configured')).toBe('true');
      expect(localStorage.getItem('reportalo_perm_camera')).toBe('true');
      expect(localStorage.getItem('reportalo_perm_location')).toBe('true');
      expect(screen.getByTestId('map-screen')).toBeInTheDocument();
    });
  });

  it('UT-PM-05: Botón "Ahora no" guarda la configuración como completada y redirige a /mapa sin bloquear', async () => {
    const MapDestination = () => <div data-testid="map-screen">Citizen Map Screen</div>;

    render(
      <MemoryRouter initialEntries={['/permisos']}>
        <Routes>
          <Route path="/permisos" element={<PermissionsPage />} />
          <Route path="/mapa" element={<MapDestination />} />
        </Routes>
      </MemoryRouter>
    );

    const skipBtns = screen.getAllByRole('button', { name: /Ahora no/i });
    fireEvent.click(skipBtns[0]);

    await waitFor(() => {
      expect(localStorage.getItem('reportalo_permissions_configured')).toBe('true');
      expect(screen.getByTestId('map-screen')).toBeInTheDocument();
    });
  });
});
