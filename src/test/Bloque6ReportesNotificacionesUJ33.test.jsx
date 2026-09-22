import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const historyRows = [
  { report_id: 'aaaa1111-0000-4000-8000-000000000000', state_code: 'EN_ANALISIS', notes: 'Derivado a inspección de tránsito', changed_at: new Date().toISOString() },
  { report_id: 'bbbb2222-0000-4000-8000-000000000000', state_code: 'RESUELTO', notes: null, changed_at: new Date(Date.now() - 3 * 86400000).toISOString() },
];

vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table) => {
      if (table === 'citizen_reports') {
        return { select: () => ({ eq: async () => ({ data: [{ id: historyRows[0].report_id }, { id: historyRows[1].report_id }], error: null }) }) };
      }
      return {
        select: () => ({ in: () => ({ order: () => ({ limit: async () => ({ data: historyRows, error: null }) }) }) }),
      };
    },
  },
}));

vi.mock('../services/offlineStorageService', () => ({
  getAllPendingSyncReports: vi.fn(),
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'vecina@example.org' }, session: {} }) }));
vi.mock('../services/reportSubmissionService', () => ({ getMyReports: vi.fn().mockResolvedValue({ success: true, reports: [] }) }));

import { getAllPendingSyncReports } from '../services/offlineStorageService';
import { getMyNotifications, markAllNotificationsRead, groupNotifications } from '../services/notificationsService';
import { NotificationsPage } from '../pages/NotificationsPage';
import { ReportsPage } from '../pages/ReportsPage';

const DRAFT = {
  client_side_id: 'draft-1',
  description: 'Contenedor desbordado',
  updatedAt: new Date().toISOString(),
};

describe('REP-3791 Bloque 6 · Mis reportes y Notificaciones (UJ v3.3 · M17 / M18)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    getAllPendingSyncReports.mockResolvedValue([DRAFT]);
  });

  it('UT-B6-01: arma los avisos con los cambios de estado de mis reportes y los borradores sin enviar', async () => {
    const { notifications, unreadCount } = await getMyNotifications('u1');

    expect(notifications).toHaveLength(3);
    expect(unreadCount).toBe(3);
    expect(notifications.some((n) => n.title.includes('pasó a En revisión'))).toBe(true);
    expect(notifications.some((n) => n.title.includes('se resolvió'))).toBe(true);
    expect(notifications.some((n) => n.title.includes('«Contenedor desbordado» sigue sin enviar'))).toBe(true);
    // El detalle conserva la nota del organismo
    expect(notifications[0].detail).toBe('«Derivado a inspección de tránsito»');
  });

  it('UT-B6-02: «Marcar leídas» deja la lista sin no leídas en la siguiente consulta', async () => {
    markAllNotificationsRead();
    const { unreadCount } = await getMyNotifications('u1');
    expect(unreadCount).toBe(0);
  });

  it('UT-B6-03: agrupa por Hoy, Esta semana y Antes', async () => {
    const { notifications } = await getMyNotifications('u1');
    const groups = groupNotifications(notifications);
    expect(groups.hoy.length).toBe(2);
    expect(groups.semana.length).toBe(1);
  });

  it('UT-B6-04: M18 muestra los avisos y limpia las no leídas al marcarlas', async () => {
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>);

    const items = await screen.findAllByTestId('notification-item');
    expect(items).toHaveLength(3);
    expect(items.filter((item) => item.dataset.unread === 'true')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /marcar leídas/i }));

    await waitFor(() => {
      expect(screen.queryAllByTestId('notification-item').filter((item) => item.dataset.unread === 'true')).toHaveLength(0);
    });
  });

  it('UT-B6-05: M17 encabeza la lista con el borrador sin enviar', async () => {
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);

    const draftRow = await screen.findByTestId('pending-draft-row');
    expect(draftRow).toHaveTextContent('Contenedor desbordado');
    expect(draftRow).toHaveTextContent('Sin enviar · esperando conexión');
    expect(draftRow).toHaveTextContent('Pendiente');
  });
});
