import React from 'react';
import { Check, Eye, Send, Ban } from 'lucide-react';

/**
 * Línea de tiempo del reporte para el ciudadano (REP-3789, bloque 4).
 *
 * Se alimenta de buildTimeline(), que combina report_state_history con el estado
 * actual del reporte. Los pasos alcanzados muestran su fecha real; los que
 * todavía no ocurrieron se dibujan apagados, sin fecha inventada.
 *
 * `notes` se renderiza solo si existe. Hoy la columna está vacía en las 18 filas
 * de producción (verificado el 20/09/2026), así que el comentario por paso que
 * muestra el mockup no va a aparecer hasta que el backend empiece a cargarlo.
 */

/** Ícono por estado. Los no alcanzados usan un círculo vacío, no un ícono. */
const STEP_ICONS = {
  RECIBIDO: Check,
  EN_ANALISIS: Eye,
  DERIVADO: Send,
  RESUELTO: Check,
  DESESTIMADO: Ban,
};

const STEP_COLORS = {
  RECIBIDO: 'bg-[#2E9E6B]',
  EN_ANALISIS: 'bg-[#1E6FCB]',
  DERIVADO: 'bg-[#1E6FCB]',
  RESUELTO: 'bg-[#2E9E6B]',
  DESESTIMADO: 'bg-[#C0392B]',
};

/**
 * Formatea la marca temporal como en el mockup: "14/08 · 14:32".
 * @param {string|null} iso
 * @returns {string|null}
 */
export const formatStepDate = (iso) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month} · ${hours}:${minutes}`;
};

export const ReportTimeline = ({ steps = [] }) => {
  if (!steps.length) return null;

  return (
    <div
      data-testid="report-timeline"
      className="rounded-xl border border-[#E6ECF3] bg-white px-3.5 py-3"
    >
      {steps.map((step, index) => {
        const Icon = STEP_ICONS[step.code];
        const stamp = formatStepDate(step.at);

        return (
          <React.Fragment key={step.code}>
            <div
              data-testid={`timeline-step-${step.code}`}
              data-reached={step.reached ? 'true' : 'false'}
              className="flex gap-2.5 items-start"
            >
              <span
                className={`w-[18px] h-[18px] rounded-full shrink-0 flex items-center justify-center text-white ${
                  step.reached ? STEP_COLORS[step.code] : 'border-2 border-[#DDE4EC]'
                }`}
              >
                {step.reached && Icon ? <Icon size={11} strokeWidth={3} /> : null}
              </span>

              <div className="min-w-0">
                <div
                  className={`font-bold text-[11px] ${
                    step.reached ? 'text-[#263249]' : 'text-[#9AA7B5]'
                  }`}
                >
                  {step.label}
                </div>

                {stamp && (
                  <div className="font-medium text-[9.5px] leading-[1.35] text-[#9AA7B5]">
                    {stamp}
                    {step.notes ? ` · "${step.notes}"` : ''}
                  </div>
                )}
              </div>
            </div>

            {/* Conector entre pasos, salvo después del último */}
            {index < steps.length - 1 && (
              <div className="w-[2px] h-[11px] bg-[#DDE4EC] ml-2" aria-hidden="true" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
