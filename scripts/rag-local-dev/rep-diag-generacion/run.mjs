// RAG-DIAG-GENERACION · Experimento B: ¿varía la generación con el contexto congelado? (solo lectura en la base).
//
// 1) Congela el contexto de un caso: vectoriza la consulta, llama al RPC match_knowledge_fragments y se queda con lo
//    que hoy llega al modelo (umbral + top-k de producción). Se guarda en salida/contexto-<caso>.json.
// 2) Llama N veces a generateContent con EXACTAMENTE los mismos bytes (se imprime el sha256 del prompt) y la misma
//    configuración que analizar-reporte (modelo, temperatura, thinking, esquema, tope de salida), leídos del fuente.
// 3) Informa estados, conjuntos de citas, validación y tokens de cada corrida.
//
// No escribe en la base y no imprime claves. Cuesta N llamadas de generación a Gemini (por defecto 5).
// Requiere en el .env de la raíz: GEMINI_API_KEY, VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (solo si hay que
// recuperar el contexto; con --reusar y un contexto ya congelado no se necesita Supabase). Apuntar SIEMPRE a staging.
//
// Uso:  node scripts/rag-local-dev/rep-diag-generacion/run.mjs [--caso D2-AVE-4] [--corridas 5] [--temperatura 1] [--reusar]
import fs from 'node:fs';

import { readGenerationSpec, buildQueryText, buildPrompt, sha256, validateRun, summarizeRuns, toMarkdown } from './lib.mjs';

const here = new URL('./', import.meta.url);
const root = new URL('../../../', import.meta.url);

const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const casoId = argValue('--caso') ?? 'D2-AVE-4';
const corridas = Number(argValue('--corridas') ?? 5);
const reuse = args.includes('--reusar');
if (!Number.isInteger(corridas) || corridas < 1 || corridas > 20) throw new Error('--corridas debe ser un entero entre 1 y 20');

const env = Object.fromEntries(
  fs.readFileSync(new URL('.env', root), 'utf-8')
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()])
);
const need = (name) => {
  if (!env[name]) throw new Error(`Falta ${name} en el .env de la raíz (no se imprime su valor).`);
  return env[name];
};
const geminiKey = need('GEMINI_API_KEY');

const spec = readGenerationSpec(fs.readFileSync(new URL('supabase/functions/analizar-reporte/index.ts', root), 'utf-8'));
const temperature = argValue('--temperatura') !== null ? Number(argValue('--temperatura')) : spec.temperature;
if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw new Error('--temperatura debe estar entre 0 y 2');

const caso = JSON.parse(fs.readFileSync(new URL('casos.json', here), 'utf-8')).find((c) => c.id === casoId);
if (!caso) throw new Error(`No existe el caso "${casoId}" en casos.json`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';

/** Reintenta 429/500/503 con espera creciente; devuelve la respuesta cruda. */
const geminiFetch = async (url, body) => {
  const backoffs = [2000, 5000, 10000];
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify(body),
    });
    if (res.ok || attempt >= backoffs.length || ![429, 500, 503].includes(res.status)) return res;
    await sleep(backoffs[attempt]);
  }
};

const salidaDir = new URL('salida/', here);
fs.mkdirSync(salidaDir, { recursive: true });
const fixtureUrl = new URL(`contexto-${caso.id}.json`, salidaDir);

// --- 1) Contexto congelado ---------------------------------------------------------------------------------------
let fragments;
if (reuse && fs.existsSync(fixtureUrl)) {
  fragments = JSON.parse(fs.readFileSync(fixtureUrl, 'utf-8')).fragments;
  console.log(`Contexto reutilizado de salida/contexto-${caso.id}.json (${fragments.length} fragmentos).`);
} else {
  const supabaseUrl = need('VITE_SUPABASE_URL').replace(/\/$/, '');
  const serviceKey = need('SUPABASE_SERVICE_ROLE_KEY');
  console.log(`Proyecto Supabase: ${new URL(supabaseUrl).host} (confirmar que es STAGING).`);

  const rest = async (path, init = {}) => {
    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        // La clave legacy service_role es un JWT y va también como Bearer; las sb_secret_... solo en apikey.
        ...(serviceKey.startsWith('eyJ') ? { Authorization: `Bearer ${serviceKey}` } : {}),
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Supabase ${path.split('?')[0]} falló (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return res.json();
  };

  const locs = await rest(
    `localities?select=id,name,subdivisions!inner(name,states_provinces!inner(name))` +
      `&name=eq.${encodeURIComponent(caso.localidad)}&subdivisions.states_provinces.name=eq.${encodeURIComponent(caso.provincia)}`
  );
  if (locs.length !== 1) throw new Error(`Se esperaba 1 localidad "${caso.localidad}" (${caso.provincia}) y hay ${locs.length}.`);

  const embRes = await geminiFetch(`${GEMINI}/models/${spec.embeddingModel}:embedContent`, {
    model: `models/${spec.embeddingModel}`,
    content: { parts: [{ text: buildQueryText(caso.descripcion, caso.categoria) }] },
    outputDimensionality: spec.dimensions,
  });
  if (!embRes.ok) throw new Error(`embedContent falló (${embRes.status})`);
  const vector = (await embRes.json())?.embedding?.values;
  if (!Array.isArray(vector) || vector.length !== spec.dimensions) throw new Error('Vector inválido');

  const rows = await rest('rpc/match_knowledge_fragments', {
    method: 'POST',
    body: JSON.stringify({
      query_embedding: vector,
      p_locality_id: locs[0].id,
      p_model_code: spec.embeddingModelCode,
      match_count: spec.matchCount,
      p_service_code: caso.categoria ?? null,
    }),
  });
  // Igual que la función: solo lo que supera el umbral llega al modelo.
  fragments = rows.filter((r) => r.similarity >= spec.threshold);
  fs.writeFileSync(fixtureUrl, JSON.stringify({ caso, congeladoEn: new Date().toISOString(), fragments }, null, 2));
  console.log(`Contexto congelado en salida/contexto-${caso.id}.json (${fragments.length} fragmentos).`);
}
if (fragments.length === 0) throw new Error('Ningún fragmento supera el umbral: en producción este caso sería sin_normativa sin llamar al modelo.');

// --- 2) N corridas con los mismos bytes --------------------------------------------------------------------------
const prompt = buildPrompt(spec.instructions, { reportText: caso.descripcion, category: caso.categoria, fragments });
const promptHash = sha256(prompt);
console.log(`Prompt ${spec.promptVersion} · sha256 ${promptHash.slice(0, 16)}… · ${corridas} corridas · temperatura ${temperature}${temperature !== spec.temperature ? ` (producción: ${spec.temperature})` : ''}.`);

const body = {
  model: `models/${spec.model}`,
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: spec.schema,
    thinkingConfig: { thinkingLevel: spec.thinkingLevel },
    temperature,
    maxOutputTokens: spec.maxOutputTokens,
  },
};

const runs = [];
for (let i = 1; i <= corridas; i += 1) {
  const started = performance.now();
  try {
    const res = await geminiFetch(`${GEMINI}/models/${spec.model}:generateContent`, body);
    if (!res.ok) throw new Error(`generateContent falló (${res.status})`);
    const data = await res.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`sin contenido (finishReason: ${candidate?.finishReason ?? '?'})`);
    const parsed = JSON.parse(text);
    const validation = validateRun(parsed, fragments, caso.categoria);
    runs.push({ parsed, validation, usage: data.usageMetadata ?? {}, finishReason: candidate.finishReason, ms: Math.round(performance.now() - started) });
    console.log(`  #${i}: ${parsed.estado} · citas ${(parsed.citas ?? []).length} · ${validation.valid ? 'válida' : `NO válida (${validation.reason})`} · ${Math.round(performance.now() - started)} ms`);
  } catch (e) {
    runs.push({ parsed: null, error: String(e.message).slice(0, 200), usage: null });
    console.log(`  #${i}: ERROR ${String(e.message).slice(0, 120)}`);
  }
}

// --- 3) Informe ---------------------------------------------------------------------------------------------------
const summary = summarizeRuns(runs);
const generatedAt = new Date().toISOString();
const stamp = generatedAt.replace(/[:.]/g, '-');
const md = toMarkdown({ caso, spec, temperature, promptHash, fragments, runs, summary, generatedAt });
fs.writeFileSync(new URL(`generacion-${caso.id}-${stamp}.md`, salidaDir), md);
fs.writeFileSync(new URL(`generacion-${caso.id}-${stamp}.json`, salidaDir), JSON.stringify({ generatedAt, caso, temperature, promptHash, spec: { ...spec, instructions: undefined, schema: undefined }, summary, runs }, null, 2));
console.log(`\nEstados: ${JSON.stringify(summary.estados)} · conjuntos de citas distintos: ${summary.conjuntosDeCitasDistintos}`);
console.log(`Informe: scripts/rag-local-dev/rep-diag-generacion/salida/generacion-${caso.id}-${stamp}.md`);
