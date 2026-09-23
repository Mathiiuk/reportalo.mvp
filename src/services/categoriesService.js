import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

/**
 * Categorías del catálogo real de `public.services`, usadas como respaldo cuando
 * no hay conexión con Supabase.
 *
 * Los códigos y nombres son los de producción (proyecto CiudadAR), verificados
 * contra la base el 22/09/2026, y coinciden con `supabase/seed.sql`.
 *
 * Antes este array decía 'infraestructura_vial' / «Infraestructura vial»,
 * 'infraccion_transito' / «Infracción de tránsito» y 'medio_ambiente' /
 * «Medio ambiente», que no existen en la base. Como con conexión las categorías
 * salen de `services`, el ciudadano veía unos nombres online y otros distintos
 * sin conexión (observación H-03 del handoff del UJ v3.3, confirmada contra la
 * base: el UJ tenía razón).
 *
 * Son CINCO: «Comercio irregular» y «Vulnerabilidad social» conviven en
 * producción (H-04). Si se decide no mostrarle «Vulnerabilidad social» al
 * ciudadano, hay que filtrarla también en la lista que llega de `services`, no
 * solo acá, porque con conexión hoy ya se muestra.
 *
 * Ojo: estas entradas no tienen `dbId`, porque el id lo asigna la base. Un
 * reporte creado por este camino va sin `service_id`.
 */
export const DEFAULT_REPORT_CATEGORIES = [
  {
    id: 'INFRAESTRUCTURA',
    name: 'Infraestructura',
    icon: 'construction',
    color: '#1E6FCB',
    bgLight: '#EEF5FC',
    borderColor: '#CFE4FA',
    example: 'Ej.: baches, veredas rotas, calzada hundida o falta de cordón cuneta.',
  },
  {
    id: 'TRANSITO',
    name: 'Tránsito',
    icon: 'local_shipping',
    color: '#F78E35',
    bgLight: '#FFF6E9',
    borderColor: '#FCE2B6',
    example: 'Ej.: estacionamiento indebido, bloqueo de rampa, camiones fuera de horario.',
  },
  {
    id: 'AMBIENTE',
    name: 'Ambiente',
    icon: 'eco',
    color: '#2E9E6B',
    bgLight: '#E3F5EC',
    borderColor: '#C3EBD7',
    example: 'Ej.: microbasurales, podas clandestinas, efluentes o contaminación acústica.',
  },
  {
    id: 'COMERCIO_IRREGULAR',
    name: 'Comercio irregular',
    icon: 'storefront',
    color: '#7C5CD6',
    bgLight: '#F4F0FD',
    borderColor: '#DED4F5',
    example: 'Ej.: venta ambulante en la vereda, feria sin habilitación, ocupación del espacio público.',
  },
  {
    id: 'VULNERABILIDAD_SOCIAL',
    name: 'Vulnerabilidad social',
    icon: 'heart_handshake',
    color: '#D6336C',
    bgLight: '#FDEFF3',
    borderColor: '#F5C9D8',
    example: 'Ej.: persona en situación de calle, familia en riesgo, necesidad de asistencia social urgente.',
  },
];

/**
 * Estilo (ícono/color) por categoría, buscado por coincidencia parcial contra el
 * `service_code`/id normalizado. El match por substring tolera que un entorno viejo
 * todavia tenga los codigos anteriores en minuscula ("infraestructura_vial" vs
 * "INFRAESTRUCTURA"), sin tener que sincronizar el codigo exacto con cada seed.
 * Las cinco entradas salen de DEFAULT_REPORT_CATEGORIES, que ahora refleja 1:1 el
 * catalogo real y supabase/seed.sql (ver SupabaseSeedValidation.test.js).
 */
const CATEGORY_STYLE_BY_KEY = {
  infraestructura: DEFAULT_REPORT_CATEGORIES[0],
  transito: DEFAULT_REPORT_CATEGORIES[1],
  ambiente: DEFAULT_REPORT_CATEGORIES[2],
  comercioirregular: DEFAULT_REPORT_CATEGORIES[3],
  vulnerabilidadsocial: DEFAULT_REPORT_CATEGORIES[4],
};

const normalizeForMatch = (text) => (text ?? '').toLowerCase().replace(/[^a-z]/g, '');

const resolveCategoryStyle = (...candidates) => {
  for (const candidate of candidates) {
    const normalized = normalizeForMatch(candidate);
    if (!normalized) continue;
    const key = Object.keys(CATEGORY_STYLE_BY_KEY).find((k) => normalized.includes(k));
    if (key) return CATEGORY_STYLE_BY_KEY[key];
  }
  return null;
};

/**
 * Obtiene las categorías de reportes desde la tabla `services` de Supabase
 * con fallback instantáneo a las categorías locales del Journey v2.
 * @returns {Promise<Array>} Lista de categorías
 */
export const getReportCategories = async () => {
  if (!isSupabaseConfigured) {
    return DEFAULT_REPORT_CATEGORIES;
  }

  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) {
      return DEFAULT_REPORT_CATEGORIES;
    }

    return data.map((srv) => {
      const fallback = resolveCategoryStyle(srv.service_code, srv.id, srv.service_name || srv.name);

      return {
        id: srv.service_code || srv.id,
        dbId: srv.id,
        name: srv.service_name || srv.name || fallback?.name || '',
        icon: fallback?.icon || 'category',
        color: fallback?.color || '#1E6FCB',
        bgLight: fallback?.bgLight || '#EEF5FC',
        borderColor: fallback?.borderColor || '#CFE4FA',
        example: srv.description || fallback?.example || '',
      };
    });
  } catch (err) {
    console.warn('[categoriesService] Fallback a categorías locales:', err);
    return DEFAULT_REPORT_CATEGORIES;
  }
};

/**
 * REP-2204 · Id de la categoría en la tabla `services`.
 *
 * Las categorías de respaldo (sin conexión, o si la consulta a `services` falló) no traen
 * `dbId`, y un reporte enviado con ellas iba con `service_id = null`: sin categoría, sin que
 * nadie se enterara. Al enviar se resuelve el id por `service_code`; si no se puede, se
 * devuelve null y quien llama decide no enviar en vez de guardar el reporte sin categoría.
 *
 * @param {{ id?: string, dbId?: string } | null} category
 * @returns {Promise<string|null>}
 */
export const resolveServiceDbId = async (category) => {
  if (!category) return null;
  if (category.dbId) return category.dbId;
  if (!category.id || !isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('services')
      .select('id')
      .eq('service_code', category.id)
      .maybeSingle();
    if (error || !data?.id) return null;
    return data.id;
  } catch {
    return null;
  }
};
