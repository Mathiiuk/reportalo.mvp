/**
 * @file gemini.ts
 * @description Llamada multimodal a Gemini (imagen + salida JSON estructurada) de analizar-imagen-reporte.
 * `fetch` se inyecta para poder probarla con Vitest sin red.
 *
 * Configuración validada en REP-3816: thinkingLevel 'low', responseSchema obligatorio, sin temperature
 * explícita. La clave va en el header x-goog-api-key y nunca en la URL: los errores de red de Deno incluyen
 * la URL en el mensaje, y ese mensaje puede terminar guardado o devuelto.
 */

import { OUTPUT_SCHEMA } from './contract.ts';

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
/** Tiempo máximo por llamada (REP-3816: máx. observada 4,4 s, p95 3,3 s). */
export const GEMINI_TIMEOUT_MS = 20_000;
const MAX_OUTPUT_TOKENS = 1024;

export type GeminiResult = {
  ok: boolean;
  status: number;
  data: any;
  latencyMs: number;
  errorText: string | null;
};

export type FetchFn = (input: string, init?: Record<string, unknown>) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

export const callGeminiVision = async ({
  fetchFn,
  apiKey,
  model,
  imageBase64,
  mimeType,
  prompt,
  timeoutMs = GEMINI_TIMEOUT_MS,
}: {
  fetchFn: FetchFn;
  apiKey: string;
  model: string;
  imageBase64: string;
  mimeType: string;
  prompt: string;
  timeoutMs?: number;
}): Promise<GeminiResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetchFn(`${GEMINI_API_BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: OUTPUT_SCHEMA,
          thinkingConfig: { thinkingLevel: 'low' },
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      }),
    });
    const text = await response.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* el llamador lo trata como respuesta inválida */
    }
    return {
      ok: response.ok,
      status: response.status,
      data,
      latencyMs: Date.now() - started,
      errorText: response.ok ? null : text.slice(0, 300),
    };
  } finally {
    clearTimeout(timer);
  }
};
