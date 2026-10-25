import { supabase } from '../lib/supabaseClient';

/**
 * REP-3000 · Bandeja del organismo de prueba.
 *
 * La base decide qué reportes entran (get_panel_inbox filtra con profile_attends_report: jurisdicción, borrador
 * generado y estado del circuito del panel). La respuesta no trae descripción, identidad ni fotos.
 *
 * @returns {Promise<{ success: boolean, reports: Array<object>, error?: string }>}
 */
export const getPanelInbox = async () => {
  const { data, error } = await supabase.rpc('get_panel_inbox');
  if (error) return { success: false, reports: [], error: error.message };
  return { success: true, reports: data ?? [] };
};
