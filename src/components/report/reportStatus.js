/**
 * Estados del reporte según el UJ v3.3 §10 «Taxonomía de estados» (REP-3791 · Bloque 3).
 *
 * La tabla `report_states` de la base todavía usa otros códigos (en_curso, rechazado) y no tiene
 * «notificado». Mientras se define el modelo (H-23), los códigos de la base se traducen acá.
 */
export const REPORT_STATUS = {
  borrador: { label: 'Pendiente', tone: 'warning' },
  enviado: { label: 'Enviado', tone: 'success' },
  en_revision: { label: 'En revisión', tone: 'accent' },
  notificado: { label: 'Notificado al responsable', tone: 'notice' },
  resuelto: { label: 'Resuelto', tone: 'success' },
  descartado: { label: 'Descartado', tone: 'neutral' },
};

// Traducción provisoria de códigos de `report_states` que no coinciden con el §10 (H-23)
const DB_STATE_ALIASES = {
  en_curso: 'en_revision',
  rechazado: 'descartado',
};

// Pasos del tracker: uno por estado real; «descartado» es un cierre alternativo, no un paso
export const TRACKER_STEPS = ['enviado', 'en_revision', 'notificado', 'resuelto'];

export const normalizeReportState = (code) => {
  const value = String(code ?? '').trim().toLowerCase();
  if (!value) return null;
  if (REPORT_STATUS[value]) return value;
  return DB_STATE_ALIASES[value] ?? value;
};

export const getStatusConfig = (code) => {
  const normalized = normalizeReportState(code);
  return REPORT_STATUS[normalized] ?? { label: normalized ?? 'Sin estado', tone: 'neutral' };
};

// Mismo formato que el acuse de envío (NewReportPage): #RP- + primeros 8 caracteres del id
export const formatReportCode = (id) => `#RP-${String(id ?? '').slice(0, 8).toUpperCase()}`;

// «14/08 · 14:32»
export const formatShortDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * Arma la línea de tiempo del detalle (M16 / D17) a partir del estado actual, la fecha de envío
 * y el historial (`report_state_history`). Si el historial no está disponible, igual marca como
 * hechos los pasos anteriores al estado actual, sin fecha.
 */
export const buildTimeline = ({ currentState, createdAt, history = [] }) => {
  const current = normalizeReportState(currentState) ?? 'enviado';
  const entries = history
    .map((entry) => ({ ...entry, state: normalizeReportState(entry.state_code) }))
    .filter((entry) => entry.state);

  const lastEntryFor = (state) => [...entries].reverse().find((entry) => entry.state === state) ?? null;

  const isDiscarded = current === 'descartado';
  const reachedIndex = isDiscarded
    ? Math.max(0, ...entries.map((entry) => TRACKER_STEPS.indexOf(entry.state)))
    : TRACKER_STEPS.indexOf(current);

  const steps = TRACKER_STEPS.map((state, index) => {
    const entry = lastEntryFor(state);
    const done = index <= reachedIndex;
    return {
      key: state,
      label: REPORT_STATUS[state].label,
      done,
      current: !isDiscarded && index === reachedIndex,
      date: formatShortDateTime(entry?.changed_at ?? (state === 'enviado' ? createdAt : null)),
      note: entry?.notes || null,
    };
  });

  if (isDiscarded) {
    const entry = lastEntryFor('descartado');
    steps.push({
      key: 'descartado',
      label: REPORT_STATUS.descartado.label,
      done: true,
      current: true,
      discarded: true,
      date: formatShortDateTime(entry?.changed_at),
      note: entry?.notes || null,
    });
  }

  return steps;
};

// Estados de cierre del §10. Lo usa el listado de Mis reportes para la insignia.
export const CLOSED_STATES = ['resuelto', 'descartado'];

/** @returns {boolean} true si el reporte ya está cerrado (resuelto o descartado). */
export const isClosedState = (code) => CLOSED_STATES.includes(normalizeReportState(code));
