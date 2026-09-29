/**
 * @file generation-experiment.mjs
 * @description REP-3797 / REP-3795: prueba de GENERACIÓN de punta a punta (recuperación +
 * Gemini + validación), sin escribir nada en la base.
 *
 * Complementa retrieval-experiment.mjs, que solo mide si el fragmento correcto llega al
 * modelo. Acá se mide lo que importa: qué estado final y qué citas produce el sistema con
 * cada variante de recuperación, repitiendo cada caso para ver la variabilidad.
 *
 * Variantes (misma consulta y mismo umbral que analizar-reporte):
 *   k6         → k=6, como está hoy en producción (línea de base)
 *   k8         → k=8
 *   k6-sin-can → k=6 pero los fragmentos informativos (canales, teléfonos) no compiten
 *   ctx-k6     → k=6 con vectores calculados sobre `hierarchy_path + contenido`. Los vectores
 *                se calculan EN MEMORIA (no se guardan): la base sigue con los vectores actuales.
 *                Hipótesis a probar: el encabezado (ley, artículo) le da contexto a fragmentos
 *                cortos; ver context-embedding-experiment.mjs para la prueba de recuperación.
 *
 * Para no desviarse de la función real, el prompt, el esquema de salida y las constantes
 * (modelo, temperatura, tope de tokens) se LEEN de supabase/functions/analizar-reporte/index.ts
 * al ejecutar; el validador es el espejo testeado (src/services/validateLlmAnalysis.js).
 * Si index.ts cambia de forma que no se pueda leer, el script aborta en vez de adivinar.
 *
 * Variante k8-excepciones (REGLA_EXCEPCIONES): prueba una regla candidata para el prompt (v3, NO está en
 * index.ts): si un fragmento citado trae una excepción o condición, la respuesta tiene que mencionarla
 * y no afirmar una prohibición absoluta; y no inventar excepciones. Se compara contra 'k8' (producción
 * hoy). Casos con excepción real: vecino-vereda-avellaneda (Ley 24.449 art. 49 b.3) y sumidero-caba
 * (Ley 451 art. 1.3.2.3.4). Para correr solo la comparación relevante:
 *   $env:VARIANT = "k8,k8-excepciones"
 * OJO: la detección de excepciones es por palabras clave (heurística); revisar la muestra impresa a mano.
 *
 * Solo lectura sobre Supabase (RPC match_knowledge_fragments, SELECT a agencies,
 * knowledge_sources y embedding_models). Gasta llamadas a Gemini: 8 embeddings de consultas,
 * unas decenas de embeddings de fragmentos (variante con encabezado) y 8 casos × 4 variantes
 * × RUNS generaciones (RUNS=3 por defecto → 120 con las 5 variantes). VARIANT="k6,k8-sin-can"
 * corre solo esas (p. ej. 2 variantes → 48 generaciones).
 *
 * Uso (PowerShell, con las claves cargadas SOLO en esa terminal):
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "..."
 *   $env:GEMINI_API_KEY = "..."
 *   node scripts/rag-local-dev/rep3797/generation-experiment.mjs
 *   # opcional: $env:RUNS = "1"   (prueba rápida)  ·  $env:CASE = "luz-quemada" (un solo caso)
 */

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { validateLlmAnalysis } from '../../../src/services/validateLlmAnalysis.js';

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

// --- lectura de la función real -------------------------------------------------------

function readFunctionConfig() {
  const source = fs.readFileSync(new URL('supabase/functions/analizar-reporte/index.ts', REPO_ROOT), 'utf-8').replace(/\r\n/g, '\n');

  const between = (start, end, label) => {
    const from = source.indexOf(start);
    if (from === -1) throw new Error(`No se encontró "${label}" en index.ts: la función cambió, actualizá el script.`);
    const to = source.indexOf(end, from);
    if (to === -1) throw new Error(`No se encontró el cierre de "${label}" en index.ts.`);
    return source.slice(from + start.length, to);
  };
  const evalLiteral = (text, label) => {
    try {
      return new Function(`return (${text});`)();
    } catch (error) {
      throw new Error(`No se pudo leer "${label}" de index.ts: ${error.message}`);
    }
  };
  const constant = (regex, label) => {
    const match = source.match(regex);
    if (!match) throw new Error(`No se encontró la constante ${label} en index.ts.`);
    return match[1];
  };

  const instructionsArray = evalLiteral(`[${between("const instructions = [", "].join('\\n');", 'instructions')}]`, 'instructions');
  const outputSchema = evalLiteral(`{${between('const LLM_OUTPUT_SCHEMA = {', '\n};', 'LLM_OUTPUT_SCHEMA')}\n}`, 'LLM_OUTPUT_SCHEMA');

  return {
    instructions: instructionsArray.join('\n'),
    outputSchema,
    generationModel: constant(/const GENERATION_MODEL = '([^']+)'/, 'GENERATION_MODEL'),
    temperature: Number(constant(/const GENERATION_TEMPERATURE = (\d+(?:\.\d+)?);/, 'GENERATION_TEMPERATURE')),
    maxOutputTokens: Number(constant(/maxOutputTokens: (\d+),/, 'maxOutputTokens')),
    thinkingLevel: constant(/thinkingConfig: \{ thinkingLevel: '([^']+)' \}/, 'thinkingLevel'),
    promptVersion: constant(/const PROMPT_VERSION = '([^']+)'/, 'PROMPT_VERSION'),
    embeddingModel: constant(/const EMBEDDING_MODEL = '([^']+)'/, 'EMBEDDING_MODEL'),
    embeddingModelCode: constant(/const EMBEDDING_MODEL_CODE = '([^']+)'/, 'EMBEDDING_MODEL_CODE'),
    embeddingDimensions: Number(constant(/const EMBEDDING_DIMENSIONS = (\d+);/, 'EMBEDDING_DIMENSIONS')),
    matchCount: Number(constant(/const DEFAULT_MATCH_COUNT = (\d+);/, 'DEFAULT_MATCH_COUNT')),
    threshold: Number(constant(/const DEFAULT_SIMILARITY_THRESHOLD = ([\d.]+);/, 'DEFAULT_SIMILARITY_THRESHOLD')),
  };
}

// --- casos ------------------------------------------------------------------------------

const LOCALITY = {
  PUERTO_MADERO: 'e025128c-3ec9-46d7-987a-1eaf0cffebb4', // CABA
  BALVANERA: 'ffa721a3-f9a9-4c88-9861-bf907727e4e9', // CABA
  PINEYRO: '90079a38-1e7e-45d6-8fbf-60140bee9b8d', // Avellaneda
};

// `expected`: fragmentos que fundamentan el caso (ids verificados contra la base el 29/09/2026).
const CASES = [
  { id: 'auto-mal-estacionado', regresion: true, text: 'Auto mal estacionado', locality: LOCALITY.PUERTO_MADERO, category: 'TRANSITO',
    expected: { 'Faltas 6.1.52': '20000000-0000-4000-8000-000000000013' } },
  { id: 'luz-quemada', regresion: true, text: 'La luz de la calle está quemada hace más de un mes y de noche no se ve nada', locality: LOCALITY.BALVANERA, category: 'INFRAESTRUCTURA',
    expected: { 'Ley 210 art. 2 b': '20000000-0000-4000-8000-000000000005', 'Ley 210 art. 3 j': '20000000-0000-4000-8000-000000000004' } },
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
  // Casos cuyo fragmento esperado trae una EXCEPCIÓN real (para la prueba de la regla de excepciones):
  //  - Ley 24.449 art. 49 b.3 (texto completo): «No obstante se puede autorizar, señal mediante, a estacionar
  //    en la parte externa de la vereda cuando su ancho sea mayor a 2,00 metros…»
  //  - Ley 451 art. 1.3.2.3.4: vuelco en sumideros «a excepción de aguas pluviales o superficiales»
  { id: 'vecino-vereda-avellaneda', regresion: false, conExcepcion: true, text: 'Un vecino se sube con el auto a la vereda todos los días y me tapa la entrada del garage', locality: LOCALITY.PINEYRO, category: 'TRANSITO',
    expected: { 'Ley 24.449 art. 49 b.3 (con excepción)': '60000000-0000-4000-8000-000000000040', 'Ley 24.449 art. 49 b.1': '20000000-0000-4000-8000-000000000009' } },
  { id: 'sumidero-caba', regresion: false, conExcepcion: true, text: 'Están tirando aceite y basura por el desagüe de la vereda', locality: LOCALITY.BALVANERA, category: 'AMBIENTE',
    expected: { 'Faltas 1.3.2.3.4 (vuelco en sumideros)': '40000000-0000-4000-8000-000000000043' } },
];

// --- regla de excepciones (candidata a PROMPT_VERSION v3; NO está en index.ts) ---------------
// Objetivo: cuando un fragmento citado trae una excepción o condición, la respuesta no puede afirmar
// una prohibición u obligación absoluta; y no debe inventar excepciones que el fragmento no tiene.
const REGLA_EXCEPCIONES =
  'Si un fragmento que citás contiene una excepción, condición o salvedad ("no obstante", "salvo", "excepto", "a excepción de", "siempre que"), tenés que mencionarla en fundamento_ciudadano y en fundamento_oficial, y no afirmar una prohibición u obligación absoluta. Incluí esa parte del texto en la cita_textual. Si ninguno de los fragmentos que citás trae una excepción, no agregues ni supongas ninguna.';

// Marcadores (heurística, NO es validación jurídica):
//  - en el TEXTO DE LOS FRAGMENTOS: excepción real ("sin perjuicio de" es una referencia cruzada, no cuenta)
const EXCEPCION_EN_FRAGMENTO = /(no obstante|salvo |excepto |a excepci[oó]n|excepci[oó]n)/i;
//  - en la RESPUESTA del modelo: menciona una salvedad
const EXCEPCION_EN_RESPUESTA = /(no obstante|salvo|excepto|excepci[oó]n|siempre que|se puede autorizar|puede autorizarse|ancho)/i;

const ALL_VARIANTS = [
  { id: 'k6', label: 'k=6 (hoy)', k: 6, excludeInfo: false },
  { id: 'k8', label: 'k=8', k: 8, excludeInfo: false },
  { id: 'k6-sin-can', label: 'k=6 sin canales', k: 6, excludeInfo: true },
  // Vectores calculados en memoria sobre `hierarchy_path + contenido` (no se guardan en la base)
  { id: 'ctx-k6', label: 'encabezado k=6', k: 6, excludeInfo: false, contextual: true },
  // Combinada: 8 fragmentos y los canales/teléfonos no compiten por los lugares. OJO: en la
  // prueba los canales quedan FUERA del contexto del modelo; en producción habría que
  // entregarlos por otro camino (determinístico, según categoría y jurisdicción).
  { id: 'k8-sin-can', label: 'k=8 sin canales', k: 8, excludeInfo: true },
  // Producción hoy es k=8 con el prompt v2 (variante 'k8'). Esta suma la regla de excepciones al prompt.
  { id: 'k8-excepciones', label: 'k=8 + regla de excepciones', k: 8, excludeInfo: false, extraInstruction: REGLA_EXCEPCIONES },
];

// Para no repetir corridas ya hechas: VARIANT="k6,k8-sin-can" corre solo esas (por defecto, todas).
const selectedIds = process.env.VARIANT ? process.env.VARIANT.split(',').map((id) => id.trim()).filter(Boolean) : null;
if (selectedIds) {
  const unknown = selectedIds.filter((id) => !ALL_VARIANTS.some((v) => v.id === id));
  if (unknown.length > 0) {
    throw new Error(`VARIANT con ids desconocidos: ${unknown.join(', ')}. Válidos: ${ALL_VARIANTS.map((v) => v.id).join(', ')}`);
  }
}
const VARIANTS = selectedIds ? ALL_VARIANTS.filter((v) => selectedIds.includes(v.id)) : ALL_VARIANTS;

// --- variante con encabezado (utilidades puras, mismas que context-embedding-experiment.mjs) ---

const cosine = (a, b) => {
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
const withContext = (fragment) => `${fragment.hierarchy_path}\n\n${fragment.content}`;

// --- llamadas -------------------------------------------------------------------------

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function geminiFetch(url, body, apiKey, label) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    lastError = new Error(`${label} falló (${res.status}): ${(await res.text()).slice(0, 200)}`);
    if (![429, 500, 503].includes(res.status)) break;
    await sleep(1500 * attempt);
  }
  throw lastError;
}

async function embedText(config, apiKey, text) {
  const data = await geminiFetch(
    `${GEMINI_API_BASE}/models/${config.embeddingModel}:embedContent`,
    { model: `models/${config.embeddingModel}`, content: { parts: [{ text }] }, outputDimensionality: config.embeddingDimensions },
    apiKey,
    'embedContent'
  );
  const values = data?.embedding?.values;
  if (!Array.isArray(values) || values.length !== config.embeddingDimensions) throw new Error('vector inválido');
  return values;
}

// Misma construcción que generateJustification de index.ts
async function generate(config, apiKey, { reportText, category, fragments, extraInstruction }) {
  const fragmentsBlock = fragments
    .map((f, i) => `[${i + 1}] fragment_id=${f.fragment_id}\n${f.hierarchy_path}\n"""${f.content}"""`)
    .join('\n\n');
  // La regla candidata se agrega al final de las instrucciones reales (leídas de index.ts)
  const instructions = extraInstruction ? `${config.instructions}\n${extraInstruction}` : config.instructions;
  const text = `${instructions}\n\nCategoría elegida por el ciudadano: ${category ?? 'sin categoría'}\n\nReclamo:\n"""${reportText}"""\n\nFragmentos recuperados:\n${fragmentsBlock}`;

  const data = await geminiFetch(
    `${GEMINI_API_BASE}/models/${config.generationModel}:generateContent`,
    {
      model: `models/${config.generationModel}`,
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: config.outputSchema,
        thinkingConfig: { thinkingLevel: config.thinkingLevel },
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
      },
    },
    apiKey,
    'generateContent'
  );
  const candidate = data?.candidates?.[0];
  const jsonText = candidate?.content?.parts?.[0]?.text;
  if (!jsonText) throw new Error(`sin contenido JSON (finishReason: ${candidate?.finishReason ?? '?'})`);
  const usage = data?.usageMetadata ?? {};
  return { parsed: JSON.parse(jsonText), inputTokens: usage.promptTokenCount ?? null, outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0) };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function validateOrganismo(db, id) {
  if (id === null || id === undefined || id === '' || String(id).trim().toLowerCase() === 'null') return { valid: true };
  if (!UUID_PATTERN.test(id)) return { valid: false, reason: `organismo_sugerido_id "${id}" no es un UUID válido.` };
  const { data, error } = await db.from('agencies').select('id').eq('id', id).maybeSingle();
  if (error || !data) return { valid: false, reason: `organismo_sugerido_id "${id}" no corresponde a ningún organismo registrado.` };
  return { valid: true };
}

// Una corrida completa de una variante: devuelve lo que guardaría la función (sin guardarlo)
async function runOnce(db, config, apiKey, testCase, pool, variant, informativeSourceIds) {
  // Variante con encabezado: se ordena y se aplica el umbral con la similitud calculada sobre
  // `hierarchy_path + contenido`; en las demás, con la similitud que devuelve la base.
  const ranked = variant.contextual
    ? [...pool].sort((a, b) => b.ctxSimilarity - a.ctxSimilarity).filter((f) => f.ctxSimilarity >= config.threshold)
    : pool.filter((f) => f.similarity >= config.threshold);
  const candidates = ranked.filter((f) => !(variant.excludeInfo && informativeSourceIds.has(f.source_id)));
  const eligible = candidates.slice(0, variant.k);
  if (eligible.length === 0) return { estado: 'sin_normativa', citedIds: [], recovered: 0, motivo: 'sin fragmentos sobre el umbral (sin llamada al modelo)' };

  const generation = await generate(config, apiKey, { reportText: testCase.text, category: testCase.category, fragments: eligible, extraInstruction: variant.extraInstruction });
  const validation = validateLlmAnalysis(generation.parsed, eligible, testCase.category);
  const organismo = validation.valid ? await validateOrganismo(db, generation.parsed.organismo_sugerido_id) : { valid: true };

  const base = { recovered: eligible.length, inputTokens: generation.inputTokens, outputTokens: generation.outputTokens, modelEstado: generation.parsed.estado };
  if (!validation.valid) return { ...base, estado: 'indeterminado', citedIds: [], motivo: validation.reason.slice(0, 140) };
  if (!organismo.valid) return { ...base, estado: 'indeterminado', citedIds: [], motivo: organismo.reason.slice(0, 140) };
  const citas = generation.parsed.citas ?? [];
  const citedIds = citas.map((c) => c.fragment_id);
  const citedFragments = eligible.filter((f) => citedIds.includes(f.fragment_id));
  const respuesta = `${generation.parsed.fundamento_ciudadano ?? ''} ${generation.parsed.fundamento_oficial ?? ''}`;
  return {
    ...base,
    estado: generation.parsed.estado,
    citedIds,
    motivo: null,
    // Métricas de excepciones (heurística por palabras clave; ver EXCEPCION_EN_*)
    fragmentoTraeExcepcion: citedFragments.some((f) => EXCEPCION_EN_FRAGMENTO.test(f.content)),
    citaIncluyeExcepcion: citas.some((c) => EXCEPCION_EN_FRAGMENTO.test(c.cita_textual ?? '')),
    respuestaMencionaExcepcion: EXCEPCION_EN_RESPUESTA.test(respuesta),
    muestra: { ciudadano: generation.parsed.fundamento_ciudadano ?? '', oficial: generation.parsed.fundamento_oficial ?? '', citas: citas.map((c) => c.cita_textual) },
  };
}

// --- principal -----------------------------------------------------------------------

async function main() {
  loadDotEnv();

  if (process.argv.includes('--check')) {
    // Sin red ni claves: solo muestra lo que se leyó de index.ts.
    const config = readFunctionConfig();
    console.log(`Modelo de generación: ${config.generationModel} · prompt ${config.promptVersion} · temperature ${config.temperature}`);
    console.log(`thinkingLevel ${config.thinkingLevel} · maxOutputTokens ${config.maxOutputTokens} · k ${config.matchCount} · umbral ${config.threshold}`);
    console.log(`Embeddings: ${config.embeddingModelCode} (${config.embeddingModel}, ${config.embeddingDimensions} dim)`);
    console.log(`Instrucciones: ${config.instructions.split('\n').length} reglas, ${config.instructions.length} caracteres`);
    console.log(`  primera: ${config.instructions.split('\n')[0].slice(0, 90)}…`);
    console.log(`  última:  ${config.instructions.split('\n').at(-1).slice(0, 90)}…`);
    console.log(`Esquema de salida: campos ${Object.keys(config.outputSchema.properties).join(', ')} · requeridos ${config.outputSchema.required.length}`);
    // Autotest de las utilidades de la variante con encabezado (sin red)
    const close = (x, y) => Math.abs(x - y) < 1e-12;
    if (!close(cosine([1, 0], [1, 0]), 1) || !close(cosine([1, 0], [0, 1]), 0) || !close(cosine([2, 0], [5, 0]), 1)) throw new Error('autotest de cosine falló');
    if (withContext({ hierarchy_path: 'Ley X > Art 1', content: 'texto' }) !== 'Ley X > Art 1\n\ntexto') throw new Error('autotest de withContext falló');
    // Autotest de las heurísticas de excepciones (lo más frágil de la medición)
    const debe = (condicion, texto) => { if (!condicion) throw new Error(`autotest de excepciones falló: ${texto}`); };
    debe(EXCEPCION_EN_FRAGMENTO.test('Tampoco se admite la detención voluntaria. No obstante se puede autorizar, señal mediante, a estacionar en la parte externa de la vereda'), 'no detecta la excepción del art. 49 b.3');
    debe(EXCEPCION_EN_FRAGMENTO.test('vuelco en sumideros, a excepción de aguas pluviales o superficiales'), 'no detecta "a excepción de"');
    debe(!EXCEPCION_EN_FRAGMENTO.test('Queda prohibido estacionar con carácter general en los siguientes sitios, sin perjuicio de lo establecido en los artículos 7.1.2 y 7.1.3'), '"sin perjuicio de" no es una excepción');
    debe(!EXCEPCION_EN_FRAGMENTO.test('El/la que venda mercaderías en la vía pública sin permiso o en infracción con la autorización otorgada'), 'la palabra "autorización" no es una excepción');
    debe(EXCEPCION_EN_RESPUESTA.test('No está permitido estacionar en la vereda salvo que exista señalización expresa que lo autorice'), 'no detecta "salvo" en la respuesta');
    debe(EXCEPCION_EN_RESPUESTA.test('se puede autorizar a estacionar cuando el ancho de la vereda es mayor a 2 metros'), 'no detecta "se puede autorizar"');
    debe(!EXCEPCION_EN_RESPUESTA.test('Está prohibido vender mercaderías en la vía pública sin permiso o autorización de la autoridad'), 'la palabra "autorización" sola no es una salvedad');
    console.log(`Variantes: ${VARIANTS.map((v) => v.label).join(' · ')}`);
    console.log('Autotest de coseno, encabezado y heurísticas de excepciones: OK');
    return;
  }

  const url =process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!url) throw new Error('Falta SUPABASE_URL (o VITE_SUPABASE_URL)');
  if (!serviceKey) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY');
  if (!geminiKey) throw new Error('Falta GEMINI_API_KEY');

  const runs = Math.max(1, Number(process.env.RUNS || 3));
  const cases = process.env.CASE ? CASES.filter((c) => c.id === process.env.CASE) : CASES;
  if (cases.length === 0) throw new Error(`CASE "${process.env.CASE}" no existe.`);

  const config = readFunctionConfig();
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: activeModel, error: modelError } = await db.from('embedding_models').select('code').eq('is_active', true).maybeSingle();
  if (modelError) throw modelError;
  if (activeModel?.code !== config.embeddingModelCode) {
    throw new Error(`El modelo activo es ${activeModel?.code}, no ${config.embeddingModelCode}: no se reproduciría la función.`);
  }
  const { data: infoSources, error: infoError } = await db.from('knowledge_sources').select('id').eq('source_type_code', 'informacion');
  if (infoError) throw infoError;
  const informativeSourceIds = new Set(infoSources.map((row) => row.id));

  console.log(`Función leída de index.ts: modelo ${config.generationModel} · prompt ${config.promptVersion} · temperature ${config.temperature} · k ${config.matchCount} · umbral ${config.threshold}`);
  console.log(`Casos: ${cases.length} · variantes: ${VARIANTS.length} · corridas por variante: ${runs} · llamadas de generación: ${cases.length * VARIANTS.length * runs}\n`);

  const results = [];
  const contextVectorCache = new Map(); // fragment_id -> vector con encabezado (solo en memoria)

  for (const testCase of cases) {
    const queryText = `${testCase.text.trim()} (categoría: ${testCase.category})`;
    const embedding = await embedText(config, geminiKey, queryText);
    // match_count 200: trae TODOS los fragmentos elegibles (cascada + categoría), ordenados por
    // la similitud actual; k y el umbral se aplican después, por variante.
    const { data: fetchedPool, error } = await db.rpc('match_knowledge_fragments', {
      query_embedding: embedding, p_locality_id: testCase.locality, p_model_code: config.embeddingModelCode, match_count: 200, p_service_code: testCase.category,
    });
    if (error) throw new Error(`RPC falló (${testCase.id}): ${error.message}`);
    let pool = fetchedPool;

    // Vectores con encabezado (en memoria, con caché entre casos): solo si alguna variante los usa
    if (VARIANTS.some((v) => v.contextual)) {
      for (const fragment of pool) {
        if (!contextVectorCache.has(fragment.fragment_id)) {
          contextVectorCache.set(fragment.fragment_id, await embedText(config, geminiKey, withContext(fragment)));
        }
      }
      pool = pool.map((f) => ({ ...f, ctxSimilarity: cosine(embedding, contextVectorCache.get(f.fragment_id)) }));
    }

    console.log(`=== ${testCase.id}${testCase.regresion ? '  [REGRESIÓN observada]' : ''}`);
    const expectedIds = Object.values(testCase.expected);

    for (const variant of VARIANTS) {
      const outcomes = [];
      for (let run = 1; run <= runs; run += 1) {
        try {
          outcomes.push(await runOnce(db, config, geminiKey, testCase, pool, variant, informativeSourceIds));
        } catch (error2) {
          outcomes.push({ estado: 'ERROR', citedIds: [], motivo: String(error2.message).slice(0, 140), recovered: 0 });
        }
      }
      const byState = outcomes.reduce((acc, o) => ({ ...acc, [o.estado]: (acc[o.estado] ?? 0) + 1 }), {});
      const citedExpected = outcomes.filter((o) => o.citedIds.some((id) => expectedIds.includes(id))).length;
      const tokens = outcomes.filter((o) => o.inputTokens != null);
      const avgIn = tokens.length ? Math.round(tokens.reduce((s, o) => s + o.inputTokens, 0) / tokens.length) : null;
      const reasons = [...new Set(outcomes.map((o) => o.motivo).filter(Boolean))];
      console.log(
        `    ${variant.label.padEnd(16)} estados: ${Object.entries(byState).map(([k, v]) => `${k}×${v}`).join(', ')}` +
          ` | citó un esperado: ${citedExpected}/${runs}` +
          ` | fragmentos al modelo: ${outcomes[0].recovered}` +
          `${avgIn ? ` | tokens entrada ~${avgIn}` : ''}`
      );
      for (const reason of reasons) console.log(`        motivo: ${reason}`);

      // Excepciones: solo cuentan las corridas que llegaron a generar respuesta con citas
      const generadas = outcomes.filter((o) => o.fragmentoTraeExcepcion !== undefined);
      const conExc = generadas.filter((o) => o.fragmentoTraeExcepcion);
      const sinExc = generadas.filter((o) => !o.fragmentoTraeExcepcion);
      const exc = {
        conExcepcion: conExc.length,
        conExcepcionMencionada: conExc.filter((o) => o.respuestaMencionaExcepcion).length,
        conExcepcionCitada: conExc.filter((o) => o.citaIncluyeExcepcion).length,
        sinExcepcion: sinExc.length,
        sinExcepcionMencionada: sinExc.filter((o) => o.respuestaMencionaExcepcion).length,
      };
      if (conExc.length > 0 || sinExc.length > 0) {
        console.log(
          `        excepciones: lo citado trae una en ${exc.conExcepcion} corrida(s) → la respuesta la menciona ${exc.conExcepcionMencionada}, la cita la incluye ${exc.conExcepcionCitada}` +
            ` | sin excepción en lo citado ${exc.sinExcepcion} → menciona igual ${exc.sinExcepcionMencionada} (posible invención)`
        );
      }
      // Para revisar a mano: texto al ciudadano de la primera corrida en los casos con excepción
      if (testCase.conExcepcion) {
        const muestra = outcomes.find((o) => o.muestra)?.muestra;
        if (muestra) console.log(`        muestra (ciudadano): ${muestra.ciudadano.slice(0, 330).replace(/\s+/g, ' ')}`);
      }
      results.push({ caso: testCase.id, regresion: testCase.regresion, variante: variant.id, byState, citedExpected, runs, avgIn, reasons, exc, muestra: outcomes.find((o) => o.muestra)?.muestra ?? null });
    }
    console.log('');
  }

  // Totales de excepciones por variante (todas las corridas de todos los casos)
  console.log('--- EXCEPCIONES por variante (heurística por palabras clave; NO es validación jurídica) ---');
  for (const variant of VARIANTS) {
    const filas = results.filter((r) => r.variante === variant.id);
    const suma = (campo) => filas.reduce((total, r) => total + r.exc[campo], 0);
    console.log(
      `${variant.label.padEnd(30)} | con excepción en lo citado: ${suma('conExcepcion')} corridas → mencionada ${suma('conExcepcionMencionada')}, citada ${suma('conExcepcionCitada')}` +
        ` | sin excepción: ${suma('sinExcepcion')} corridas → menciona igual ${suma('sinExcepcionMencionada')} (posible invención)`
    );
  }
  console.log('');

  console.log('--- RESUMEN (por caso y variante: estados | citó un esperado) ---');
  console.log('caso | ' + VARIANTS.map((v) => v.label).join(' | '));
  for (const testCase of cases) {
    const cells = VARIANTS.map((variant) => {
      const row = results.find((r) => r.caso === testCase.id && r.variante === variant.id);
      return `${Object.entries(row.byState).map(([k, v]) => `${k}×${v}`).join(',')} | esp ${row.citedExpected}/${row.runs}`;
    });
    console.log(`${testCase.regresion ? '* ' : ''}${testCase.id} | ${cells.join(' | ')}`);
  }
  console.log('\n(* = caso que empeoró tras el lote 2)');
  console.log('Solo lectura sobre Supabase. "citó un esperado" = alguna cita cae en un fragmento esperado; no es validación jurídica.');
  fs.writeFileSync(new URL('scripts/rag-local-dev/rep3797/generation-experiment-results.json', REPO_ROOT), JSON.stringify(results, null, 2));
  console.log('Detalle guardado en scripts/rag-local-dev/rep3797/generation-experiment-results.json (no versionado).');
}

main().catch((error) => {
  console.error(`\nERROR: ${error.message}`);
  process.exit(1);
});
