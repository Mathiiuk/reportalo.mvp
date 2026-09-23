import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, AlertTriangle, CloudOff, Hourglass, Lock, RefreshCw, Construction, Truck, Leaf, Store, HelpCircle, Inbox } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { getAllPendingSyncReports } from '../services/offlineStorageService';
import { syncPendingReports } from '../services/pendingSyncService';
import { PENDING_SYNC_EVENT } from '../components/common/PendingSyncManager';
import { getCategoryTone } from '../components/report/categoryTone';
import { useIsDesktopLayout } from '../hooks/useMediaQuery';

const ICON_MAP = { construction: Construction, local_shipping: Truck, eco: Leaf, storefront: Store };

const pad = (n) => String(n).padStart(2, '0');

// «hoy 08:14» · «ayer 19:40» · «14/08 · 19:40»
const formatWhen = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return `hoy ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `ayer ${time}`;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} · ${time}`;
};

// Sin blobs guardados no hay nada que enviar: el borrador no puede salir de la cola.
const hasStoredPhotos = (draft) => (draft?.evidenceList || []).some((ev) => ev.blob);

const draftTitle = (draft) => {
  const text = String(draft.description || '').trim().split('\n')[0];
  if (!text) return draft.selectedCategory?.name || 'Reporte sin descripción';
  return text.length > 48 ? `${text.slice(0, 47)}…` : text;
};

/**
 * Pendientes de envío (UJ v3.3 · M20 — REP-3791 Bloque 4).
 * Lista los reportes guardados sin conexión (IndexedDB, PENDING_SYNC) y permite reintentar el envío.
 * El envío automático al volver la conexión lo hace PendingSyncManager.
 */
export const PendingReportsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [drafts, setDrafts] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const deviceWord = useIsDesktopLayout() ? 'computadora' : 'teléfono';

  const loadDrafts = useCallback(async () => {
    const list = await getAllPendingSyncReports().catch(() => []);
    setDrafts(list);
  }, []);

  useEffect(() => {
    loadDrafts();
    window.addEventListener(PENDING_SYNC_EVENT, loadDrafts);
    return () => window.removeEventListener(PENDING_SYNC_EVENT, loadDrafts);
  }, [loadDrafts]);

  const handleRetry = async () => {
    if (!isOnline) {
      toast.warning('Todavía no hay conexión', { description: 'Los reportes se envían solos apenas vuelva.' });
      return;
    }
    setIsSyncing(true);
    const result = await syncPendingReports({ userId: user?.id });
    setIsSyncing(false);
    await loadDrafts();
    if (result.sent > 0) {
      toast.success(result.sent === 1 ? 'Se envió 1 reporte' : `Se enviaron ${result.sent} reportes`);
    }
    if (result.failed > 0) {
      toast.error('Algunos reportes no se pudieron enviar', { description: result.errors[0]?.error });
    }
  };

  const count = drafts?.length ?? 0;

  return (
    <div data-testid="pending-reports-page" className="flex min-h-[100dvh] w-full flex-col bg-rep-bg font-manrope">
      {!isOnline && (
        <div role="status" className="flex items-center justify-center gap-2 bg-rep-ink px-4 pb-2 pt-[max(8px,env(safe-area-inset-top,8px))] text-rep-label font-semibold text-rep-bg">
          <CloudOff aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
          Sin conexión · se envían solos al volver
        </div>
      )}

      <div className={`mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-6 ${isOnline ? 'pt-[max(8px,env(safe-area-inset-top,8px))]' : 'pt-2'}`}>
        <header className="flex items-center gap-1 py-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Volver"
            className="rep-focus -ml-2 flex min-h-touch min-w-touch items-center justify-center rounded-full text-rep-ink-label hover:bg-rep-divider"
          >
            <ArrowLeft aria-hidden="true" className="h-6 w-6" strokeWidth={2.25} />
          </button>
          <div>
            <h1 className="m-0 text-rep-title text-rep-ink desktop:text-rep-title-d">Pendientes de envío</h1>
            {drafts && count > 0 && (
              <p className="m-0 text-rep-label text-rep-ink-muted desktop:text-rep-label-d">
                {count === 1 ? `1 reporte guardado en este ${deviceWord}` : `${count} reportes guardados en este ${deviceWord}`}
              </p>
            )}
          </div>
        </header>

        {drafts === null ? (
          <div aria-busy="true" className="mt-3 flex flex-col gap-3 motion-safe:animate-pulse">
            <div className="h-24 rounded-2xl bg-rep-track" />
            <div className="h-24 rounded-2xl bg-rep-track" />
          </div>
        ) : count === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rep-accent-soft text-rep-accent">
              <Inbox aria-hidden="true" className="h-7 w-7" strokeWidth={2} />
            </span>
            <p className="m-0 text-rep-section text-rep-ink">No hay reportes pendientes</p>
            <p className="m-0 max-w-[280px] text-rep-body text-rep-ink-muted">
              Todo lo que guardaste sin conexión ya se envió.
            </p>
            <button
              type="button"
              onClick={() => navigate('/mapa')}
              className="rep-focus mt-2 min-h-touch rounded-xl px-4 text-rep-body font-bold text-rep-accent"
            >
              Volver al mapa
            </button>
          </div>
        ) : (
          <>
            <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
              {drafts.map((draft) => {
                const tone = getCategoryTone(draft.selectedCategory || {});
                const Icon = ICON_MAP[draft.selectedCategory?.icon] || HelpCircle;
                const place = draft.customLocation?.localityLabel || draft.address || 'Ubicación guardada';
                const meta = [draft.selectedCategory?.name, place, formatWhen(draft.updatedAt || draft.createdAt)]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <li
                    key={draft.client_side_id}
                    data-testid="pending-report-item"
                    className="flex gap-3 rounded-2xl border border-rep-border bg-rep-surface p-4 shadow-rep-card"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: tone.soft, color: tone.base }}
                    >
                      <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-rep-body font-bold text-rep-ink desktop:text-rep-body-d">{draftTitle(draft)}</span>
                      <span className="truncate text-rep-label text-rep-ink-muted">{meta}</span>
                      {/* Un borrador cuyas fotos ya no están en el dispositivo no se va a
                          poder enviar nunca: decir «requiere conexión» sería mentir y el
                          ciudadano esperaría para siempre un envío que no va a ocurrir. */}
                      {hasStoredPhotos(draft) ? (
                        <span className="inline-flex items-center gap-1.5 text-rep-label font-semibold text-rep-warning-ink">
                          <Hourglass aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                          Falta protegerse la foto: requiere conexión.
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-rep-label font-semibold text-rep-danger">
                          <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                          No se puede enviar: las fotos ya no están en este dispositivo.
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="m-0 mt-4 flex items-start gap-2 text-rep-label text-rep-ink-muted">
              <Lock aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
              Las fotos en cola quedan solo en tu {deviceWord} hasta que haya conexión.
            </p>

            <button
              type="button"
              onClick={handleRetry}
              disabled={isSyncing}
              aria-busy={isSyncing}
              className="rep-focus mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-rep-accent-border bg-rep-surface text-rep-button text-rep-accent transition-[transform,filter] duration-120 hover:brightness-[.96] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 dark:hover:brightness-[1.06]"
            >
              <RefreshCw aria-hidden="true" className={`h-[18px] w-[18px] ${isSyncing ? 'motion-safe:animate-spin' : ''}`} strokeWidth={2.25} />
              {isSyncing ? 'Enviando…' : 'Reintentar ahora'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PendingReportsPage;
