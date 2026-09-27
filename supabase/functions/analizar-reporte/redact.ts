/**
 * @file redact.ts
 * @description Segunda defensa para que la clave de Gemini nunca termine en
 * report_ai_analysis.status_reason ni en la respuesta JSON de analizar-reporte.
 *
 * La primera defensa es no poner la clave en la URL (va en x-goog-api-key):
 * los errores de red de Deno (DNS, TLS, conexión cortada) incluyen la URL
 * completa en el mensaje. Esto cubre el caso de que alguna URL con ?key= se
 * cuele igual en el futuro. Archivo aparte (y no dentro de index.ts) para
 * poder probarlo con Vitest desde src/test/: index.ts arranca Deno.serve al
 * importarse.
 */

// Valor de un parámetro key= en una URL (?key=... o &key=...), hasta el próximo separador
const KEY_QUERY_PARAM = /([?&]key=)[^&\s)"']+/gi;
// Formato de las claves de API de Google (Gemini, Vision): "AIza" + 35 caracteres
const GOOGLE_API_KEY = /AIza[0-9A-Za-z_-]{35}/g;

/** Reemplaza por *** cualquier clave de API visible en un mensaje de error. */
export const redactApiKeys = (message: string): string =>
  message.replace(KEY_QUERY_PARAM, '$1***').replace(GOOGLE_API_KEY, '***');
