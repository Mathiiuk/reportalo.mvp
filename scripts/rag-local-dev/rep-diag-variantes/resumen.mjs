// RAG-DIAG-VARIANTES · Resume la última salida de run.mjs en tablas Markdown (sin red).
//
// Uso:  node scripts/rag-local-dev/rep-diag-variantes/resumen.mjs [salida/variantes-<fecha>.json]
import fs from 'node:fs';

const here = new URL('./', import.meta.url);
const file = process.argv[2]
  ? new URL(process.argv[2], here)
  : new URL(`salida/${fs.readdirSync(new URL('salida/', here)).filter((f) => f.startsWith('variantes-')).sort().at(-1)}`, here);
const { config, results, apiCalls, taskTypeProbe, maxBaselineDiff, rrfK } = JSON.parse(fs.readFileSync(file, 'utf-8'));

const VARIANTS = ['B', 'V1', 'V2', 'V1+V2', 'V3', 'V3+V2', 'V3+V1+V2'];
const K = config.matchCount;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? null : s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const pct = (x) => `${Math.round(x * 100)} %`;
const f3 = (x) => (x == null ? '-' : x.toFixed(3).replace('.', ','));
const f1 = (x) => (x == null ? '-' : String(Math.round(x * 10) / 10).replace('.', ','));

const positives = results.filter((r) => r.grupo !== 'N');
const negatives = results.filter((r) => r.grupo === 'N');

const stats = (rows, v) => {
  const firsts = rows.map((r) => r.metrics[v].primera).filter((p) => p != null);
  return {
    n: rows.length,
    hit: rows.filter((r) => r.metrics[v].primera != null && r.metrics[v].primera <= K).length / rows.length,
    mediana: median(firsts),
    mrr: rows.reduce((s, r) => s + (r.metrics[v].primera ? 1 / r.metrics[v].primera : 0), 0) / rows.length,
    // Cobertura: de los esperados elegibles, cuántos entran al top-k (tope k por caso)
    cobertura: rows.reduce((s, r) => s + r.metrics[v].enTop8 / Math.min(K, r.esperadosElegibles || 1), 0) / rows.length,
  };
};

const out = [];
const table = (title, rows) => {
  out.push(`### ${title} (${rows.length} casos)`, '', '| Variante | Recall@8 | Posición mediana de la 1.ª esperada | MRR | Esperados dentro del top 8 |', '|---|---|---|---|---|');
  for (const v of VARIANTS) {
    const s = stats(rows, v);
    out.push(`| ${v} | ${pct(s.hit)} | ${f1(s.mediana)} | ${f3(s.mrr)} | ${pct(s.cobertura)} |`);
  }
  out.push('');
};

out.push(`Archivo: ${file.pathname.split('/').at(-1)} · top-k ${K} · RRF k=${rrfK}`, '');
out.push(`taskType: ${taskTypeProbe}`, `Control baseline: diferencia máxima ${maxBaselineDiff.toExponential(2)}`, `API: ${JSON.stringify(apiCalls)}`, '');
table('Todos los casos con norma esperada', positives);
table('D1 a D5', positives.filter((r) => r.grupo === 'D'));
table('Reportes reales', positives.filter((r) => r.grupo === 'R'));
table('Sin baches en CABA (D4 y equivalentes)', positives.filter((r) => r.escenario !== 'BACHE_CABA'));
table('Solo baches en CABA (D4 y equivalentes)', positives.filter((r) => r.escenario === 'BACHE_CABA'));

out.push('### Separación de similitud máxima (con norma vs. sin norma aplicable)', '',
  '| Variante | Media con norma | Mín. con norma | Media sin norma | Máx. sin norma | Diferencia de medias | AUC |', '|---|---|---|---|---|---|---|');
for (const v of ['B', 'V1', 'V2', 'V1+V2']) {
  const p = positives.map((r) => r.metrics[v].simMax);
  const n = negatives.map((r) => r.metrics[v].simMax);
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  let wins = 0;
  for (const a of p) for (const b of n) wins += a > b ? 1 : a === b ? 0.5 : 0;
  out.push(`| ${v} | ${f3(mean(p))} | ${f3(Math.min(...p))} | ${f3(mean(n))} | ${f3(Math.max(...n))} | ${f3(mean(p) - mean(n))} | ${f3(wins / (p.length * n.length))} |`);
}
out.push('');

out.push('### Casos sin norma: similitud máxima por variante', '', '| Caso | B | V1 | V2 | V1+V2 |', '|---|---|---|---|---|');
for (const r of negatives) out.push(`| ${r.id} | ${['B', 'V1', 'V2', 'V1+V2'].map((v) => f3(r.metrics[v].simMax)).join(' | ')} |`);
out.push('');

out.push('### Posición de cada esperado en D4 y baches de CABA', '', `| Caso | Fragmento | ${VARIANTS.join(' | ')} |`, `|---|---|${VARIANTS.map(() => '---').join('|')}|`);
for (const r of positives.filter((x) => x.escenario === 'BACHE_CABA')) {
  for (const e of r.esperadosDetalle) out.push(`| ${r.id} | ${e.ruta.split(' > ').slice(0, 2).join(' > ')} | ${VARIANTS.map((v) => e.posicion[v]).join(' | ')} |`);
}
out.push('');

out.push('### Primera esperada por caso', '', `| Caso | Cand. | ${VARIANTS.join(' | ')} |`, `|---|---|${VARIANTS.map(() => '---').join('|')}|`);
for (const r of positives) out.push(`| ${r.id} | ${r.candidatos} | ${VARIANTS.map((v) => r.metrics[v].primera ?? '-').join(' | ')} |`);

console.log(out.join('\n'));
