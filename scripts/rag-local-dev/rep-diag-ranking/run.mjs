// RAG-DIAG-RANKING · Diagnóstico de ranking de recuperación contra la base REAL (solo lectura).
//
// Para cada caso de casos.json: arma el mismo texto de consulta que analizar-reporte, lo vectoriza con
// gemini-embedding-2 (768), llama al RPC match_knowledge_fragments con una ventana grande (por defecto 20)
// y muestra TODOS los candidatos con su similitud, marcando cuáles habrían llegado al modelo (umbral + top-k
// de producción). En producción solo se guarda lo que supera el umbral: acá se ve también lo que queda debajo.
//
// No llama a Gemini para generar, no escribe en la base y no imprime ninguna clave.
// Requiere en el .env de la raíz: GEMINI_API_KEY, VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
// (el RPC está restringido a service_role). Apuntar SIEMPRE a staging.
//
// Uso:  node scripts/rag-local-dev/rep-diag-ranking/run.mjs [--solo D5-CABA-1] [--ventana 20]
import fs from 'node:fs';

import { readProdConfig, buildQueryText, classifyCandidates, toMarkdown } from './lib.mjs';

const here = new URL('./', import.meta.url);
const root = new URL('../../../', import.meta.url);

const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const only = argValue('--solo');
const windowSize = Number(argValue('--ventana') ?? 20);
if (!Number.isInteger(windowSize) || windowSize < 1 || windowSize > 100) {
  throw new Error('--ventana debe ser un entero entre 1 y 100');
}

// Variables del .env (sin imprimir valores)
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
const supabaseUrl = need('VITE_SUPABASE_URL').replace(/\/$/, '');
const serviceKey = need('SUPABASE_SERVICE_ROLE_KEY');

const config = readProdConfig(
  fs.readFileSync(new URL('supabase/functions/analizar-reporte/index.ts', root), 'utf-8')
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mismo llamado que embedText de la función: sin taskType, 768 dimensiones. Reintenta 429/500/503. */
const embed = async (text) => {
  const backoffs = [2000, 5000, 10000];
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.embeddingModel}:embedContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        model: `models/${config.embeddingModel}`,
        content: { parts: [{ text }] },
        outputDimensionality: config.dimensions,
      }),
    });
    if (res.ok) {
      const values = (await res.json())?.embedding?.values;
      if (!Array.isArray(values) || values.length !== config.dimensions) throw new Error('Vector inválido');
      return values;
    }
    if (attempt >= backoffs.length || ![429, 500, 503].includes(res.status)) {
      throw new Error(`embedContent falló (${res.status})`);
    }
    await sleep(backoffs[attempt]);
  }
};

const rest = async (path, init = {}) => {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      // La clave legacy service_role es un JWT y va también como Bearer; las nuevas sb_secret_... no son JWT
      // y solo van en apikey.
      ...(serviceKey.startsWith('eyJ') ? { Authorization: `Bearer ${serviceKey}` } : {}),
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path.split('?')[0]} falló (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
};

const localityCache = new Map();
const resolveLocality = async ({ localidad, provincia }) => {
  const key = `${localidad}|${provincia}`;
  if (localityCache.has(key)) return localityCache.get(key);
  const rows = await rest(
    `localities?select=id,name,subdivisions!inner(name,states_provinces!inner(name))` +
      `&name=eq.${encodeURIComponent(localidad)}&subdivisions.states_provinces.name=eq.${encodeURIComponent(provincia)}`
  );
  if (rows.length !== 1) {
    throw new Error(`Se esperaba 1 localidad "${localidad}" (${provincia}) y hay ${rows.length}. Revisar casos.json.`);
  }
  localityCache.set(key, rows[0].id);
  return rows[0].id;
};

const cases = JSON.parse(fs.readFileSync(new URL('casos.json', here), 'utf-8')).filter((c) => !only || c.id === only);
if (cases.length === 0) throw new Error(`Ningún caso coincide con --solo ${only}`);

console.log(`Config de producción leída: top-k ${config.matchCount}, umbral ${config.threshold}, ventana de diagnóstico ${windowSize}.`);
console.log(`Proyecto Supabase: ${new URL(supabaseUrl).host} (confirmar que es STAGING).`);

const results = [];
for (const c of cases) {
  const localityId = await resolveLocality(c);
  const queryText = buildQueryText(c.descripcion, c.categoria);
  const vector = await embed(queryText);
  const rows = await rest('rpc/match_knowledge_fragments', {
    method: 'POST',
    body: JSON.stringify({
      query_embedding: vector,
      p_locality_id: localityId,
      p_model_code: config.embeddingModelCode,
      match_count: windowSize,
      p_service_code: c.categoria ?? null,
    }),
  });
  const analysis = classifyCandidates(rows, { matchCount: config.matchCount, threshold: config.threshold, esperado: c.esperado });
  results.push({ ...c, queryText, analysis });
  console.log(`${c.id}: mejor similitud ${analysis.mejorSimilitud?.toFixed(3) ?? '-'} · ${analysis.veredicto}${analysis.esperadoEstado ? ` · esperado: ${analysis.esperadoEstado}` : ''}`);
}

const generatedAt = new Date().toISOString();
const stamp = generatedAt.replace(/[:.]/g, '-');
fs.mkdirSync(new URL('salida/', here), { recursive: true });
fs.writeFileSync(new URL(`salida/ranking-${stamp}.md`, here), toMarkdown({ config, results, generatedAt }));
fs.writeFileSync(new URL(`salida/ranking-${stamp}.json`, here), JSON.stringify({ generatedAt, config, results }, null, 2));
console.log(`\nInforme: scripts/rag-local-dev/rep-diag-ranking/salida/ranking-${stamp}.md`);
