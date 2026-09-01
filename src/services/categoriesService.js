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
 * Obtiene las categorías de reportes desde Supabase (si está configurado)
 * con fallback instantáneo a los datos del Journey v2.
 * @returns {Promise<Array>} Lista de categorías
 */
export const getReportCategories = async () => {
  if (!isSupabaseConfigured) {
    return DEFAULT_REPORT_CATEGORIES;
  }

  try {
    const { data, error } = await supabase
      .from('report_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return DEFAULT_REPORT_CATEGORIES;
    }

    return data.map((cat) => ({
      id: cat.id || cat.code,
      name: cat.name || cat.title,
      icon: cat.icon || 'category',
      color: cat.color || '#1E6FCB',
      bgLight: cat.bg_light || '#EEF5FC',
      borderColor: cat.border_color || '#CFE4FA',
      example: cat.example || cat.description || '',
    }));
  } catch (err) {
    console.warn('[categoriesService] Fallback a categorías locales:', err);
    return DEFAULT_REPORT_CATEGORIES;
  }
};
