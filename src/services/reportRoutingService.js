/**
 * @file reportRoutingService.js
 * @description Destino del reporte recién enviado (REP-3845).
 *
 * El organismo receptor lo resuelve el backend (`route_report`, REP-2800/2801) con el catálogo aprobado REP-2806:
 * jurisdicción efectiva por locality_id, prestación, reglas R-1 a R-5 y canal verificado. Antes la pantalla
 * «Reporte enviado» decidía el organismo en el navegador por el nombre de la localidad («avellaneda» → Municipio
 * de Avellaneda, si no → Gobierno de la Ciudad) y nunca llamaba a route_report, así que no quedaba traza en
 * report_routing. Este módulo es el único punto del frontend que pide el destino: nunca lo inventa.
 *
 * route_report es idempotente: con la misma entrada y el mismo catálogo devuelve lo ya registrado.
 * Solo el autor, quien atiende el reporte o el servidor pueden pedirlo (para cualquier otro devuelve null).
 * Calcula el destino y lo registra: no envía nada a ningún organismo (modo borrador, REP-2801).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

/**
 * Pide (y registra) el routing del reporte. Nunca lanza.
 * @param {string} reportId UUID de citizen_reports.id
 * @returns {Promise<{ success: boolean, routing: object|null, error?: string }>}
 */
export const routeReport = async (reportId) => {
  if (!isSupabaseConfigured || !reportId) {
    return { success: false, routing: null, error: 'Falta el reporte o Supabase no está configurado.' };
  }
  try {
    const { data, error } = await supabase.rpc('route_report', { p_report_id: reportId });
    if (error) return { success: false, routing: null, error: error.message };
    return { success: true, routing: data ?? null };
  } catch (err) {
    return { success: false, routing: null, error: err?.message || 'No se pudo consultar el destino.' };
  }
};

/**
 * Traduce el resultado de route_report a lo que muestra «Reporte enviado».
 *
 * - `verificado`: hay organismo y canal según el catálogo aprobado.
 * - `sin_destino`: no se identificó la prestación (o no tiene canal aprobado): se muestra el organismo y el canal
 *   GENERALES de la jurisdicción, con la salvedad visible de que no es un receptor confirmado (E2).
 * - `no_resuelto`: hay más de un organismo posible y ninguna regla desempata: no se elige ninguno.
 * - `fuera_del_piloto`: la jurisdicción no es CABA ni Avellaneda: no se presenta ningún organismo (E3).
 * - `no_disponible`: no hubo respuesta: no se muestra ningún organismo supuesto.
 *
 * @param {object|null} routing Resultado de route_report
 * @returns {{ kind: string, organismo?: string|null, organismoPadre?: string|null, canal?: string|null, motivo?: string|null }}
 */
export const describeRoutingDestination = (routing) => {
  if (!routing || typeof routing !== 'object') return { kind: 'no_disponible' };
  if (routing.jurisdiccion === 'FUERA_DEL_PILOTO') {
    return { kind: 'fuera_del_piloto', motivo: routing.motivo ?? null };
  }

  const organismo = routing.organismo_verificado?.nombre ?? null;
  const organismoPadre = routing.organismo_verificado?.organismo_padre ?? null;
  const canal = routing.canal_verificado?.etiqueta || routing.canal_verificado?.valor || null;

  if (routing.criterio === 'no_resuelto') {
    return { kind: 'no_resuelto', motivo: routing.motivo ?? null };
  }
  // Sin destino verificado: el organismo general puede faltar si la jurisdicción no tiene canal general aprobado
  if (routing.sin_destino_verificado) {
    return { kind: 'sin_destino', organismo, organismoPadre, canal, motivo: routing.motivo ?? null };
  }
  if (!organismo) return { kind: 'no_disponible' };
  return { kind: 'verificado', organismo, organismoPadre, canal };
};
