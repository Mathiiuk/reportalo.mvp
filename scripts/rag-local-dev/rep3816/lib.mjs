// REP-3816 · Llamada multimodal con modelo y thinking configurables. La clave se lee del .env y nunca se imprime.
import fs from 'node:fs';

const envText = fs.readFileSync(new URL('../../../.env', import.meta.url), 'utf-8');
const apiKey = envText.match(/^GEMINI_API_KEY=(.*)$/m)?.[1]?.trim();
if (!apiKey) throw new Error('GEMINI_API_KEY no encontrada en .env');

const dir = new URL('./', import.meta.url);
export const readJson = (p) => JSON.parse(fs.readFileSync(new URL(p, dir), 'utf-8'));
export const fileUrl = (p) => new URL(p, dir);

const API = 'https://generativelanguage.googleapis.com/v1beta';

// Reintenta solo errores transitorios (429/500/503), igual que el resto de los arneses
const withRetry = async (fn) => {
  const backoffs = [2000, 5000, 10000];
  for (let attempt = 1; ; attempt += 1) {
    const started = performance.now();
    const res = await fn();
    const latencyMs = performance.now() - started;
    if (res.ok || attempt > backoffs.length || ![429, 500, 503].includes(res.status)) return { res, latencyMs, attempts: attempt };
    await new Promise((r) => setTimeout(r, backoffs[attempt - 1]));
  }
};

export const callMultimodal = async ({ model, thinkingConfig, imageBase64, mimeType, prompt, responseSchema, maxOutputTokens = 1024 }) => {
  const { res, latencyMs, attempts } = await withRetry(() =>
    fetch(`${API}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
          thinkingConfig,
          maxOutputTokens,
        },
      }),
    })
  );
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* se informa como error */ }
  return { ok: res.ok, status: res.status, latencyMs, attempts, data, errorText: res.ok ? null : text.slice(0, 400) };
};
