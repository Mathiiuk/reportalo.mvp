import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

/**
 * Categorías oficiales según User Journey v2.
 * Utilizadas como fallback en caso de operar offline o sin conexión a Supabase.
 */
export const DEFAULT_REPORT_CATEGORIES = [
  {
    id: 'infraestructura_vial',
    name: 'Infraestructura vial',
    icon: 'construction',
    color: '#1E6FCB',
    bgLight: '#EEF5FC',
    borderColor: '#CFE4FA',
    example: 'Ej.: baches, veredas rotas, calzada hundida o falta de cordón cuneta.',
  },
  {
    id: 'infraccion_transito',
    name: 'Infracción de tránsito',
    icon: 'local_shipping',
    color: '#F78E35',
    bgLight: '#FFF6E9',
    borderColor: '#FCE2B6',
    example: 'Ej.: estacionamiento indebido, bloqueo de rampa, camiones fuera de horario.',
  },
  {
    id: 'medio_ambiente',
    name: 'Medio ambiente',
    icon: 'eco',
    color: '#2E9E6B',
    bgLight: '#E3F5EC',
    borderColor: '#C3EBD7',
    example: 'Ej.: microbasurales, podas clandestinas, efluentes o contaminación acústica.',
  },
  {
    id: 'comercio_irregular',
    name: 'Comercio irregular',
    icon: 'storefront',
    color: '#7C5CD6',
    bgLight: '#F4F0FD',
    borderColor: '#DED4F5',
    example: 'Ej.: venta ambulante en la vereda, feria sin habilitación, ocupación del espacio público.',
  },
];

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
      const fallback = DEFAULT_REPORT_CATEGORIES.find(
        (c) => c.id === srv.service_code || c.id === srv.id
      );

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
