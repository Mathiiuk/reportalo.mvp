import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getUserInitials } from '../../utils/userUtils';

/**
 * Barra blanca con la marca para las pantallas de escritorio de antes de entrar a la app
 * (UJ v3.3 · D01 a D07): portada, acceso, «Revisá tu correo», onboarding y permisos.
 * Todavía no hay navegación: solo la marca y, según la pantalla, «Ingresar» o el avatar.
 * La barra con secciones es `AppDesktopHeader` (AppLayout). REP-3791 Bloque 11-C.
 *
 * @param {boolean} [showUser]  Muestra las iniciales del usuario (D04 a D07, ya con sesión).
 * @param {React.ReactNode} [children]  Acciones a la derecha (por ejemplo, «Ingresar» en D01).
 */
export const BrandBar = ({ showUser = false, children = null }) => {
  const { user } = useAuth();

  return (
    <header
      data-testid="brand-bar"
      className="z-20 flex flex-none items-center gap-5 border-b border-rep-divider bg-rep-surface px-6 py-2.5"
    >
      <Link to="/" className="flex min-h-touch items-center gap-2 text-inherit no-underline transition-opacity hover:opacity-90">
        <img src="/logo-icon.webp" alt="" aria-hidden="true" className="h-[25px] w-[19px] object-contain" />
        <span className="text-rep-section-d text-rep-ink">
          Reportalo<span className="align-super text-[9px] font-bold text-rep-ink-muted">™</span>
        </span>
      </Link>

      <div className="ml-auto flex items-center gap-2">
        {children}
        {showUser && (
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-rep-accent-border bg-rep-accent-soft text-rep-label font-extrabold text-rep-accent"
          >
            {getUserInitials(user)}
          </span>
        )}
      </div>
    </header>
  );
};

export default BrandBar;
