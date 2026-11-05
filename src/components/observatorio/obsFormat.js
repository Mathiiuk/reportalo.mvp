/**
 * OBS · F1 · Formato y constantes del observatorio.
 *
 * Reglas de la metodología que se ven en pantalla:
 * - Un porcentaje o unos días que la base devolvió null (menos de 5 casos) se muestran «—», nunca 0.
 * - Un dato oficial que no existe (población) se muestra «s/d», nunca se inventa.
 */

// Las cuatro categorías del observatorio (Vulnerabilidad social no entra: REP-3906), en orden FIJO.
// El orden no es alfabético a propósito: en oscuro, el naranja de Infraestructura y el amarillo de Tránsito juntos no
// se distinguen (validador de paleta: ΔE 11,8 < 15). Con Ambiente en el medio pasa en claro y en oscuro.
// Los colores son los de la guía de Iván (tokens --rep-cat-*). En oscuro quedan más claros que la banda recomendada
// para gráficos: por eso todo gráfico lleva leyenda y números, nunca solo el color.
export const CATEGORIAS = [
  { code: 'INFRAESTRUCTURA', nombre: 'Infraestructura', color: 'rgb(var(--rep-cat-infra))' },
  { code: 'AMBIENTE', nombre: 'Ambiente', color: 'rgb(var(--rep-cat-ambiente))' },
  { code: 'TRANSITO', nombre: 'Tránsito', color: 'rgb(var(--rep-cat-transito))' },
  { code: 'COMERCIO_IRREGULAR', nombre: 'Comercio irregular', color: 'rgb(var(--rep-cat-comercio))' },
];

export const nombreCategoria = (code) => CATEGORIAS.find((c) => c.code === code)?.nombre ?? code;

// Períodos del POC: el mes en curso, el trimestre y los últimos 6 meses (por defecto)
export const PERIODOS = [
  { key: '1', label: 'Mes', meses: 1 },
  { key: '3', label: 'Trimestre', meses: 3 },
  { key: '6', label: '6 meses', meses: 6 },
];
export const PERIODO_POR_DEFECTO = '6';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Fecha local en formato de la base (YYYY-MM-DD), sin pasar por UTC
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Primer día del período: el 1 del mes que está (meses − 1) meses antes del mes de hoy.
 * @param {string} key clave del período ('1' | '3' | '6')
 * @param {Date} [hoy]
 * @returns {string} fecha YYYY-MM-DD
 */
export const desdeDePeriodo = (key, hoy = new Date()) => {
  const p = PERIODOS.find((x) => x.key === key) ?? PERIODOS.find((x) => x.key === PERIODO_POR_DEFECTO);
  return iso(new Date(hoy.getFullYear(), hoy.getMonth() - (p.meses - 1), 1));
};

/** Texto del período para los encabezados: «junio a noviembre de 2026» o «noviembre de 2026». */
export const textoPeriodo = (key, hoy = new Date()) => {
  const p = PERIODOS.find((x) => x.key === key) ?? PERIODOS.find((x) => x.key === PERIODO_POR_DEFECTO);
  const ini = new Date(hoy.getFullYear(), hoy.getMonth() - (p.meses - 1), 1);
  const fin = `${MESES[hoy.getMonth()]} de ${hoy.getFullYear()}`;
  if (p.meses === 1) return fin;
  return ini.getFullYear() === hoy.getFullYear()
    ? `${MESES[ini.getMonth()]} a ${fin}`
    : `${MESES[ini.getMonth()]} de ${ini.getFullYear()} a ${fin}`;
};

/**
 * Los meses del período, del más viejo al actual, como 'YYYY-MM-01'.
 * @returns {string[]}
 */
export const mesesDelPeriodo = (key, hoy = new Date()) => {
  const p = PERIODOS.find((x) => x.key === key) ?? PERIODOS.find((x) => x.key === PERIODO_POR_DEFECTO);
  return Array.from({ length: p.meses }, (_, i) => iso(new Date(hoy.getFullYear(), hoy.getMonth() - (p.meses - 1) + i, 1)));
};

// Días que necesita un mes para que sus reportes «tengan tiempo» de resolverse (POC: franja «Todavía abiertos»)
export const DIAS_PARA_MADURAR = 60;

/** true si el mes empezó hace menos de 60 días: sus cifras todavía van a cambiar. */
export const mesTodaviaAbierto = (mes, hoy = new Date()) => {
  const [a, m] = String(mes).split('-').map(Number);
  return (hoy - new Date(a, m - 1, 1)) / 86400000 < DIAS_PARA_MADURAR;
};

/** Mes largo para los textos: '2026-10-01' → 'octubre de 2026'. */
export const mesLargo = (fecha) => `${MESES[Number(String(fecha).slice(5, 7)) - 1] ?? ''} de ${String(fecha).slice(0, 4)}`;

/** Mes corto para los ejes: '2026-10-01' → 'Oct'. */
export const mesCorto = (fecha) => MESES_CORTOS[Number(String(fecha).slice(5, 7)) - 1] ?? '';

export const RAYA = '—';
export const SIN_DATO = 's/d';

/** Número con separador de miles argentino. null → «—». */
export const fmtNum = (n, decimales = 0) =>
  n === null || n === undefined || Number.isNaN(Number(n))
    ? RAYA
    : Number(n).toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

/** Porcentaje con un decimal como máximo: 1 → «1 %», 12.5 → «12,5 %». null → «—». */
export const fmtPct = (v) =>
  v === null || v === undefined ? RAYA : `${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`;

/** Días: 1 → «1 día», 7.8 → «7,8 días». null → «—». */
export const fmtDias = (v) => {
  if (v === null || v === undefined) return RAYA;
  const n = Number(v);
  return `${n.toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${n === 1 ? 'día' : 'días'}`;
};
