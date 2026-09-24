// REP-3790 · Corredor del spike. Protocolo: Confluence «REP-3790: Protocolo del spike».
// Uso: node run-spike.mjs [--reps 3] [--cases 01,02,...] [--variants T,I]
//
// T (control): texto equivalente → vector → recuperación → mismo prompt y generación que REP-3786.
// I:           foto anonimizada → hechos observables (JSON) → su texto_reclamo → el mismo camino.
// Entre T e I solo cambia el origen del texto: misma localidad, categoría, corpus, top-k 6,
// umbral 0.45, thinking low y maxOutputTokens 2048.
//
// Cada corrida se agrega a raw/runs.ndjson al terminar: si se corta, al volver a correr retoma.
import fs from 'node:fs';
import {
  readJson, fileUrl, loadCorpus, embedText, retrieve, buildPrompt, callGemini, callGeminiWithImage,
  validate, THINKING, MAX_OUTPUT_TOKENS,
} from './lib.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), [])
);
const REPS = Number(args.reps ?? 3);
const { casos } = readJson('casos.json');
const caseIds = (args.cases ?? casos.map((c) => c.id).join(',')).split(',');
const variants = (args.variants ?? 'T,I').split(',');

const { fragments, db } = loadCorpus();
const fragmentVectors = readJson('raw/fragment-vectors.json');

// Extracción: solo hechos observables. Nada de leyes, intenciones ni identificación de personas.
export const EXTRACTION_PROMPT = [
  'Sos un asistente que describe fotografías de la vía pública para un sistema de reclamos vecinales.',
  'Describí ÚNICAMENTE lo que se ve en la imagen. Reglas estrictas:',
  '- No menciones leyes, normas, artículos, multas ni si algo es legal o ilegal.',
  '- No supongas intenciones, causas ni hechos que no se vean (por ejemplo, cuánto tiempo lleva algo así).',
  '- No identifiques ni describas rasgos de personas: a lo sumo, que hay personas y qué hacen. Las zonas pixeladas son anonimización, no las describas.',
  '- Si algo no se puede determinar con la imagen, ponelo en "incertidumbres".',
  '- Si no se ve ningún problema en la vía pública, decilo: "hay_problema_visible" en false.',
  '"texto_reclamo" es una descripción breve (una o dos oraciones, en castellano rioplatense, como la escribiría un vecino) de lo que se ve, sin interpretar la ley.',
].join('\n');

export const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    hechos_observables: { type: 'array', items: { type: 'string' } },
    hay_problema_visible: { type: 'boolean' },
    categoria_probable: { type: 'string', enum: ['TRANSITO', 'INFRAESTRUCTURA', 'AMBIENTE', 'OTRO', 'NINGUNA'] },
    incertidumbres: { type: 'array', items: { type: 'string' } },
    texto_reclamo: { type: 'string' },
  },
  required: ['hechos_observables', 'hay_problema_visible', 'categoria_probable', 'incertidumbres', 'texto_reclamo'],
};

const extractFacts = async (caso) => {
  const image = fs.readFileSync(fileUrl(`fotos/anonimizadas/${caso.foto}`)).toString('base64');
  const r = await callGeminiWithImage({
    imageBase64: image, mimeType: 'image/jpeg', prompt: EXTRACTION_PROMPT, responseSchema: EXTRACTION_SCHEMA, maxOutputTokens: 1024,
  });
  const cand = r.data?.candidates?.[0];
  const usage = r.data?.usageMetadata ?? {};
  let facts = null;
  let failure = null;
  if (!r.ok) failure = 'error_api';
  else if (cand?.finishReason === 'MAX_TOKENS') failure = 'truncado';
  else {
    try { facts = JSON.parse(cand?.content?.parts?.map((p) => p.text).join('') ?? ''); } catch { failure = 'json_invalido'; }
    if (facts && !facts.texto_reclamo?.trim()) failure = 'sin_texto';
  }
  return {
    facts, failure, latencyMs: Math.round(r.latencyMs), attempts: r.attempts, error: r.errorText,
    promptTokens: usage.promptTokenCount ?? null,
    imageTokens: usage.promptTokensDetails?.find((d) => d.modality === 'IMAGE')?.tokenCount ?? null,
    outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
  };
};

// Mismo tramo que analizar-reporte a partir del texto: vector, recuperación y generación
const ragFromText = async (caso, text) => {
  const emb = await embedText(text);
  const started = performance.now();
  const hits = retrieve({ queryVector: emb.values, fragmentVectors, db, locality: caso.localidad, category: caso.categoria });
  const retrievalMs = performance.now() - started;
  const retrieved = hits.map((h) => fragments[h.id]);

  // Como la función: sin fragmentos elegibles no se llama al modelo
  if (!retrieved.length) {
    return { emb, retrievalMs, hits, retrieved, gen: null, parsed: { estado: 'sin_normativa', citas: [] }, technicalFailure: null };
  }
  const prompt = buildPrompt({ reportText: text, category: caso.categoria, fragments: retrieved, concise: false });
  const gen = await callGemini({ prompt, thinkingConfig: THINKING, maxOutputTokens: MAX_OUTPUT_TOKENS });
  const cand = gen.data?.candidates?.[0];
  let parsed = null;
  let technicalFailure = null;
  if (!gen.ok) technicalFailure = 'error_api';
  else if (cand?.finishReason === 'MAX_TOKENS') technicalFailure = 'truncado';
  else {
    try { parsed = JSON.parse(cand?.content?.parts?.[0]?.text ?? ''); } catch { technicalFailure = 'json_invalido'; }
  }
  if (parsed && !technicalFailure && !validate(parsed, retrieved).valid) technicalFailure = 'validacion';
  return { emb, retrievalMs, hits, retrieved, gen, parsed: technicalFailure ? { estado: 'indeterminado', citas: [] } : parsed, technicalFailure };
};

// Orden intercalado reproducible (mismo PRNG que REP-3786)
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const random = rng(3790);
const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const runsFile = fileUrl('raw/runs.ndjson');
const done = new Set(
  fs.existsSync(runsFile)
    ? fs.readFileSync(runsFile, 'utf-8').split('\n').filter(Boolean).map((l) => { const r = JSON.parse(l); return `${r.case}|${r.variant}|${r.rep}`; })
    : []
);

const total = REPS * caseIds.length * variants.length;
let n = 0;
for (let rep = 1; rep <= REPS; rep += 1) {
  for (const id of caseIds) {
    const caso = casos.find((c) => c.id === id);
    for (const variant of shuffle(variants)) {
      n += 1;
      if (done.has(`${id}|${variant}|${rep}`)) continue;

      let extraction = null;
      let text = caso.texto;
      if (variant === 'I') {
        extraction = await extractFacts(caso);
        text = extraction.facts?.texto_reclamo ?? null;
      }

      let rag = null;
      if (text) rag = await ragFromText(caso, text);
      const usage = rag?.gen?.data?.usageMetadata ?? {};
      const stageMs = {
        extraccion: extraction?.latencyMs ?? 0,
        vector: Math.round(rag?.emb?.latencyMs ?? 0),
        recuperacion: Math.round(rag?.retrievalMs ?? 0),
        generacion: Math.round(rag?.gen?.latencyMs ?? 0),
      };

      const line = {
        ts: new Date().toISOString(), case: id, variant, rep,
        texto: text,
        extraccion: extraction && {
          fallo: extraction.failure, error: extraction.error, intentos: extraction.attempts,
          tokensEntrada: extraction.promptTokens, tokensImagen: extraction.imageTokens, tokensSalida: extraction.outputTokens,
          hechos: extraction.facts,
        },
        recuperados: rag?.hits.map((h) => ({ id: h.id, ruta: fragments[h.id].hierarchy_path, similitud: +h.similarity.toFixed(4) })) ?? [],
        fallaTecnica: extraction?.failure ?? rag?.technicalFailure ?? null,
        tokensEntradaGeneracion: usage.promptTokenCount ?? null,
        tokensSalidaGeneracion: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
        latenciaMs: stageMs,
        latenciaTotalMs: Object.values(stageMs).reduce((a, b) => a + b, 0),
        estado: rag?.parsed?.estado ?? 'indeterminado',
        es_infraccion: rag?.parsed?.es_infraccion ?? null,
        citas: (rag?.parsed?.citas ?? []).map((c) => ({ id: c.fragment_id, ruta: fragments[c.fragment_id]?.hierarchy_path ?? null, cita: c.cita_textual })),
        fundamento_ciudadano: rag?.parsed?.fundamento_ciudadano ?? null,
      };
      fs.appendFileSync(runsFile, JSON.stringify(line) + '\n');
      console.error(`[${n}/${total}] rep${rep} ${id} ${variant} ${String(line.estado).padEnd(16)} citas=${line.citas.length} ${line.latenciaTotalMs}ms${line.fallaTecnica ? ' !' + line.fallaTecnica : ''}`);
      await new Promise((res) => setTimeout(res, 250));
    }
  }
}
console.error('Listo.');
