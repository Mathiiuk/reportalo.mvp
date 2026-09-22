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

/** Tope de marcadores. Dibujar más satura el mapa y no aporta lectura. */
export const MAP_REPORTS_LIMIT = 200;

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
 * @param {object} [options]
 * @param {number} [options.limit] Tope de reportes a traer
 * @returns {Promise<{ success: boolean, reports: Array, error?: string }>}
 */
export const getPublicMapReports = async ({ limit = MAP_REPORTS_LIMIT } = {}) => {
  if (!isSupabaseConfigured) {
    return { success: false, reports: [], error: 'Supabase no está configurado.' };
  }

  try {
    const { data, error } = await supabase
      .from('citizen_reports')
      .select(
        'id, description, latitud, longitud, current_state_code, created_at, services ( service_name ), localities ( name )'
      )
      .not('latitud', 'is', null)
      .not('longitud', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, reports: [], error: error.message };
    }

    // Una fila sin coordenadas utilizables no se puede dibujar: se descarta en vez de
    // mandar un NaN a MapLibre, que rompe el mapa entero.
    const reports = (data ?? [])
      .map(mapRowToMarker)
      .filter(({ coordinates }) => Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1]));

    return { success: true, reports };
  } catch (err) {
    return { success: false, reports: [], error: err?.message || 'Error inesperado al cargar el mapa.' };
  }
};

export default getPublicMapReports;
