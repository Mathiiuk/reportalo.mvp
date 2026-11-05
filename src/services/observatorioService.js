import { supabase } from '../lib/supabaseClient';

/**
 * OBS · F0a · Lectura del observatorio del vecino.
 *
 * Solo llama a las funciones de agregados de la base (migración 20261105010506_obs_f0a_agregados_del_observatorio.sql).
 * Todas exigen sesión: la base no las otorga a anon. Ninguna devuelve reportes sueltos, coordenadas ni textos.
 *
 * La regla de menos de 5 casos la aplica la base: cuando un porcentaje o unos días vienen null, la pantalla muestra «—».
 */

// Niveles del territorio, de arriba hacia abajo (los cuatro de la base)
export const NIVELES = ['pais', 'provincia', 'subdivision', 'localidad'];

// Nivel de las zonas hijas de cada nivel; la localidad es el último
export const NIVEL_HIJO = { pais: 'provincia', provincia: 'subdivision', subdivision: 'localidad', localidad: null };

// Umbral de casos que usa la base (obs_min_casos); se repite acá solo para los textos de la pantalla
export const MIN_CASOS = 5;

/**
 * Arma los parámetros comunes de las funciones del observatorio.
 * @param {{ nivel: string, zona?: string|null, desde?: string|null, hasta?: string|null, categoria?: string|null }} filtro
 */
export const paramsDeFiltro = ({ nivel, zona = null, desde = null, hasta = null, categoria } = {}) => {
  // Un nivel desconocido es un error de programación: no se manda a la base
  if (!NIVELES.includes(nivel)) throw new Error(`Nivel desconocido: ${nivel}`);
  // El país no lleva zona; los demás niveles sí
  if (nivel !== 'pais' && !zona) throw new Error(`Falta la zona del nivel ${nivel}`);

  const params = { p_nivel: nivel, p_zona: nivel === 'pais' ? null : zona, p_desde: desde, p_hasta: hasta };
  // obs_por_categoria no recibe categoría: solo se agrega cuando se la pasa explícitamente
  if (categoria !== undefined) params.p_categoria = categoria || null;
  return params;
};

// Llama a una función de la base y devuelve sus filas, o lanza el error
const llamar = async (fn, params) => {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw error;
  return data ?? [];
};

// Los numeric de Postgres pueden llegar como texto: se convierten, y null sigue siendo null («—» en pantalla)
const num = (v) => (v === null || v === undefined ? null : Number(v));

/** Plazos por categoría (tabla observatorio_plazos; solo lectura con sesión). */
export const fetchPlazos = async () => {
  const { data, error } = await supabase.from('observatorio_plazos').select('service_code, plazo_dias, fuente').order('service_code');
  if (error) throw error;
  return (data ?? []).map((f) => ({ categoria: f.service_code, plazoDias: f.plazo_dias, fuente: f.fuente }));
};

/** Territorio para los selectores y las migas (sin datos de reportes). */
export const fetchZonas = () => llamar('obs_zonas');

/**
 * Resumen de una zona: reportes, resueltos, % resueltos, mediana y p90 de días, cumplimiento de plazo y abiertos.
 * @returns {Promise<object>} una sola fila; con la zona vacía, todo en 0 y los porcentajes en null
 */
export const fetchResumen = async (filtro) => {
  const [fila] = await llamar('obs_resumen', paramsDeFiltro({ categoria: null, ...filtro }));
  const f = fila ?? {};
  return {
    reportes: f.reportes ?? 0,
    resueltos: f.resueltos ?? 0,
    pctResueltos: num(f.pct_resueltos),
    medianaDias: num(f.mediana_dias),
    p90Dias: num(f.p90_dias),
    elegiblesPlazo: f.elegibles_plazo ?? 0,
    enPlazo: f.en_plazo ?? 0,
    pctEnPlazo: num(f.pct_en_plazo),
    abiertos: f.abiertos ?? 0,
  };
};

/**
 * Reportes por mes de creación. Cada mes trae su total (categoria null) y una fila por categoría.
 * @returns {Promise<Array<{ mes: string, categoria: string|null, reportes: number, resueltos: number, pctResueltos: number|null }>>}
 */
export const fetchPorMes = async (filtro) =>
  (await llamar('obs_por_mes', paramsDeFiltro({ categoria: null, ...filtro }))).map((f) => ({
    mes: f.mes,
    categoria: f.service_code ?? null,
    reportes: f.reportes,
    resueltos: f.resueltos,
    pctResueltos: num(f.pct_resueltos),
  }));

/** Reportes por categoría (siempre las cuatro, aunque tengan 0). */
export const fetchPorCategoria = async (filtro) => {
  // La torta no se filtra por categoría: se descarta la que venga en el filtro
  const { categoria: _ignorada, ...resto } = filtro ?? {};
  return (await llamar('obs_por_categoria', paramsDeFiltro(resto))).map((f) => ({
    categoria: f.service_code,
    nombre: f.service_name,
    reportes: f.reportes,
    resueltos: f.resueltos,
    pctResueltos: num(f.pct_resueltos),
    medianaDias: num(f.mediana_dias),
    plazoDias: f.plazo_dias,
  }));
};

/**
 * Zonas del nivel de abajo con sus cifras, en orden alfabético (nunca un ranking).
 * En el último nivel (localidad) no hay hijos: devuelve [] sin consultar.
 */
export const fetchHijos = async (filtro) => {
  if (!NIVEL_HIJO[filtro?.nivel]) return [];
  return (await llamar('obs_hijos', paramsDeFiltro({ categoria: null, ...filtro }))).map((f) => ({
    zona: f.zona_id,
    nivel: f.nivel,
    nombre: f.nombre,
    reportes: f.reportes,
    resueltos: f.resueltos,
    pctResueltos: num(f.pct_resueltos),
    medianaDias: num(f.mediana_dias),
    abiertos: f.abiertos,
  }));
};
