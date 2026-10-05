// REP-3816 · Corredor del spike. Protocolo: PROTOCOLO.md (fijado antes de correr).
// Uso: node run-spike.mjs [--configs P-low,P-min,F1,F2] [--inputs C01,M1,...]
// Cada corrida se agrega a raw/runs.ndjson al terminar: si se corta, al volver a correr retoma.
import fs from 'node:fs';
import { readJson, fileUrl, callMultimodal } from './lib.mjs';
import { OUTPUT_SCHEMA, PROMPT_VERSION, buildPrompt, validateOutput } from './contract.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), [])
);

const CONFIGS = {
  'P-low': { model: 'gemini-3.8-flash', thinking: { thinkingLevel: 'low' }, reps: 3 },
  // Desvío: thinkingLevel 'minimal' no es válido para gemini-3.8-flash (HTTP 400, 42 corridas fallidas guardadas). Se reemplaza por presupuesto 0.
  'P-min': { model: 'gemini-3.8-flash', thinking: { thinkingLevel: 'minimal' }, reps: 3 },
  'P-b0': { model: 'gemini-3.8-flash', thinking: { thinkingBudget: 0 }, reps: 3 },
  F1: { model: 'gemini-3.7-flash', thinking: { thinkingLevel: 'low' }, reps: 1 },
  F2: { model: 'gemini-3.5-flash-lite', thinking: { thinkingLevel: 'low' }, reps: 1 },
};
const configIds = (args.configs ?? Object.keys(CONFIGS).join(',')).split(',');
const { inputs } = readJson('inputs.json');
const inputIds = (args.inputs ?? inputs.map((i) => i.id).join(',')).split(',');

const photoPath = (photo) => {
  const [origin, name] = photo.split('/');
  return origin === 'rep3790' ? new URL(`../rep3790/fotos/anonimizadas/${name}`, import.meta.url) : fileUrl(`fotos/${name}`);
};

const runsFile = fileUrl('raw/runs.ndjson');
const done = new Set(
  fs.existsSync(runsFile)
    ? fs.readFileSync(runsFile, 'utf-8').split('\n').filter(Boolean).map((l) => { const r = JSON.parse(l); return `${r.config}|${r.input}|${r.rep}`; })
    : []
);

let n = 0;
for (const configId of configIds) {
  const cfg = CONFIGS[configId];
  for (let rep = 1; rep <= cfg.reps; rep += 1) {
    for (const id of inputIds) {
      n += 1;
      if (done.has(`${configId}|${id}|${rep}`)) continue;
      const input = inputs.find((i) => i.id === id);
      const imageBytes = fs.readFileSync(photoPath(input.photo));
      const r = await callMultimodal({
        model: cfg.model,
        thinkingConfig: cfg.thinking,
        imageBase64: imageBytes.toString('base64'),
        mimeType: 'image/jpeg',
        prompt: buildPrompt({ description: input.description, categoryCode: input.category }),
        responseSchema: OUTPUT_SCHEMA,
      });

      const cand = r.data?.candidates?.[0];
      const usage = r.data?.usageMetadata ?? {};
      let output = null;
      let failure = null;
      if (!r.ok) failure = 'error_api';
      else if (cand?.finishReason !== 'STOP') failure = `finish_${cand?.finishReason ?? 'desconocido'}`;
      else {
        try { output = JSON.parse(cand.content.parts.map((p) => p.text).join('')); } catch { failure = 'json_invalido'; }
      }
      const validation = output ? validateOutput(output) : { valid: false, reason: failure };

      const record = {
        config: configId, model: cfg.model, thinking: JSON.stringify(cfg.thinking), promptVersion: PROMPT_VERSION,
        input: id, kind: input.kind, rep,
        ok: r.ok, status: r.status, attempts: r.attempts, latencyMs: Math.round(r.latencyMs),
        finishReason: cand?.finishReason ?? null, failure, error: r.errorText,
        valid: validation.valid, invalidReason: validation.reason,
        promptTokens: usage.promptTokenCount ?? null,
        imageTokens: usage.promptTokensDetails?.find((d) => d.modality === 'IMAGE')?.tokenCount ?? null,
        outputTokens: usage.candidatesTokenCount ?? null,
        thoughtTokens: usage.thoughtsTokenCount ?? 0,
        output,
      };
      fs.appendFileSync(runsFile, `${JSON.stringify(record)}\n`);
      console.log(`${n} ${configId} ${id} rep${rep}: ${record.ok ? 'ok' : `ERROR ${record.status}`} ${record.latencyMs} ms · ${output?.coherence ?? record.invalidReason}`);
    }
  }
}
