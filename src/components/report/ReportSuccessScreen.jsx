import React from 'react';
import { CheckCircle2, Check, Landmark, Ban, ShieldCheck } from 'lucide-react';
import { getCategoryTone } from './categoryTone';
import { useIsDesktopLayout } from '../../hooks/useMediaQuery';

// Tracker alineado a la base (UJ v3.3 §10 «Taxonomía de estados»): un paso por estado real
const TRACKER_STEPS = [
  { key: 'enviado', label: 'Enviado' },
  { key: 'en_revision', label: 'En revisión' },
  { key: 'notificado', label: 'Notificado al responsable' },
  { key: 'resuelto', label: 'Resuelto' },
];

const formatClock = (date) =>
  date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * Acuse de envío «Reporte enviado».
 * UJ v3.3 · M15 (teléfono) y D16 (escritorio: tarjeta centrada y tracker horizontal).
 * La entrada anima la transición M14 → M15: la tilde y el título aparecen sobre el fondo oscuro y
 * suben a su lugar; el resto del acuse se completa después. Respeta «prefiere menos movimiento».
 *
 * `consentVersion` / `consentAcceptedAt` (opcionales): la fila de constancia se muestra solo en el
 * envío que originó la aceptación de los términos (REP-3543).
 */
export const ReportSuccessScreen = ({
  reportCode = '#RP-2048',
  category,
  agencyName = 'Municipio de Avellaneda',
  onViewReport,
  onReturnToMap,
  onViewTerms,
  consentVersion = null,
  consentAcceptedAt = null,
}) => {
  const isDesktop = useIsDesktopLayout();
  const timeLabel = `Hoy ${formatClock(new Date())}`;
  const categoryName = (category?.name || 'Tránsito').toUpperCase();
  const tone = getCategoryTone(category || { id: 'transito' });
  const consentClock = consentAcceptedAt ? formatClock(new Date(consentAcceptedAt)) : formatClock(new Date());

  return (
    <div
      data-testid="report-success-screen"
      className="rep-success-bg relative flex h-full min-h-0 w-full flex-1 select-none flex-col overflow-hidden bg-rep-bg font-manrope"
    >
      <style>{`
        @keyframes repSuccessBg { 0% { background-color: rgb(var(--rep-camera)); } 100% { background-color: rgb(var(--rep-bg)); } }
        @keyframes repSuccessInk { 0% { color: rgb(255 255 255); } 100% { color: rgb(var(--rep-ink)); } }
        @keyframes repSuccessRise { 0% { transform: translateY(18px); } 100% { transform: translateY(0); } }
        @keyframes repSuccessPop { 0% { opacity: 0; transform: scale(0.3); } 60% { opacity: 1; transform: scale(1.14); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes repSuccessFadeUp { 0% { opacity: 0; transform: translateY(14px); } 100% { opacity: 1; transform: translateY(0); } }
        .rep-success-bg { animation: repSuccessBg 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .rep-success-rise { animation: repSuccessRise 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .rep-success-pop { animation: repSuccessPop 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .rep-success-ink { animation: repSuccessInk 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .rep-success-fade { animation: repSuccessFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.45s both; }
        @media (prefers-reduced-motion: reduce) {
          .rep-success-bg, .rep-success-rise, .rep-success-pop, .rep-success-ink, .rep-success-fade { animation: none !important; }
        }
      `}</style>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-md flex-col px-4 pb-4 pt-[max(24px,env(safe-area-inset-top,24px))] desktop:max-w-[600px] desktop:px-0 desktop:py-12">
          <div className="desktop:rounded-3xl desktop:border desktop:border-rep-border desktop:bg-rep-surface desktop:p-8 desktop:shadow-rep-float">
            {/* Tilde y título (heredan la transición desde M14 / D15) */}
            <div className="rep-success-rise flex flex-col items-center text-center desktop:flex-row desktop:items-center desktop:gap-4 desktop:text-left">
              <span className="rep-success-pop flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-rep-success-soft text-rep-success desktop:rounded-2xl">
                <CheckCircle2 aria-hidden="true" className="h-8 w-8" strokeWidth={2.25} />
              </span>
              <div className="mt-3 desktop:mt-0">
                <h1 className="rep-success-ink m-0 text-rep-title text-rep-ink desktop:text-rep-title-d">Reporte enviado</h1>
                <p className="rep-success-fade m-0 mt-1 text-rep-body text-rep-ink-muted desktop:text-rep-body-d">
                  Tu evidencia ya está en camino al organismo competente.
                </p>
              </div>
            </div>

            <div className="rep-success-fade mt-5 flex flex-col gap-3 desktop:mt-6">
              {/* Número, categoría y organismo */}
              <section className="rounded-2xl border border-rep-border bg-rep-surface p-4 shadow-rep-card desktop:flex desktop:items-center desktop:gap-4 desktop:bg-rep-surface-sunken desktop:shadow-none">
                <div className="flex items-center justify-between gap-3 desktop:justify-start">
                  <span data-testid="success-report-code" className="text-rep-section font-extrabold text-rep-ink">
                    {reportCode}
                  </span>
                  <span className="rounded-lg px-2.5 py-1 text-rep-pill tracking-wide" style={{ color: tone.ink, backgroundColor: tone.soft }}>
                    {categoryName}
                  </span>
                </div>
                <div aria-hidden="true" className="my-3 h-px bg-rep-divider desktop:hidden" />
                <div className="flex items-center gap-2 text-rep-body font-semibold text-rep-ink-body desktop:ml-auto">
                  <Landmark aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-rep-ink-muted" strokeWidth={2} />
                  <span>{agencyName}</span>
                </div>
              </section>

              {/* Estado del trámite: vertical en teléfono, horizontal en escritorio */}
              <section aria-label="Estado del reporte" className="rounded-2xl border border-rep-border bg-rep-surface p-4 shadow-rep-card desktop:border-0 desktop:px-0 desktop:shadow-none">
                <ol className="relative m-0 flex list-none flex-col gap-3 p-0 desktop:flex-row desktop:items-start desktop:gap-0">
                  {TRACKER_STEPS.map((step, index) => {
                    const isDone = index === 0;
                    return (
                      <React.Fragment key={step.key}>
                        {index > 0 && (
                          <li
                            aria-hidden="true"
                            className={`hidden desktop:mt-[11px] desktop:block desktop:h-[2px] desktop:flex-1 desktop:rounded-full ${
                              index === 1 ? 'bg-rep-success/60' : 'bg-rep-track'
                            }`}
                          />
                        )}
                        <li
                          aria-current={isDone ? 'step' : undefined}
                          className="flex items-start gap-3 desktop:w-[112px] desktop:flex-col desktop:items-center desktop:gap-1.5 desktop:text-center"
                        >
                          {isDone ? (
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rep-success text-rep-on-accent">
                              <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />
                            </span>
                          ) : (
                            <span aria-hidden="true" className="h-6 w-6 shrink-0 rounded-full border-2 border-rep-track bg-rep-surface" />
                          )}
                          <span className="flex flex-col">
                            <span className={`text-rep-body desktop:text-rep-label-d ${isDone ? 'font-bold text-rep-ink' : 'font-semibold text-rep-ink-muted'}`}>
                              {step.label}
                            </span>
                            {isDone && <span className="text-rep-label font-medium text-rep-ink-muted">{timeLabel}</span>}
                          </span>
                        </li>
                      </React.Fragment>
                    );
                  })}
                </ol>

                <div className="mt-4 flex items-start gap-2 border-t border-rep-divider pt-3 desktop:hidden">
                  <Ban aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rep-ink-muted" strokeWidth={2} />
                  <span className="text-rep-label font-medium text-rep-ink-muted">
                    También puede cerrarse como <strong className="font-bold text-rep-ink-label">Descartado</strong>, con el motivo a la vista.
                  </span>
                </div>
              </section>

              {/* Constancia de consentimiento: solo en el envío que originó la aceptación */}
              {consentVersion && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl px-1 text-rep-label font-semibold text-rep-success desktop:rounded-2xl desktop:bg-rep-accent-soft desktop:px-4 desktop:py-3 desktop:text-rep-label-d desktop:text-rep-ink-body">
                  <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0 desktop:text-rep-accent" strokeWidth={2.25} />
                  <span>Consentimiento registrado · v{consentVersion} · hoy {consentClock}</span>
                  <button
                    type="button"
                    onClick={onViewTerms}
                    className="rep-focus rounded font-bold text-rep-accent underline-offset-2 hover:underline desktop:ml-auto"
                  >
                    Ver constancia
                  </button>
                </div>
              )}
            </div>

            {/* Acciones en escritorio (D16): dentro de la tarjeta */}
            {isDesktop && (
            <div className="rep-success-fade mt-6 flex gap-3">
              <button
                type="button"
                onClick={onViewReport}
                aria-label="Ver el reporte"
                className="rep-focus flex min-h-[52px] flex-1 items-center justify-center rounded-2xl bg-rep-accent text-rep-button text-rep-on-accent shadow-rep-accent transition-[transform,background-color] duration-120 hover:bg-rep-accent-strong active:scale-[0.98]"
              >
                Ver el reporte
              </button>
              <button
                type="button"
                onClick={onReturnToMap}
                aria-label="Volver al mapa"
                className="rep-focus flex min-h-[52px] flex-1 items-center justify-center rounded-2xl border border-rep-border bg-rep-surface text-rep-button text-rep-ink transition-[transform,filter] duration-120 hover:brightness-[.96] active:scale-[0.98] dark:hover:brightness-[1.06]"
              >
                Volver al mapa
              </button>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Acciones en teléfono (M15): pie fijo */}
      {!isDesktop && (
      <div className="rep-success-fade shrink-0 border-t border-rep-divider bg-rep-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom,12px))]">
        <div className="mx-auto flex w-full max-w-md flex-col gap-1">
          <button
            type="button"
            onClick={onViewReport}
            aria-label="Ver el reporte"
            className="rep-focus flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-rep-accent text-rep-button text-rep-on-accent shadow-rep-accent transition-[transform,background-color] duration-120 hover:bg-rep-accent-strong active:scale-[0.98]"
          >
            Ver el reporte
          </button>
          <button
            type="button"
            onClick={onReturnToMap}
            aria-label="Volver al mapa"
            className="rep-focus min-h-touch w-full rounded-xl text-rep-body font-bold text-rep-accent"
          >
            Volver al mapa
          </button>
        </div>
      </div>
      )}
    </div>
  );
};

export default ReportSuccessScreen;
