import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, BookOpen, CloudOff, House, Map as MapIcon, RotateCw } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

/**
 * OBS · F1 · Marco del observatorio del vecino (POC v5: D56–D61 en escritorio, M49–M54 en el teléfono).
 *
 * - Escritorio: barra superior con el logo, el sello «Observatorio», las cuatro secciones y «Volver a Reportalo».
 * - Teléfono: cabecera corta y las cuatro secciones abajo (en el POC, la navegación inferior).
 * - Sin conexión: franja fija arriba con «Reintentar» (estado «Sin conexión» de D60/M53).
 *
 * Se entra solo con sesión (decisión de Matías, 04/11/2026): la ruta va dentro de ProtectedRoute.
 */
export const SECCIONES = [
  { to: '/observatorio/mi-barrio', label: 'Mi barrio', icon: House },
  { to: '/observatorio/mapa', label: 'Mapa', icon: MapIcon },
  { to: '/observatorio/comparar', label: 'Comparar', icon: ArrowLeftRight },
  { to: '/observatorio/metodologia', label: 'Metodología', icon: BookOpen },
];

const Logo = () => (
  <Link to="/observatorio" className="flex items-center gap-2 text-inherit no-underline">
    <img src="/logo-icon.webp" alt="" aria-hidden="true" className="h-[25px] w-[19px] object-contain" />
    <span className="text-rep-section text-rep-ink desktop:text-rep-section-d">
      Reportalo<span className="align-super text-[9px] font-bold text-rep-ink-muted">™</span>
    </span>
    <span className="rounded-full bg-rep-accent-soft px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-rep-accent">
      OBSERVATORIO
    </span>
  </Link>
);

const VolverALaApp = ({ compacto = false }) => (
  <Link
    to="/mapa"
    aria-label="Volver a Reportalo"
    className="rep-focus flex min-h-touch items-center gap-1.5 rounded-xl px-2.5 text-rep-label font-bold text-rep-ink-label no-underline hover:bg-rep-divider"
  >
    <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
    {!compacto && <span>Volver a Reportalo</span>}
  </Link>
);

/** Franja de sin conexión: lo que se ve son los últimos datos que se pudieron traer. */
export const FranjaSinConexion = () => (
  <div role="status" className="flex items-center gap-2 bg-rep-warning-soft px-4 py-2 text-[12.5px] font-semibold text-rep-warning-ink">
    <CloudOff aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2.25} />
    <span className="min-w-0 flex-1">Sin conexión. Las cifras pueden no estar al día.</span>
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="rep-focus inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2 font-bold underline"
    >
      <RotateCw aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
      Reintentar
    </button>
  </div>
);

export const ObsLayout = ({ children }) => {
  const { isOnline } = useNetworkStatus();

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-rep-bg font-manrope">
      {/* Teléfono: cabecera corta */}
      <header className="z-30 flex flex-none items-center justify-between border-b border-rep-divider bg-rep-surface px-3 pb-2 pt-[max(10px,env(safe-area-inset-top,10px))] desktop:hidden">
        <Logo />
        <VolverALaApp compacto />
      </header>

      {/* Escritorio: barra con las secciones */}
      <header
        data-testid="obs-desktop-header"
        className="z-30 hidden flex-none items-center gap-6 border-b border-rep-divider bg-rep-surface px-6 py-2.5 desktop:flex"
      >
        <Logo />
        <nav aria-label="Secciones del observatorio" className="flex gap-5">
          {SECCIONES.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              className={({ isActive }) =>
                `rep-focus rounded py-1 text-rep-label-d no-underline transition-colors ${
                  isActive ? 'border-b-2 border-rep-accent font-bold text-rep-accent' : 'font-semibold text-rep-ink-muted hover:text-rep-ink-label'
                }`
              }
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
        <span className="ml-auto" />
        <VolverALaApp />
      </header>

      {!isOnline && <FranjaSinConexion />}

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-3.5 px-4 pb-28 pt-4 desktop:gap-4 desktop:px-6 desktop:pb-12 desktop:pt-6">
          {children}
        </div>
      </main>

      {/* Teléfono: las cuatro secciones abajo */}
      <nav
        aria-label="Secciones del observatorio"
        data-testid="obs-tab-bar"
        className="fixed inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom,12px))] z-30 mx-auto flex w-[calc(100%-32px)] max-w-[390px] items-center justify-between rounded-[28px] border border-rep-border bg-rep-surface px-2 py-1.5 shadow-rep-float desktop:hidden"
      >
        {SECCIONES.map((s) => {
          const Icon = s.icon;
          return (
            <NavLink
              key={s.to}
              to={s.to}
              className={({ isActive }) =>
                `rep-focus flex min-h-touch flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] px-1 py-1 no-underline transition-colors duration-120 ${
                  isActive ? 'bg-rep-accent-soft text-rep-accent' : 'text-rep-ink-faint hover:text-rep-ink-label'
                }`
              }
            >
              <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
              <span className="text-[10px] font-bold leading-none">{s.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

export default ObsLayout;
