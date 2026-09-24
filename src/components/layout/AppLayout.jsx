import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Bell, Map as MapIcon, FileText, Camera, User, Megaphone, ImagePlus, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getUserInitials } from '../../utils/userUtils';
import { THEME_TOGGLE_ENABLED, setThemePreference } from '../../lib/themePreference';

// UJ v3.3 §10 «Comportamiento del tema»: el conmutador vive en la barra superior. La constante
// y el guardado de la preferencia viven en lib/themePreference (H-09); se reexporta para Perfil.
export { THEME_TOGGLE_ENABLED };

const TABS = [
  { key: 'mapa', label: 'Mapa', icon: MapIcon, path: '/mapa', ariaLabel: 'Mapa' },
  { key: 'reportes', label: 'Mis reportes', icon: FileText, path: '/reportes', ariaLabel: 'Mis reportes' },
  { key: 'alertas', label: 'Novedades', icon: Megaphone, path: '/alertas', ariaLabel: 'Alertas y novedades' },
  { key: 'perfil', label: 'Perfil', icon: User, path: '/perfil', ariaLabel: 'Perfil' },
];

const ThemeToggle = ({ className = '' }) => {
  // Estado propio para que el ícono cambie al tocarlo; parte del tema ya aplicado en <html>
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  if (!THEME_TOGGLE_ENABLED) return null;
  return (
    <button
      type="button"
      aria-label={isDark ? 'Usar tema claro' : 'Usar tema oscuro'}
      onClick={() => setIsDark(setThemePreference(isDark ? 'light' : 'dark') === 'dark')}
      className={`rep-focus flex min-h-touch min-w-touch items-center justify-center rounded-full text-rep-ink-label transition-colors duration-120 hover:bg-rep-divider ${className}`}
    >
      {isDark ? <Sun aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} /> : <Moon aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />}
    </button>
  );
};

/**
 * Marco de la app: barra superior, navegación y acceso a «Reportar».
 * UJ v3.3 · M08 (teléfono: cabecera + cuatro pestañas + botón flotante) y D09 (escritorio:
 * la navegación pasa al encabezado). REP-3791 Bloque 5. Mismo contrato de props que antes.
 */
export const AppLayout = ({ children, activeTab = 'mapa', onCameraClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const userInitials = getUserInitials(user);

  const getActiveTab = () => {
    if (location.pathname.startsWith('/mapa')) return 'mapa';
    if (location.pathname.startsWith('/reportes')) return 'reportes';
    if (location.pathname.startsWith('/alertas') || location.pathname.startsWith('/novedades')) return 'alertas';
    if (location.pathname.startsWith('/perfil')) return 'perfil';
    return activeTab;
  };
  const currentTab = getActiveTab();

  const handleCameraClick = () => {
    if (onCameraClick) {
      onCameraClick();
      return;
    }
    navigate('/nuevo-reporte');
  };

  const handleDirectCapture = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      navigate('/nuevo-reporte', { state: { initialCapturedFile: file } });
    }
    e.target.value = '';
  };

  return (
    <div className="relative flex h-[100dvh] w-full select-none flex-col overflow-hidden bg-rep-bg font-manrope">
      {/* Cabecera en teléfono (M08) */}
      <header className="z-30 flex-none border-b border-rep-divider bg-rep-surface pt-[max(12px,env(safe-area-inset-top,12px))] md:hidden">
        <div className="flex items-center justify-between px-4 pb-2 pt-1">
          <Link to="/mapa" className="flex items-center gap-2.5 text-inherit no-underline">
            <img src="/logo-icon.webp" alt="" aria-hidden="true" className="h-7 w-6 select-none object-contain" />
            <span className="text-rep-title text-rep-ink">
              Reportalo<span className="align-super text-[10px] font-bold text-rep-ink-muted">™</span>
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => navigate('/notificaciones')}
              aria-label="Ver alertas y notificaciones"
              className="rep-focus relative flex min-h-touch min-w-touch items-center justify-center rounded-full text-rep-ink-label transition-colors duration-120 hover:bg-rep-divider active:scale-[0.98]"
            >
              <Bell aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
              <span className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-rep-surface bg-rep-danger px-1 text-[10px] font-extrabold text-white">
                2
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Cabecera en escritorio (D09): la navegación vive acá */}
      <header className="z-30 hidden flex-none items-center gap-5 border-b border-rep-divider bg-rep-surface px-6 py-2.5 md:flex">
        <Link to="/mapa" className="flex items-center gap-2 text-inherit no-underline transition-opacity hover:opacity-90">
          <img src="/logo-icon.webp" alt="" aria-hidden="true" className="h-[25px] w-[19px] object-contain" />
          <span className="text-rep-section-d text-rep-ink">
            Reportalo<span className="align-super text-[9px] font-bold text-rep-ink-muted">™</span>
          </span>
        </Link>

        <nav aria-label="Secciones" className="ml-4 flex gap-6">
          {TABS.filter((tab) => tab.key !== 'perfil').map((tab) => (
            <Link
              key={tab.key}
              to={tab.path}
              className={`rep-focus rounded py-1 text-rep-label-d no-underline transition-colors ${
                currentTab === tab.key
                  ? 'border-b-2 border-rep-accent font-bold text-rep-accent'
                  : 'font-semibold text-rep-ink-muted hover:text-rep-ink-label'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={handleCameraClick}
            className="rep-focus flex min-h-touch items-center gap-2 rounded-xl bg-rep-accent px-4 text-rep-label-d font-bold text-rep-on-accent shadow-rep-accent transition-[transform,background-color] duration-120 hover:bg-rep-accent-strong active:scale-[0.98]"
          >
            <ImagePlus aria-hidden="true" className="h-[17px] w-[17px]" strokeWidth={2.25} />
            <span>Reportar</span>
          </button>
          <Link
            to="/perfil"
            title="Ver mi perfil"
            aria-label="Ver mi perfil"
            className="rep-focus flex h-9 w-9 items-center justify-center rounded-full border border-rep-accent-border bg-rep-accent-soft text-rep-label font-extrabold text-rep-accent no-underline transition-[filter] duration-120 hover:brightness-[.96] dark:hover:brightness-[1.06]"
          >
            {userInitials}
          </Link>
        </div>
      </header>

      <main className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-rep-bg">{children}</main>

      {/* Botón «Reportar» sobre el mapa (M08) */}
      {currentTab === 'mapa' && (
        <div className="pointer-events-none fixed bottom-[max(92px,calc(env(safe-area-inset-bottom,12px)+80px))] right-4 z-30 md:hidden">
          <label
            htmlFor="mobile-direct-camera-trigger"
            aria-label="Tomar foto y reportar"
            className="rep-focus pointer-events-auto flex min-h-touch cursor-pointer items-center gap-2 rounded-full bg-rep-accent px-5 py-3.5 text-rep-button text-rep-on-accent shadow-rep-accent transition-transform duration-120 active:scale-[0.97]"
          >
            <Camera aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
            <span>Reportar</span>
            <input
              id="mobile-direct-camera-trigger"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={handleDirectCapture}
              data-testid="direct-camera-trigger"
            />
          </label>
        </div>
      )}

      {/* Barra de pestañas en teléfono (M08): cuatro accesos */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom,12px))] z-30 flex justify-center px-4 md:hidden">
        <nav
          aria-label="Navegación principal"
          className="pointer-events-auto flex w-full max-w-[390px] items-center justify-between rounded-[28px] border border-rep-border bg-rep-surface px-2 py-1.5 shadow-rep-float"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => navigate(tab.path)}
                aria-label={tab.ariaLabel}
                aria-current={isActive ? 'page' : undefined}
                className={`rep-focus relative flex min-h-touch flex-1 flex-col items-center gap-0.5 rounded-[14px] border-0 bg-transparent px-2 py-1 transition-colors duration-120 ${
                  isActive ? 'bg-rep-accent-soft text-rep-accent' : 'text-rep-ink-faint hover:text-rep-ink-label'
                }`}
              >
                <span className="relative">
                  <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
                  {/* Punto de no leídas en Novedades (M08) */}
                  {tab.key === 'alertas' && (
                    <span aria-hidden="true" className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full border border-rep-surface bg-rep-danger" />
                  )}
                </span>
                <span className="text-[10px] font-bold leading-none">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default AppLayout;
