// REP-3863 · Auditoría de vinculos_norma.csv contra el catálogo de fragmentos vigentes (solo lectura, sin red).
// Uso: node scripts/rep3863/auditar_vinculos.mjs <raíz del repo> [salida de pares (fragmento, categoría)]
// Los pares se cruzan después con fragment_services: un par nuevo cambiaría match_knowledge_fragments (M1).
// Ojo: el emparejamiento por artículo no filtra el inciso; los pares que marque como nuevos se revisan a mano.
import fs from 'node:fs';
const [, , root] = process.argv;
const csv = (p) => { const t = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''); const rows = []; let r = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c === '"' && t[i+1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ',') { r.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i+1] === '\n') i++; r.push(f); f = ''; if (r.some(x => x)) rows.push(r); r = []; } else f += c; }
  if (f || r.length) { r.push(f); rows.push(r); } const [h, ...b] = rows; return b.map(x => Object.fromEntries(h.map((k, i) => [k, x[i] ?? '']))); };
const cat = csv(`${root}/docs/Entrega_Ivan_REP-3859/catalogo_fragmentos_2026-10-20.csv`).filter(f => f.is_current === 'true');
const vinc = csv(`${root}/scripts/rep3863/dataset/vinculos_norma.csv`);
const num = (s) => String(s).replace(/\./g, '').replace(/\/\d+$/, '');
const parse = (n) => {
  let m = n.match(/^(?:LOM \(DL 6769\/58\))/) ? { numero: '6769' } : null;
  if (!m) { const x = n.match(/(?:Ley|DL|Decreto-Ley|Ordenanza Fiscal|Ord\.)\s*([\d.]+)/i); if (x) m = { numero: num(x[1]) }; }
  if (!m && /Constitución PBA/.test(n)) m = { numero: 'CONST_PBA' };
  if (!m) return null;
  const a = n.match(/arts?\.\s*([\d.]+(?:\s*bis)?)/i); if (a) m.articulo = a[1].replace(/\s+/g, ' ');
  const s = n.match(/Secc\.\s*([\d.]+)/i); if (s) m.articulo = s[1];
  return m;
};
const res = { exacto: [], solo_ley: [], no_en_corpus: [] };
const pares = new Set();
const GRUPO_CAT = { ALUMBRADO: 'INFRAESTRUCTURA', CALLES: 'INFRAESTRUCTURA', VEREDAS: 'INFRAESTRUCTURA', PLUVIALES: 'INFRAESTRUCTURA', SEMAFOROS_SENALES: 'INFRAESTRUCTURA', TRANSITO_ESTACIONAMIENTO: 'TRANSITO', HIGIENE_RESIDUOS: 'AMBIENTE', CONTAMINACION: 'AMBIENTE', ESPACIO_PUBLICO_COMERCIO: 'COMERCIO_IRREGULAR', LOCAL_SIN_HABILITACION: 'COMERCIO_IRREGULAR', SITUACION_DE_CALLE: 'VULNERABILIDAD_SOCIAL', NINEZ: 'VULNERABILIDAD_SOCIAL' };
for (const v of vinc) {
  const p = parse(v.norma);
  let hits = [];
  if (p) hits = cat.filter(f => (p.numero === 'CONST_PBA' ? /constituci/i.test(f.fuente) : num(f.numero) === p.numero));
  const byArt = p?.articulo ? hits.filter(f => { const art = (f.articulo || f.hierarchy_path).toLowerCase(); return art === p.articulo.toLowerCase() || f.hierarchy_path.toLowerCase().includes(`artículo ${p.articulo.toLowerCase()}`) || f.hierarchy_path.toLowerCase().includes(`art. ${p.articulo.toLowerCase()}`); }) : [];
  const line = `${v.jurisdiccion}/${v.grupo_destino} [${v.tipo_fundamento}] ${v.norma}`;
  if (byArt.length) { res.exacto.push(`${line} → ${byArt.map(f => f.fragment_id.slice(-4)).join(',')}`); byArt.forEach(f => pares.add(`('${f.fragment_id}','${GRUPO_CAT[v.grupo_destino]}')`)); }
  else if (hits.length) res.solo_ley.push(`${line} → ley en corpus (${hits.length} frag.), artículo no encontrado`);
  else res.no_en_corpus.push(line);
}
console.log(`vigentes en catálogo: ${cat.length}`);
if (process.argv[3]) fs.writeFileSync(process.argv[3], [...pares].join(','));
for (const k of Object.keys(res)) { console.log(`\n## ${k} (${res[k].length})`); res[k].forEach(x => console.log(' - ' + x)); }
