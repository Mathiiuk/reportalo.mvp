/**
 * @file index.ts
 * @description Supabase Edge Function: dirección aproximada a partir de un punto (REP-3843).
 * Runtime: Deno / TypeScript en Supabase Edge Functions.
 *
 * Proxy a Nominatim (OpenStreetMap) para sugerir calle y altura cuando el vecino confirma el punto del reporte.
 * Se usa un proxy y no el navegador porque la política de uso de Nominatim pide identificarse con un User-Agent
 * propio y poder cambiar de proveedor sin actualizar la app, y porque así al proveedor solo le llegan las
 * coordenadas: ni la IP ni la identidad del vecino. Toda la lógica está en geocode.ts (probada con Vitest).
 *
 * Se despliega con verify_jwt = true: solo usuarios con sesión. Cuerpo { lat, lng } → { address } (o null).
 * Nunca falla hacia el vecino: ante cualquier problema responde { address: null } y la app sigue sin dirección.
 */
import { buildReverseUrl, isValidCoordinate, parseNominatimReverse } from './geocode.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Política de Nominatim: identificar la aplicación (los User-Agent por defecto de las librerías no sirven)
const USER_AGENT = 'Reportalo-MVP/1.0 (https://reportalo.com.ar; info@reportalo.com.ar)';
const TIMEOUT_MS = 3500;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  let payload: { lat?: unknown; lng?: unknown } | null = null;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'El cuerpo del pedido no es un JSON válido.' }, 400);
  }

  const lat = payload?.lat;
  const lng = payload?.lng;
  if (!isValidCoordinate(lat, lng)) return json({ error: 'Coordenadas inválidas.' }, 400);

  try {
    const response = await fetch(buildReverseUrl(lat as number, lng as number), {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return json({ address: null, reason: `proveedor_${response.status}` });
    return json({ address: parseNominatimReverse(await response.json()) });
  } catch {
    // Timeout o red: la dirección es opcional, el reporte sigue
    return json({ address: null, reason: 'proveedor_no_disponible' });
  }
});
