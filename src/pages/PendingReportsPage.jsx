import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, AlertTriangle, CloudOff, Hourglass, Lock, RefreshCw, Trash2, Construction, Truck, Leaf, Store, HelpCircle, Inbox } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { getAllPendingSyncReports, deleteDraftReport, updateDraftReport } from '../services/offlineStorageService';
import { syncPendingReports } from '../services/pendingSyncService';
import { DESCRIPTION_MIN_LENGTH, DESCRIPTION_MAX_LENGTH, validateDescription } from '../services/reportDescription';
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
 * H-35 · Por qué este borrador no salió, en palabras del ciudadano; null si no hay un motivo propio.
 * La descripción se valida acá mismo (una sola regla: reportDescription) porque es lo que más se puede
 * corregir sin salir de Pendientes; el resto sale del último intento de envío que quedó guardado.
 * Un fallo de protección de fotos ya tiene su texto habitual («requiere conexión»).
 */
const draftReason = (draft) => {
  const description = validateDescription(draft.description);
  if (!description.valid) return { text: description.error, tone: 'danger' };
  const stored = draft.lastSyncError;
  if (stored && stored.code !== 'PROTECTION' && stored.message) {
    return { text: stored.message, tone: stored.kind === 'invalid' ? 'danger' : 'warning' };
  }
  return null;
};

/**
 * Una tarjeta de Pendientes (UJ v3.3 · M20). H-35: además del estado, permite completar la descripción
 * cuando es lo que falta y descartar el reporte (con confirmación), para que un borrador trabado tenga salida.
 */
const PendingDraftCard = ({ draft, deviceWord, onSaveDescription, onDiscard }) => {
  const tone = getCategoryTone(draft.selectedCategory || {});
  const Icon = ICON_MAP[draft.selectedCategory?.icon] || HelpCircle;
  const place = draft.customLocation?.localityLabel || draft.address || 'Ubicación guardada';
  const meta = [draft.selectedCategory?.name, place, formatWhen(draft.updatedAt || draft.createdAt)]
    .filter(Boolean)
    .join(' · ');

  const photos = hasStoredPhotos(draft);
  const reason = draftReason(draft);
  const canEditDescription = photos && !validateDescription(draft.description).valid;

  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState(draft.description || '');
  const [fieldError, setFieldError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    const check = validateDescription(text);
    if (!check.valid) {
      setFieldError(check.error);
      return;
    }
    setFieldError(null);
    setBusy(true);
    await onSaveDescription(draft, text.trim());
    setBusy(false);
  };

  const handleDiscard = async () => {
    setBusy(true);
    const done = await onDiscard(draft);
    // Si se descartó, la tarjeta desaparece de la lista; si no, vuelve al estado normal
    if (!done) {
      setBusy(false);
      setConfirming(false);
    }
  };

  const reasonColor = reason?.tone === 'warning' ? 'text-rep-warning-ink' : 'text-rep-danger';

  return (
    <li
      data-testid="pending-report-item"
      className="flex gap-3 rounded-2xl border border-rep-border bg-rep-surface p-4 shadow-rep-card"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: tone.soft, color: tone.base }}
      >
        <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-rep-body font-bold text-rep-ink desktop:text-rep-body-d">{draftTitle(draft)}</span>
        <span className="truncate text-rep-label text-rep-ink-muted">{meta}</span>

        {/* Un borrador cuyas fotos ya no están en el dispositivo no se va a
            poder enviar nunca: decir «requiere conexión» sería mentir y el
            ciudadano esperaría para siempre un envío que no va a ocurrir. */}
        {!photos ? (
          <span className="inline-flex items-center gap-1.5 text-rep-label font-semibold text-rep-danger">
            <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            No se puede enviar: las fotos ya no están en este dispositivo.
          </span>
        ) : reason ? (
          <span data-testid="pending-reason" className={`inline-flex items-start gap-1.5 text-rep-label font-semibold ${reasonColor}`}>
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            <span>{reason.text}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-rep-label font-semibold text-rep-warning-ink">
            <Hourglass aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            Falta protegerse la foto: requiere conexión.
          </span>
        )}

        {/* H-35: la descripción es lo único que el ciudadano puede completar acá */}
        {canEditDescription && (
          <div className="mt-2 flex flex-col gap-1.5">
            <label htmlFor={`pending-desc-${draft.client_side_id}`} className="text-rep-label font-bold text-rep-ink-label">
              Descripción del reporte
            </label>
            <textarea
              id={`pending-desc-${draft.client_side_id}`}
              data-testid="pending-description-input"
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={DESCRIPTION_MAX_LENGTH}
              rows={3}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={`pending-desc-help-${draft.client_side_id}`}
              placeholder="Contá brevemente lo que observaste…"
              className="block w-full resize-none rounded-xl border border-rep-border bg-rep-bg px-3 py-2.5 text-rep-input text-rep-ink-body outline-none focus:border-rep-accent"
            />
            <div className="flex items-start justify-between gap-3">
              <span id={`pending-desc-help-${draft.client_side_id}`} className="text-rep-label text-rep-ink-muted">
                Entre {DESCRIPTION_MIN_LENGTH} y {DESCRIPTION_MAX_LENGTH} caracteres.
              </span>
              <span className="shrink-0 text-rep-label tabular-nums text-rep-ink-muted">
                {text.length}/{DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
            {fieldError && (
              <p role="alert" className="m-0 text-rep-label text-rep-danger">
                {fieldError}
              </p>
            )}
            <button
              type="button"
              data-testid="pending-description-save"
              onClick={handleSave}
              disabled={busy}
              className="rep-focus min-h-touch rounded-xl bg-rep-accent px-4 text-rep-body font-bold text-rep-on-accent disabled:cursor-not-allowed disabled:opacity-45"
            >
              Guardar y reintentar
            </button>
          </div>
        )}

        {/* H-35: todo borrador tiene salida. Se pide confirmación porque se pierden las fotos. */}
        {confirming ? (
          <div className="mt-2 flex flex-col gap-2 rounded-xl border border-rep-danger/30 bg-rep-surface-sunken p-3">
            <p className="m-0 text-rep-label font-bold text-rep-ink">¿Descartar este reporte?</p>
            <p className="m-0 text-rep-label text-rep-ink-muted">
              Vas a perder las fotos y los datos que guardaste en este {deviceWord}. No se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDiscard}
                disabled={busy}
                className="rep-focus min-h-touch flex-1 rounded-xl bg-rep-danger px-3 text-rep-label font-bold text-rep-on-accent disabled:opacity-45"
              >
                Sí, descartar
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="rep-focus min-h-touch flex-1 rounded-xl border border-rep-border px-3 text-rep-label font-bold text-rep-ink-label disabled:opacity-45"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            data-testid="pending-discard-btn"
            onClick={() => setConfirming(true)}
            className="rep-focus mt-1 inline-flex min-h-touch items-center gap-1.5 self-start rounded-lg px-1 text-rep-label font-bold text-rep-danger hover:underline"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
            Descartar
          </button>
        )}
      </div>
    </li>
  );
};

/**
 * Pendientes de envío (UJ v3.3 · M20 — REP-3791 Bloque 4).
 * Lista los reportes guardados sin conexión (IndexedDB, PENDING_SYNC) y permite reintentar el envío.
 * El envío automático al volver la conexión lo hace PendingSyncManager.
 * H-35: cada borrador puede descartarse y, si falta la descripción, completarse desde su tarjeta.
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

  // H-35: completar la descripción de un pendiente trabado y volver a intentar
  const handleSaveDescription = async (draft, description) => {
    try {
      await updateDraftReport(draft.client_side_id, { description });
    } catch {
      toast.error('No pudimos guardar la descripción', { description: 'Probá de nuevo.' });
      return;
    }
    await loadDrafts();
    if (!isOnline) {
      toast.success('Descripción guardada', { description: 'El reporte se envía solo apenas vuelva la conexión.' });
      return;
    }
    await handleRetry();
  };

  // H-35: descartar un pendiente. Devuelve true si se borró.
  const handleDiscard = async (draft) => {
    try {
      await deleteDraftReport(draft.client_side_id);
    } catch {
      toast.error('No pudimos descartar el reporte', { description: 'Probá de nuevo.' });
      return false;
    }
    await loadDrafts();
    toast.success('Reporte descartado');
    return true;
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
              {drafts.map((draft) => (
                <PendingDraftCard
                  key={draft.client_side_id}
                  draft={draft}
                  deviceWord={deviceWord}
                  onSaveDescription={handleSaveDescription}
                  onDiscard={handleDiscard}
                />
              ))}
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
