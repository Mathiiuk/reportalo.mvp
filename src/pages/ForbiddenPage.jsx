import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

/**
 * 403 · acceso restringido (UJ v3.3 · M32 — REP-3791 Bloque 9).
 * El enlace existe, pero la cuenta no tiene permisos. Se usará cuando el panel del municipio y el
 * del oficial tengan control por rol (Bloque 10): hoy la ruta queda registrada y lista.
 */
export const ForbiddenPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const attemptedPath = location.state?.from || location.pathname;

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-rep-surface font-manrope">
      <div className="flex flex-none items-center border-b border-rep-divider bg-rep-surface px-6 pb-3 pt-[max(16px,env(safe-area-inset-top,16px))]">
        <Link to="/" className="flex items-center gap-2 text-inherit no-underline">
          <img src="/logo-icon.webp" alt="" aria-hidden="true" className="h-[25px] w-[19px] object-contain" />
          <span className="text-rep-section text-rep-ink">Reportalo</span>
        </Link>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rep-warning-soft text-rep-warning-ink">
          <Lock className="h-8 w-8" strokeWidth={1.75} />
        </span>

        <span className="mt-4 text-[11px] font-extrabold uppercase tracking-widest text-rep-ink-faint">Error 403</span>
        <h1 className="m-0 mt-1 text-rep-title text-rep-ink md:text-rep-title-d">Acceso denegado</h1>
        <p className="m-0 mt-2 max-w-[440px] text-rep-body text-rep-ink-muted md:text-rep-body-d">
          El enlace existe, pero tu cuenta no tiene permisos para abrirlo.
        </p>

        <div className="mt-4 max-w-full overflow-hidden rounded-xl border border-rep-border bg-rep-bg px-4 py-2.5 text-left">
          <div className="mb-1 text-[9px] font-bold tracking-[0.5px] text-rep-ink-faint">DIRECCIÓN</div>
          <div className="truncate font-mono text-rep-label font-semibold text-rep-ink-label">{attemptedPath}</div>
        </div>

        <div className="mt-5 flex w-full max-w-[320px] flex-col gap-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rep-focus flex min-h-touch w-full items-center justify-center rounded-xl border-0 bg-rep-accent px-4 text-rep-label font-extrabold text-rep-on-accent transition-colors duration-120 hover:bg-rep-accent-strong"
          >
            Volver al inicio
          </button>
          <button
            type="button"
            onClick={() => navigate('/municipios')}
            className="rep-focus flex min-h-touch w-full items-center justify-center rounded-xl border border-rep-border bg-rep-surface px-4 text-rep-label font-bold text-rep-ink-label transition-[filter] duration-120 hover:brightness-[.96] dark:hover:brightness-[1.06]"
          >
            Ingresar con cuenta institucional
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForbiddenPage;
