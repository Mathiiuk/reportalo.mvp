/**
 * @file context-embedding-experiment.mjs
 * @description REP-3797 / REP-3795: ¿mejora la recuperación si el vector se calcula sobre
 * `hierarchy_path + contenido` en vez de solo el contenido? SOLO LECTURA: los vectores
 * nuevos se calculan en memoria y no se guardan en ningún lado.
 *
 * Contexto: hoy el vector de cada fragmento se calcula solo con `content`
 * (embed-pending.mjs y load-corpus.mjs). Un fragmento como "j) Recibir y tramitar las
 * quejas y reclamos…" no dice de qué ley ni de qué servicio es, y su similitud con "luz
 * quemada" es baja (0,58; puesto 24). Hipótesis A PROBAR: con el encabezado
 * (Ley 210 > Artículo 3 (funciones) > inciso j) dentro del texto embebido, los fragmentos
 * cortos y sin contexto suben en el ranking.
 *
 * Método:
 *  1. Para cada caso, la RPC match_knowledge_fragments (match_count 200) devuelve TODOS los
 *     fragmentos elegibles (cascada jurisdiccional + categoría) con la similitud actual.
 *  2. Se embebe la consulta igual que analizar-reporte (`texto (categoría: X)`).
 *  3. Para cada fragmento elegible se embebe `hierarchy_path\n\ncontenido` (con caché) y se
 *     calcula la similitud coseno con la consulta.
 *  4. Se compara el puesto de los fragmentos esperados: vectores actuales vs con encabezado.
 *
 * Autocomprobación: antes de comparar, se embebe el `content` SOLO de 3 fragmentos y se
 * compara contra la similitud que da la RPC. Si no coinciden (tolerancia 0,01), la
 * metodología no reproduce la base y el script aborta.
 *
 * Gasta llamadas de embedding a Gemini (unas decenas). No escribe nada en Supabase.
 *
 * Uso (PowerShell, claves cargadas SOLO en esa terminal):
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "..."
 *   $env:GEMINI_API_KEY = "..."
 *   node scripts/rag-local-dev/rep3797/context-embedding-experiment.mjs
 *   node scripts/rag-local-dev/rep3797/context-embedding-experiment.mjs --selftest   # sin red ni claves
 */

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const REPO_ROOT = new URL('../../../', import.meta.url);

function loadDotEnv() {
  const envPath = new URL('.env', REPO_ROOT);
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '');
  }
}

// Mismos valores que supabase/functions/analizar-reporte/index.ts
const EMBEDDING_MODEL = 'gemini-embedding-2';
const EMBEDDING_MODEL_CODE = 'gemini-embedding-2@768';
const EMBEDDING_DIMENSIONS = 768;
const CURRENT_K = 6;
const SIMILARITY_TOLERANCE = 0.01;

const PROCEDURE_FRAGMENT_IDS = new Set([
  '60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000003',
  '60000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000005',
  '60000000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000007',
  '60000000-0000-4000-8000-000000000008', '60000000-0000-4000-8000-000000000009',
]);

const LOCALITY = {
  PUERTO_MADERO: 'e025128c-3ec9-46d7-987a-1eaf0cffebb4', // CABA
  BALVANERA: 'ffa721a3-f9a9-4c88-9861-bf907727e4e9', // CABA
  PINEYRO: '90079a38-1e7e-45d6-8fbf-60140bee9b8d', // Avellaneda
};

// Mismos casos y ids esperados que retrieval-experiment.mjs (verificados el 29/09/2026)
const CASES = [
  { id: 'auto-mal-estacionado', regresion: true, text: 'Auto mal estacionado', locality: LOCALITY.PUERTO_MADERO, category: 'TRANSITO',
    expected: { 'Faltas 6.1.52': '20000000-0000-4000-8000-000000000013' } },
  { id: 'luz-quemada', regresion: true, text: 'La luz de la calle está quemada hace más de un mes y de noche no se ve nada', locality: LOCALITY.BALVANERA, category: 'INFRAESTRUCTURA',
    expected: { 'Ley 210 art. 3 j': '20000000-0000-4000-8000-000000000004', 'Ley 210 art. 2 b': '20000000-0000-4000-8000-000000000005' } },
  { id: 'basural-avellaneda', regresion: true, text: 'Basural a cielo abierto en la esquina, tiran residuos todos los días', locality: LOCALITY.PINEYRO, category: 'AMBIENTE',
    expected: { 'Ley 13.592 art. 9': '40000000-0000-4000-8000-000000000024' } },
  { id: 'camioneta-vereda', regresion: false, text: 'Dejaron la camioneta estacionada en la vereda y no dejan pasar a la gente con el cochecito', locality: LOCALITY.PUERTO_MADERO, category: 'TRANSITO',
    expected: { 'Faltas 6.1.37': '20000000-0000-4000-8000-000000000014', 'Faltas 6.1.54': '40000000-0000-4000-8000-000000000048' } },
  { id: 'choripanes-avellaneda', regresion: false, text: 'Che, hay un tipo vendiendo choripanes en la esquina de casa sin ninguna habilitación, ¿no lo controlan?', locality: LOCALITY.PINEYRO, category: 'COMERCIO_IRREGULAR',
    expected: { 'DL 8751/77 art. 35': '60000000-0000-4000-8000-000000000004', 'LOM art. 27 inc. 1': '40000000-0000-4000-8000-000000000049' } },
  { id: 'auto-abandonado-avellaneda', regresion: false, text: 'Hace meses que hay un auto tirado en la calle, todo destrozado y sin patente, nadie se lo lleva', locality: LOCALITY.PINEYRO, category: 'TRANSITO',
    expected: { 'Ley 24.449 art. 49 b.7': '60000000-0000-4000-8000-000000000029' } },
  { id: 'vereda-rota-raices', regresion: false, text: 'La vereda está rota y levantada por las raíces de un árbol', locality: LOCALITY.BALVANERA, category: 'INFRAESTRUCTURA',
    expected: { 'Ley 5902 art. 7': '40000000-0000-4000-8000-000000000003' } },
  { id: 'basura-vereda-caba', regresion: false, text: 'Hay un montón de bolsas de basura tiradas en la vereda y hace días que no las levanta nadie', locality: LOCALITY.BALVANERA, category: 'AMBIENTE',
    expected: { 'Faltas 1.3.13': '40000000-0000-4000-8000-000000000041' } },
];

// --- utilidades puras (con autotest) ---------------------------------------------------

export const cosine = (a, b) => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

/** Puesto (1 = mejor) de `id` en `items` ordenados por `score` descendente; null si no está. */
export const rankBy = (items, scoreOf, id) => {
  const sorted = [...items].sort((x, y) => scoreOf(y) - scoreOf(x));
  const index = sorted.findIndex((item) => item.fragment_id === id);
  return index === -1 ? null : index + 1;
};

/** Texto que se embebería con el encabezado: contexto + contenido. */
export const withContext = (fragment) => `${fragment.hierarchy_path}\n\n${fragment.content}`;

function selfTest() {
  const assert = (condition, label) => {
    if (!condition) throw new Error(`autotest falló: ${label}`);
    console.log(`  ok · ${label}`);
  };
  assert(Math.abs(cosine([1, 0], [1, 0]) - 1) < 1e-12, 'coseno de vectores iguales = 1');
  assert(Math.abs(cosine([1, 0], [0, 1])) < 1e-12, 'coseno de ortogonales = 0');
  assert(Math.abs(cosine([2, 0], [5, 0]) - 1) < 1e-12, 'el coseno ignora la magnitud');
  const items = [{ fragment_id: 'a', s: 0.2 }, { fragment_id: 'b', s: 0.9 }, { fragment_id: 'c', s: 0.5 }];
  assert(rankBy(items, (i) => i.s, 'b') === 1 && rankBy(items, (i) => i.s, 'c') === 2 && rankBy(items, (i) => i.s, 'a') === 3, 'ranking por puntaje descendente');
  assert(rankBy(items, (i) => i.s, 'zzz') === null, 'id ausente = null');
  assert(withContext({ hierarchy_path: 'Ley X > Art 1', content: 'texto' }) === 'Ley X > Art 1\n\ntexto', 'texto con encabezado');
  console.log('Autotest OK');
}

// --- Gemini / Supabase ---------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function embedText(apiKey, text) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ model: `models/${EMBEDDING_MODEL}`, content: { parts: [{ text }] }, outputDimensionality: EMBEDDING_DIMENSIONS }),
    });
    if (res.ok) {
      const values = (await res.json())?.embedding?.values;
      if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) throw new Error('vector inválido');
      return values;
    }
    lastError = new Error(`embedContent falló (${res.status}): ${(await res.text()).slice(0, 160)}`);
    if (![429, 500, 503].includes(res.status)) break;
    await sleep(1500 * attempt);
  }
  throw lastError;
}

const fmt = (rank) => (rank === null ? 'fuera' : String(rank));

async function main() {
  if (process.argv.includes('--selftest')) {
    selfTest();
    return;
  }

  loadDotEnv();
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!url) throw new Error('Falta SUPABASE_URL (o VITE_SUPABASE_URL)');
  if (!serviceKey) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY');
  if (!geminiKey) throw new Error('Falta GEMINI_API_KEY');

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: activeModel, error: modelError } = await db.from('embedding_models').select('code').eq('is_active', true).maybeSingle();
  if (modelError) throw modelError;
  if (activeModel?.code !== EMBEDDING_MODEL_CODE) throw new Error(`El modelo activo es ${activeModel?.code}, no ${EMBEDDING_MODEL_CODE}.`);

  const { data: infoSources, error: infoError } = await db.from('knowledge_sources').select('id').eq('source_type_code', 'informacion');
  if (infoError) throw infoError;
  const informativeSourceIds = new Set(infoSources.map((row) => row.id));
  const tag = (f) => (informativeSourceIds.has(f.source_id) ? '[CANAL] ' : PROCEDURE_FRAGMENT_IDS.has(f.fragment_id) ? '[PROC] ' : '');

  const contextVectorCache = new Map(); // fragment_id -> vector con encabezado
  const contentVectorCache = new Map(); // solo para la autocomprobación
  const summary = [];
  let selfCheckDone = false;

  for (const testCase of CASES) {
    const queryVector = await embedText(geminiKey, `${testCase.text.trim()} (categoría: ${testCase.category})`);
    const { data: pool, error } = await db.rpc('match_knowledge_fragments', {
      query_embedding: queryVector, p_locality_id: testCase.locality, p_model_code: EMBEDDING_MODEL_CODE, match_count: 200, p_service_code: testCase.category,
    });
    if (error) throw new Error(`RPC falló (${testCase.id}): ${error.message}`);

    // Autocomprobación de la metodología con 3 fragmentos del primer caso
    if (!selfCheckDone) {
      console.log('Autocomprobación: ¿mi cálculo con el texto solo reproduce la similitud que da la base?');
      let worst = 0;
      for (const fragment of pool.slice(0, 3)) {
        const vector = await embedText(geminiKey, fragment.content);
        contentVectorCache.set(fragment.fragment_id, vector);
        const mine = cosine(queryVector, vector);
        const diff = Math.abs(mine - fragment.similarity);
        worst = Math.max(worst, diff);
        console.log(`   ${fragment.hierarchy_path.split('>').pop().trim().slice(0, 36).padEnd(36)} base ${fragment.similarity.toFixed(4)} · mío ${mine.toFixed(4)} · diferencia ${diff.toFixed(4)}`);
      }
      if (worst > SIMILARITY_TOLERANCE) {
        throw new Error(`La diferencia máxima (${worst.toFixed(4)}) supera ${SIMILARITY_TOLERANCE}: la metodología no reproduce la base. Se aborta para no sacar conclusiones falsas.`);
      }
      console.log(`   OK (diferencia máxima ${worst.toFixed(4)} ≤ ${SIMILARITY_TOLERANCE})\n`);
      selfCheckDone = true;
    }

    for (const fragment of pool) {
      if (!contextVectorCache.has(fragment.fragment_id)) {
        contextVectorCache.set(fragment.fragment_id, await embedText(geminiKey, withContext(fragment)));
      }
    }
    const scored = pool.map((f) => ({ ...f, ctxSimilarity: cosine(queryVector, contextVectorCache.get(f.fragment_id)) }));

    const baseTop = [...scored].sort((a, b) => b.similarity - a.similarity).slice(0, CURRENT_K);
    const ctxTop = [...scored].sort((a, b) => b.ctxSimilarity - a.ctxSimilarity).slice(0, CURRENT_K);

    console.log(`=== ${testCase.id}${testCase.regresion ? '  [REGRESIÓN observada]' : ''}  (${pool.length} fragmentos elegibles)`);
    for (const [label, fragmentId] of Object.entries(testCase.expected)) {
      const baseRank = rankBy(scored, (f) => f.similarity, fragmentId);
      const ctxRank = rankBy(scored, (f) => f.ctxSimilarity, fragmentId);
      const item = scored.find((f) => f.fragment_id === fragmentId);
      console.log(
        `    · ${label}: puesto actual ${fmt(baseRank)} (sim ${item ? item.similarity.toFixed(2) : '-'})` +
          `  →  con encabezado ${fmt(ctxRank)} (sim ${item ? item.ctxSimilarity.toFixed(2) : '-'})`
      );
      summary.push({ caso: testCase.id, regresion: testCase.regresion, fragmento: label, baseRank, ctxRank });
    }
    const line = (list, key) => list.map((f) => `${tag(f)}${f.hierarchy_path.split('>').pop().trim().slice(0, 26)}`).join(' | ');
    console.log(`    Top 6 actual:         ${line(baseTop)}`);
    console.log(`    Top 6 con encabezado: ${line(ctxTop)}`);
    const canalBase = baseTop.filter((f) => informativeSourceIds.has(f.source_id)).length;
    const canalCtx = ctxTop.filter((f) => informativeSourceIds.has(f.source_id)).length;
    console.log(`    Canales en el top 6: ${canalBase} → ${canalCtx}\n`);
  }

  const inTop = (rank) => rank !== null && rank <= CURRENT_K;
  console.log('--- RESUMEN: puesto del fragmento esperado (actual → con encabezado) ---');
  for (const row of summary) {
    console.log(`${row.regresion ? '* ' : ''}${row.caso} | ${row.fragmento} | ${fmt(row.baseRank)} → ${fmt(row.ctxRank)}  ${inTop(row.baseRank) === inTop(row.ctxRank) ? '' : inTop(row.ctxRank) ? '(ENTRA al top 6)' : '(SALE del top 6)'}`);
  }
  const baseIn = summary.filter((r) => inTop(r.baseRank)).length;
  const ctxIn = summary.filter((r) => inTop(r.ctxRank)).length;
  console.log(`\nFragmentos esperados dentro del top ${CURRENT_K}: ${baseIn}/${summary.length} con los vectores actuales → ${ctxIn}/${summary.length} con encabezado.`);
  console.log('Solo lectura: no se guardó ningún vector. Esto mide recuperación, no generación; falta la prueba de generación antes de adoptar el cambio.');
}

main().catch((error) => {
  console.error(`\nERROR: ${error.message}`);
  process.exit(1);
});
