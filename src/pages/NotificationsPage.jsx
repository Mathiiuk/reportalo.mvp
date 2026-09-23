import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, Megaphone, CheckCircle2, CloudOff, BellOff } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../hooks/useAuth';
import { getMyNotifications, groupNotifications, markAllNotificationsRead } from '../services/notificationsService';
import { formatShortDateTime } from '../components/report/reportStatus';
import { EmptyState } from '../components/common/EmptyState';

const ICONS = {
  estado: ArrowLeftRight,
  notificado: Megaphone,
  resuelto: CheckCircle2,
  borrador: CloudOff,
};

const TONES = {
  estado: 'bg-rep-accent-soft text-rep-accent',
  notificado: 'bg-rep-notice-soft text-rep-notice',
  resuelto: 'bg-rep-success-soft text-rep-success',
  borrador: 'bg-rep-track text-rep-ink-label',
};

const GROUP_LABELS = { hoy: 'Hoy', semana: 'Esta semana', antes: 'Antes' };

// «Hace 2 h» · «Ayer 18:40» · «22/08 · 14:10»
const relativeLabel = (isoDate) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const diffHours = (Date.now() - date.getTime()) / 36e5;
  if (diffHours < 1) return 'Recién';
  if (diffHours < 24) return `Hace ${Math.round(diffHours)} h`;
  if (diffHours < 48) return `Ayer ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return formatShortDateTime(isoDate);
};

/**
 * Notificaciones del ciudadano (UJ v3.3 · M18 teléfono / D19 escritorio — REP-3791 Bloque 6).
 * Solo cambios de estado, notas del organismo y avisos de la propia cuenta: las publicaciones
 * del municipio viven en Novedades.
 */
export const NotificationsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    const result = await getMyNotifications(user?.id);
    setItems(result.notifications);
    setUnreadCount(result.unreadCount);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkAllRead = () => {
    markAllNotificationsRead();
    setItems((prev) => (prev ? prev.map((item) => ({ ...item, unread: false })) : prev));
    setUnreadCount(0);
  };

  const groups = groupNotifications(items || []);

  return (
    <AppLayout activeTab="alertas">
      <div className="flex-1 overflow-y-auto bg-rep-bg pb-28 md:pb-10">
        <div className="mx-auto w-full max-w-lg px-4 pt-3 md:max-w-3xl md:px-10 md:pt-8">
          <header className="flex items-center gap-1 pb-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Volver"
              className="rep-focus -ml-2 flex min-h-touch min-w-touch items-center justify-center rounded-full text-rep-ink-label hover:bg-rep-divider md:hidden"
            >
              <ArrowLeft aria-hidden="true" className="h-6 w-6" strokeWidth={2.25} />
            </button>
            <div className="flex-1">
              <h1 className="m-0 text-rep-title text-rep-ink md:text-rep-title-d">Notificaciones</h1>
              {unreadCount > 0 && (
                <p className="m-0 hidden text-rep-label-d text-rep-ink-muted md:block">
                  {unreadCount === 1 ? '1 sin leer' : `${unreadCount} sin leer`}
                </p>
              )}
            </div>
            {items?.length > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                className="rep-focus min-h-touch rounded-lg px-1 text-rep-label font-bold text-rep-accent transition-opacity duration-120 disabled:opacity-45 md:text-rep-label-d"
              >
                <span className="md:hidden">Marcar leídas</span>
                <span className="hidden md:inline">Marcar todas como leídas</span>
              </button>
            )}
          </header>

          {items === null ? (
            <div aria-busy="true" className="flex flex-col gap-3 motion-safe:animate-pulse">
              <div className="h-20 rounded-2xl bg-rep-track" />
              <div className="h-20 rounded-2xl bg-rep-track" />
            </div>
          ) : items.length === 0 ? (
            /* Estado vacío (UJ v3.3 · M28): es el estado inicial de toda cuenta nueva */
            <EmptyState
              icon={BellOff}
              title="Estás al día"
              description="Cuando un reporte tuyo cambie de estado o el organismo deje una nota, te avisamos acá."
              secondaryAction={{ label: 'Ver mis reportes', onClick: () => navigate('/reportes') }}
            />
          ) : (
            <div className="flex flex-col gap-5">
              {Object.entries(groups)
                .filter(([, list]) => list.length > 0)
                .map(([key, list]) => (
                  <section key={key} aria-label={GROUP_LABELS[key]}>
                    <h2 className="m-0 mb-2 text-[11px] font-extrabold uppercase tracking-wider text-rep-ink-muted">
                      {GROUP_LABELS[key]}
                    </h2>
                    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                      {list.map((item) => {
                        const Icon = ICONS[item.kind] || ArrowLeftRight;
                        return (
                          <li
                            key={item.id}
                            data-testid="notification-item"
                            data-unread={item.unread ? 'true' : 'false'}
                            className={`flex gap-3 rounded-2xl border p-3.5 shadow-rep-card ${
                              item.unread ? 'border-rep-accent-border bg-rep-accent-soft' : 'border-rep-border bg-rep-surface'
                            }`}
                          >
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONES[item.kind] || TONES.estado}`}>
                              <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
                            </span>

                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                              <div className="flex items-start justify-between gap-3">
                                <span className="text-rep-body font-bold leading-snug text-rep-ink md:text-rep-body-d">{item.title}</span>
                                <span className="shrink-0 whitespace-nowrap text-rep-label text-rep-ink-muted">{relativeLabel(item.at)}</span>
                              </div>
                              {item.detail && <span className="text-rep-label text-rep-ink-muted md:text-rep-label-d">{item.detail}</span>}
                              {item.reportId && (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/reportes/${item.reportId}`)}
                                  className="rep-focus min-h-touch self-start rounded-lg px-1 text-rep-label font-bold text-rep-accent hover:underline"
                                >
                                  Ver el reporte
                                </button>
                              )}
                              {item.kind === 'borrador' && (
                                <button
                                  type="button"
                                  onClick={() => navigate('/pendientes')}
                                  className="rep-focus min-h-touch self-start rounded-lg px-1 text-rep-label font-bold text-rep-accent hover:underline"
                                >
                                  Ver pendientes
                                </button>
                              )}
                            </div>

                            {item.unread && <span aria-label="Sin leer" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rep-accent" />}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default NotificationsPage;
