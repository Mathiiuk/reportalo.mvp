import React from 'react';
import { getStatusConfig, normalizeReportState } from './reportStatus';

// Un color por estado (UJ v3.3 §10): ámbar, verde, acento, violeta, verde, gris
const TONE_CLASS = {
  warning: 'bg-rep-warning-soft text-rep-warning-ink',
  success: 'bg-rep-success-soft text-rep-success',
  accent: 'bg-rep-accent-soft text-rep-accent',
  notice: 'bg-rep-notice-soft text-rep-notice',
  neutral: 'bg-rep-track text-rep-ink-label',
};

// En listados largos la píldora usa la forma corta (M17 · D18)
const SHORT_LABELS = { notificado: 'Notificado' };

/**
 * Píldora de estado del reporte (componente nombrado en el §10 del UJ v3.3: «StatusPill»).
 * Acepta tanto los códigos del §10 como los de la base actual (ver reportStatus.js).
 */
export const StatusPill = ({ state, className = '', short = false }) => {
  const { label, tone } = getStatusConfig(state);
  const code = normalizeReportState(state);
  const text = short ? SHORT_LABELS[code] || label : label;
  return (
    <span
      data-testid="status-pill"
      data-state={code ?? ''}
      className={`inline-flex shrink-0 items-center rounded-lg px-2.5 py-1 text-rep-pill uppercase tracking-wide ${TONE_CLASS[tone] ?? TONE_CLASS.neutral} ${className}`}
    >
      {text}
    </span>
  );
};

export default StatusPill;
