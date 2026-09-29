/**
 * @file retrieval-experiment.mjs
 * @description REP-3797 / REP-3795: experimento de SOLO RECUPERACIÓN (sin generación, sin escrituras).
 *
 * Pregunta que responde: en los casos donde el lote 2 empeoró el resultado (auto mal
 * estacionado, luz quemada, basural), ¿el fragmento correcto está entre los recuperados?
 * ¿Qué pasa si se recuperan más fragmentos (k) o si los fragmentos informativos (canales,
 * teléfonos) no compiten por los mismos lugares que las normas?
 *
 * Reproduce EXACTAMENTE lo que hace analizar-reporte:
 *   - texto de consulta: `${descripcion} (categoría: ${CATEGORIA})`
 *   - embedding gemini-embedding-2, 768 dimensiones
 *   - RPC match_knowledge_fragments con cascada jurisdiccional y filtro por categoría
 *   - umbral de similitud 0.45
 * Pide 40 resultados a la RPC (ordenados por similitud) y reconstruye las variantes en
 * el cliente: como el orden es por similitud, "top 8" o "sin informativos" se calculan
 * sobre la misma lista, sin tocar la base.
 *
 * Solo lee: 1 SELECT a knowledge_sources, 1 SELECT a embedding_models y N llamadas a la RPC
 * (STABLE, sin efectos). No escribe nada en Supabase.
 *
 * Uso (PowerShell, con las claves cargadas SOLO en esa terminal):
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "..."
 *   $env:GEMINI_API_KEY = "..."
 *   node scripts/rag-local-dev/rep3797/retrieval-experiment.mjs
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
const SIMILARITY_THRESHOLD = 0.45;
const POOL_SIZE = 40;

// Fragmentos de PROCEDIMIENTO de faltas (Decreto-Ley 8751/77 arts. 1, 18, 35, 38 y Ley 1217
// Anexo arts. 1, 2, 3, 34): genericos por definicion, mapeados hoy a las 4 categorias con
// conducta. Son los 8 de la PARTE 11 (interruptor) del lote 2. El art. 4 bis del 8751/77 NO
// esta en la lista: es fundamento de fondo, no procedimiento.
const PROCEDURE_FRAGMENT_IDS = new Set([
  '60000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000003',
  '60000000-0000-4000-8000-000000000004',
  '60000000-0000-4000-8000-000000000005',
  '60000000-0000-4000-8000-000000000006',
  '60000000-0000-4000-8000-000000000007',
  '60000000-0000-4000-8000-000000000008',
  '60000000-0000-4000-8000-000000000009',
]);

const LOCALITY = {
  PUERTO_MADERO: 'e025128c-3ec9-46d7-987a-1eaf0cffebb4', // CABA
  BALVANERA: 'ffa721a3-f9a9-4c88-9861-bf907727e4e9', // CABA
  PINEYRO: '90079a38-1e7e-45d6-8fbf-60140bee9b8d', // Avellaneda
};

// `expected`: fragmentos que, si están entre los recuperados, permiten fundamentar el caso.
// Ids verificados contra la base el 29/09/2026.
const CASES = [
  {
    id: 'auto-mal-estacionado',
    regresion: true,
    text: 'Auto mal estacionado',
    locality: LOCALITY.PUERTO_MADERO,
    category: 'TRANSITO',
    expected: { 'Faltas 6.1.52 (estacionar en lugar prohibido)': '20000000-0000-4000-8000-000000000013' },
  },
  {
    id: 'luz-quemada',
    regresion: true,
    text: 'La luz de la calle está quemada hace más de un mes y de noche no se ve nada',
    locality: LOCALITY.BALVANERA,
    category: 'INFRAESTRUCTURA',
    expected: {
      'Ley 210 art. 3 j (quejas y reclamos)': '20000000-0000-4000-8000-000000000004',
      'Ley 210 art. 2 b (alumbrado)': '20000000-0000-4000-8000-000000000005',
    },
  },
  {
    id: 'basural-avellaneda',
    regresion: true,
    text: 'Basural a cielo abierto en la esquina, tiran residuos todos los días',
    locality: LOCALITY.PINEYRO,
    category: 'AMBIENTE',
    expected: { 'Ley 13.592 art. 9 (clausura de basurales)': '40000000-0000-4000-8000-000000000024' },
  },
  {
    id: 'camioneta-vereda',
    regresion: false,
    text: 'Dejaron la camioneta estacionada en la vereda y no dejan pasar a la gente con el cochecito',
    locality: LOCALITY.PUERTO_MADERO,
    category: 'TRANSITO',
    expected: {
      'Faltas 6.1.37 (obstrucción)': '20000000-0000-4000-8000-000000000014',
      'Faltas 6.1.54 (sobre aceras)': '40000000-0000-4000-8000-000000000048',
    },
  },
  {
    id: 'choripanes-avellaneda',
    regresion: false,
    text: 'Che, hay un tipo vendiendo choripanes en la esquina de casa sin ninguna habilitación, ¿no lo controlan?',
    locality: LOCALITY.PINEYRO,
    category: 'COMERCIO_IRREGULAR',
    expected: {
      'DL 8751/77 art. 35 (acción pública)': '60000000-0000-4000-8000-000000000004',
      'LOM art. 27 inc. 1 (habilitación)': '40000000-0000-4000-8000-000000000049',
    },
  },
  {
    id: 'auto-abandonado-avellaneda',
    regresion: false,
    text: 'Hace meses que hay un auto tirado en la calle, todo destrozado y sin patente, nadie se lo lleva',
    locality: LOCALITY.PINEYRO,
    category: 'TRANSITO',
    expected: { 'Ley 24.449 art. 49 b.7 (más de 5 días)': '60000000-0000-4000-8000-000000000029' },
  },
  {
    id: 'vereda-rota-raices',
    regresion: false,
    text: 'La vereda está rota y levantada por las raíces de un árbol',
    locality: LOCALITY.BALVANERA,
    category: 'INFRAESTRUCTURA',
    expected: { 'Ley 5902 art. 7 (raíces de árboles)': '40000000-0000-4000-8000-000000000003' },
  },
  {
    id: 'basura-vereda-caba',
    regresion: false,
    text: 'Hay un montón de bolsas de basura tiradas en la vereda y hace días que no las levanta nadie',
    locality: LOCALITY.BALVANERA,
    category: 'AMBIENTE',
    expected: { 'Faltas 1.3.13 (arrojar residuos)': '40000000-0000-4000-8000-000000000041' },
  },
];

async function embedText(apiKey, text) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }),
  });
  if (!res.ok) throw new Error(`embedContent falló (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const values = (await res.json())?.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) throw new Error('vector inválido');
  return values;
}

const rankOf = (list, fragmentId) => {
  const index = list.findIndex((f) => f.fragment_id === fragmentId);
  return index === -1 ? null : index + 1;
};
const fmtRank = (rank) => (rank === null ? 'fuera' : String(rank));
const inTop = (rank, k) => rank !== null && rank <= k;

async function main() {
  loadDotEnv();
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!url) throw new Error('Falta SUPABASE_URL (o VITE_SUPABASE_URL)');
  if (!serviceKey) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY');
  if (!geminiKey) throw new Error('Falta GEMINI_API_KEY');

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: activeModel, error: modelError } = await db
    .from('embedding_models')
    .select('code')
    .eq('is_active', true)
    .maybeSingle();
  if (modelError) throw modelError;
  if (activeModel?.code !== EMBEDDING_MODEL_CODE) {
    throw new Error(`El modelo activo es ${activeModel?.code}, no ${EMBEDDING_MODEL_CODE}: el experimento no reproduciría la función.`);
  }

  const { data: infoSources, error: infoError } = await db
    .from('knowledge_sources')
    .select('id')
    .eq('source_type_code', 'informacion');
  if (infoError) throw infoError;
  const informativeSourceIds = new Set(infoSources.map((row) => row.id));
  console.log(`Fuentes informativas (canales, teléfonos): ${informativeSourceIds.size}`);
  console.log(`Umbral ${SIMILARITY_THRESHOLD} · k actual ${CURRENT_K} · pool ${POOL_SIZE}\n`);

  const summary = [];

  for (const testCase of CASES) {
    const queryText = `${testCase.text.trim()} (categoría: ${testCase.category})`;
    const embedding = await embedText(geminiKey, queryText);
    const { data, error } = await db.rpc('match_knowledge_fragments', {
      query_embedding: embedding,
      p_locality_id: testCase.locality,
      p_model_code: EMBEDDING_MODEL_CODE,
      match_count: POOL_SIZE,
      p_service_code: testCase.category,
    });
    if (error) throw new Error(`RPC falló (${testCase.id}): ${error.message}`);

    const aboveThreshold = data.filter((f) => f.similarity >= SIMILARITY_THRESHOLD);
    const isInfo = (f) => informativeSourceIds.has(f.source_id);
    const isProcedure = (f) => PROCEDURE_FRAGMENT_IDS.has(f.fragment_id);
    // Variante A: sin canales/telefonos. Variante B: sin canales NI procedimiento.
    const withoutInfo = aboveThreshold.filter((f) => !isInfo(f));
    const withoutInfoNorProcedure = aboveThreshold.filter((f) => !isInfo(f) && !isProcedure(f));
    const topCurrent = aboveThreshold.slice(0, CURRENT_K);
    const infoInTop = topCurrent.filter(isInfo).length;
    const procedureInTop = topCurrent.filter(isProcedure).length;
    const expectedIds = new Set(Object.values(testCase.expected));
    // "Desplaza": hay un esperado que NO entra en el top actual y ocupa un lugar un
    // fragmento informativo o de procedimiento (los que compiten sin ser fundamento de fondo).
    const missingExpected = [...expectedIds].filter((id) => rankOf(topCurrent, id) === null);
    const displacers = infoInTop + procedureInTop;

    console.log(`=== ${testCase.id}${testCase.regresion ? '  [REGRESIÓN observada]' : ''}`);
    console.log(`    "${testCase.text}"  · ${testCase.category}`);
    console.log(
      `    Recuperados sobre el umbral: ${aboveThreshold.length} (de ${data.length}) · ` +
        `en el top ${CURRENT_K}: ${infoInTop} de canal/teléfono, ${procedureInTop} de procedimiento` +
        `${missingExpected.length > 0 && displacers > 0 ? '  ← hay un esperado afuera y lugares ocupados por canal/procedimiento' : ''}`
    );

    for (const [label, fragmentId] of Object.entries(testCase.expected)) {
      const full = rankOf(aboveThreshold, fragmentId);
      const noInfo = rankOf(withoutInfo, fragmentId);
      const noInfoNorProc = rankOf(withoutInfoNorProcedure, fragmentId);
      const similarity = aboveThreshold.find((f) => f.fragment_id === fragmentId)?.similarity;
      console.log(
        `    · ${label}: puesto ${fmtRank(full)}` +
          `${similarity !== undefined ? ` (sim ${similarity.toFixed(2)})` : ''}` +
          ` | sin canales: puesto ${fmtRank(noInfo)}` +
          ` | sin canales ni procedimiento: puesto ${fmtRank(noInfoNorProc)}`
      );
      summary.push({
        caso: testCase.id,
        regresion: testCase.regresion,
        fragmento: label,
        puestoActual: full,
        puestoSinInformativos: noInfo,
        puestoSinCanalesNiProcedimiento: noInfoNorProc,
        k6: inTop(full, 6),
        k8: inTop(full, 8),
        k10: inTop(full, 10),
        k6SinInfo: inTop(noInfo, 6),
        k8SinInfo: inTop(noInfo, 8),
        k6SinInfoProc: inTop(noInfoNorProc, 6),
        k8SinInfoProc: inTop(noInfoNorProc, 8),
        infoEnTop6: infoInTop,
        procedimientoEnTop6: procedureInTop,
      });
    }
    console.log(`    Top ${CURRENT_K} actual: ${topCurrent
      .map((f) => `${isInfo(f) ? '[CANAL] ' : isProcedure(f) ? '[PROC] ' : ''}${f.hierarchy_path.split('>').pop().trim().slice(0, 34)}`)
      .join(' | ')}\n`);
  }

  const yes = (value) => (value ? 'sí' : 'no');
  console.log('--- RESUMEN: ¿el fragmento esperado entra en los recuperados? ---');
  console.log('caso | fragmento | k=6 (hoy) | k=8 | k=10 | k=6 sin canales | k=8 sin canales | k=6 sin canales ni proc. | canal/proc. en top 6');
  for (const row of summary) {
    console.log(
      `${row.regresion ? '* ' : ''}${row.caso} | ${row.fragmento} | ${yes(row.k6)} | ${yes(row.k8)} | ${yes(row.k10)} | ${yes(row.k6SinInfo)} | ${yes(row.k8SinInfo)} | ${yes(row.k6SinInfoProc)} | ${row.infoEnTop6}/${row.procedimientoEnTop6}`
    );
  }
  const totalTop = summary.length ? new Set(summary.map((row) => row.caso)).size * CURRENT_K : 0;
  const perCase = new Map(summary.map((row) => [row.caso, row]));
  const infoLugares = [...perCase.values()].reduce((sum, row) => sum + row.infoEnTop6, 0);
  const procLugares = [...perCase.values()].reduce((sum, row) => sum + row.procedimientoEnTop6, 0);
  console.log(`
Lugares del top ${CURRENT_K} ocupados en total (${perCase.size} casos, ${totalTop} lugares): ${infoLugares} por canal/teléfono, ${procLugares} por procedimiento.`);
  console.log('Criterio propuesto por Hernán: si entra 1 de 6 y no desplaza nada, se queda; si entra siempre y empuja afuera una norma de fondo, se corre la PARTE 11.');
  console.log('\n(* = caso que empeoró tras el lote 2)');
  console.log('Este experimento NO genera respuestas ni escribe en la base: mide si el fragmento correcto llega al modelo.');
}

main().catch((error) => {
  console.error(`\nERROR: ${error.message}`);
  process.exit(1);
});
