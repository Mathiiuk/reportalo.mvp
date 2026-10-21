// RAG-DIAG-VARIANTES · Resume la corrida de la batería de 81 casos: actual (B) contra híbrida (V3), sin red.
//
// Cada consulta distinta pesa tantas filas de la batería como comparten su texto, categoría y localidad, así que
// los totales son sobre los 81 reportes (y, aparte, sobre las 47 consultas distintas). V3+V2 se muestra solo como
// referencia. «Llega al modelo» = top 8 y similitud >= umbral, igual que analizar-reporte.
//
// Uso:  node scripts/rag-local-dev/rep-diag-variantes/resumen-bateria.mjs [salida/variantes-bateria81-<fecha>.json]
import fs from 'node:fs';

const here = new URL('./', import.meta.url);
const file = process.argv[2]
  ? new URL(process.argv[2], here)
  : new URL(`salida/${fs.readdirSync(new URL('salida/', here)).filter((f) => f.startsWith('variantes-bateria81-')).sort().at(-1)}`, here);
const { config, results, apiCalls, maxBaselineDiff, rrfK, generatedAt } = JSON.parse(fs.readFileSync(file, 'utf-8'));

const VARIANTS = ['B', 'V3', 'V3t05', 'V3+V2'];
const K = config.matchCount;
const w = (r) => r.filas.length;
const pct = (x) => `${Math.round(x * 100)} %`;
const f3 = (x) => (x == null ? '-' : x.toFixed(3).replace('.', ','));
const f1 = (x) => (x == null ? '-' : String(Math.round(x * 10) / 10).replace('.', ','));
const wmedian = (pairs) => {
  const s = pairs.flatMap(([v, n]) => Array(n).fill(v)).sort((a, b) => a - b);
  return s.length === 0 ? null : s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const conNorma = results.filter((r) => r.grupo === 'B');
const sinNorma = results.filter((r) => r.grupo === 'N');
const sinAceptables = results.filter((r) => r.grupo === 'V');

const stats = (rows, v, weighted = true) => {
  const wt = weighted ? w : () => 1;
  const n = rows.reduce((s, r) => s + wt(r), 0);
  const avg = (fn) => rows.reduce((s, r) => s + wt(r) * fn(r), 0) / n;
  const m = (r) => r.metrics[v];
  return {
    n,
    recall: avg((r) => (m(r).primera != null && m(r).primera <= K ? 1 : 0)),
    mediana: wmedian(rows.filter((r) => m(r).primera != null).map((r) => [m(r).primera, wt(r)])),
    primera1: avg((r) => (m(r).primera === 1 ? 1 : 0)),
    mrr: avg((r) => (m(r).primera ? 1 / m(r).primera : 0)),
    cobertura: avg((r) => m(r).enTop8 / Math.min(K, r.esperadosElegibles || 1)),
    entregaEsperado: avg((r) => (m(r).esperadosEntregados > 0 ? 1 : 0)),
    precision: avg((r) => (m(r).entregados ? m(r).esperadosEntregados / m(r).entregados : 0)),
  };
};

const out = [];
const table = (title, rows, weighted = true) => {
  out.push(`### ${title} (${weighted ? `${rows.reduce((s, r) => s + w(r), 0)} reportes, ` : ''}${rows.length} consultas distintas)`, '',
    '| Variante | Recall@8 | 1.ª esperada en el puesto 1 | Posición mediana | MRR | Esperados dentro del top 8 | Llega al modelo al menos un aceptable | Aceptables / entregados |',
    '|---|---|---|---|---|---|---|---|');
  for (const v of VARIANTS) {
    const s = stats(rows, v, weighted);
    out.push(`| ${v} | ${pct(s.recall)} | ${pct(s.primera1)} | ${f1(s.mediana)} | ${f3(s.mrr)} | ${pct(s.cobertura)} | ${pct(s.entregaEsperado)} | ${pct(s.precision)} |`);
  }
  out.push('');
};

out.push(`Archivo: ${file.pathname.split('/').at(-1)} · corrida ${generatedAt} · top-k ${K} · umbral ${config.threshold} · RRF k=${rrfK}`);
out.push(`Control baseline: diferencia máxima ${maxBaselineDiff.toExponential(2)} · API: ${JSON.stringify(apiCalls)}`, '');

table('Todos los reportes con norma esperada', conNorma);
table('Mismo cálculo sin ponderar (cada consulta distinta cuenta una vez)', conNorma, false);
table('Sin D4 (baches en CABA)', conNorma.filter((r) => r.escenario !== 'BACHE_CABA'));
table('Solo D4 (baches en CABA)', conNorma.filter((r) => r.escenario === 'BACHE_CABA'));

out.push('### Por escenario (ponderado por reportes)', '', '| Escenario | Reportes | Consultas | MRR B | MRR V3 | Puesto 1 B | Puesto 1 V3 | Cobertura B | Cobertura V3 |', '|---|---|---|---|---|---|---|---|---|');
for (const esc of [...new Set(conNorma.map((r) => r.escenario))]) {
  const rows = conNorma.filter((r) => r.escenario === esc);
  const b = stats(rows, 'B'), h = stats(rows, 'V3');
  out.push(`| ${esc} | ${b.n} | ${rows.length} | ${f3(b.mrr)} | ${f3(h.mrr)} | ${pct(b.primera1)} | ${pct(h.primera1)} | ${pct(b.cobertura)} | ${pct(h.cobertura)} |`);
}
out.push('');

// Cambios en lo que ve el modelo: conjunto del top 8 que pasa el umbral, B contra V3.
const entregadosIds = (r, v) => r.metrics[v].entregadosIds;
let mejor = 0, peor = 0, igual = 0, cambianConjunto = 0, mejorN = 0, peorN = 0, cambianN = 0;
const filasCaso = [];
for (const r of conNorma) {
  const pb = r.metrics.B.primera, ph = r.metrics.V3.primera;
  if (ph < pb) { mejor += w(r); mejorN += 1; } else if (ph > pb) { peor += w(r); peorN += 1; } else igual += w(r);
  const sb = new Set(entregadosIds(r, 'B')), sh = new Set(entregadosIds(r, 'V3'));
  const entran = [...sh].filter((id) => !sb.has(id)).length;
  if (entran) { cambianConjunto += w(r); cambianN += 1; }
  filasCaso.push(`| ${r.id} | ${r.escenario} | ${w(r)} | ${r.candidatos} | ${r.ftsCoincidencias} | ${pb ?? '-'} | ${ph ?? '-'} | ${r.metrics.B.enTop8} → ${r.metrics.V3.enTop8} | ${entran} | ${r.descripcion.length > 60 ? `${r.descripcion.slice(0, 57)}…` : r.descripcion} |`);
}
out.push('### Movimiento de la primera esperada (B → V3)', '',
  `- Mejora: ${mejor} reportes (${mejorN} consultas) · Igual: ${igual} · Empeora: ${peor} reportes (${peorN} consultas)`,
  `- Cambia lo que llega al modelo (entra al menos un fragmento que con B no llegaba): ${cambianConjunto} reportes (${cambianN} consultas)`, '');

out.push('### Por consulta', '', '| Caso | Escenario | Reportes | Cand. | Coincid. texto | 1.ª B | 1.ª V3 | Esperados en top 8 (B → V3) | Fragmentos nuevos que llegan al modelo | Texto |', '|---|---|---|---|---|---|---|---|---|---|');
out.push(...filasCaso, '');

out.push('### D4: posición de cada norma de competencia', '', `| Caso | Fragmento | Similitud | ${VARIANTS.join(' | ')} |`, `|---|---|---|${VARIANTS.map(() => '---').join('|')}|`);
for (const r of conNorma.filter((x) => x.escenario === 'BACHE_CABA')) {
  for (const e of r.esperadosDetalle) out.push(`| ${r.id} | ${e.ruta.split(' > ').slice(0, 2).join(' > ')} | ${f3(e.similitud)} | ${VARIANTS.map((v) => e.posicion[v]).join(' | ')} |`);
}
out.push('');

out.push('### Controles sin norma y vulnerabilidad social (no entran en las métricas)', '', '| Caso | Grupo | Reportes | Cand. | Sim. máx. | Llegan al modelo B | Llegan al modelo V3 | Fragmentos nuevos en top 8 | Texto |', '|---|---|---|---|---|---|---|---|---|');
for (const r of [...sinNorma, ...sinAceptables]) {
  const sb = new Set(r.metrics.B.top8Ids);
  const entran = r.metrics.V3.top8Ids.filter((id) => !sb.has(id)).length;
  out.push(`| ${r.id} | ${r.grupo === 'N' ? 'sin norma' : 'vulnerabilidad'} | ${w(r)} | ${r.candidatos} | ${f3(r.metrics.B.simMax)} | ${r.metrics.B.entregados} | ${r.metrics.V3.entregados} | ${entran} | ${r.descripcion.slice(0, 60)} |`);
}

console.log(out.join('\n'));
