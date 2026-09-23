// REP-3786 · Corredor del experimento (Fases 1 y 2).
// Uso: node run-experiment.mjs [--reps 5] [--configs BASE,A,B,C,BASE+,A+,B+,C+] [--cases A,B,...]
// - Recuperación: subconjuntos derivados de la recuperación k=6 (phase0-analysis.json).
// - El orden de las configuraciones se intercala dentro de cada repetición (semilla fija).
// - Cada corrida se agrega a raw/runs.ndjson al terminar: si se corta, al volver a correr retoma sin repetir.
import fs from 'node:fs';
import { buildPrompt, callGemini } from './gemini-call.mjs';
import { countWords, countSentences } from './evaluate.mjs';

const dir = new URL('./', import.meta.url);
const readJson = (p) => JSON.parse(fs.readFileSync(new URL(p, dir), 'utf-8'));

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), [])
);
const REPS = Number(args.reps ?? 5);

const fragments = readJson('fragments.json');
const retrieval = readJson('phase0-analysis.json');
const thinkingMode = readJson('raw/thinking-mode.json');

// «Desactivado»: el modo que la sonda verificó con thoughts = 0 (si no hay, se usa el nivel mínimo y así se informa)
const THINKING_OFF = thinkingMode.chosen?.thinkingConfig ?? { thinkingLevel: 'minimal' };
const THINKING = { low: { thinkingLevel: 'low' }, off: THINKING_OFF };

const CONFIGS = {
  BASE: { retrieval: 'BASE', thinking: 'low', maxOut: 2048, concise: false },
  A: { retrieval: 'A', thinking: 'low', maxOut: 2048, concise: false },
  B: { retrieval: 'B', thinking: 'off', maxOut: 2048, concise: false },
  C: { retrieval: 'C', thinking: 'off', maxOut: 2048, concise: false },
  'BASE+': { retrieval: 'BASE', thinking: 'low', maxOut: 1024, concise: true },
  'A+': { retrieval: 'A', thinking: 'low', maxOut: 1024, concise: true },
  'B+': { retrieval: 'B', thinking: 'off', maxOut: 1024, concise: true },
  'C+': { retrieval: 'C', thinking: 'off', maxOut: 1024, concise: true },
};

// Casos con llamada al LLM (F no llama: 0 fragmentos elegibles)
const CASES = {
  A: { text: 'Boca de tormenta rota, el agua no drena y se acumula en la calle', cat: 'INFRAESTRUCTURA' },
  B: { text: 'Auto estacionado sobre la rampa de acceso peatonal, bloquea el paso a personas con movilidad reducida', cat: 'TRANSITO' },
  C: { text: 'Auto estacionado sobre la rampa de acceso peatonal, bloquea el paso a personas con movilidad reducida', cat: 'TRANSITO' },
  'D-Av': { text: 'No anda la luminaria de la calle hace varios dias, queda todo oscuro de noche', cat: 'INFRAESTRUCTURA' },
  'D-CABA': { text: 'No anda la luminaria de la calle hace varios dias, queda todo oscuro de noche', cat: 'INFRAESTRUCTURA' },
  E: { text: 'Dos personas discuten en plena calle y frenan el transito, hay bocinazos y quejas de vecinos', cat: 'TRANSITO' },
  'E-sin-categoria': { text: 'Dos personas discuten en plena calle y frenan el transito, hay bocinazos y quejas de vecinos', cat: null },
  Prueba1: { text: 'Auto estacionado sobre la rampa de acceso peatonal, bloquea el paso a personas con movilidad reducida', cat: 'INFRAESTRUCTURA' },
  Prueba2: { text: 'Venta ambulante sin habilitacion ocupando la vereda', cat: 'TRANSITO' },
};

const configNames = (args.configs ?? Object.keys(CONFIGS).join(',')).split(',');
const caseNames = (args.cases ?? Object.keys(CASES).join(',')).split(',');

// PRNG con semilla fija (mulberry32) para que el orden intercalado sea reproducible
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const random = rng(3786);
const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// Validación determinística: réplica de validateLlmAnalysis de la función
const validate = (analysis, retrieved) => {
  for (const f of ['estado', 'es_infraccion', 'fundamento_ciudadano', 'fundamento_oficial', 'confianza', 'citas']) {
    if (analysis[f] === undefined) return { valid: false, reason: `Falta el campo obligatorio "${f}".` };
  }
  if (!Array.isArray(analysis.citas)) return { valid: false, reason: 'citas debe ser un array.' };
  const byId = new Map(retrieved.map((f) => [f.fragment_id, f]));
  for (const c of analysis.citas) {
    if (!c?.fragment_id || !c?.cita_textual) return { valid: false, reason: 'Cada cita debe tener fragment_id y cita_textual.' };
    const frag = byId.get(c.fragment_id);
    if (!frag) return { valid: false, reason: `fragment_id "${c.fragment_id}" no está entre los recuperados.` };
    if (!frag.content.includes(c.cita_textual)) return { valid: false, reason: `La cita de "${c.fragment_id}" no aparece literal en el fragmento.` };
  }
  return { valid: true };
};

const runsFile = new URL('raw/runs.ndjson', dir);
const done = new Set(
  fs.existsSync(runsFile)
    ? fs.readFileSync(runsFile, 'utf-8').split('\n').filter(Boolean).map((l) => { const r = JSON.parse(l); return `${r.case}|${r.config}|${r.rep}`; })
    : []
);

const total = REPS * caseNames.length * configNames.length;
let n = 0;
for (let rep = 1; rep <= REPS; rep += 1) {
  for (const caseName of caseNames) {
    for (const configName of shuffle(configNames)) {
      n += 1;
      if (done.has(`${caseName}|${configName}|${rep}`)) continue;
      const cfg = CONFIGS[configName];
      const ids = retrieval[caseName][cfg.retrieval].ids;
      const retrieved = ids.map((id) => fragments[id]);
      const prompt = buildPrompt({ reportText: CASES[caseName].text, category: CASES[caseName].cat, fragments: retrieved, concise: cfg.concise });
      const r = await callGemini({ prompt, thinkingConfig: THINKING[cfg.thinking], maxOutputTokens: cfg.maxOut });

      const cand = r.data?.candidates?.[0];
      const usage = r.data?.usageMetadata ?? {};
      const thoughts = usage.thoughtsTokenCount ?? 0;
      const candidates = usage.candidatesTokenCount ?? 0;
      const finishReason = cand?.finishReason ?? null;
      const jsonText = cand?.content?.parts?.[0]?.text;

      let parsed = null;
      let technicalFailure = null;
      let validation = null;
      if (!r.ok) technicalFailure = 'error_api';
      else if (finishReason === 'MAX_TOKENS') technicalFailure = 'truncado';
      else if (!jsonText) technicalFailure = 'json_invalido';
      else {
        try { parsed = JSON.parse(jsonText); } catch { technicalFailure = 'json_invalido'; }
      }
      if (parsed && !technicalFailure) {
        validation = validate(parsed, retrieved);
        if (!validation.valid) technicalFailure = 'validacion';
      }
      // Como la función: si la validación o el JSON fallan, el resultado entregado es «indeterminado» sin citas
      const delivered = technicalFailure ? { estado: 'indeterminado', citas: [] } : parsed;

      const line = {
        ts: new Date().toISOString(),
        case: caseName, config: configName, rep,
        attempts: r.attempts, status: r.status, latencyMs: Math.round(r.latencyMs),
        finishReason, technicalFailure, validationReason: validation?.valid === false ? validation.reason : null,
        error: r.ok ? null : r.errorText,
        fragmentsSent: retrieved.length,
        promptTokens: usage.promptTokenCount ?? null,
        candidatesTokens: candidates, thoughtsTokens: thoughts, outputTokens: candidates + thoughts,
        estadoModelo: parsed?.estado ?? null,
        estado: delivered.estado,
        citas: (delivered.citas ?? []).map((c) => ({ fragment_id: c.fragment_id, cita_textual: c.cita_textual })),
        wordsCiudadano: countWords(parsed?.fundamento_ciudadano), sentencesCiudadano: countSentences(parsed?.fundamento_ciudadano),
        wordsOficial: countWords(parsed?.fundamento_oficial),
        fundamento_ciudadano: parsed?.fundamento_ciudadano ?? null,
        fundamento_oficial: parsed?.fundamento_oficial ?? null,
      };
      fs.appendFileSync(runsFile, JSON.stringify(line) + '\n');
      console.error(`[${n}/${total}] rep${rep} ${caseName.padEnd(15)} ${configName.padEnd(5)} ${String(line.estado).padEnd(13)} in=${line.promptTokens} out=${line.outputTokens} ${line.latencyMs}ms${technicalFailure ? ' !' + technicalFailure : ''}`);
      await new Promise((res) => setTimeout(res, 250));
    }
  }
}
console.error('Listo.');
