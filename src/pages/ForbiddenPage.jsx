import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useNoIndex } from '../hooks/useNoIndex';
import { ArrowLeft, Lock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useIsDesktopLayout } from '../hooks/useMediaQuery';
import { AppDesktopHeader, AppTabBar } from '../components/layout/AppLayout';

/**
 * Ilustración del 403: señal de contramano sobre la valla. Mismo trazo que las de M30 y M31.
 */
const ForbiddenIllustration = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 200 124" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <clipPath id="rep-403-barrier">
        <rect x="20" y="82" width="160" height="16" rx="4" />
      </clipPath>
    </defs>
    {/* Poste y cartel «403» */}
    <rect x="97" y="44" width="6" height="40" rx="2" fill="#b8c3cf" />
    <rect x="80" y="54" width="40" height="17" rx="4" fill="#fff" stroke="#c9d2dc" strokeWidth="2" />
    <text x="100" y="66.5" fontFamily="Manrope Variable,Manrope,sans-serif" fontSize="10" fontWeight="800" fill="#5b6a7a" textAnchor="middle">
      403
    </text>
    {/* Señal de contramano */}
    <circle cx="100" cy="26" r="22" fill="#d64541" stroke="#b03a2e" strokeWidth="3" />
    <rect x="85" y="22" width="30" height="8" rx="2" fill="#fff" />
    {/* Valla con franjas */}
    <rect x="20" y="82" width="160" height="16" rx="4" fill="#fff" stroke="#c9d2dc" strokeWidth="2" />
    <g clipPath="url(#rep-403-barrier)" fill="#d64541">
      <path d="M26 98l12-16h10L36 98z" />
      <path d="M50 98l12-16h10L60 98z" />
      <path d="M74 98l12-16h10L84 98z" />
      <path d="M98 98l12-16h10l-12 16z" />
      <path d="M122 98l12-16h10l-12 16z" />
      <path d="M146 98l12-16h10l-12 16z" />
    </g>
    {/* Patas y piso */}
    <rect x="38" y="98" width="6" height="12" rx="1.5" fill="#b8c3cf" />
    <rect x="156" y="98" width="6" height="12" rx="1.5" fill="#b8c3cf" />
    <path d="M30 116h24M146 116h24M66 116h14M92 116h16M120 116h14" stroke="#dfe5ec" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

/**
 * 403 · acceso restringido (UJ v3.3 · M32 teléfono / D38 escritorio).
 *
 * «Permiso, no dirección»: la ruta existe y la sesión es válida; faltan permisos. El texto no
 * culpa al usuario y no filtra qué hay del otro lado. Dos salidas: al inicio si es usuario, al
 * acceso institucional si es personal municipal. Con sesión conserva la navegación.
 * REP-3791 Bloque 9, rehecho en el Bloque 11-B para seguir el diseño.
 *
 * Estado de navegación opcional: `from` (dirección que se intentó abrir) y `sectionLabel`
 * (nombre de la sección, para la cabecera del teléfono; por defecto «Acceso restringido»).
 */
export const ForbiddenPage = () => {
  useNoIndex();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const isDesktop = useIsDesktopLayout();
  const hasSession = Boolean(session);

  const attemptedPath = location.state?.from || location.pathname;
  const sectionLabel = location.state?.sectionLabel || 'Acceso restringido';
  const host = typeof window !== 'undefined' && window.location?.host ? window.location.host : 'reportalo.com.ar';

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-rep-bg font-manrope">
      {isDesktop && hasSession && <AppDesktopHeader activeTab={null} />}

      {isDesktop && !hasSession && (
        <div className="flex flex-none items-center border-b border-rep-divider bg-rep-surface px-6 py-3">
          <Link to="/" className="flex items-center gap-2 text-inherit no-underline">
            <img src="/logo-icon.webp" alt="" aria-hidden="true" className="h-[25px] w-[19px] object-contain" />
            <span className="text-rep-section-d text-rep-ink">
              Reportalo<span className="align-super text-[9px] font-bold text-rep-ink-muted">™</span>
            </span>
          </Link>
        </div>
      )}

      {!isDesktop && (
        // M32: cabecera con «volver» y el nombre de la sección
        <div className="flex flex-none items-center gap-[9px] border-b border-rep-divider bg-rep-surface px-[14px] pb-3 pt-[max(16px,env(safe-area-inset-top,16px))]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Volver"
            className="rep-focus flex cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 transition-transform active:scale-95"
          >
            <ArrowLeft aria-hidden="true" className="h-[22px] w-[22px] text-rep-ink-label" strokeWidth={2.25} />
          </button>
          <span className="text-[16px] font-extrabold text-rep-ink">{sectionLabel}</span>
        </div>
      )}

      <div
        className={`flex flex-1 flex-col items-center justify-center overflow-y-auto px-8 text-center ${
          hasSession ? 'pb-28 desktop:pb-10' : 'pb-10'
        }`}
      >
        <ForbiddenIllustration className="h-[118px] w-[190px] desktop:h-[134px] desktop:w-[216px]" />

        <h1 className="m-0 mt-4 text-rep-title text-rep-ink desktop:text-rep-title-d">Error 403 - Acceso Denegado</h1>
        <p className="m-0 mt-2 max-w-[440px] text-rep-body text-rep-ink-muted desktop:text-rep-body-d">
          El enlace existe, pero tu cuenta no tiene permisos para abrirlo.
        </p>

        {/* La dirección que se intentó abrir */}
        <div className="mt-4 flex max-w-full items-center gap-2.5 overflow-hidden rounded-xl border border-rep-border bg-rep-surface px-4 py-2.5 text-left">
          <Lock aria-hidden="true" className="h-4 w-4 flex-none text-rep-ink-faint" strokeWidth={2.25} />
          <div className="min-w-0">
            <div className="mb-0.5 hidden text-[9px] font-bold tracking-[0.5px] text-rep-ink-faint desktop:block">DIRECCIÓN</div>
            <div className="truncate font-mono text-rep-label font-semibold text-rep-ink-label">
              <span>{host}</span>
              <span>{attemptedPath}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col items-center gap-3 desktop:flex-row desktop:gap-4">
          <button
            type="button"
            onClick={() => navigate(hasSession ? '/mapa' : '/')}
            className="rep-focus flex min-h-touch items-center justify-center rounded-[13px] border-0 bg-rep-accent px-6 text-rep-button text-rep-on-accent shadow-rep-accent transition-[transform,background-color] duration-120 hover:bg-rep-accent-strong active:scale-[0.98]"
          >
            Volver al inicio
          </button>
          <button
            type="button"
            onClick={() => navigate('/municipios')}
            className="rep-focus min-h-touch rounded border-0 bg-transparent px-2 text-rep-body font-bold text-rep-ink-muted transition-colors hover:text-rep-ink-label desktop:text-rep-body-d"
          >
            Ingresar con cuenta institucional
          </button>
        </div>
      </div>

      {/* M32: «Conserva las pestañas: la sesión sigue viva» */}
      {hasSession && <AppTabBar activeTab="mapa" className="desktop:hidden" />}
    </div>
  );
};

export default ForbiddenPage;
