import React from 'react';
import { ArrowLeft, Check } from 'lucide-react';

const STEPS = ['Foto', 'Detalle', 'Enviar'];

/**
 * Indicador de pasos del alta de reporte: Foto → Detalle → Enviar (UJ v3.3 · M10 / M11).
 * Paso hecho = check verde · paso actual = acento · paso pendiente = gris.
 */
export const ReportStepper = ({ current = 1 }) => (
  <ol className="m-0 flex list-none items-center p-0" aria-label="Pasos del reporte">
    {STEPS.map((label, index) => {
      const step = index + 1;
      const isDone = step < current;
      const isCurrent = step === current;

      const dotClass = isDone
        ? 'bg-rep-success text-rep-on-accent'
        : isCurrent
          ? 'bg-rep-accent text-rep-on-accent'
          : 'bg-rep-track text-rep-ink-faint';

      const labelClass = isDone
        ? 'font-bold text-rep-success'
        : isCurrent
          ? 'font-bold text-rep-accent'
          : 'font-semibold text-rep-ink-faint';

      return (
        <li
          key={label}
          aria-current={isCurrent ? 'step' : undefined}
          className={`flex items-center ${index > 0 ? 'flex-1' : ''}`}
        >
          {index > 0 && (
            <span
              aria-hidden="true"
              className={`mx-2 h-[2px] flex-1 rounded-full ${step <= current ? 'bg-rep-accent' : 'bg-rep-track'}`}
            />
          )}
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-rep-label font-extrabold ${dotClass}`}
            >
              {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : step}
            </span>
            <span className={`text-rep-label ${labelClass}`}>{label}</span>
            {isDone && <span className="sr-only">(completado)</span>}
          </span>
        </li>
      );
    })}
  </ol>
);

/**
 * Cabecera de las pantallas del alta de reporte: volver + título + pasos.
 * Teléfono: pasos debajo del título (M10 / M11) · escritorio: todo en una fila (D10 / D11 / D12).
 */
export const ReportFlowHeader = ({ title = 'Nuevo reporte', step, onBack, backLabel = 'Volver' }) => (
  <header className="shrink-0 border-b border-rep-divider bg-rep-surface px-2 pb-3.5 pt-[max(8px,env(safe-area-inset-top,8px))] desktop:flex desktop:items-center desktop:gap-10 desktop:px-8 desktop:py-4">
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onBack}
        aria-label={backLabel}
        className="rep-focus flex min-h-touch min-w-touch items-center justify-center rounded-full text-rep-ink-label transition-[transform,background-color] duration-120 hover:bg-rep-divider active:scale-[0.98]"
      >
        <ArrowLeft className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
      </button>
      <h1 className="m-0 text-rep-title text-rep-ink desktop:text-rep-title-d">{title}</h1>
    </div>
    {step ? (
      <div className="mt-2 px-3 desktop:mt-0 desktop:w-[400px] desktop:px-0">
        <ReportStepper current={step} />
      </div>
    ) : null}
  </header>
);

export default ReportFlowHeader;
