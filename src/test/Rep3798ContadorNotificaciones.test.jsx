/**
 * @file Rep3798ContadorNotificaciones.test.jsx
 * @description REP-3798 (H-40): la campana muestra las notificaciones sin leer reales, no un «2» fijo.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../services/notificationsService', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getMyNotifications: vi.fn() };
});

import { useAuth } from '../hooks/useAuth';
import { getMyNotifications, NOTIFICATIONS_READ_EVENT } from '../services/notificationsService';
import { resetUnreadCountCache } from '../hooks/useUnreadNotifications';
import { NotificationsBell } from '../components/layout/AppLayout';

const renderBell = () => render(<MemoryRouter><NotificationsBell /></MemoryRouter>);

describe('REP-3798 · contador real de la campana', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetUnreadCountCache();
    useAuth.mockReturnValue({ user: { id: 'u1' } });
    getMyNotifications.mockResolvedValue({ notifications: [], unreadCount: 3, error: null });
  });

  it('UT-CNT-01: muestra la cantidad real de notificaciones sin leer', async () => {
    renderBell();
    expect(await screen.findByTestId('notifications-badge')).toHaveTextContent('3');
    expect(getMyNotifications).toHaveBeenCalledWith('u1');
  });

  it('UT-CNT-02: la etiqueta accesible incluye la cantidad', async () => {
    renderBell();
    expect(await screen.findByRole('button', { name: /3 sin leer/i })).toBeInTheDocument();
  });

  it('UT-CNT-03: sin notificaciones sin leer no se dibuja el badge', async () => {
    getMyNotifications.mockResolvedValue({ notifications: [], unreadCount: 0, error: null });
    renderBell();
    await waitFor(() => expect(getMyNotifications).toHaveBeenCalled());
    expect(screen.queryByTestId('notifications-badge')).not.toBeInTheDocument();
  });

  it('UT-CNT-04: con más de 9 muestra «9+»', async () => {
    getMyNotifications.mockResolvedValue({ notifications: [], unreadCount: 14, error: null });
    renderBell();
    expect(await screen.findByTestId('notifications-badge')).toHaveTextContent('9+');
  });

  it('UT-CNT-05: sin sesión no consulta nada ni muestra badge', () => {
    useAuth.mockReturnValue({ user: null });
    renderBell();
    expect(getMyNotifications).not.toHaveBeenCalled();
    expect(screen.queryByTestId('notifications-badge')).not.toBeInTheDocument();
  });

  it('UT-CNT-06: al marcar como leídas el contador se actualiza', async () => {
    renderBell();
    expect(await screen.findByTestId('notifications-badge')).toHaveTextContent('3');

    getMyNotifications.mockResolvedValue({ notifications: [], unreadCount: 0, error: null });
    await act(async () => {
      window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
    });
    await waitFor(() => expect(screen.queryByTestId('notifications-badge')).not.toBeInTheDocument());
  });

  it('UT-CNT-07: dos campanas (teléfono y escritorio) comparten una sola consulta', async () => {
    render(<MemoryRouter><NotificationsBell /><NotificationsBell ariaLabel="Ver notificaciones" /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByTestId('notifications-badge')).toHaveLength(2));
    expect(getMyNotifications).toHaveBeenCalledTimes(1);
  });

  it('UT-CNT-08: si la consulta falla, el contador no rompe la pantalla', async () => {
    getMyNotifications.mockRejectedValue(new Error('sin red'));
    renderBell();
    await waitFor(() => expect(getMyNotifications).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /notificaciones/i })).toBeInTheDocument();
    expect(screen.queryByTestId('notifications-badge')).not.toBeInTheDocument();
  });
});
