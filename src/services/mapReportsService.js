/**
 * @file mapReportsService.js
 * @description Reportes reales para el mapa de inicio (M08 / D09).
 *
 * Hasta ahora `CitizenMap` leía `src/data/mockReports.js`: la pantalla principal de la
 * app mostraba cinco reportes inventados, con categorías que no existen en la base
 * («Alumbrado público», «Higiene urbana», «Espacios verdes»), y «Ver el reporte»
 * navegaba a un detalle que devolvía «No encontramos este reporte» (observación H-36
 * del handoff del UJ v3.3).
 *
 * La consulta es pública a propósito: `citizen_reports` tiene la policy
 * `lectura_publica`, justamente porque el mapa muestra los reclamos de todo el barrio,
 * no solo los propios. Por eso acá NO se trae nada sensible: ni `user_id`, ni el
 * análisis jurídico, ni las fotos. El detalle, que sí es privado, valida pertenencia
 * por su cuenta.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { getStatusConfig } from '../components/report/reportStatus';
import { getCategoryTone } from '../components/report/categoryTone';

/**
 * Tope defensivo de marcadores POR CONSULTA. Dibujar más satura el mapa y no aporta lectura. REP-3805: ya no es un
 * tope global de «los últimos 200 de todo el mapa» (que ocultaba en silencio los más viejos al crecer el volumen):
 * aplica a la zona visible, y si esa zona lo alcanza se le avisa al ciudadano que acerque el mapa.
 */
export const MAP_REPORTS_LIMIT = 200;

/** Cuánto se agranda, por cada lado, la zona que se pide respecto de la visible (para no reconsultar por cada paneo corto). */
export const MAP_VIEWPORT_PADDING = 0.2;

/** @typedef {{ west: number, south: number, east: number, north: number }} MapBounds */

/** Agranda una zona un porcentaje de su tamaño por cada lado. */
export const padBounds = (bounds, ratio = MAP_VIEWPORT_PADDING) => {
  const dLng = (bounds.east - bounds.west) * ratio;
  const dLat = (bounds.north - bounds.south) * ratio;
  return { west: bounds.west - dLng, east: bounds.east + dLng, south: bounds.south - dLat, north: bounds.north + dLat };
};

/** ¿La zona `outer` contiene por completo a `inner`? */
export const boundsContain = (outer, inner) =>
  inner.west >= outer.west && inner.east <= outer.east && inner.south >= outer.south && inner.north <= outer.north;

export const boundsArea = (bounds) => Math.max(0, bounds.east - bounds.west) * Math.max(0, bounds.north - bounds.south);

/** Si la zona visible se achicó por debajo de esta fracción de lo ya cargado, vale la pena reconsultar una zona que se truncó. */
const ZOOM_IN_REFETCH_RATIO = 0.8;

/**
 * ¿Hace falta consultar de nuevo al cambiar la zona visible?
 *  - Sin consulta previa, o si la zona visible se salió de lo cargado: sí.
 *  - Si lo cargado se había truncado (llegó al tope) y la zona visible ahora es bastante menor (se acercó el mapa): sí,
 *    para traer los reportes que habían quedado afuera.
 *  - En cualquier otro caso lo que ya se tiene alcanza.
 * @param {{ bounds: MapBounds, viewport?: MapBounds, truncated: boolean } | null} previous Última consulta: zona pedida (con
 *   margen), zona visible que la originó y si se truncó
 * @param {MapBounds} viewport Zona visible ahora
 */
export const shouldRefetchViewport = (previous, viewport) => {
  if (!previous) return true;
  if (!boundsContain(previous.bounds, viewport)) return true;
  // Se compara con la zona VISIBLE de la consulta anterior, no con la pedida (que lleva margen): si no, el mismo viewport
  // parecería «más chico» y reconsultaría sin que nadie haya acercado nada.
  const previousVisibleArea = boundsArea(previous.viewport ?? previous.bounds);
  return Boolean(previous.truncated) && boundsArea(viewport) < previousVisibleArea * ZOOM_IN_REFETCH_RATIO;
};

/**
 * Ícono del marcador por categoría. Las claves son las de MARKER_ICON_MAP en CitizenMap.
 * Se resuelve por coincidencia parcial sobre el nombre normalizado, igual que los tonos,
 * para tolerar variantes del catálogo entre entornos.
 */
const ICON_BY_CATEGORY = [
  ['infraestructura', 'traffic'],
  ['transito', 'car_crash'],
  ['ambiente', 'park'],
  ['comercioirregular', 'store'],
  ['vulnerabilidadsocial', 'assist'],
];

// «Vulnerabilidad social» no es una de las cuatro categorías con token propio, así que
// getCategoryTone cae al color que se le pase. Es el mismo rosa de categoriesService.
const FALLBACK_COLOR_BY_CATEGORY = {
  vulnerabilidadsocial: '#D6336C',
};

const normalize = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

/**
 * Convierte una coordenada a número sin disimular los vacíos.
 *
 * `Number(null)` y `Number('')` dan 0, que es un valor finito y perfectamente
 * válido para MapLibre: un reporte sin coordenadas terminaría dibujado en el
 * golfo de Guinea en lugar de descartarse. Acá los vacíos se vuelven NaN, que es
 * lo que el filtro sabe rechazar.
 */
const toCoordinate = (value) => {
  if (value === null || value === undefined || value === '') return NaN;
  return Number(value);
};

const resolveIcon = (categoryName) => {
  const key = normalize(categoryName);
  const match = ICON_BY_CATEGORY.find(([needle]) => key.includes(needle));
  return match ? match[1] : 'pin';
};

/** «24 Ago 2026», el mismo formato que usa Mis reportes. */
const formatDate = (isoDate) => {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date
    .toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace('.', '')
    .replace(/^\w/, (c) => c.toUpperCase());
};

/**
 * Título de la tarjeta. La base no guarda un título aparte: el ciudadano escribe una
 * sola descripción. Se usa su primera oración, recortada, y el texto completo queda
 * como descripción.
 */
const buildTitle = (description) => {
  const text = String(description ?? '').trim();
  if (!text) return 'Reporte sin descripción';
  const firstSentence = text.split(/(?<=[.!?])\s/)[0] || text;
  const title = firstSentence.length > 70 ? `${firstSentence.slice(0, 67).trimEnd()}…` : firstSentence;
  return title.replace(/\.$/, '');
};

/**
 * Adapta una fila de `citizen_reports` a la forma que dibuja el mapa.
 * @param {object} row Fila con los joins de services y localities
 * @returns {object} Reporte listo para el marcador y la ficha
 */
export const mapRowToMarker = (row) => {
  const categoryName = row.services?.service_name || 'Sin categoría';
  const normalizedCategory = normalize(categoryName);
  const tone = getCategoryTone({
    name: categoryName,
    color: FALLBACK_COLOR_BY_CATEGORY[normalizedCategory],
  });

  return {
    id: row.id,
    title: buildTitle(row.description),
    description: row.description || '',
    category: categoryName,
    categoryIcon: resolveIcon(categoryName),
    // Etiqueta del §10, traducida desde el código real de la base
    status: getStatusConfig(row.current_state_code).label,
    stateCode: row.current_state_code,
    pinColor: tone.base,
    // MapLibre espera [lng, lat], al revés que la intuición
    coordinates: [toCoordinate(row.longitud), toCoordinate(row.latitud)],
    address: row.localities?.name || 'Ubicación sin localidad',
    date: formatDate(row.created_at),
  };
};

/**
 * Trae los reportes georreferenciados para el mapa.
 *
 * Nunca lanza: el mapa tiene que dibujarse igual aunque la consulta falle, porque es la
 * pantalla de inicio. Ante un error devuelve la lista vacía y el motivo.
 *
 * REP-3805: con `bounds` trae solo los reportes de esa zona (por longitud y latitud). Pide un registro más que el límite
 * para saber si la zona lo alcanzó y lo informa en `truncated`: nunca se corta en silencio. Mismas columnas, misma policy
 * (`lectura_publica`) y mismas reglas de visibilidad que antes: no se expone nada nuevo.
 *
 * @param {object} [options]
 * @param {number} [options.limit] Tope de reportes a traer
 * @param {MapBounds} [options.bounds] Zona a consultar; sin ella se consulta todo el mapa (comportamiento anterior)
 * @returns {Promise<{ success: boolean, reports: Array, truncated?: boolean, error?: string }>}
 */
export const getPublicMapReports = async ({ limit = MAP_REPORTS_LIMIT, bounds = null } = {}) => {
  if (!isSupabaseConfigured) {
    return { success: false, reports: [], error: 'Supabase no está configurado.' };
  }

  try {
    let query = supabase
      .from('citizen_reports')
      .select(
        'id, description, latitud, longitud, current_state_code, created_at, services ( service_name ), localities ( name )'
      );
    query = bounds
      ? query
          .gte('longitud', bounds.west)
          .lte('longitud', bounds.east)
          .gte('latitud', bounds.south)
          .lte('latitud', bounds.north)
      : query.not('latitud', 'is', null).not('longitud', 'is', null);
    // Un registro de más: si llega, la zona superó el tope y hay reportes que no se dibujan (se avisa)
    const { data, error } = await query.order('created_at', { ascending: false }).limit(limit + 1);

    if (error) {
      return { success: false, reports: [], error: error.message };
    }

    // Una fila sin coordenadas utilizables no se puede dibujar: se descarta en vez de
    // mandar un NaN a MapLibre, que rompe el mapa entero.
    const rows = data ?? [];
    const truncated = rows.length > limit;
    const reports = rows
      .slice(0, limit)
      .map(mapRowToMarker)
      .filter(({ coordinates }) => Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1]));

    return { success: true, reports, truncated };
  } catch (err) {
    return { success: false, reports: [], error: err?.message || 'Error inesperado al cargar el mapa.' };
  }
};

export default getPublicMapReports;
