// REP-3786 · Fase 0 (sin LLM). Une las 7 recuperaciones k=6, verifica el contenido de cada fragmento
// contra el md5 de la base y calcula, para cada configuración de recuperación, qué queda dentro.
// Uso: node phase0.mjs   ->  escribe fragments.json y phase0-analysis.json
import fs from 'node:fs';
import crypto from 'node:crypto';

const dir = new URL('./', import.meta.url);
const read = (p) => JSON.parse(fs.readFileSync(new URL(p, dir), 'utf-8'));
const md5 = (s) => crypto.createHash('md5').update(s, 'utf8').digest('hex');

// 1. Recuperación fresca (k=6) por caso
const rows = [1, 2, 3, 4, 5, 6, 7].flatMap((n) => read(`raw/retrieval-0${n}.json`));
const byCase = {};
for (const r of rows) (byCase[r.case_name] ??= []).push(r);
for (const k in byCase) byCase[k].sort((a, b) => a.rank - b.rank);

// 2. Contenido de referencia (arnés anterior), verificado contra el hash de la base
const old = read('../p01-r5-final/retrieved.json');
const content = new Map();
for (const list of Object.values(old)) for (const f of list) content.set(f.fragment_id, f);
// Fragmentos que el arnés anterior no tenía (texto traído de la base; el md5 de abajo lo verifica)
for (const f of read('raw/extra-fragments.json')) content.set(f.fragment_id, f);

const fragments = {};
const problems = [];
for (const r of rows) {
  const ref = content.get(r.fragment_id);
  if (!ref) { problems.push(`${r.fragment_id}: no está en el arnés anterior (hay que traer su texto)`); continue; }
  if (md5(ref.content) !== r.content_md5) { problems.push(`${r.fragment_id}: el texto cambió respecto de la base (md5)`); continue; }
  fragments[r.fragment_id] = { fragment_id: r.fragment_id, hierarchy_path: r.hierarchy_path, content: ref.content };
}
fs.writeFileSync(new URL('fragments.json', dir), JSON.stringify(fragments, null, 2));

// 3. Normas esperadas por caso (REP-3764 / P-01), a nivel de norma; A exige sus tres fragmentos
const has = (path, s) => path.includes(s);
const EXPECT = {
  A: { all: ['Artículo 52', 'Artículo 59', 'Artículo 192'], forbid: ['Faltas'] },
  B: { anyOf: [['Ley 2148'], ['Ley 451']], forbid: ['Ley 24.449'] },
  C: { anyOf: [['Ley 24.449']], forbid: ['(CABA)'] },
  'D-Av': { anyOf: [['Artículo 52']], forbid: [] },
  'D-CABA': { anyOf: [['Ley 210']], forbid: ['Ley 24.449'] },
  E: { anyOf: [['Ley 24.449']], forbid: ['8031'] },
};

// 4. Configuraciones de recuperación (k, umbral)
const CONFIGS = { BASE: [6, 0.45], A: [3, 0.52], B: [3, 0.52], C: [3, 0.55] };
const out = {};
for (const [name, list] of Object.entries(byCase)) {
  out[name] = {};
  for (const [cfg, [k, th]] of Object.entries(CONFIGS)) {
    const kept = list.slice(0, k).filter((r) => r.similarity >= th);
    const paths = kept.map((r) => r.hierarchy_path);
    const e = EXPECT[name];
    let recall = null;
    if (e?.all) recall = e.all.every((s) => paths.some((p) => has(p, s)));
    else if (e?.anyOf) recall = e.anyOf.every((group) => group.some((s) => paths.some((p) => has(p, s))));
    out[name][cfg] = {
      n: kept.length,
      ids: kept.map((r) => r.fragment_id),
      sims: kept.map((r) => Number(r.similarity.toFixed(3))),
      recall,
      forbidden_present: e?.forbid?.length ? paths.filter((p) => e.forbid.some((s) => has(p, s))).length : 0,
    };
  }
}
out._sinConsulta = { F: 'COMERCIO_IRREGULAR: sin fragmentos por diseño (se verifica aparte con SQL)' };
fs.writeFileSync(new URL('phase0-analysis.json', dir), JSON.stringify(out, null, 2));

// 5. Resumen legible
console.log(`Fragmentos verificados por md5: ${Object.keys(fragments).length}`);
console.log(problems.length ? 'PROBLEMAS:\n - ' + problems.join('\n - ') : 'Sin problemas de contenido.');
console.log('\ncaso            | BASE (k6,.45)      | A (k3,.52)         | B (k3,.52)         | C (k3,.55)');
for (const [name, cfgs] of Object.entries(out)) {
  if (name.startsWith('_')) continue;
  const cell = (c) => `${c.n} frag ${c.recall === null ? ' - ' : c.recall ? 'OK ' : 'PIERDE'}`.padEnd(19);
  console.log(name.padEnd(15), '|', ['BASE', 'A', 'B', 'C'].map((c) => cell(cfgs[c])).join('| '));
}
