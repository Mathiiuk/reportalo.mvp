/**
 * @file run-rep3764-cases.mjs
 * @description Corre los 6 casos A-F de docs/REP-3764_casos_esperados.md contra el
 * pipeline REAL de recuperación (retrieveKnowledgeFragments de
 * src/services/legalRagService.js), con una llamada de red real al RPC
 * match_knowledge_fragments sobre el Postgres local (supabase/local-dev/sql/native-no-pgvector),
 * en vez del fixture en memoria que usan los tests unitarios.
 *
 * IMPORTANTE — qué es "real" acá y qué no:
 *   - SÍ es real: la conexión de red a Postgres, la ejecución del RPC SQL,
 *     la cascada jurisdiccional (eligible_knowledge_sources), el filtrado y
 *     el orden por similitud, y la función retrieveKnowledgeFragments de
 *     legalRagService.js sin ningún stub de por medio.
 *   - NO es real: el embedding. No hay GEMINI_API_KEY en este entorno, así
 *     que se usa la misma función determinística de contenido que ya está
 *     validada en src/test/fixtures/ragTestFixtures.js (no es un modelo de
 *     embeddings real, pero tampoco es ruido aleatorio: separa los conceptos
 *     igual que en los tests unitarios). Antes de correr este script, sobrescribe
 *     los vectores aleatorios que cargó 05_dev_fake_embeddings_array.sql por estos.
 *
 * Uso:
 *   node scripts/rag-local-dev/run-rep3764-cases.mjs
 *
 * Requiere el Postgres local de supabase/local-dev/sql/native-no-pgvector/
 * corriendo en localhost:5433 con el esquema y el corpus ya cargados.
 */

import pg from 'pg';
import {
  retrieveKnowledgeFragments,
  selectFragmentsAboveThreshold,
} from '../../src/services/legalRagService.js';
import { createFakeEmbeddingsClient } from '../../src/test/fixtures/ragTestFixtures.js';

const { Client } = pg;

const CONNECTION_STRING =
  process.env.RAG_DEV_DB_URL || 'postgresql://postgres@localhost:5433/reportalo_rag_dev';

const MODEL_CODE = 'gemini-embedding-2@768';

const CASES = [
  {
    id: 'A',
    query: 'Hay una boca de tormenta rota hace semanas en mi cuadra',
    jurisdiction: 'Avellaneda',
    threshold: 0.45,
    mustInclude: ['FR01', 'FR02', 'FR03'], // Const PBA 192.4, LOM 52, LOM 59
    mustExclude: ['FR15'], // distractor Dec-Ley 8031/73
  },
  {
    id: 'B',
    query: 'Un auto está estacionado sobre la rampa para discapacitados de la esquina',
    jurisdiction: 'CABA',
    threshold: 0.45,
    mustInclude: ['FR12', 'FR13'], // Ley 2148 + Ley 451 (juntas)
    mustExclude: ['FR07', 'FR08', 'FR09', 'FR10'], // Ley 24.449 no aplica en CABA
  },
  {
    id: 'C (control negativo)',
    query: 'Un auto está estacionado sobre la rampa para discapacitados de la esquina',
    jurisdiction: 'Avellaneda',
    threshold: 0.45,
    mustInclude: ['FR10'], // Ley 24.449 art. 49 (vía adhesión PBA)
    mustExclude: ['FR11', 'FR12', 'FR13', 'FR14'], // normas de CABA excluidas por cascada
  },
  {
    id: 'D (Avellaneda)',
    query: 'No anda la luz de la calle hace tres días',
    jurisdiction: 'Avellaneda',
    threshold: 0.35,
    mustInclude: ['FR02'], // LOM 52
    mustExclude: [],
  },
  {
    id: 'D (CABA)',
    query: 'No anda la luz de la calle hace tres días',
    jurisdiction: 'CABA',
    threshold: 0.35,
    mustInclude: ['FR05'], // Ley 210 alumbrado público
    mustExclude: [],
  },
  {
    id: 'E',
    query: 'Hay quilombo en la esquina, discuten y frenan el tránsito todos los días',
    jurisdiction: 'Avellaneda',
    threshold: 0.45,
    mustInclude: [], // algún fragmento de tránsito (FR07-FR10)
    mustExclude: ['FR15'], // descarta el distractor
  },
  {
    id: 'F',
    query: 'Un puesto vende bebidas en la vereda sin habilitación',
    jurisdiction: 'Avellaneda',
    threshold: 0.40,
    mustInclude: [],
    mustExclude: [], // se verifica aparte: debe dar 0 resultados
    expectEmpty: true,
  },
];

// FR01..FR15 -> UUID del corpus (docs/REP-3769_seed_y_RAG.sql PARTE 7)
const FRAGMENT_LABELS = {};
for (let i = 1; i <= 15; i++) {
  const n = String(i).padStart(2, '0');
  FRAGMENT_LABELS[`20000000-0000-4000-8000-0000000000${n}`] = `FR${n}`;
}

async function main() {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();

  const embeddingsClient = createFakeEmbeddingsClient();

  // 1. Recalcular embeddings del corpus con la función determinística de contenido
  //    (sobrescribe los vectores puramente aleatorios de 05_dev_fake_embeddings_array.sql).
  const { rows: fragments } = await client.query(
    'select id, content from public.knowledge_fragments where is_current'
  );
  for (const frag of fragments) {
    const vector = await embeddingsClient.embedText(frag.content);
    await client.query(
      `insert into public.fragment_embeddings (fragment_id, model_code, embedding)
       values ($1, $2, $3)
       on conflict (fragment_id, model_code) do update set embedding = excluded.embedding`,
      [frag.id, MODEL_CODE, vector]
    );
  }
  console.log(`Recalculados ${fragments.length} embeddings de contenido (deterministicos, no Gemini).\n`);

  // 2. Resolver localidades representativas
  const { rows: localities } = await client.query(
    "select id, name from public.localities where name in ('Piñeyro', 'Retiro')"
  );
  const localityByName = Object.fromEntries(localities.map((l) => [l.name, l.id]));
  const localityIdFor = (jurisdiction) =>
    jurisdiction === 'CABA' ? localityByName['Retiro'] : localityByName['Piñeyro'];

  // 3. supabaseClient real: .rpc ejecuta el RPC de verdad contra Postgres
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

  console.log('='.repeat(90));
  console.log('REP-3764 — Casos A-F contra el pipeline real (retrieveKnowledgeFragments + RPC de red)');
  console.log('='.repeat(90));

  let allOk = true;

  for (const testCase of CASES) {
    const { fragments: retrieved, error } = await retrieveKnowledgeFragments({
      supabaseClient,
      embeddingsClient,
      queryText: testCase.query,
      localityId: localityIdFor(testCase.jurisdiction),
      modelCode: MODEL_CODE,
      matchCount: 8,
    });

    if (error) {
      console.log(`\nCaso ${testCase.id}: ERROR — ${error}`);
      allOk = false;
      continue;
    }

    const eligible = selectFragmentsAboveThreshold(retrieved, testCase.threshold);
    const labels = eligible.map((f) => FRAGMENT_LABELS[f.fragment_id] || f.fragment_id);

    let ok = true;
    if (testCase.expectEmpty) {
      ok = eligible.length === 0;
    } else {
      const hasAllExpected = testCase.mustInclude.every((code) => labels.includes(code));
      const hasNoneExcluded = testCase.mustExclude.every((code) => !labels.includes(code));
      ok = hasAllExpected && hasNoneExcluded;
    }
    allOk = allOk && ok;

    console.log(`\nCaso ${testCase.id} — "${testCase.query}" (${testCase.jurisdiction})`);
    console.log(`  Umbral: ${testCase.threshold} · Resultado: ${ok ? 'PASS' : 'FAIL'}`);
    if (eligible.length === 0) {
      console.log('  Sin fragmentos sobre el umbral (sin_normativa).');
    } else {
      eligible.forEach((f) => {
        const label = FRAGMENT_LABELS[f.fragment_id] || f.fragment_id;
        console.log(`  ${label}  sim=${f.similarity.toFixed(4)}  ${f.hierarchy_path}`);
      });
    }
  }

  console.log('\n' + '='.repeat(90));
  console.log(allOk ? 'RESULTADO GLOBAL: GO (6/6 casos OK)' : 'RESULTADO GLOBAL: revisar casos marcados FAIL arriba');
  console.log('='.repeat(90));

  await client.end();
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error('Error fatal ejecutando los casos:', err);
  process.exit(1);
});
