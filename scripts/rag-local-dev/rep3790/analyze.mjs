// REP-3790 · Análisis de raw/runs.ndjson contra casos.json y la regla de decisión del protocolo.
// Uso: node analyze.mjs  ->  imprime el resumen y escribe raw/analysis.json
import fs from 'node:fs';
import { readJson, writeJson, fileUrl } from './lib.mjs';

const { casos } = readJson('casos.json');
const runs = fs.readFileSync(fileUrl('raw/runs.ndjson'), 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const ABSTENCION = ['indeterminado', 'sin_normativa', 'fuera_de_alcance'];

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const matches = (ruta, patrones) => patrones.some((p) => ruta?.includes(p));

// Clasificación de una corrida según el resultado esperado del caso
const score = (run, caso) => {
  const e = caso.esperado;
  const rutas = run.citas.map((c) => c.ruta);
  const falsosPositivos = rutas.filter((r) => !matches(r, e.normas) && !matches(r, e.discutibles));
  const discutibles = rutas.filter((r) => matches(r, e.discutibles) && !matches(r, e.normas));
  const abstuvo = ABSTENCION.includes(run.estado) && rutas.length === 0;
  const correcta = e.abstencion ? abstuvo : run.estado === 'fundamentado' && rutas.some((r) => matches(r, e.normas));
  return { correcta, abstuvo, falsosPositivos: falsosPositivos.length, discutibles: discutibles.length };
};

const byCase = {};
for (const caso of casos) {
  byCase[caso.id] = {};
  for (const v of ['T', 'I']) {
    const rs = runs.filter((r) => r.case === caso.id && r.variant === v).sort((a, b) => a.rep - b.rep);
    const scored = rs.map((r) => ({ ...score(r, caso), estado: r.estado, normas: [...new Set(r.citas.map((c) => c.ruta.split(' > ').slice(-1)[0]))].sort() }));
    // Consistencia: las 3 repeticiones terminan con el mismo estado y el mismo conjunto de normas citadas
    const firmas = scored.map((s) => `${s.estado}|${s.normas.join(',')}`);
    byCase[caso.id][v] = {
      n: rs.length,
      correctas: scored.filter((s) => s.correcta).length,
      falsosPositivos: scored.reduce((a, s) => a + s.falsosPositivos, 0),
      discutibles: scored.reduce((a, s) => a + s.discutibles, 0),
      fallasTecnicas: rs.filter((r) => r.fallaTecnica).length,
      consistente: new Set(firmas).size === 1,
      corridas: scored.map((s) => `${s.estado}${s.normas.length ? ' [' + s.normas.join('; ') + ']' : ''}`),
    };
  }
}

const tot = (v, k) => Object.values(byCase).reduce((a, c) => a + c[v][k], 0);
const lat = (v) => runs.filter((r) => r.variant === v).map((r) => r.latenciaTotalMs);
const stage = (v, s) => median(runs.filter((r) => r.variant === v).map((r) => r.latenciaMs[s]));
const iRuns = runs.filter((r) => r.variant === 'I' && r.extraccion);

const resumen = {
  corridas: runs.length,
  normativaCorrecta: { T: tot('T', 'correctas'), I: tot('I', 'correctas'), ratioIsobreT: +(tot('I', 'correctas') / tot('T', 'correctas')).toFixed(3) },
  falsosPositivos: { T: tot('T', 'falsosPositivos'), I: tot('I', 'falsosPositivos') },
  discutibles: { T: tot('T', 'discutibles'), I: tot('I', 'discutibles') },
  fallasTecnicas: { T: tot('T', 'fallasTecnicas'), I: tot('I', 'fallasTecnicas') },
  casosConsistentes: { T: Object.values(byCase).filter((c) => c.T.consistente).length, I: Object.values(byCase).filter((c) => c.I.consistente).length, de: casos.length },
  latenciaMedianaMs: {
    T: median(lat('T')), I: median(lat('I')), ratioIsobreT: +(median(lat('I')) / median(lat('T'))).toFixed(2),
    porEtapaI: { extraccion: stage('I', 'extraccion'), vector: stage('I', 'vector'), generacion: stage('I', 'generacion') },
    porEtapaT: { vector: stage('T', 'vector'), generacion: stage('T', 'generacion') },
  },
  tokensExtraccionMediana: {
    entrada: median(iRuns.map((r) => r.extraccion.tokensEntrada)),
    imagen: median(iRuns.map((r) => r.extraccion.tokensImagen)),
    salida: median(iRuns.map((r) => r.extraccion.tokensSalida)),
  },
  tokensGeneracionMediana: {
    T: { entrada: median(runs.filter((r) => r.variant === 'T' && r.tokensEntradaGeneracion).map((r) => r.tokensEntradaGeneracion)), salida: median(runs.filter((r) => r.variant === 'T').map((r) => r.tokensSalidaGeneracion)) },
    I: { entrada: median(runs.filter((r) => r.variant === 'I' && r.tokensEntradaGeneracion).map((r) => r.tokensEntradaGeneracion)), salida: median(runs.filter((r) => r.variant === 'I').map((r) => r.tokensSalidaGeneracion)) },
  },
};

writeJson('raw/analysis.json', { resumen, porCaso: byCase });
console.log(JSON.stringify(resumen, null, 2));
console.log('\ncaso | tipo          | T correctas | I correctas | T consistente | I consistente');
for (const caso of casos) {
  const c = byCase[caso.id];
  console.log(`${caso.id}   | ${caso.tipo.padEnd(13)} | ${c.T.correctas}/${c.T.n}         | ${c.I.correctas}/${c.I.n}         | ${c.T.consistente ? 'sí' : 'no'}            | ${c.I.consistente ? 'sí' : 'no'}`);
  console.log(`       T: ${c.T.corridas.join(' · ')}`);
  console.log(`       I: ${c.I.corridas.join(' · ')}`);
}
