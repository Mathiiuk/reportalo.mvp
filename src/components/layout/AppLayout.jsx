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
 * Campana de notificaciones (UJ v3.3 · M08, D19 y D35). Lleva a /notificaciones (M18 / D19).
 * El contador sigue fijo hasta que se defina cómo viaja el dato de no leídas (H-40).
 */
export const NotificationsBell = ({ ariaLabel = 'Ver alertas y notificaciones', className = '' }) => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate('/notificaciones')}
      aria-label={ariaLabel}
      className={`rep-focus relative flex min-h-touch min-w-touch items-center justify-center rounded-full text-rep-ink-label transition-colors duration-120 hover:bg-rep-divider active:scale-[0.98] ${className}`}
    >
      <Bell aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
      <span className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-rep-surface bg-rep-danger px-1 text-[10px] font-extrabold text-white">
        2
      </span>
    </button>
  );
};

/**
 * Barra superior global de escritorio (UJ v3.3 · D09 y D16 a D20; D36 y D38 con sesión).
 * Vive en AppLayout y también la usan las pantallas que no van dentro del marco de pestañas
 * (acuse de envío, detalle del reporte, 404 de reporte y 403), para que la navegación sea la
 * misma en toda la app. REP-3791 Bloque 11-B.
 *
 * @param {string|null} activeTab  Pestaña marcada ('mapa' | 'reportes' | 'alertas'); null = ninguna.
 * @param {Function} [onReport]    Acción de «Reportar». Por defecto abre /nuevo-reporte.
 * @param {string} [className]     Controla la visibilidad (por ejemplo, 'hidden desktop:flex').
 */
export const AppDesktopHeader = ({ activeTab = null, onReport, className = 'flex' }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userInitials = getUserInitials(user);
  const handleReport = onReport || (() => navigate('/nuevo-reporte'));

  return (
    <header
      data-testid="app-desktop-header"
      className={`z-30 flex-none items-center gap-5 border-b border-rep-divider bg-rep-surface px-6 py-2.5 ${className}`}
    >
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
            aria-current={activeTab === tab.key ? 'page' : undefined}
            className={`rep-focus rounded py-1 text-rep-label-d no-underline transition-colors ${
              activeTab === tab.key
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
        {/* D19 · D35: la campana también en escritorio. Sin ella, Notificaciones no tenía entrada en una PC. */}
        <NotificationsBell ariaLabel="Ver notificaciones" />
        <button
          type="button"
          onClick={handleReport}
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
  );
};

/**
 * Botón central «Reportar» de la barra de pestañas (teléfono): naranja, con ícono de cámara.
 * Abre la captura (/nuevo-reporte), donde se puede sacar la foto o subir una imagen de la galería.
 * Reemplaza al botón flotante «Reportar» que había sobre el mapa.
 */
const ReportTabButton = () => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate('/nuevo-reporte')}
      aria-label="Reportar"
      data-testid="tab-report-button"
      className="rep-focus relative -mt-6 flex shrink-0 flex-col items-center gap-0.5 rounded-full border-0 bg-transparent px-2 transition-transform duration-120 active:scale-[0.96]"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-rep-surface bg-[#E07C1A] text-white shadow-rep-float">
        <Camera aria-hidden="true" className="h-6 w-6" strokeWidth={2.25} />
      </span>
      <span className="text-[10px] font-bold leading-none text-rep-ink-label">Reportar</span>
    </button>
  );
};

/**
 * Barra de pestañas de teléfono (UJ v3.3 · M08): cuatro accesos y, en el medio, el botón naranja
 * «Reportar». También la usan M30 y M32, que la conservan porque la sesión sigue siendo válida.
 *
 * @param {string|null} activeTab Pestaña marcada; null = ninguna.
 * @param {string} [className]    Controla la visibilidad (por ejemplo, 'desktop:hidden').
 */
export const AppTabBar = ({ activeTab = null, className = '' }) => {
  const navigate = useNavigate();
  return (
    <div className={`pointer-events-none fixed inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom,12px))] z-30 flex justify-center px-4 ${className}`}>
      <nav
        aria-label="Navegación principal"
        className="pointer-events-auto flex w-full max-w-[390px] items-center justify-between rounded-[28px] border border-rep-border bg-rep-surface px-2 py-1.5 shadow-rep-float"
      >
        {TABS.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <React.Fragment key={tab.key}>
              {/* El botón «Reportar» va en el centro: dos pestañas a cada lado */}
              {index === TABS.length / 2 && <ReportTabButton />}
            <button
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
            </React.Fragment>
          );
        })}
      </nav>
    </div>
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

  const getActiveTab = () => {
    // UJ v3.3: Notificaciones y Novedades son secciones distintas. En /notificaciones no se
    // marca ninguna pestaña (antes quedaba marcada «Novedades» por el activeTab de la página).
    if (location.pathname.startsWith('/notificaciones')) return null;
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

  return (
    <div className="relative flex h-[100dvh] w-full select-none flex-col overflow-hidden bg-rep-bg font-manrope">
      {/* Cabecera en teléfono (M08) */}
      <header className="z-30 flex-none border-b border-rep-divider bg-rep-surface pt-[max(12px,env(safe-area-inset-top,12px))] desktop:hidden">
        <div className="flex items-center justify-between px-4 pb-2 pt-1">
          <Link to="/mapa" className="flex items-center gap-2.5 text-inherit no-underline">
            <img src="/logo-icon.webp" alt="" aria-hidden="true" className="h-7 w-6 select-none object-contain" />
            <span className="text-rep-title text-rep-ink">
              Reportalo<span className="align-super text-[10px] font-bold text-rep-ink-muted">™</span>
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationsBell />
          </div>
        </div>
      </header>

      {/* Cabecera en escritorio (D09): la navegación vive acá */}
      <AppDesktopHeader activeTab={currentTab} onReport={handleCameraClick} className="hidden desktop:flex" />

      <main className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-rep-bg">{children}</main>

      {/* Barra de pestañas en teléfono (M08): cuatro accesos y «Reportar» en el centro */}
      <AppTabBar activeTab={currentTab} className="desktop:hidden" />
    </div>
  );
};

export default AppLayout;
