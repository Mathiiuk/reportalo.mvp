// REP-3786 · Seguimiento: variante D (top-k 4 · umbral 0.52 · thinking low), analizada por cálculo.
// Sin llamadas a Gemini: usa la recuperación de la Fase 0 (phase0-analysis.json) y los tokens medidos en
// las 360 corridas (raw/runs.ndjson). Responde: ¿cuántos casos cambian de prompt frente al baseline y
// cuánto ahorro de entrada cabe esperar?
// Uso: node variant-d-estimate.mjs
import fs from 'node:fs';

const dir = new URL('./', import.meta.url);
const readJson = (p) => JSON.parse(fs.readFileSync(new URL(p, dir), 'utf-8'));
const phase0 = readJson('phase0-analysis.json');
const runs = fs.readFileSync(new URL('raw/runs.ndjson', dir), 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

const K_D = 4;
const THRESHOLD_D = 0.52;
const CASES = Object.keys(phase0).filter((k) => !k.startsWith('_'));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const meanInput = (config, caso) => mean(runs.filter((r) => r.config === config && r.case === caso).map((r) => r.promptTokens));

// 1. ¿En qué casos cambia el prompt? (D = primeros K_D de la recuperación k=6, con similitud >= umbral)
console.log('caso            | frag BASE | frag D | ¿cambia el prompt?');
let changed = 0;
const fragmentsD = {};
for (const caso of CASES) {
  const base = phase0[caso].BASE;
  const nD = base.sims.slice(0, K_D).filter((s) => s >= THRESHOLD_D).length;
  fragmentsD[caso] = nD;
  const cambia = nD !== base.n;
  if (cambia) changed += 1;
  console.log(`${caso.padEnd(15)} | ${String(base.n).padStart(9)} | ${String(nD).padStart(6)} | ${cambia ? 'SÍ' : 'no (idéntico al baseline)'}`);
}
console.log(`\nCasos donde D difiere del baseline: ${changed} de ${CASES.length}`);

// 2. Tokens de entrada por fragmento, estimados con E sin categoría: BASE (6 fragmentos) frente a A (3 fragmentos)
const tokensPerFragment =
  (meanInput('BASE', 'E-sin-categoria') - meanInput('A', 'E-sin-categoria')) /
  (phase0['E-sin-categoria'].BASE.n - phase0['E-sin-categoria'].A.n);
const baseMean = mean(CASES.map((c) => meanInput('BASE', c)));
const removedFragments = CASES.reduce((total, c) => total + (phase0[c].BASE.n - fragmentsD[c]), 0);
const savingPerCall = (removedFragments * tokensPerFragment) / CASES.length;
console.log(`\nTokens de entrada por fragmento (estimado): ${Math.round(tokensPerFragment)}`);
console.log(`Entrada media del BASE por llamada: ${Math.round(baseMean)}`);
console.log(
  `Ahorro esperado de D: ~${Math.round(savingPerCall)} tokens por llamada = ${((savingPerCall / baseMean) * 100).toFixed(1)}% (R5 exige 10%)`
);

// 3. ¿De dónde sale el ahorro de A (top-3)?
const dropsA = CASES.map((c) => [c, phase0[c].BASE.n - phase0[c].A.n]).filter(([, n]) => n > 0);
console.log(
  `\nFragmentos que A (top-3) deja de enviar: ${dropsA.map(([c, n]) => `${c} −${n}`).join(', ')} ` +
    `(total ${dropsA.reduce((t, [, n]) => t + n, 0)}, en ${dropsA.length} de ${CASES.length} casos)`
);

// 4. Un umbral global, ¿separa lo útil de lo que no? Similitud del fragmento que el caso A necesita frente a
//    fragmentos irrelevantes de otros casos (E sin categoría: venta de productos y LOM art. 52).
const neededA = Math.min(...phase0.A.BASE.sims);
const irrelevantE = phase0['E-sin-categoria'].BASE.sims.slice(4);
console.log(`\nFragmento necesario del caso A, similitud mínima: ${neededA}`);
console.log(`Fragmentos irrelevantes de E sin categoría (puestos 5 y 6): ${irrelevantE.join(', ')}`);
console.log(
  irrelevantE.some((s) => s > neededA)
    ? 'Hay un fragmento irrelevante con MÁS similitud que el necesario: ningún umbral global los separa en estos casos.'
    : 'Un umbral entre ambos los separaría en estos casos.'
);
