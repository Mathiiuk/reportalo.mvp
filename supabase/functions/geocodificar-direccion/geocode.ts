/**
 * @file geocode.ts
 * @description REP-3843 · Lógica pura del proxy geocodificar-direccion (probada con Vitest, sin Deno ni red).
 *
 * Convierte la respuesta de Nominatim (reverse, jsonv2) en { street, number, roadType }. Nunca inventa: si no viene
 * la calle, devuelve null; si la altura no es un número de puerta, queda vacía.
 */

export type RoadType = 'avenida' | 'secundaria';

export interface SuggestedAddress {
  street: string;
  number: string | null;
  roadType: RoadType | null;
}

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

/** Tipo de vía con el vocabulario de route_report (R-4): «Avenida», «Av.» o «Av» al inicio → avenida. */
export const classifyRoadType = (street: string | null | undefined): RoadType | null => {
  const nombre = (street ?? '').trim();
  if (!nombre) return null;
  return /^(avenida|avda\.?|av\.?)(\s|$)/i.test(nombre) ? 'avenida' : 'secundaria';
};

/** Coordenadas numéricas dentro de una caja que cubre Argentina continental. */
export const isValidCoordinate = (lat: unknown, lng: unknown): boolean =>
  typeof lat === 'number' &&
  typeof lng === 'number' &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -56 && lat <= -21 &&
  lng >= -74 && lng <= -53;

/** URL de la consulta inversa: detalle de dirección, nivel de edificio y nombres en español. */
export const buildReverseUrl = (lat: number, lng: number): string => {
  const url = new URL(NOMINATIM_REVERSE);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'es');
  return url.toString();
};

/** Respuesta de Nominatim → dirección sugerida, o null si no hay calle. */
export const parseNominatimReverse = (data: unknown): SuggestedAddress | null => {
  if (!data || typeof data !== 'object') return null;
  const address = (data as { address?: Record<string, unknown> }).address;
  const street = typeof address?.road === 'string' ? address.road.trim() : '';
  if (!street) return null;

  // Solo un número de puerta (con letra opcional, como 745B); rangos o «s/n» no se toman
  const rawNumber = typeof address?.house_number === 'string' ? address.house_number.trim() : '';
  const number = /^\d{1,5}[A-Za-z]?$/.test(rawNumber) ? rawNumber : null;

  return { street, number, roadType: classifyRoadType(street) };
};
