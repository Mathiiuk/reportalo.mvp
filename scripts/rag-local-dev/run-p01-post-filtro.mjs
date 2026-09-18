/**
 * @file run-p01-post-filtro.mjs
 * @description P-01 (REP-2908-VERIF ronda 4): corre los casos A-F de REP-3764 +
 * 2 pruebas de categoría mal elegida contra la Edge Function `analizar-reporte`
 * YA DESPLEGADA en Supabase real, que ya tiene el filtro por categoría de V-09
 * (fragment_services / p_service_code). No persiste nada en la base: se omite
 * `reportId` a propósito, así la función solo devuelve el resultado sin
 * intentar el insert en report_ai_analysis.
 *
 * Uso:
 *   node scripts/rag-local-dev/run-p01-post-filtro.mjs
 */

import { readFileSync } from 'node:fs';

function loadEnvVar(name) {
  if (process.env[name]) return process.env[name];
  const envFile = readFileSync(new URL('../../.env', import.meta.url), 'utf-8');
  const match = envFile.match(new RegExp(`^${name}=(.*)$`, 'm'));
  if (!match) throw new Error(`Falta ${name} en .env`);
  return match[1].trim();
}

const FUNCTION_URL = `${loadEnvVar('VITE_SUPABASE_URL')}/functions/v1/analizar-reporte`;
const ANON_KEY = loadEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY');

// IDs reales de Supabase (proyecto CiudadAR)
const LOCALITY = {
  AVELLANEDA: '90079a38-1e7e-45d6-8fbf-60140bee9b8d', // Piñeyro, partido de Avellaneda, Buenos Aires
  CABA: '5cf0be29-55ce-452c-892b-d37fb6e669f2', // Retiro, Comuna 1, CABA
};

const CASES = [
  {
    id: 'A',
    query: 'Hay una boca de tormenta rota hace semanas en mi cuadra',
    localityId: LOCALITY.AVELLANEDA,
    localityName: 'Avellaneda',
    category: 'INFRAESTRUCTURA',
    runs: 5,
  },
  {
    id: 'B',
    query: 'Un auto está estacionado sobre la rampa para discapacitados de la esquina',
    localityId: LOCALITY.CABA,
    localityName: 'CABA',
    category: 'TRANSITO',
    runs: 5,
  },
  {
    id: 'C (control negativo)',
    query: 'Un auto está estacionado sobre la rampa para discapacitados de la esquina',
    localityId: LOCALITY.AVELLANEDA,
    localityName: 'Avellaneda',
    category: 'TRANSITO',
    runs: 5,
  },
  {
    id: 'D-Av',
    query: 'No anda la luz de la calle hace tres días',
    localityId: LOCALITY.AVELLANEDA,
    localityName: 'Avellaneda',
    category: 'INFRAESTRUCTURA',
    runs: 5,
  },
  {
    id: 'D-CABA',
    query: 'No anda la luz de la calle hace tres días',
    localityId: LOCALITY.CABA,
    localityName: 'CABA',
    category: 'INFRAESTRUCTURA',
    runs: 5,
  },
  {
    id: 'E',
    query: 'Hay quilombo en la esquina, discuten y frenan el tránsito todos los días',
    localityId: LOCALITY.AVELLANEDA,
    localityName: 'Avellaneda',
    category: 'TRANSITO',
    runs: 5,
  },
  {
    id: 'F',
    query: 'Un puesto vende bebidas en la vereda sin habilitación',
    localityId: LOCALITY.AVELLANEDA,
    localityName: 'Avellaneda',
    category: 'COMERCIO_IRREGULAR',
    runs: 5,
  },
  {
    id: 'Prueba 1 (categoría mal elegida)',
    query: 'Un auto está estacionado sobre la rampa para discapacitados de la esquina',
    localityId: LOCALITY.CABA,
    localityName: 'CABA',
    category: 'INFRAESTRUCTURA',
    runs: 1,
  },
  {
    id: 'Prueba 2 (categoría mal elegida)',
    query: 'Un puesto vende bebidas en la vereda sin habilitación',
    localityId: LOCALITY.AVELLANEDA,
    localityName: 'Avellaneda',
    category: 'TRANSITO',
    runs: 1,
  },
];

async function callAnalizarReporte({ query, localityId, category }) {
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    // Sin reportId a propósito: la función no persiste nada si no viene.
    body: JSON.stringify({ description: query, category, localityId }),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Respuesta no-JSON (status ${response.status}): ${text.slice(0, 300)}`);
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const allResults = [];

  for (const testCase of CASES) {
    console.log(`\n${'='.repeat(100)}`);
    console.log(`Caso ${testCase.id} — "${testCase.query}" (${testCase.localityName} / ${testCase.category}) x${testCase.runs}`);
    console.log('='.repeat(100));

    for (let i = 1; i <= testCase.runs; i++) {
      try {
        const result = await callAnalizarReporte(testCase);
        const row = {
          caso: testCase.id,
          corrida: i,
          jurisdiccion: testCase.localityName,
          categoria: testCase.category,
          estado: result.estado,
          error: result.error ?? null,
          citas: (result.citas ?? []).map((c) => c.fragment_id),
          recuperados: result.retrievedFragmentIds ?? [],
          confianza: result.confianza ?? null,
        };
        allResults.push(row);
        console.log(
          `  [${i}/${testCase.runs}] estado=${row.estado}` +
            (row.error ? ` error="${row.error}"` : '') +
            ` recuperados=${row.recuperados.length} citas=${row.citas.length}`
        );
      } catch (err) {
        console.error(`  [${i}/${testCase.runs}] FALLO: ${err.message}`);
        allResults.push({
          caso: testCase.id,
          corrida: i,
          jurisdiccion: testCase.localityName,
          categoria: testCase.category,
          estado: 'ERROR_HTTP',
          error: err.message,
          citas: [],
          recuperados: [],
          confianza: null,
        });
      }
      await sleep(1500); // evitar rate limit de Gemini
    }
  }

  console.log(`\n${'='.repeat(100)}`);
  console.log('RESUMEN');
  console.log('='.repeat(100));
  console.log(JSON.stringify(allResults, null, 2));

  const fs = await import('node:fs');
  fs.writeFileSync(
    new URL('./p01-post-filtro-resultados.json', import.meta.url),
    JSON.stringify(allResults, null, 2)
  );
  console.log('\nGuardado en scripts/rag-local-dev/p01-post-filtro-resultados.json');
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
