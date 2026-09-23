import React from 'react';

/**
 * Estado vacío reutilizable (componente nombrado en el §10 del UJ v3.3: «EmptyState»).
 * UJ v3.3 · M26 a M28 y D34 / D35 — REP-3791 Bloque 9.
 *
 * Reglas del diseño que sostiene:
 * - Tono de espera, no de error: dice qué va a pasar cuando haya datos.
 * - Un solo verbo por pantalla: la acción que la llena. La salida secundaria no compite.
 * - En teléfono ocupa el ancho; en escritorio es una tarjeta horizontal.
 */
export const EmptyState = ({ icon: Icon, title, description, primaryAction = null, secondaryAction = null, className = '' }) => (
  <div
    data-testid="empty-state"
    className={`mx-auto mt-6 flex w-full max-w-xl flex-col items-center rounded-[24px] border border-rep-border bg-rep-surface p-8 text-center shadow-rep-card md:mt-12 md:max-w-[620px] md:flex-row md:items-center md:gap-7 md:text-left ${className}`}
  >
    {Icon && (
      <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-rep-accent-soft text-rep-accent md:h-20 md:w-20">
        <Icon className="h-8 w-8 md:h-9 md:w-9" strokeWidth={1.75} />
      </span>
    )}

    <div className="flex flex-1 flex-col items-center md:items-start">
      <h2 className="m-0 mt-4 text-rep-section text-rep-ink md:mt-0 md:text-rep-section-d">{title}</h2>
      {description && <p className="m-0 mt-2 text-rep-body text-rep-ink-muted md:text-rep-body-d">{description}</p>}

      {(primaryAction || secondaryAction) && (
        <div className="mt-4 flex w-full flex-col items-center gap-2 md:w-auto md:flex-row md:gap-3">
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="rep-focus flex min-h-touch w-full items-center justify-center gap-1.5 rounded-xl border-0 bg-rep-accent px-4 text-rep-label font-extrabold text-rep-on-accent transition-colors duration-120 hover:bg-rep-accent-strong md:w-auto"
            >
              {primaryAction.icon && <primaryAction.icon aria-hidden="true" className="h-[17px] w-[17px]" strokeWidth={2.25} />}
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="rep-focus flex min-h-touch w-full items-center justify-center rounded-xl border border-rep-border bg-rep-surface px-4 text-rep-label font-bold text-rep-ink-label transition-[filter] duration-120 hover:brightness-[.96] dark:hover:brightness-[1.06] md:w-auto"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  </div>
);

export default EmptyState;
