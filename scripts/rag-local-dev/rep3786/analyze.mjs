// REP-3786 · Análisis de raw/runs.ndjson. Aplica evaluate.mjs y la regla R1–R5 del protocolo (spec §6 y §12).
// Uso: node analyze.mjs   ->  raw/summary.json y tablas en markdown por consola
import fs from 'node:fs';
import { evaluateRun, RULES } from './evaluate.mjs';

const dir = new URL('./', import.meta.url);
const readJson = (p) => JSON.parse(fs.readFileSync(new URL(p, dir), 'utf-8'));
const fragments = readJson('fragments.json');
const phase0 = readJson('phase0-analysis.json');
const runs = fs.readFileSync(new URL('raw/runs.ndjson', dir), 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

const CONFIGS = ['BASE', 'A', 'B', 'C', 'BASE+', 'A+', 'B+', 'C+'];
const DECIDE = Object.entries(RULES).filter(([, r]) => r.role === 'decide').map(([k]) => k);
const INFO = Object.entries(RULES).filter(([, r]) => r.role === 'info').map(([k]) => k);
const pathOf = (id) => fragments[id]?.hierarchy_path ?? `(desconocido ${id})`;

// Evaluar cada corrida
for (const r of runs) {
  r.eval = evaluateRun(r.case, { estado: r.estado, citedPaths: r.citas.map((c) => pathOf(c.fragment_id)), technicalFailure: r.technicalFailure });
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
const p90 = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil(0.9 * s.length) - 1)] : null; };
const sum = (a) => a.reduce((x, y) => x + y, 0);

const by = (cfg, cases) => runs.filter((r) => r.config === cfg && (!cases || cases.includes(r.case)));

// ---- Por configuración ----
const summary = {};
for (const cfg of CONFIGS) {
  const all = by(cfg);
  const perCase = {};
  for (const c of [...DECIDE, ...INFO].filter((x) => x !== 'F')) {
    const rs = by(cfg, [c]);
    perCase[c] = { n: rs.length, correct: rs.filter((r) => r.eval.correct).length };
  }
  const llm = all; // todas las corridas llaman al LLM (F no está en runs)
  summary[cfg] = {
    n: all.length,
    perCase,
    correctDecide: sum(DECIDE.filter((c) => c !== 'F').map((c) => perCase[c].correct)),
    nDecide: sum(DECIDE.filter((c) => c !== 'F').map((c) => perCase[c].n)),
    wrongCitationDecide: by(cfg, DECIDE).filter((r) => r.eval.wrongCitation).length,
    wrongCitationInfo: by(cfg, INFO).filter((r) => r.eval.wrongCitation).length,
    falsePositiveInfo: by(cfg, INFO).filter((r) => r.eval.falsePositive).length,
    lostToAbstention: by(cfg, DECIDE).filter((r) => r.eval.lostToAbstention).length,
    truncados: all.filter((r) => r.technicalFailure === 'truncado').length,
    jsonInvalido: all.filter((r) => r.technicalFailure === 'json_invalido').length,
    errorApi: all.filter((r) => r.technicalFailure === 'error_api').length,
    validacion: all.filter((r) => r.technicalFailure === 'validacion').length,
    inputMedian: median(llm.map((r) => r.promptTokens).filter((x) => x != null)),
    inputMean: Math.round(sum(llm.map((r) => r.promptTokens ?? 0)) / (llm.length || 1)),
    outputMedian: median(llm.map((r) => r.outputTokens)),
    outputMean: Math.round(sum(llm.map((r) => r.outputTokens)) / (llm.length || 1)),
    outputMax: Math.max(...llm.map((r) => r.outputTokens)),
    thoughtsMean: Math.round(sum(llm.map((r) => r.thoughtsTokens)) / (llm.length || 1)),
    thoughtsMax: Math.max(...llm.map((r) => r.thoughtsTokens)),
    latencyMedian: median(llm.map((r) => r.latencyMs)),
    latencyP90: p90(llm.map((r) => r.latencyMs)),
    retried: llm.filter((r) => r.attempts > 1).length,
    conciseCitizenOk: null,
    conciseOfficialOk: null,
  };
  if (cfg.endsWith('+')) {
    const withText = llm.filter((r) => r.fundamento_ciudadano);
    summary[cfg].conciseCitizenOk = withText.filter((r) => r.sentencesCiudadano <= 2 && r.wordsCiudadano <= 45).length + '/' + withText.length;
    const withOff = llm.filter((r) => r.fundamento_oficial);
    summary[cfg].conciseOfficialOk = withOff.filter((r) => r.wordsOficial <= 66).length + '/' + withOff.length;
  } else {
    const withText = llm.filter((r) => r.fundamento_ciudadano);
    summary[cfg].wordsCitizenMedian = median(withText.map((r) => r.wordsCiudadano));
    summary[cfg].wordsOfficialMedian = median(llm.filter((r) => r.fundamento_oficial).map((r) => r.wordsOficial));
  }
}

// ---- Regla de decisión pre-registrada (R1–R5) frente a BASE, y su versión «+» frente a BASE+ ----
const pct = (a, b) => (b ? ((a - b) / b) * 100 : 0);
const decideRules = (cfg, ref) => {
  const s = summary[cfg];
  const r = summary[ref];
  const gating = DECIDE.filter((c) => c !== 'F');
  const r1Detail = gating.map((c) => ({ case: c, variant: s.perCase[c].correct, base: r.perCase[c].correct }));
  const R1 = r1Detail.every((d) => d.variant >= d.base);
  // R2 (aclarada en spec §12): 0 citas incorrectas en casos que deciden; en informativos, no mayores que la referencia; 0 truncados/JSON inválidos
  const R2 = s.wrongCitationDecide === 0 && s.wrongCitationInfo <= r.wrongCitationInfo && s.falsePositiveInfo <= r.falsePositiveInfo && s.truncados === 0 && s.jsonInvalido === 0;
  // R3 (Fase 0): recall a nivel de norma en la recuperación de la configuración
  const retr = cfg.replace('+', '');
  const R3 = gating.every((c) => phase0[c][retr].recall === true);
  // R4: ningún positivo que decide pasa a abstención y F sigue en sin_normativa (por construcción, 0 fragmentos)
  const R4 = s.lostToAbstention <= r.lostToAbstention && s.lostToAbstention === 0;
  const gain = {
    input: pct(s.inputMedian, r.inputMedian),
    output: pct(s.outputMedian, r.outputMedian),
    latency: pct(s.latencyMedian, r.latencyMedian),
  };
  const R5 = gain.input <= -10 || gain.output <= -15 || gain.latency <= -20;
  return { R1, R2, R3, R4, R5, all: R1 && R2 && R3 && R4 && R5, gain, r1Detail };
};
const decisions = {};
for (const cfg of ['A', 'B', 'C']) decisions[cfg] = decideRules(cfg, 'BASE');
for (const cfg of ['BASE+', 'A+', 'B+', 'C+']) decisions[cfg] = decideRules(cfg, 'BASE');
// Extra de los «+»: 0 truncamientos, máximo de salida <= 819 y concisión medida en >= 90 %
for (const cfg of ['BASE+', 'A+', 'B+', 'C+']) {
  const s = summary[cfg];
  const [cOk, cN] = s.conciseCitizenOk.split('/').map(Number);
  const [oOk, oN] = s.conciseOfficialOk.split('/').map(Number);
  decisions[cfg].plus = { truncados0: s.truncados === 0, max819: s.outputMax <= 819, concision90: cN > 0 && cOk / cN >= 0.9 && oN > 0 && oOk / oN >= 0.9 };
  decisions[cfg].all = decisions[cfg].all && decisions[cfg].plus.truncados0 && decisions[cfg].plus.max819 && decisions[cfg].plus.concision90;
}

// ---- ¿El baseline cita fragmentos que top-3 dejaría afuera? (evidencia para «no pierde normativa relevante») ----
const beyondTop3 = {};
for (const r of by('BASE')) {
  const ids = phase0[r.case].BASE.ids;
  const beyond = r.citas.filter((c) => ids.indexOf(c.fragment_id) >= 3);
  if (beyond.length) {
    beyondTop3[r.case] ??= { runsConCitaFueraDeTop3: 0, citas: {} };
    beyondTop3[r.case].runsConCitaFueraDeTop3 += 1;
    for (const c of beyond) beyondTop3[r.case].citas[pathOf(c.fragment_id)] = (beyondTop3[r.case].citas[pathOf(c.fragment_id)] ?? 0) + 1;
  }
}
summary.__baselineCitasFueraDeTop3 = beyondTop3;

fs.writeFileSync(new URL('raw/summary.json', dir), JSON.stringify({ summary, decisions }, null, 2));

// ---- Salida legible ----
const f0 = (x) => (x == null ? '-' : Math.round(x));
console.log(`Corridas analizadas: ${runs.length}\n`);
console.log('| Config | aciertos (deciden) | citas incorrectas (deciden/info) | falsos pos. (info) | a abstención | truncados/JSON inv./val. | in mediana | out mediana | out máx | thoughts prom | lat. mediana | lat. p90 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const cfg of CONFIGS) {
  const s = summary[cfg];
  console.log(`| ${cfg} | ${s.correctDecide}/${s.nDecide} | ${s.wrongCitationDecide}/${s.wrongCitationInfo} | ${s.falsePositiveInfo} | ${s.lostToAbstention} | ${s.truncados}/${s.jsonInvalido}/${s.validacion} | ${f0(s.inputMedian)} | ${f0(s.outputMedian)} | ${s.outputMax} | ${s.thoughtsMean} | ${f0(s.latencyMedian)} ms | ${f0(s.latencyP90)} ms |`);
}
console.log('\nAciertos por caso (sobre 5):');
console.log('| Caso | ' + CONFIGS.join(' | ') + ' |');
console.log('|---|' + CONFIGS.map(() => '---').join('|') + '|');
for (const c of [...DECIDE.filter((x) => x !== 'F'), ...INFO]) {
  console.log(`| ${c}${INFO.includes(c) ? ' (info)' : ''} | ` + CONFIGS.map((cfg) => `${summary[cfg].perCase[c].correct}/${summary[cfg].perCase[c].n}`).join(' | ') + ' |');
}
console.log('\nRegla de decisión (frente a BASE):');
for (const [cfg, d] of Object.entries(decisions)) {
  console.log(`${cfg.padEnd(5)} R1=${d.R1 ? 'sí' : 'NO'} R2=${d.R2 ? 'sí' : 'NO'} R3=${d.R3 ? 'sí' : 'NO'} R4=${d.R4 ? 'sí' : 'NO'} R5=${d.R5 ? 'sí' : 'NO'}` +
    (d.plus ? ` | +: trunc0=${d.plus.truncados0 ? 'sí' : 'NO'} max<=819=${d.plus.max819 ? 'sí' : 'NO'} concisión>=90%=${d.plus.concision90 ? 'sí' : 'NO'}` : '') +
    ` => ${d.all ? 'CUMPLE TODO' : 'no cumple'} | Δin ${d.gain.input.toFixed(0)}% Δout ${d.gain.output.toFixed(0)}% Δlat ${d.gain.latency.toFixed(0)}%`);
}
