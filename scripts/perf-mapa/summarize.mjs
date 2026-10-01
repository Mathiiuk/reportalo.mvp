/**
 * Resume los JSON de measure.mjs en una tabla Markdown (REP-3803).
 *
 * Uso: node summarize.mjs <carpeta-results> <perfil> <etiqueta-base> [otras etiquetas...]
 * Por cada etiqueta: mediana [mínimo–máximo] de cada métrica y diferencia de la mediana
 * contra la etiqueta base. Con 5 corridas el rango mínimo–máximo es la dispersión.
 */
import fs from 'node:fs';
import path from 'node:path';

const [dir, profile, baseLabel, ...others] = process.argv.slice(2);
const labels = [baseLabel, ...others];

const median = (v) => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const load = (label) => JSON.parse(fs.readFileSync(path.join(dir, `${label}-${profile}.json`), 'utf8'));

const METRICS = [
  ['Performance', (r) => r.lh.performance, 0, ''],
  ['FCP (ms)', (r) => r.lh.fcp, 0, 'ms'],
  ['LCP (ms)', (r) => r.lh.lcp, 0, 'ms'],
  ['TBT (ms)', (r) => r.lh.tbt, 0, 'ms'],
  ['CLS', (r) => r.lh.cls, 3, ''],
  ['Pines: primero (ms)', (r) => r.probe.markersFirstMs, 0, 'ms'],
  ['Pines: todos (ms)', (r) => r.probe.markersAllMs, 0, 'ms'],
];

const fmt = (n, d) => Number(n).toFixed(d);
const data = Object.fromEntries(labels.map((l) => [l, load(l)]));
const baseMedians = Object.fromEntries(METRICS.map(([name, pick]) => [name, median(data[baseLabel].results.map(pick))]));

const lines = [];
lines.push(`| Métrica | ${labels.join(' | ')} |`);
lines.push(`|---|${labels.map(() => '---').join('|')}|`);
for (const [name, pick, d] of METRICS) {
  const cells = labels.map((l) => {
    const v = data[l].results.map(pick);
    const med = median(v);
    const delta = l === baseLabel ? '' : ` (${med - baseMedians[name] >= 0 ? '+' : ''}${fmt(med - baseMedians[name], d)})`;
    return `${fmt(med, d)} [${fmt(Math.min(...v), d)}–${fmt(Math.max(...v), d)}]${delta}`;
  });
  lines.push(`| ${name} | ${cells.join(' | ')} |`);
}
const checks = labels.map((l) => {
  const rs = data[l].results;
  const codes = [...new Set(rs.flatMap((r) => [...r.lh.reportsRequestStatus, ...r.probe.reportsRequestStatus]))];
  const pins = [...new Set(rs.map((r) => r.probe.markersCount))];
  const finals = [...new Set(rs.map((r) => new URL(r.lh.finalUrl).pathname))];
  return `${l}: HTTP ${codes.join(',')} · pines ${pins.join(',')} · ruta final ${finals.join(',')}`;
});
console.log(lines.join('\n'));
console.log('\nVerificación de datos reales:\n' + checks.map((c) => `- ${c}`).join('\n'));
