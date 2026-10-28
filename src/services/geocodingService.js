import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

/**
 * REP-3843 · Dirección aproximada sugerida a partir del punto del reporte.
 *
 * La pide al proxy geocodificar-direccion (Nominatim / OpenStreetMap). Es una ayuda, no un requisito: sin conexión,
 * con error o si tarda, devuelve null y el vecino sigue (puede escribir la calle o dejarla vacía). Nunca bloquea el
 * envío.
 */

export const ADDRESS_UNAVAILABLE = 'Dirección no disponible';
export const OSM_ATTRIBUTION = 'Dirección sugerida con datos de © OpenStreetMap contributors';

const SUGGEST_TIMEOUT_MS = 4000;

/**
 * Tipo de vía con el vocabulario de route_report (R-4). Misma regla que supabase/functions/geocodificar-direccion/
 * geocode.ts (la función corre en Deno, aparte): se recalcula acá cuando el vecino corrige la calle.
 * @param {string|null|undefined} street
 * @returns {'avenida'|'secundaria'|null}
 */
export const classifyRoadType = (street) => {
  const nombre = (street ?? '').trim();
  if (!nombre) return null;
  return /^(avenida|avda\.?|av\.?)(\s|$)/i.test(nombre) ? 'avenida' : 'secundaria';
};

/**
 * @param {{ lat: number, lng: number }} coords
 * @returns {Promise<{ street: string, number: string|null, roadType: 'avenida'|'secundaria'|null } | null>}
 */
export const suggestAddress = async ({ lat, lng }) => {
  if (!isSupabaseConfigured || typeof navigator !== 'undefined' && navigator.onLine === false) return null;

  let pedido;
  try {
    pedido = supabase.functions
      .invoke('geocodificar-direccion', { body: { lat, lng } })
      .then(({ data, error }) => (error ? null : data?.address ?? null))
      .catch(() => null);
  } catch {
    // Cliente sin Edge Functions disponibles: se sigue sin dirección
    return null;
  }
  const limite = new Promise((resolve) => setTimeout(() => resolve(null), SUGGEST_TIMEOUT_MS));

  return Promise.race([pedido, limite]);
};

/**
 * Dirección para mostrar. Con `withNumber: false` (terceros, REP-3876 §8) nunca se muestra la altura.
 * @param {{ street?: string|null, number?: string|null } | null} address
 */
export const formatAddress = (address, { withNumber = true } = {}) => {
  const street = address?.street?.trim();
  if (!street) return ADDRESS_UNAVAILABLE;
  const number = withNumber ? address?.number?.trim() : '';
  return number ? `${street} ${number}` : street;
};
