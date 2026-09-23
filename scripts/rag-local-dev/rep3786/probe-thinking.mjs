// REP-3786 · Sonda: ¿cómo se «desactiva» el thinking en gemini-3.8-flash?
// Prueba 4 modos sobre el mismo prompt (caso A, fragmentos de BASE) y registra el thoughtsTokenCount real.
// Uso: node probe-thinking.mjs   ->  raw/thinking-mode.json
import fs from 'node:fs';
import { buildPrompt, callGemini } from './gemini-call.mjs';

const fragments = JSON.parse(fs.readFileSync(new URL('fragments.json', import.meta.url), 'utf-8'));
const analysis = JSON.parse(fs.readFileSync(new URL('phase0-analysis.json', import.meta.url), 'utf-8'));
const prompt = buildPrompt({
  reportText: 'Boca de tormenta rota, el agua no drena y se acumula en la calle',
  category: 'INFRAESTRUCTURA',
  fragments: analysis.A.BASE.ids.map((id) => fragments[id]),
  concise: false,
});

const MODES = [
  { id: 'low', thinkingConfig: { thinkingLevel: 'low' } },
  { id: 'budget0', thinkingConfig: { thinkingBudget: 0 } },
  { id: 'minimal', thinkingConfig: { thinkingLevel: 'minimal' } },
  { id: 'omitido', thinkingConfig: null },
];

const results = [];
for (const mode of MODES) {
  const r = await callGemini({ prompt, thinkingConfig: mode.thinkingConfig, maxOutputTokens: 2048 });
  const u = r.data?.usageMetadata ?? {};
  const row = {
    modo: mode.id,
    ok: r.ok,
    status: r.status,
    thoughts: u.thoughtsTokenCount ?? 0,
    candidates: u.candidatesTokenCount ?? null,
    prompt: u.promptTokenCount ?? null,
    finishReason: r.data?.candidates?.[0]?.finishReason ?? null,
    latencyMs: Math.round(r.latencyMs),
    error: r.ok ? null : r.errorText,
  };
  results.push(row);
  console.log(JSON.stringify(row));
  await new Promise((res) => setTimeout(res, 500));
}

// «Desactivado» = el primer modo aceptado que deja thoughts en 0
const off = results.find((r) => r.ok && r.modo !== 'low' && r.thoughts === 0);
const chosen = off ? MODES.find((m) => m.id === off.modo) : null;
fs.mkdirSync(new URL('raw/', import.meta.url), { recursive: true });
fs.writeFileSync(
  new URL('raw/thinking-mode.json', import.meta.url),
  JSON.stringify({ chosen: chosen ? { id: chosen.id, thinkingConfig: chosen.thinkingConfig } : null, observed: results }, null, 2)
);
console.log(chosen ? `\nModo «desactivado» elegido: ${chosen.id}` : '\nNingún modo deja thoughts en 0: se informará como «thinking mínimo».');
