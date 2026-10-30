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
  // REP-3001 (reglas del panel §4 y §6): el vecino lee la misma etiqueta que el operador
  notificado: { label: 'Derivado', tone: 'notice' },
  resuelto: { label: 'Resuelto', tone: 'success' },
  descartado: { label: 'Desestimado', tone: 'neutral' },
  // REP-2502 (H-2, PO 15/10/2026): estados nuevos. INFORMADO = se le indicó al vecino el canal que corresponde,
  // sin derivar a un organismo (vulnerabilidad social). ESCALADO y EN_DISCREPANCIA los pone el organismo.
  informado: { label: 'Informado', tone: 'notice' },
  escalado: { label: 'Escalado', tone: 'notice' },
  en_discrepancia: { label: 'En discrepancia', tone: 'warning' },
};

/*
 * Traducción de los códigos de `report_states` a la taxonomía del §10 (H-23).
 *
 * Los códigos REALES de producción (proyecto CiudadAR, verificados el 21/09/2026
 * contra la base: 17 reportes, todos con estos valores) son los de arriba, en
 * mayúscula. El `seed.sql` del repositorio declara otro juego en minúscula
 * (borrador / enviado / en_curso / resuelto / rechazado) que **no existe en la
 * base**: ese archivo quedó desactualizado y conviene alinearlo.
 *
 * Se aceptan los dos juegos: los de producción, que son los que importan hoy, y
 * los del seed, por si alguna vez se migra el catálogo. `normalizeReportState`
 * pasa a minúscula antes de buscar acá, así que las claves van en minúscula.
 */
const DB_STATE_ALIASES = {
  // Códigos reales de producción
  recibido: 'enviado',
  en_analisis: 'en_revision',
  derivado: 'notificado',
  desestimado: 'descartado',
  // Códigos del seed del repositorio, hoy inexistentes en la base
  en_curso: 'en_revision',
  rechazado: 'descartado',
};

// Pasos del tracker: uno por estado real; «descartado» es un cierre alternativo, no un paso
export const TRACKER_STEPS = ['enviado', 'en_revision', 'notificado', 'resuelto'];
// REP-3841: Vulnerabilidad social no se deriva: Enviado → Informado, sin «Derivado» ni «Resuelto»
export const SOCIAL_TRACKER_STEPS = ['enviado', 'informado'];

// Estados que se muestran como un paso extra al final del recorrido, no dentro de los 4 pasos
const EXTRA_STATES = ['descartado', 'informado', 'escalado', 'en_discrepancia'];
// Los que ocurren después de la notificación al organismo: el recorrido llega al menos hasta «notificado»
const AFTER_NOTIFIED_STATES = ['escalado', 'en_discrepancia'];

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

// «hoy 14:32» · «ayer 19:40» · «09/08»: fecha corta de las filas de Mis reportes (M17 · D18)
export const formatListDate = (value, now = new Date()) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return `hoy ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `ayer ${time}`;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
};

/**
 * Arma la línea de tiempo del detalle (M16 / D17) a partir del estado actual, la fecha de envío
 * y el historial (`report_state_history`). Si el historial no está disponible, igual marca como
 * hechos los pasos anteriores al estado actual, sin fecha. `taken` es el «tomado» del organismo (REP-3001), si hubo.
 */
export const buildTimeline = ({ currentState, createdAt, history = [], socialAssistance = false, taken = null }) => {
  const current = normalizeReportState(currentState) ?? 'enviado';
  const entries = history
    .map((entry) => ({ ...entry, state: normalizeReportState(entry.state_code) }))
    .filter((entry) => entry.state);

  const lastEntryFor = (state) => [...entries].reverse().find((entry) => entry.state === state) ?? null;

  // REP-3841: un INFORMADO también usa este recorrido aunque no se sepa la categoría (solo lo pone asistencia social).
  // Un cierre como Descartado se agrega al final, igual que en el recorrido general.
  if (socialAssistance || current === 'informado') {
    const informed = current === 'informado';
    const steps = SOCIAL_TRACKER_STEPS.map((state, index) => {
      const entry = lastEntryFor(state);
      const done = index === 0 || informed;
      return {
        key: state,
        label: REPORT_STATUS[state].label,
        done,
        current: informed ? state === 'informado' : index === 0 && current !== 'descartado',
        date: formatShortDateTime(entry?.changed_at ?? (state === 'enviado' ? createdAt : null)),
        note: entry?.notes || null,
      };
    });
    if (current === 'descartado') {
      const entry = lastEntryFor(current);
      steps.push({
        key: current,
        label: REPORT_STATUS[current].label,
        done: true,
        current: true,
        discarded: true,
        date: formatShortDateTime(entry?.changed_at),
        note: entry?.notes || null,
      });
    }
    return steps;
  }

  const isExtra = EXTRA_STATES.includes(current);
  const reachedIndex = isExtra
    ? Math.max(
        0,
        ...entries.map((entry) => TRACKER_STEPS.indexOf(entry.state)),
        AFTER_NOTIFIED_STATES.includes(current) ? TRACKER_STEPS.indexOf('notificado') : 0
      )
    : TRACKER_STEPS.indexOf(current);

  const steps = TRACKER_STEPS.map((state, index) => {
    const entry = lastEntryFor(state);
    const done = index <= reachedIndex;
    return {
      key: state,
      label: REPORT_STATUS[state].label,
      done,
      current: !isExtra && index === reachedIndex,
      date: formatShortDateTime(entry?.changed_at ?? (state === 'enviado' ? createdAt : null)),
      note: entry?.notes || null,
    };
  });

  // REP-3001 (reglas §6): después de Derivado, el «tomado» y cada Escalado o En discrepancia por el que pasó, en orden.
  // «Tomado» es un paso hecho, nunca el actual: el reporte sigue Derivado, no Resuelto.
  const afterNotified = [];
  if (taken?.taken_at) {
    afterNotified.push({
      key: 'tomado',
      label: 'El organismo tomó tu reporte',
      done: true,
      current: false,
      date: formatShortDateTime(taken.taken_at),
      detail: taken.agency || null,
      note: null,
    });
  }
  const intermediates = entries.filter((entry) => AFTER_NOTIFIED_STATES.includes(entry.state));
  // Sin historial legible, el estado actual igual aparece (sin fecha)
  if (AFTER_NOTIFIED_STATES.includes(current) && intermediates.at(-1)?.state !== current) {
    intermediates.push({ state: current });
  }
  intermediates.forEach((entry, index) => {
    const isLast = index === intermediates.length - 1;
    afterNotified.push({
      key: afterNotified.some((step) => step.key === entry.state) ? `${entry.state}-${index}` : entry.state,
      label: REPORT_STATUS[entry.state].label,
      done: true,
      current: isLast && entry.state === current,
      date: formatShortDateTime(entry.changed_at),
      // D-05: el destino es texto libre del operador; no se afirma que se haya enviado a ningún lado
      // REP-3001: con el contacto del destino, si el operador lo cargó
      detail: entry.escalated_to
        ? [`El organismo indicó que corresponde a: ${entry.escalated_to}`, entry.escalated_contact ? `Contacto: ${entry.escalated_contact}` : null]
            .filter(Boolean)
            .join(' · ')
        : null,
      note: entry.notes || null,
    });
  });
  steps.splice(TRACKER_STEPS.indexOf('notificado') + 1, 0, ...afterNotified);

  if (current === 'descartado') {
    const entry = lastEntryFor(current);
    steps.push({
      key: current,
      label: REPORT_STATUS[current].label,
      done: true,
      current: true,
      discarded: true,
      date: formatShortDateTime(entry?.changed_at),
      note: entry?.notes || null,
    });
  }

  return steps;
};

// Decisiones del organismo que el vecino ve arriba del seguimiento (reglas §6, diseño v2 D50 a D52)
const ORGANISM_DECISIONS = ['resuelto', 'descartado', 'escalado', 'en_discrepancia'];

/**
 * REP-3001 · Respuesta del organismo para «Mis reportes» (diseño v2 de Iván, D49 a D52): el estado, el motivo textual,
 * a quién corresponde si se escaló, qué organismo de prueba lo marcó y cuándo. Derivado y tomado muestra que llegó a
 * la bandeja. Sin decisión ni derivación, null.
 */
export const buildOrganismResponse = ({ currentState, history = [], taken = null }) => {
  const current = normalizeReportState(currentState);
  if (current === 'notificado') {
    if (!taken?.taken_at) return null;
    return {
      state: current,
      label: REPORT_STATUS[current].label,
      summary: `Llegó a la bandeja de ${taken.agency || 'un organismo de prueba'}.`,
      reason: null,
      escalatedTo: null,
      contact: null,
      agency: taken.agency || null,
      isTest: true,
      date: formatShortDateTime(taken.taken_at),
    };
  }
  if (!ORGANISM_DECISIONS.includes(current)) return null;
  const entry = [...history].reverse().find((h) => normalizeReportState(h.state_code) === current);
  if (!entry) return null;
  return {
    state: current,
    label: REPORT_STATUS[current].label,
    summary: null,
    reason: entry.notes || null,
    escalatedTo: entry.escalated_to || null,
    contact: entry.escalated_contact || null,
    agency: entry.agencies?.name || null,
    isTest: Boolean(entry.agencies?.is_test),
    date: formatShortDateTime(entry.changed_at),
    changedAt: entry.changed_at,
  };
};

// Estados de cierre del §10. Lo usa el listado de Mis reportes para la insignia.
export const CLOSED_STATES = ['resuelto', 'descartado', 'informado'];

/** @returns {boolean} true si el reporte ya está cerrado (resuelto, descartado o informado). */
export const isClosedState = (code) => CLOSED_STATES.includes(normalizeReportState(code));
