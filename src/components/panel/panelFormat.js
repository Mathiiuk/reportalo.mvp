/*
 * REP-3000 · Formatos y reglas de presentación del panel (diseño de Iván, LEEME §5). Todas las fechas en hora de
 * Argentina, igual para todos los operadores. Lo que se puede hacer con un caso no se decide acá: sale de `actions`.
 */

const TZ = 'America/Argentina/Buenos_Aires';
const FMT = new Intl.DateTimeFormat('es-AR', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const parts = (date) => Object.fromEntries(FMT.formatToParts(new Date(date)).map((p) => [p.type, p.value]));
const dayKey = (date) => {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}`;
};

export const ddmm = (date) => {
  const p = parts(date);
  return `${p.day}/${p.month}`;
};
export const hhmm = (date) => {
  const p = parts(date);
  return `${p.hour}:${p.minute}`;
};
const isToday = (date) => dayKey(date) === dayKey(Date.now());
const isYesterday = (date) => dayKey(date) === dayKey(Date.now() - 864e5);

/** Antigüedad de la fila: «Recién», «Hace N min», «Hace N h», «Ayer» o dd/mm. */
export const relativeAge = (date) => {
  const min = (Date.now() - new Date(date)) / 6e4;
  if (min < 1) return 'Recién';
  if (min < 60) return `Hace ${Math.floor(min)} min`;
  if (isYesterday(date)) return 'Ayer';
  if (min < 1440) return `Hace ${Math.floor(min / 60)} h`;
  return ddmm(date);
};

/** «hoy», «ayer» o «el dd/mm». */
export const dayWord = (date) => (isToday(date) ? 'hoy' : isYesterday(date) ? 'ayer' : `el ${ddmm(date)}`);

/** Número de caso del diseño: «Caso N° 000042». */
export const caseLabel = (n) => `Caso N° ${String(n ?? '').padStart(6, '0')}`;

export const FINAL_STATES = ['RESUELTO', 'DESESTIMADO'];
export const FILTERS = [
  ['por-tomar', 'Por tomar'],
  ['en-curso', 'En curso'],
  ['cerrados', 'Cerrados'],
];
export const isFilter = (value) => FILTERS.some(([key]) => key === value);

/** Por tomar = Derivado sin «tomado»; En curso = Derivado tomado, Escalado o En discrepancia; Cerrados = finales. */
export const bucketOf = (report) =>
  FINAL_STATES.includes(report.state_code) ? 'cerrados' : report.state_code === 'DERIVADO' && !report.taken ? 'por-tomar' : 'en-curso';

export const STATE_LABEL = {
  RECIBIDO: 'Recibido',
  EN_ANALISIS: 'En análisis',
  DERIVADO: 'Derivado',
  TOMADO: 'Tomado',
  ESCALADO: 'Escalado',
  EN_DISCREPANCIA: 'En discrepancia',
  RESUELTO: 'Resuelto',
  DESESTIMADO: 'Desestimado',
  INFORMADO: 'Informado',
};

/** Calle y altura si existen (REP-3843); el operador ve las dos (REP-3876 §8). */
export const addressLabel = ({ address_street: street, address_number: number }) =>
  street?.trim() ? [street.trim(), number?.trim()].filter(Boolean).join(' ') : 'Dirección no disponible';

export const ROAD_TYPE = { avenida: 'Avenida', secundaria: 'Calle' };

/** Coordenada con coma decimal y signo menos tipográfico: «−34,6043». */
export const coordLabel = (n) => (typeof n === 'number' ? `${n < 0 ? '−' : ''}${Math.abs(n).toFixed(4).replace('.', ',')}` : '');

// Marcas que deja la redacción de REP-3874 en la descripción
export const CONTACT_MARK = /\[(correo oculto|teléfono oculto)\]/gi;
export const hasHiddenContact = (text) => new RegExp(CONTACT_MARK.source, 'i').test(text ?? '');

/**
 * Referencia de la norma en una línea, como en el diseño (D41): «Ley 2148 (CABA), art. 7.1.9, inc. h)». La completa
 * queda en el texto desplegable. Si no se reconoce el artículo, vuelve como vino.
 */
export const shortReference = (reference) => {
  if (!reference) return '';
  const [law, rest = ''] = reference.split(/\s+—\s+/);
  const segments = rest.split(/\s*>\s*/);
  const article = segments.map((s) => s.match(/^art(?:ículo|iculo|\.)\s*([\w.]+)/i)).find(Boolean);
  if (!article) return reference;
  const clause = segments.map((s) => s.match(/^inciso\s+(.+)$/i)).find(Boolean);
  return [law, `art. ${article[1].replace(/\.$/, '')}`, clause ? `inc. ${clause[1]}` : null].filter(Boolean).join(', ');
};

/**
 * Historial del caso para el panel: estados de report_state_history + el evento «tomado», en orden. El organismo
 * aparece solo en acciones de un organismo (la base no manda el operador). Como en D44, arranca con el alta del
 * reporte (la base no guarda esa fila) y los registros automáticos van sin motivo: son textos internos.
 */
export const buildPanelTimeline = ({ history = [], taken = null, agencyName = '', createdAt = null }) => {
  const label = (entry) =>
    ({
      RECIBIDO: 'Reporte creado',
      EN_ANALISIS: 'Análisis automático',
      DERIVADO: `Entró a la bandeja de ${agencyName}`,
      RESUELTO: 'Marcado como resuelto',
      DESESTIMADO: 'Desestimado',
      ESCALADO: 'Escalado',
      EN_DISCREPANCIA: 'Registrada la discrepancia',
      INFORMADO: 'Informado al vecino',
    })[entry.state_code] ?? entry.state_label ?? entry.state_code;

  const items = history.map((entry) => ({
    at: entry.changed_at,
    kind: 'state',
    code: entry.state_code,
    label: label(entry),
    actor: entry.actor_type === 'organismo' ? entry.agency : null,
    reason: entry.actor_type === 'sistema' ? null : entry.notes || null,
    escalatedTo: entry.escalated_to || null,
    contact: entry.escalated_contact || null,
  }));
  if (createdAt && !history.some((entry) => entry.state_code === 'RECIBIDO')) {
    items.push({ at: createdAt, kind: 'state', code: 'RECIBIDO', label: 'Reporte creado', actor: null, reason: null, escalatedTo: null, contact: null });
  }
  if (taken?.taken_at) {
    items.push({ at: taken.taken_at, kind: 'event', code: 'TOMADO', label: `Tomado por ${taken.agency}`, actor: taken.agency });
  }
  return items.sort((a, b) => new Date(a.at) - new Date(b.at));
};
