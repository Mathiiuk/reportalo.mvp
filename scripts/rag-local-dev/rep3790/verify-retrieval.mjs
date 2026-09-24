// REP-3790 · Comprueba que la recuperación local es la de la base antes de correr el spike.
// 1) Con los vectores de consulta que usó la base en REP-3786 (p01-r5-final), la recuperación
//    local k=6 tiene que dar los mismos fragmentos, en el mismo orden y con la misma similitud
//    que las recuperaciones reales guardadas en rep3786/raw/retrieval-0N.json.
// 2) Vectorizar hoy el mismo texto de consulta tiene que dar el mismo vector (determinismo).
import fs from 'node:fs';
import { loadCorpus, retrieve, embedText, readJson, writeJson } from './lib.mjs';

const { db } = loadCorpus();
const fragmentVectors = readJson('raw/fragment-vectors.json');
const cases = JSON.parse(fs.readFileSync(new URL('../p01-r5-final/cases-with-embeddings.json', import.meta.url), 'utf-8'));
const dbRows = [1, 2, 3, 4, 5, 6, 7].flatMap((n) =>
  JSON.parse(fs.readFileSync(new URL(`../rep3786/raw/retrieval-0${n}.json`, import.meta.url), 'utf-8'))
);
const locName = Object.fromEntries(Object.entries(db.localidades).map(([k, v]) => [v, k]));
const cosine = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i += 1) { d += a[i] * b[i]; x += a[i] ** 2; y += b[i] ** 2; } return d / Math.sqrt(x * y); };

let maxDiff = 0;
let orderMismatches = 0;
const report = [];
for (const c of cases) {
  // Filas de la base que siguen vigentes (un fragmento dado de baja después no puede reaparecer)
  const fromDb = dbRows.filter((r) => r.case_name === c.name && db.fragmentos[r.fragment_id]).sort((a, b) => a.rank - b.rank);
  if (!fromDb.length) continue;
  const local = retrieve({ queryVector: c.embedding, fragmentVectors, db, locality: locName[c.locality], category: c.cat, threshold: -1 });
  const sameOrder = fromDb.every((r, i) => local[i]?.id === r.fragment_id);
  if (!sameOrder) orderMismatches += 1;
  for (const r of fromDb) {
    const l = local.find((x) => x.id === r.fragment_id);
    maxDiff = Math.max(maxDiff, l ? Math.abs(l.similarity - r.similarity) : 1);
  }
  report.push({ caso: c.name, mismoOrden: sameOrder, db: fromDb.map((r) => [r.fragment_id.slice(-4), +r.similarity.toFixed(4)]), local: local.slice(0, fromDb.length).map((r) => [r.id.slice(-4), +r.similarity.toFixed(4)]) });
}

// Determinismo del vector de consulta (una sola llamada)
const sample = cases[0];
const { values } = await embedText(sample.queryText);
const determinism = cosine(values, sample.embedding);

const result = { casos: report.length, desordenados: orderMismatches, maxDiferenciaSimilitud: maxDiff, cosenoVectorHoyVsBase: determinism, detalle: report };
writeJson('raw/verify-retrieval.json', result);
console.log(JSON.stringify({ casos: result.casos, desordenados: orderMismatches, maxDiferenciaSimilitud: maxDiff.toExponential(2), cosenoVectorHoyVsBase: determinism.toFixed(6) }, null, 2));
if (orderMismatches || maxDiff > 1e-3 || determinism < 0.999) { console.error('NO COINCIDE: no correr el spike.'); process.exit(1); }
console.error('La recuperación local coincide con la base.');
