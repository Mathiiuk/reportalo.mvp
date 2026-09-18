/**
 * @file localitiesService.js
 * @description Localidades seleccionables para el selector manual de REP-2500
 * (Opción 1, aprobada por el PO — ver REP-2908-VERIF_ronda2_hernan.md §4).
 *
 * R-2: la lista se limita a la zona piloto (barrios de CABA + localidades del
 * partido de Avellaneda, Buenos Aires). Santa Fe no aparece, a propósito:
 * `localities` tiene una "Avellaneda" real en Santa Fe, cargada solo para
 * probar que el sistema nunca resuelve una localidad por nombre — no es una
 * zona de operación.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

/**
 * R-1: formato de cada opción — "Localidad — Partido/Comuna, Provincia".
 * Distingue localidades homónimas (ej. las dos "Avellaneda" del esquema).
 */
export const formatLocalityLabel = ({ localityName, subdivisionName, provinceName }) =>
  `${localityName} — ${subdivisionName}, ${provinceName}`;

/**
 * Trae las localidades de la zona piloto, ya con el label armado (R-1) y
 * una clave sin tildes para búsqueda (R-5).
 * @returns {Promise<{ success: boolean, localities: Array<{id: string, label: string, searchKey: string}>, error?: string }>}
 */
export const getSelectableLocalities = async () => {
  if (!isSupabaseConfigured) {
    return { success: false, localities: [], error: 'Supabase no está configurado.' };
  }

  // Trae las 57 filas con su jerarquía embebida y filtra en JS (R-2): un
  // filtro `.or()` de PostgREST cruzando dos niveles de tabla embebida
  // (subdivisions -> states_provinces) es frágil, y el dataset es chico.
  try {
    const { data, error } = await supabase
      .from('localities')
      .select('id, name, subdivisions!inner(name, states_provinces!inner(name))');

    if (error) throw error;

    const rows = (data ?? [])
      .map((row) => {
        const subdivisionName = row.subdivisions?.name;
        const provinceName = row.subdivisions?.states_provinces?.name;
        if (!subdivisionName || !provinceName) return null;
        // R-2: solo CABA completa, y dentro de Buenos Aires solo el partido de Avellaneda.
        const isCaba = provinceName === 'Ciudad Autónoma de Buenos Aires';
        const isAvellanedaBA = provinceName === 'Buenos Aires' && subdivisionName === 'Avellaneda';
        if (!isCaba && !isAvellanedaBA) return null;

        const label = formatLocalityLabel({
          localityName: row.name,
          subdivisionName,
          provinceName,
        });
        return {
          id: row.id,
          label,
          searchKey: normalizeForSearch(label),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));

    // Guardar en localStorage como fallback infalible para modo Offline
    localStorage.setItem('reportalo_localities_cache', JSON.stringify(rows));

    return { success: true, localities: rows };
  } catch (error) {
    console.warn('[Offline Fallback] Falló Supabase, intentando usar caché local...', error);
    const cached = localStorage.getItem('reportalo_localities_cache');
    if (cached) {
      return { success: true, localities: JSON.parse(cached) };
    }
    return { success: false, localities: [], error: error.message || 'Error de red sin caché disponible.' };
  }
};

/**
 * R-5: normaliza para buscar sin distinguir tildes/mayúsculas.
 * "pineyro" tiene que encontrar "Piñeyro".
 */
export const normalizeForSearch = (text) =>
  (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
