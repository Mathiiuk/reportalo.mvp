import React, { useState } from 'react';
import { changePanelReportState, takeReport } from '../../services/panelService';

/*
 * REP-3001 · Acciones del operador (reglas del panel §5). Qué se ofrece lo decide la base (`actions`, del catálogo
 * de transiciones); esta pantalla no habilita nada por su cuenta y la base vuelve a validar todo.
 */

// Opciones de «Rechazar», con el texto de las reglas §5
const REJECT_OPTIONS = [
  { state: 'ESCALADO', label: 'Corresponde a otro organismo o área' },
  { state: 'DESESTIMADO', label: 'No hay reclamo o está mal formulado' },
  { state: 'EN_DISCREPANCIA', label: 'Lo reportado no coincide' },
];

const formatearFecha = (iso) =>
  new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' });

const BUTTON = 'rep-focus min-h-touch rounded-[13px] px-5 text-rep-button disabled:opacity-50';
const PRIMARY = `${BUTTON} border-0 bg-rep-accent text-rep-on-accent`;
const SECONDARY = `${BUTTON} border border-rep-border bg-rep-surface text-rep-ink`;

/** Modal con motivo obligatorio; en «Rechazar», también la opción y, si se escala, a quién. */
const ActionDialog = ({ kind, options, saving, onCancel, onConfirm }) => {
  const [toState, setToState] = useState(kind === 'resolver' ? 'RESUELTO' : null);
  const [reason, setReason] = useState('');
  const [target, setTarget] = useState('');
  const needsTarget = toState === 'ESCALADO';
  const ready = Boolean(toState) && reason.trim() !== '' && (!needsTarget || target.trim() !== '');

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="panel-action-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[520px] rounded-xl bg-rep-surface px-6 py-5">
        <h2 id="panel-action-title" className="m-0 text-rep-title text-rep-ink">
          {kind === 'resolver' ? 'Marcar resuelto' : 'Rechazar'}
        </h2>

        {kind === 'rechazar' && (
          <fieldset className="m-0 mt-4 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1 text-rep-label font-semibold text-rep-ink-muted">¿Por qué lo rechazás?</legend>
            {options.map((option) => (
              <label key={option.state} className="flex items-center gap-2 text-rep-body text-rep-ink">
                <input type="radio" name="panel-reject" checked={toState === option.state} onChange={() => setToState(option.state)} />
                {option.label}
              </label>
            ))}
          </fieldset>
        )}

        {needsTarget && (
          <label className="mt-4 flex flex-col gap-1 text-rep-label font-semibold text-rep-ink-muted">
            ¿A qué organismo o área corresponde?
            <input
              type="text"
              value={target}
              maxLength={200}
              onChange={(event) => setTarget(event.target.value)}
              className="rep-focus rounded-lg border border-rep-border px-3 py-2 text-rep-body text-rep-ink"
            />
          </label>
        )}

        <label className="mt-4 flex flex-col gap-1 text-rep-label font-semibold text-rep-ink-muted">
          Motivo (lo ve el vecino)
          <textarea
            value={reason}
            rows={3}
            maxLength={1000}
            onChange={(event) => setReason(event.target.value)}
            className="rep-focus rounded-lg border border-rep-border px-3 py-2 text-rep-body text-rep-ink"
          />
        </label>

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={saving} className={SECONDARY}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={!ready || saving}
            onClick={() => onConfirm({ toState, reason: reason.trim(), escalatedTo: needsTarget ? target.trim() : null })}
            className={PRIMARY}
          >
            {saving ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * @param {{ report: object, onChanged: () => Promise<void> }} props
 *   onChanged vuelve a leer el detalle sin vaciar la pantalla.
 */
export const PanelReportActions = ({ report, onChanged }) => {
  const [dialog, setDialog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const actions = report.actions ?? [];
  const rejectOptions = REJECT_OPTIONS.filter((option) => actions.includes(option.state));
  const canTake = report.state_code === 'DERIVADO' && !report.taken;

  const run = async (accion) => {
    if (saving) return;
    setSaving(true);
    setFeedback(null);
    const result = await accion();
    setSaving(false);
    setDialog(null);
    // Si la base rechazó porque el reporte ya cambió, se relee para mostrar el estado real
    await onChanged();
    setFeedback(result.ok ? { ok: true, text: 'Listo, el cambio quedó registrado.' } : { ok: false, text: result.message });
  };

  return (
    <section className="rounded-xl border border-rep-border bg-rep-surface px-5 py-4">
      <p className="m-0 mb-3 text-rep-label font-semibold text-rep-ink-muted">Acciones</p>

      {report.taken && (
        <p className="m-0 mb-3 text-rep-body text-rep-ink">
          Tomado por {report.taken.agency} · {formatearFecha(report.taken.taken_at)}
        </p>
      )}

      {actions.length === 0 ? (
        <p className="m-0 text-rep-body text-rep-ink-muted">
          Caso cerrado: {report.state_label || report.state_code} no se revierte desde el panel.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {canTake && (
            <button type="button" disabled={saving} onClick={() => run(() => takeReport(report.report_id))} className={PRIMARY}>
              Tomar el caso
            </button>
          )}
          {rejectOptions.length > 0 && (
            <button type="button" disabled={saving} onClick={() => setDialog('rechazar')} className={SECONDARY}>
              Rechazar
            </button>
          )}
          {actions.includes('RESUELTO') && (
            <button type="button" disabled={saving} onClick={() => setDialog('resolver')} className={SECONDARY}>
              Marcar resuelto
            </button>
          )}
        </div>
      )}

      {feedback && (
        <p role={feedback.ok ? 'status' : 'alert'} className={`m-0 mt-3 text-rep-body ${feedback.ok ? 'text-rep-ink' : 'text-rep-danger'}`}>
          {feedback.text}
        </p>
      )}

      <p className="m-0 mt-3 text-[11px] text-rep-ink-faint">
        Simulación con un organismo de prueba: ningún municipio real recibe ni gestiona este reporte.
      </p>

      {dialog && (
        <ActionDialog
          kind={dialog}
          options={rejectOptions}
          saving={saving}
          onCancel={() => setDialog(null)}
          onConfirm={(accion) => run(() => changePanelReportState(report.report_id, accion))}
        />
      )}
    </section>
  );
};

/** Historial del reporte en el panel (versión simple, según Leo): estado, fecha, a quién y motivo. */
export const PanelReportHistory = ({ history }) => {
  if (!history?.length) return null;
  return (
    <section className="rounded-xl border border-rep-border bg-rep-surface px-5 py-4">
      <p className="m-0 mb-2 text-rep-label font-semibold text-rep-ink-muted">Historial</p>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {history.map((entry, index) => (
          <li key={`${entry.state_code}-${entry.changed_at}-${index}`} className="flex flex-col">
            <span className="text-rep-body font-bold text-rep-ink">
              {entry.state_label || entry.state_code} <span className="font-normal text-rep-ink-muted">· {formatearFecha(entry.changed_at)}</span>
            </span>
            {entry.escalated_to && <span className="text-rep-label text-rep-ink-body">Corresponde a: {entry.escalated_to}</span>}
            {entry.notes && <span className="text-rep-label text-rep-ink-muted">«{entry.notes}»</span>}
          </li>
        ))}
      </ol>
    </section>
  );
};
