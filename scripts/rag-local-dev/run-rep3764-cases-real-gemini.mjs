/**
 * @file run-rep3764-cases-real-gemini.mjs
 * @description Corre los 6 casos A-F de docs/REP-3764_casos_esperados.md contra el
 * pipeline COMPLETO de producción: embeddings reales de gemini-embedding-2 (768d),
 * recuperación real por RPC contra Postgres local, y generación real con
 * gemini-3.8-flash (validada de forma determinística), usando exactamente
 * src/services/legalRagService.js + src/services/geminiClient.js sin ningún stub.
 *
 * Requiere GEMINI_API_KEY en .env (variable de entorno de servidor — nunca la
 * cargues en un VITE_* ni la commitees).
 *
 * Uso:
 *   node scripts/rag-local-dev/run-rep3764-cases-real-gemini.mjs
 */

import { readFileSync } from 'node:fs';
import pg from 'pg';
import { analyzeReport, retrieveKnowledgeFragments, EMBEDDING_MODEL_CODE } from '../../src/services/legalRagService.js';
import { createGeminiEmbeddingsClient, createGeminiGenerationClient } from '../../src/services/geminiClient.js';

const { Client } = pg;

function loadEnvVar(name) {
  if (process.env[name]) return process.env[name];
  const envFile = readFileSync(new URL('../../.env', import.meta.url), 'utf-8');
  const match = envFile.match(new RegExp(`^${name}=(.*)$`, 'm'));
  if (!match) throw new Error(`Falta ${name} en .env`);
  return match[1].trim();
}

const GEMINI_API_KEY = loadEnvVar('GEMINI_API_KEY');
const CONNECTION_STRING = process.env.RAG_DEV_DB_URL || 'postgresql://postgres@localhost:5433/reportalo_rag_dev';

// fetch con reintento simple ante 429/503 (picos de demanda transitorios de la API)
async function fetchWithRetry(url, options, attempt = 1) {
  const response = await fetch(url, options);
  if ((response.status === 429 || response.status === 503) && attempt <= 4) {
    const waitMs = attempt * 4000;
    console.log(`  (reintentando en ${waitMs / 1000}s — ${response.status})`);
    await new Promise((r) => setTimeout(r, waitMs));
    return fetchWithRetry(url, options, attempt + 1);
  }
  return response;
}

const CASES = [
  { id: 'A', query: 'Hay una boca de tormenta rota hace semanas en mi cuadra', locality: 'Piñeyro' },
  { id: 'B', query: 'Un auto está estacionado sobre la rampa para discapacitados de la esquina', locality: 'Retiro' },
  { id: 'C (control negativo)', query: 'Un auto está estacionado sobre la rampa para discapacitados de la esquina', locality: 'Piñeyro' },
  { id: 'D (Avellaneda)', query: 'No anda la luz de la calle hace tres días', locality: 'Piñeyro' },
  { id: 'D (CABA)', query: 'No anda la luz de la calle hace tres días', locality: 'Retiro' },
  { id: 'E', query: 'Hay quilombo en la esquina, discuten y frenan el tránsito todos los días', locality: 'Piñeyro' },
  { id: 'F', query: 'Un puesto vende bebidas en la vereda sin habilitación', locality: 'Piñeyro' },
];

const FRAGMENT_LABELS = {};
for (let i = 1; i <= 15; i++) {
  const n = String(i).padStart(2, '0');
  FRAGMENT_LABELS[`20000000-0000-4000-8000-0000000000${n}`] = `FR${n}`;
}

async function main() {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();

  const embeddingsClient = createGeminiEmbeddingsClient({ apiKey: GEMINI_API_KEY, fetchImpl: fetchWithRetry });
  const generationClient = createGeminiGenerationClient({ apiKey: GEMINI_API_KEY, fetchImpl: fetchWithRetry, thinkingLevel: 'low' });

  // 1. Vectorizar el corpus real con gemini-embedding-2 (768d) — reemplaza los
  //    vectores sintéticos/deterministicos usados en las corridas anteriores.
  const { rows: fragments } = await client.query(
    'select id, content from public.knowledge_fragments where is_current'
  );
  console.log(`Vectorizando ${fragments.length} fragmentos con gemini-embedding-2 (real)...`);
  for (const frag of fragments) {
    const vector = await embeddingsClient.embedText(frag.content);
    await client.query(
      `insert into public.fragment_embeddings (fragment_id, model_code, embedding)
       values ($1, $2, $3)
       on conflict (fragment_id, model_code) do update set embedding = excluded.embedding`,
      [frag.id, EMBEDDING_MODEL_CODE, vector]
    );
    process.stdout.write('.');
  }
  console.log(`\nListo: ${fragments.length} embeddings reales cargados.\n`);

  const { rows: localities } = await client.query(
    "select id, name from public.localities where name in ('Piñeyro', 'Retiro')"
  );
  const localityByName = Object.fromEntries(localities.map((l) => [l.name, l.id]));

  const supabaseClient = {
    rpc: async (fnName, args) => {
      try {
        const { rows } = await client.query(
          `select * from public.${fnName}($1, $2, $3, $4)`,
          [args.query_embedding, args.p_locality_id, args.p_model_code, args.match_count]
        );
        return { data: rows, error: null };
      } catch (err) {
        return { data: null, error: { message: err.message } };
      }
    },
  };

  console.log('='.repeat(100));
  console.log('REP-3764 — Casos A-F, pipeline COMPLETO real (embeddings + RPC + generación Gemini)');
  console.log('='.repeat(100));

  for (const testCase of CASES) {
    const localityId = localityByName[testCase.locality];

    const result = await analyzeReport({
      description: testCase.query,
      localityId,
      supabaseClient,
      embeddingsClient,
      generationClient,
    });

    const citedLabels = (result.citedFragments || []).map((f) => FRAGMENT_LABELS[f.fragment_id] || f.fragment_id);
    const retrievedLabels = (result.retrievedFragments || []).map((f) => FRAGMENT_LABELS[f.fragment_id] || f.fragment_id);

    console.log(`\nCaso ${testCase.id} — "${testCase.query}" (${testCase.locality})`);
    console.log(`  estado: ${result.estado}`);
    if (result.error) console.log(`  error: ${result.error}`);
    console.log(`  fragmentos recuperados: ${retrievedLabels.join(', ') || '(ninguno)'}`);
    console.log(`  fragmentos citados: ${citedLabels.join(', ') || '(ninguno)'}`);
    if (result.fundamento_ciudadano) console.log(`  fundamento_ciudadano: ${result.fundamento_ciudadano}`);
    if (result.confianza !== undefined) console.log(`  confianza: ${result.confianza}`);
    console.log(`  latencia: ${result.latencyMs} ms`);
  }

  console.log('\n' + '='.repeat(100));
  await client.end();
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
