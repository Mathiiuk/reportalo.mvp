/**
 * @file notificationsService.js
 * @description Avisos sobre los reportes del ciudadano (UJ v3.3 · M18 / D19 — REP-3791 Bloque 6).
 *
 * No existe una tabla de notificaciones: la lista se arma con datos que ya están en la base y en
 * el dispositivo. Cambios de estado y notas del organismo salen de `report_state_history`; los
 * borradores sin enviar, de IndexedDB. Las publicaciones del municipio no entran acá: viven en
 * Novedades. Lo leído se guarda en el dispositivo (H-42).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { getAllPendingSyncReports } from './offlineStorageService';
import { getStatusConfig, normalizeReportState, formatReportCode } from '../components/report/reportStatus';

const READ_AT_KEY = 'reportalo_notifications_read_at';

const safeStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

export const getLastReadAt = () => safeStorage()?.getItem(READ_AT_KEY) || null;

export const markAllNotificationsRead = () => {
  const now = new Date().toISOString();
  safeStorage()?.setItem(READ_AT_KEY, now);
  return now;
};

const titleForState = (code, reportCode) => {
  const state = normalizeReportState(code);
  const label = getStatusConfig(code).label;
  if (state === 'notificado') return `${reportCode} fue notificado al responsable`;
  if (state === 'resuelto') return `${reportCode} se resolvió`;
  if (state === 'descartado') return `${reportCode} se cerró como ${label}`;
  return `Tu reporte ${reportCode} pasó a ${label}`;
};

/**
 * @returns {Promise<{ notifications: Array<object>, unreadCount: number, error: string|null }>}
 */
export const getMyNotifications = async (userId) => {
  const lastReadAt = getLastReadAt();
  const isUnread = (isoDate) => !lastReadAt || new Date(isoDate) > new Date(lastReadAt);
  const notifications = [];
  let error = null;

  // 1. Cambios de estado de mis reportes
  if (isSupabaseConfigured && userId) {
    const { data: reports, error: reportsError } = await supabase
      .from('citizen_reports')
      .select('id, created_at')
      .eq('user_id', userId);

    if (reportsError) {
      error = reportsError.message;
    } else if (reports?.length) {
      const byId = new Map(reports.map((report) => [report.id, report]));
      const { data: history, error: historyError } = await supabase
        .from('report_state_history')
        .select('report_id, state_code, notes, changed_at')
        .in('report_id', [...byId.keys()])
        .order('changed_at', { ascending: false })
        .limit(60);

      if (historyError) {
        // Si RLS no habilita el historial, la pantalla igual muestra los borradores (H-24)
        error = historyError.message;
      } else {
        history?.forEach((entry) => {
          const reportCode = formatReportCode(entry.report_id);
          notifications.push({
            id: `estado-${entry.report_id}-${entry.changed_at}`,
            kind: normalizeReportState(entry.state_code) === 'resuelto' ? 'resuelto' : 'estado',
            reportId: entry.report_id,
            title: titleForState(entry.state_code, reportCode),
            detail: entry.notes ? `«${entry.notes}»` : null,
            at: entry.changed_at,
            unread: isUnread(entry.changed_at),
          });
        });
      }
    }
  }

  // 2. Borradores que siguen esperando conexión
  const drafts = await getAllPendingSyncReports().catch(() => []);
  drafts.forEach((draft) => {
    const at = draft.updatedAt || draft.createdAt || new Date().toISOString();
    const name = String(draft.description || '').trim().split('\n')[0] || 'Reporte sin descripción';
    notifications.push({
      id: `borrador-${draft.client_side_id}`,
      kind: 'borrador',
      title: `Tu borrador «${name.length > 40 ? `${name.slice(0, 39)}…` : name}» sigue sin enviar`,
      detail: 'Se envía solo cuando vuelva la conexión',
      at,
      unread: isUnread(at),
    });
  });

  notifications.sort((a, b) => new Date(b.at) - new Date(a.at));

  return {
    notifications,
    unreadCount: notifications.filter((item) => item.unread).length,
    error,
  };
};

// Agrupación de la lista: Hoy · Esta semana · Antes (M18)
export const groupNotifications = (notifications = []) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  const groups = { hoy: [], semana: [], antes: [] };
  notifications.forEach((item) => {
    const at = new Date(item.at);
    if (at >= startOfToday) groups.hoy.push(item);
    else if (at >= weekAgo) groups.semana.push(item);
    else groups.antes.push(item);
  });
  return groups;
};
