import React from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Unlink } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useIsDesktopLayout } from '../hooks/useMediaQuery';
import { AppDesktopHeader, AppTabBar } from '../components/layout/AppLayout';

/**
 * 404 · reporte inexistente (UJ v3.3 · M30 teléfono / D36 escritorio).
 *
 * «Contenido inexistente, sesión intacta»: la ruta es válida y el reporte no. Con sesión se
 * conserva la navegación de la app (pestañas en el teléfono, barra global en escritorio). Sin
 * sesión (un enlace compartido que abre alguien sin cuenta) queda solo la cabecera con «volver».
 * REP-3791 Bloque 11-B: botón principal «Volver al inicio» y navegación, como pide el diseño.
 */
export const NotFoundReportPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { session } = useAuth();
  const isDesktop = useIsDesktopLayout();
  const hasSession = Boolean(session);

  // Use a default ID if none provided in params
  const displayId = id || 'RP-1907';

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-rep-bg font-manrope">
      {isDesktop && hasSession ? (
        // D36: barra global completa, con «Mapa» marcado
        <AppDesktopHeader activeTab="mapa" />
      ) : (
        // M30: cabecera con «volver»
        <div className="flex flex-none items-center gap-[9px] border-b border-rep-divider bg-rep-surface px-[14px] pb-3 pt-[max(16px,env(safe-area-inset-top,16px))]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Volver"
            className="rep-focus flex cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 transition-transform active:scale-95"
          >
            <ArrowLeft aria-hidden="true" className="h-[22px] w-[22px] text-rep-ink-label" strokeWidth={2.25} />
          </button>
          <span className="text-[16px] font-extrabold text-rep-ink">Reporte</span>
        </div>
      )}

      {/* Content */}
      <div
        className={`flex flex-1 flex-col items-center justify-center overflow-y-auto bg-rep-bg px-[30px] text-center desktop:px-10 ${
          hasSession ? 'pb-28 desktop:pb-10' : 'pb-10'
        }`}
      >
        <div className="flex items-center justify-center">
          <svg className="h-[112px] w-[164px] desktop:h-[134px] desktop:w-[196px]" viewBox="0 0 164 112" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="4" y="58" width="156" height="48" rx="7" fill="#cfd8e2"></rect>
            <path d="M4 88h156" stroke="#e8edf3" strokeWidth="4" strokeDasharray="14 12"></path>
            <path d="M60 66c11-5 29-6 38 0s11 17 0 21-33 4-42-3 -7-13 4-18Z" fill="#5c6a7a"></path>
            <path d="M65 70c9-4 22-5 29 0s8 13 0 16-25 3-32-2 -6-10 3-14Z" fill="#3b4756"></path>
            <rect x="112" y="10" width="48" height="32" rx="5" fill="#fff" stroke="#c0392b" strokeWidth="3"></rect>
            <rect x="133" y="42" width="6" height="30" rx="2" fill="#b8c3cf"></rect>
            <text x="136" y="26" fontFamily="Manrope Variable,Manrope,sans-serif" fontSize="9" fontWeight="800" fill="#c0392b" textAnchor="middle">CERRADO</text>
            <text x="136" y="37" fontFamily="Manrope Variable,Manrope,sans-serif" fontSize="7.5" fontWeight="700" fill="#9aa7b5" textAnchor="middle">404</text>
            <path d="M18 84l9-32h8l9 32H18Z" fill="#F78E35"></path>
            <rect x="12" y="82" width="39" height="8" rx="3" fill="#e07c1a"></rect>
            <rect x="22" y="62" width="17" height="6" fill="#fff" opacity=".85"></rect>
          </svg>
        </div>

        <h1 className="m-0 mt-3 text-rep-title text-rep-ink desktop:mt-4 desktop:text-rep-title-d">Este reporte ya no está</h1>

        <p className="m-0 mt-2 max-w-[430px] text-pretty text-rep-body text-rep-ink-muted desktop:text-rep-body-d">
          El enlace que abriste apunta a un reporte que se dio de baja o que nunca existió.
        </p>

        {/* La URL fallida tal cual, para que el usuario confirme que copió bien el enlace */}
        <div className="mt-4 flex w-full items-center justify-center gap-2 rounded-[12px] border border-rep-border bg-rep-surface px-3 py-2.5 text-left desktop:w-auto desktop:justify-start desktop:px-4">
          <Unlink aria-hidden="true" className="h-4 w-4 flex-none text-rep-ink-faint" strokeWidth={2.25} />
          <span className="truncate font-mono text-[11px] font-semibold leading-[1.35] text-rep-ink-muted desktop:text-[12px]">
            reportalo.ar/r/{displayId}
          </span>
        </div>

        <div className="mt-5 flex flex-col items-center gap-3 desktop:flex-row desktop:gap-4">
          <Link
            to={hasSession ? '/mapa' : '/'}
            className="rep-focus flex min-h-touch items-center justify-center rounded-[13px] bg-rep-accent px-6 text-rep-button text-rep-on-accent no-underline shadow-rep-accent transition-[transform,background-color] duration-120 hover:bg-rep-accent-strong active:scale-[0.98]"
          >
            Volver al inicio
          </Link>

          <Link
            to="/reportes"
            className="rep-focus rounded text-rep-body font-bold text-rep-ink-muted no-underline transition-colors hover:text-rep-ink-label desktop:text-rep-body-d"
          >
            Ir a mis reportes
          </Link>
        </div>
      </div>

      {/* M30: «Conserva la barra de pestañas: es un error de contenido, no de sesión» */}
      {hasSession && <AppTabBar activeTab="mapa" className="desktop:hidden" />}
    </div>
  );
};

export default NotFoundReportPage;
