/**
 * @file run-casos-p4-p5.mjs
 * @description REP-3795: casos de repro para el Punto 4 (vulnerabilidad social → asistencia,
 * costo cero) y el Punto 5 (temperature 0 → misma respuesta para el mismo texto) del
 * diagnóstico (docs/sprint14/RAG_diagnostico_puntos_rotos.docx).
 *
 * Elegidos a propósito en Tránsito/Avellaneda (corpus completo) y Vulnerabilidad social
 * (cualquier zona) para no mezclar el resultado con REP-3796 (visibilidad de sanciones en
 * CABA) ni con REP-3797 (corpus todavía chico para Infraestructura/Ambiente/Comercio en
 * CABA) — ver el chat de REP-3795 para el detalle de por qué esos dos quedan afuera.
 *
 * Mismo patrón que run-p01-post-filtro.mjs: llama a la función YA DESPLEGADA (no persiste,
 * sin reportId), no importa index.ts. Apunta a `analizar-reporte` por defecto — pasar
 * FUNCTION_NAME=analizar-reporte-rep3795 (u otro nombre de copia) para probar una copia
 * sin tocar la función real, como se hizo en REP-3793 con quarantine-anonymize-rep3793.
 *
 * Uso:
 *   node scripts/rag-local-dev/rep3795/run-casos-p4-p5.mjs
 *   FUNCTION_NAME=analizar-reporte-rep3795 node scripts/rag-local-dev/rep3795/run-casos-p4-p5.mjs
 */

import { readFileSync } from 'node:fs';

function loadEnvVar(name) {
  if (process.env[name]) return process.env[name];
  const envFile = readFileSync(new URL('../../../.env', import.meta.url), 'utf-8');
  const match = envFile.match(new RegExp(`^${name}=(.*)$`, 'm'));
  if (!match) throw new Error(`Falta ${name} en .env`);
  return match[1].trim();
}

const FUNCTION_NAME = process.env.FUNCTION_NAME || 'analizar-reporte';
const FUNCTION_URL = `${loadEnvVar('VITE_SUPABASE_URL')}/functions/v1/${FUNCTION_NAME}`;
const ANON_KEY = loadEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY');
// R5-05: la función exige este header (mismo valor que el secreto RAG_DISPATCH_TOKEN
// de la función / rag_dispatch_token de Vault). Nunca hardcodeado acá.
const DISPATCH_TOKEN = process.env.RAG_DISPATCH_TOKEN;
if (!DISPATCH_TOKEN) {
  throw new Error('Falta RAG_DISPATCH_TOKEN en el entorno (la función lo exige desde R5-05).');
}

// IDs reales de Supabase (proyecto CiudadAR)
const LOCALITY = {
  PUERTO_MADERO: 'e025128c-3ec9-46d7-987a-1eaf0cffebb4', // CABA
  ALMAGRO: '497d8317-44a9-473b-95dc-56836c35199b', // CABA
  BALVANERA: 'ffa721a3-f9a9-4c88-9861-bf907727e4e9', // CABA
  PIÑEYRO: '90079a38-1e7e-45d6-8fbf-60140bee9b8d', // Avellaneda
  WILDE: '094a78f5-ce7b-4e76-8d54-5bb95419fe93', // Avellaneda
};

// R5-05: la función ignora description/category/localityId del cuerpo y los lee de la
// base por reportId. Reportes de prueba creados a mano (28/09/2026, marcados
// "[TEST REP-3795]" en la descripción, mismo user_id que las pruebas de REP-3793) --
// no son de un ciudadano real, borrar cuando se cierre la prueba.
const CASES = [
  // --- Punto 4: vulnerabilidad social → asistencia, costo cero ---
  {
    grupo: 'Punto 4',
    id: 'VS-1',
    reportId: '9a2cf981-6d38-4931-8d9b-da11c23a5880',
    query: 'Persona en situación de calle',
    localityName: 'Balvanera (CABA)',
    category: 'VULNERABILIDAD_SOCIAL',
    runs: 1,
    esperado: 'asistencia, sin citas, sin llamada a Gemini (chequear que no haya embedContent/generateContent en los logs de la función para este reporte)',
  },
  {
    grupo: 'Punto 4',
    id: 'VS-2',
    reportId: '268f1769-200d-4693-8917-b8736cb5bf62',
    query: 'Refugio improvisado bajo estructura vial',
    localityName: 'Wilde (Avellaneda)',
    category: 'VULNERABILIDAD_SOCIAL',
    runs: 1,
    esperado: 'asistencia, misma verificación que VS-1 (repite en la otra jurisdicción a propósito)',
  },
  // --- Punto 5: consistencia (5 corridas c/u, comparar contra docs/sprint14) ---
  {
    grupo: 'Punto 5',
    id: 'T-1',
    reportId: 'eb8e82af-19db-488d-b4d1-308862703daa',
    query: 'Auto mal estacionado',
    localityName: 'Puerto Madero (CABA)',
    category: 'TRANSITO',
    runs: 5,
    esperado: 'antes del fix: 1/4 fundamentado, 3/4 No concluyente (Tabla 16 del diagnóstico) — con temperature 0, las 5 corridas deberían dar el MISMO estado',
  },
  {
    grupo: 'Punto 5',
    id: 'T-2',
    reportId: '558f59b4-7f93-4448-92ea-9ad1ce2c9401',
    query: 'Auto mal estacionado.',
    localityName: 'Puerto Madero (CABA)',
    category: 'TRANSITO',
    runs: 5,
    esperado: 'antes del fix: fundamentado (mismo texto que T-1 salvo el punto final) — el punto de comparación es que T-1 y T-2 deberían converger al mismo resultado ahora',
  },
  {
    grupo: 'Punto 5',
    id: 'T-3',
    reportId: '549dc328-2eb6-4851-a48e-5b719410edce',
    query: 'La camioneta está mal eatacionada',
    localityName: 'Almagro (CABA)',
    category: 'TRANSITO',
    runs: 5,
    esperado: 'antes del fix: No concluyente (Tabla 16) pese a que el art. 6.1.52 de la Ley 451 cubre "estacionar en forma antirreglamentaria" — la regla nueva del prompt debería resolverlo a fundamentado, consistente en las 5 corridas',
  },
  // --- Control positivo: no debería cambiar (ya andaba bien) ---
  {
    grupo: 'Control',
    id: 'T-4',
    reportId: '4cd77edf-bc66-40a7-8fe2-f2a52a99fff2',
    query: 'Auto estacionado en la mitad de la calle',
    localityName: 'Piñeyro (Avellaneda)',
    category: 'TRANSITO',
    runs: 3,
    esperado: 'fundamentado, Ley 24.449 arts. 48/49, en las 3 corridas — control de que el fix no rompió el caso que ya funcionaba',
  },
];

async function callAnalizarReporte({ reportId }) {
  const started = Date.now();
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'x-rag-dispatch-token': DISPATCH_TOKEN,
    },
    // Sin queueMessageId: no hay mensaje de pgmq que borrar (no vino de la cola real).
    body: JSON.stringify({ reportId }),
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
  return { ...json, ms: Date.now() - started };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`Función: ${FUNCTION_URL}\n`);
  const allResults = [];

  for (const testCase of CASES) {
    console.log(`\n${'='.repeat(100)}`);
    console.log(`[${testCase.grupo}] ${testCase.id} — "${testCase.query}" (${testCase.localityName} / ${testCase.category}) x${testCase.runs}`);
    console.log(`Esperado: ${testCase.esperado}`);
    console.log('='.repeat(100));

    const estados = [];
    for (let i = 1; i <= testCase.runs; i++) {
      try {
        const result = await callAnalizarReporte(testCase);
        estados.push(result.estado);
        allResults.push({
          grupo: testCase.grupo,
          caso: testCase.id,
          corrida: i,
          estado: result.estado,
          error: result.error ?? null,
          citas: (result.citas ?? []).map((c) => c.fragment_id),
          recuperados: result.retrievedFragmentIds ?? [],
          ms: result.ms,
        });
        console.log(
          `  [${i}/${testCase.runs}] estado=${result.estado}` +
            (result.error ? ` error="${result.error}"` : '') +
            ` recuperados=${(result.retrievedFragmentIds ?? []).length} citas=${(result.citas ?? []).length} (${result.ms} ms)`
        );
      } catch (err) {
        console.error(`  [${i}/${testCase.runs}] FALLO: ${err.message}`);
        allResults.push({ grupo: testCase.grupo, caso: testCase.id, corrida: i, estado: 'ERROR_HTTP', error: err.message });
      }
      await sleep(1500); // evitar rate limit de Gemini
    }

    const consistente = new Set(estados).size <= 1;
    console.log(`  → ${consistente ? '✅ consistente' : '⚠️  INCONSISTENTE'} (estados: ${[...new Set(estados)].join(', ')})`);
  }

  console.log(`\n${'='.repeat(100)}`);
  console.log('RESUMEN');
  console.log('='.repeat(100));
  console.log(JSON.stringify(allResults, null, 2));

  const fs = await import('node:fs');
  fs.writeFileSync(
    new URL('./resultados.json', import.meta.url),
    JSON.stringify(allResults, null, 2)
  );
  console.log('\nGuardado en scripts/rag-local-dev/rep3795/resultados.json');
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
