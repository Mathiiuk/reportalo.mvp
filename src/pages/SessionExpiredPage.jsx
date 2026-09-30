import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LockKeyhole, Save, Mail } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getActiveDraftReport } from '../services/offlineStorageService';
import { getSessionMarker, saveResumePath, getResumePath } from '../lib/sessionMarker';

/**
 * «Tu sesión venció» (UJ v3.3 · M23 — REP-3791 Bloque 4). Sin contraparte de escritorio en el UJ:
 * en pantallas anchas se muestra la misma tarjeta centrada.
 * Se llega desde ProtectedRoute cuando había una sesión y ya no está (la sesión venció, no se cerró).
 * Reingreso con los mismos dos métodos; al volver se retoma la pantalla donde estaba.
 */
export const SessionExpiredPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, signInWithGoogle, signInWithMagicLink } = useAuth();
  const [hasDraft, setHasDraft] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const email = getSessionMarker()?.email || null;

  useEffect(() => {
    saveResumePath(location.state?.from);
  }, [location.state]);

  useEffect(() => {
    getActiveDraftReport()
      .then((draft) => setHasDraft(Boolean(draft)))
      .catch(() => setHasDraft(false));
  }, []);

  if (session) {
    return <Navigate to={getResumePath() || '/mapa'} replace />;
  }

  const handleMagicLink = async () => {
    if (!email) {
      navigate('/login');
      return;
    }
    setIsSending(true);
    const { error } = await signInWithMagicLink(email);
    setIsSending(false);
    if (!error) navigate('/check-email', { state: { email } });
  };

  return (
    <div data-testid="session-expired-page" className="flex min-h-[100dvh] w-full items-center justify-center bg-rep-bg px-4 py-8 font-manrope">
      <div className="flex w-full max-w-md flex-col items-center text-center desktop:rounded-3xl desktop:border desktop:border-rep-border desktop:bg-rep-surface desktop:p-10 desktop:shadow-rep-float">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rep-accent-soft text-rep-accent">
          <LockKeyhole aria-hidden="true" className="h-8 w-8" strokeWidth={2} />
        </span>
        <h1 className="m-0 mt-5 text-rep-title text-rep-ink desktop:text-rep-title-d">Tu sesión venció</h1>
        <p className="m-0 mt-2 text-rep-body text-rep-ink-body desktop:text-rep-body-d">
          Por seguridad cerramos la sesión después de un tiempo sin uso. Te mandamos un enlace nuevo y seguís donde estabas.
        </p>

        {hasDraft && (
          <p className="m-0 mt-4 flex items-center gap-2 rounded-xl bg-rep-success-soft px-3 py-2 text-rep-label font-semibold text-rep-success">
            <Save aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2.25} />
            Tu reporte en curso quedó guardado como borrador.
          </p>
        )}

        <button
          type="button"
          onClick={handleMagicLink}
          disabled={isSending}
          className="rep-focus mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-rep-accent px-4 text-rep-button text-rep-on-accent shadow-rep-accent transition-[transform,background-color] duration-120 hover:bg-rep-accent-strong active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Mail aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.25} />
          {isSending ? 'Enviando…' : 'Enviarme un enlace'}
        </button>
        {email && <span className="mt-1.5 text-rep-label text-rep-ink-muted">a {email}</span>}

        <button
          type="button"
          onClick={() => signInWithGoogle()}
          className="rep-focus mt-3 flex min-h-[52px] w-full items-center justify-center rounded-2xl border border-rep-border bg-rep-surface px-4 text-rep-button text-rep-ink transition-[transform,filter] duration-120 hover:brightness-[.96] active:scale-[0.98] dark:hover:brightness-[1.06]"
        >
          Continuar con Google
        </button>
      </div>
    </div>
  );
};

export default SessionExpiredPage;
