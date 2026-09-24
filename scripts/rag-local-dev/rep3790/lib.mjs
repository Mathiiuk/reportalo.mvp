// REP-3790 · Piezas comunes del spike imagen → hechos observables → RAG textual.
//
// La generación reutiliza tal cual el arnés de REP-3786 (mismo prompt, esquema y llamada que
// analizar-reporte). La recuperación se reproduce localmente con la misma regla que
// match_knowledge_fragments: fuentes elegibles por localidad, filtro por categoría, similitud
// coseno contra el vector del contenido de cada fragmento, top-k 6 y umbral 0.45. Que dé lo mismo
// que la base se comprueba con verify-retrieval.mjs antes de correr nada.
//
// La clave se lee del .env y nunca se imprime.
import fs from 'node:fs';
import crypto from 'node:crypto';

import { GENERATION_MODEL } from '../rep3786/gemini-call.mjs';

export { buildPrompt, callGemini, GENERATION_MODEL } from '../rep3786/gemini-call.mjs';

const dir = new URL('./', import.meta.url);
export const readJson = (p) => JSON.parse(fs.readFileSync(new URL(p, dir), 'utf-8'));
export const writeJson = (p, data) => fs.writeFileSync(new URL(p, dir), JSON.stringify(data, null, 2));
export const fileUrl = (p) => new URL(p, dir);
const md5 = (s) => crypto.createHash('md5').update(s, 'utf8').digest('hex');

const envText = fs.readFileSync(new URL('../../../.env', import.meta.url), 'utf-8');
const apiKey = envText.match(/^GEMINI_API_KEY=(.*)$/m)?.[1]?.trim();
if (!apiKey) throw new Error('GEMINI_API_KEY no encontrada en .env');

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const EMBEDDING_MODEL = 'gemini-embedding-2';
export const EMBEDDING_DIMENSIONS = 768;

// Parámetros del baseline de REP-3786 (no se cambian en este spike)
export const MATCH_COUNT = 6;
export const SIMILARITY_THRESHOLD = 0.45;
export const THINKING = { thinkingLevel: 'low' };
export const MAX_OUTPUT_TOKENS = 2048;

const withRetry = async (fn) => {
  const backoffs = [2000, 5000, 10000];
  for (let attempt = 1; ; attempt += 1) {
    const started = performance.now();
    const res = await fn();
    const latencyMs = performance.now() - started;
    if (res.ok || attempt > backoffs.length || ![429, 500, 503].includes(res.status)) {
      return { res, latencyMs, attempts: attempt };
    }
    await new Promise((r) => setTimeout(r, backoffs[attempt - 1]));
  }
};

/** Igual que embedText de analizar-reporte: sin taskType, 768 dimensiones. */
export const embedText = async (text) => {
  const { res, latencyMs, attempts } = await withRetry(() =>
    fetch(`${GEMINI_API_BASE}/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
    })
  );
  if (!res.ok) throw new Error(`embedContent falló (${res.status}): ${await res.text()}`);
  const values = (await res.json())?.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) throw new Error('Vector inválido');
  return { values, latencyMs, attempts };
};

/** Llamada multimodal genérica (extracción de hechos). Devuelve la respuesta cruda. */
export const callGeminiWithImage = async ({ imageBase64, mimeType, prompt, responseSchema, maxOutputTokens }) => {
  const { res, latencyMs, attempts } = await withRetry(() =>
    fetch(`${GEMINI_API_BASE}/models/${GENERATION_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
          thinkingConfig: THINKING,
          maxOutputTokens,
        },
      }),
    })
  );
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* se informa como error */ }
  return { ok: res.ok, status: res.status, latencyMs, attempts, data, errorText: res.ok ? null : text.slice(0, 500) };
};

/** Fragmentos del corpus con su texto, verificado contra el md5 de la base (corpus-db.json). */
export const loadCorpus = () => {
  const db = readJson('corpus-db.json');
  const pool = [];
  const r3786 = (p) => JSON.parse(fs.readFileSync(new URL(`../rep3786/${p}`, dir), 'utf-8'));
  pool.push(...Object.values(r3786('fragments.json')).map((f) => ({ id: f.fragment_id, content: f.content })));
  pool.push(...r3786('raw/extra-fragments.json').map((f) => ({ id: f.fragment_id, content: f.content })));
  for (const list of Object.values(JSON.parse(fs.readFileSync(new URL('../p01-r5-final/retrieved.json', dir), 'utf-8')))) {
    pool.push(...list.map((f) => ({ id: f.fragment_id, content: f.content })));
  }
  const toEmbed = JSON.parse(fs.readFileSync(new URL('../fragments-to-embed.json', dir), 'utf-8'));
  pool.push(...(Array.isArray(toEmbed) ? toEmbed : Object.values(toEmbed)).map((f) => ({ id: f.id, content: f.content })));
  pool.push(...readJson('fragments-extra.json'));

  const fragments = {};
  for (const [id, meta] of Object.entries(db.fragmentos)) {
    const hit = pool.find((p) => p.id === id && md5(p.content) === meta.md5);
    if (!hit) throw new Error(`Sin texto verificado para ${id} (${meta.ruta})`);
    fragments[id] = { fragment_id: id, hierarchy_path: meta.ruta, content: hit.content };
  }
  return { fragments, db };
};

const cosine = (a, b) => {
  let dot = 0; let na = 0; let nb = 0;
  for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

/**
 * Réplica de match_knowledge_fragments + el umbral de analizar-reporte.
 * @returns {{ id: string, similarity: number }[]} ya cortado por top-k y umbral
 */
export const retrieve = ({ queryVector, fragmentVectors, db, locality, category, k = MATCH_COUNT, threshold = SIMILARITY_THRESHOLD }) => {
  const eligible = db.elegibles[`${locality}|${category ?? ''}`];
  if (!eligible) throw new Error(`Sin elegibilidad para ${locality}|${category}`);
  return eligible
    .map((id) => ({ id, similarity: cosine(queryVector, fragmentVectors[id]) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)
    .filter((r) => r.similarity >= threshold);
};

// Réplica de validateLlmAnalysis de la función (igual que en el arnés de REP-3786)
export const validate = (analysis, retrieved) => {
  for (const f of ['estado', 'es_infraccion', 'fundamento_ciudadano', 'fundamento_oficial', 'confianza', 'citas']) {
    if (analysis[f] === undefined) return { valid: false, reason: `Falta el campo obligatorio "${f}".` };
  }
  if (!Array.isArray(analysis.citas)) return { valid: false, reason: 'citas debe ser un array.' };
  const byId = new Map(retrieved.map((f) => [f.fragment_id, f]));
  for (const c of analysis.citas) {
    if (!c?.fragment_id || !c?.cita_textual) return { valid: false, reason: 'Cada cita debe tener fragment_id y cita_textual.' };
    const frag = byId.get(c.fragment_id);
    if (!frag) return { valid: false, reason: `fragment_id "${c.fragment_id}" no está entre los recuperados.` };
    if (!frag.content.includes(c.cita_textual)) return { valid: false, reason: `La cita de "${c.fragment_id}" no aparece literal en el fragmento.` };
  }
  return { valid: true };
};
