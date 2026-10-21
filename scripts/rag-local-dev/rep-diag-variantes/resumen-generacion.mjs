// RAG-DIAG-VARIANTES · Resume qué cita Gemini con el contexto actual (B) y con el híbrido (V3), sin red.
//
// Lee las salidas de rep-diag-generacion corridas con --desde-variantes (generacion-<caso>-<B|V3>-<fecha>.json, la
// última de cada una) y clasifica cada cita con los aceptables de §5 del LEEME de Hernán (casos-bateria81.json).
//
// Uso:  node scripts/rag-local-dev/rep-diag-variantes/resumen-generacion.mjs <caso> [<caso> …]
import fs from 'node:fs';

const here = new URL('./', import.meta.url);
const genDir = new URL('../rep-diag-generacion/salida/', here);
const { escenarios, casos } = JSON.parse(fs.readFileSync(new URL('casos-bateria81.json', here), 'utf-8'));
const files = fs.readdirSync(genDir);
const corto = (ruta) => ruta.split(' > ').filter((p, i, a) => i === 0 || i === a.length - 1).join(' > ');

const out = ['| Caso | Escenario | Contexto | Fragmentos (aceptables) | Estados | Citas por corrida (✓ = aceptable de §5) | Todas las citas aceptables |', '|---|---|---|---|---|---|---|'];
const totales = {};
for (const casoId of process.argv.slice(2)) {
  const caso = casos.find((c) => c.id === casoId);
  if (!caso) throw new Error(`No existe el caso ${casoId}`);
  const esperados = new Set(escenarios[caso.escenario].esperados);
  for (const v of ['B', 'V3']) {
    const id = `${casoId}-${v}`;
    const ultimo = files.filter((f) => f.startsWith(`generacion-${id}-`) && f.endsWith('.json')).sort().at(-1);
    if (!ultimo) throw new Error(`Falta la corrida de ${id}`);
    const gen = JSON.parse(fs.readFileSync(new URL(ultimo, genDir), 'utf-8'));
    const ctx = JSON.parse(fs.readFileSync(new URL(`contexto-${id}.json`, genDir), 'utf-8')).fragments;
    const ruta = new Map(ctx.map((f) => [f.fragment_id, f.hierarchy_path]));
    const aceptablesEnCtx = ctx.filter((f) => esperados.has(f.fragment_id)).length;
    const t = (totales[`${caso.escenario} · ${v}`] ??= { corridas: 0, validas: 0, indeterminado: 0, conAceptable: 0, todasAceptables: 0, citas: 0, citasAceptables: 0 });
    const estados = [], citas = [], todas = [];
    for (const r of gen.runs) {
      t.corridas += 1;
      if (!r.parsed) { estados.push('error'); citas.push('—'); todas.push('—'); continue; }
      if (r.validation?.valid) t.validas += 1;
      if (r.parsed.estado === 'indeterminado') t.indeterminado += 1;
      const ids = [...new Set((r.parsed.citas ?? []).map((c) => c.fragment_id))];
      const ok = ids.filter((x) => esperados.has(x)).length;
      t.citas += ids.length; t.citasAceptables += ok;
      if (ok > 0) t.conAceptable += 1;
      if (ids.length > 0 && ok === ids.length) t.todasAceptables += 1;
      estados.push(`${r.parsed.estado}${r.validation?.valid ? '' : ' (NO válida)'}`);
      citas.push(ids.map((x) => `${esperados.has(x) ? '✓ ' : ''}${corto(ruta.get(x) ?? x)}`).join(' · ') || 'sin citas');
      todas.push(ids.length === 0 ? '—' : ok === ids.length ? 'sí' : `${ok} de ${ids.length}`);
    }
    const iguales = new Set(citas).size === 1;
    out.push(`| ${casoId} | ${caso.escenario} | ${v} | ${ctx.length} (${aceptablesEnCtx}) | ${[...new Set(estados)].join(', ')} | ${iguales ? `${citas[0]} (×${citas.length})` : citas.join('<br>')} | ${[...new Set(todas)].join(', ')} |`);
  }
}
out.push('', '| Escenario · contexto | Corridas | Válidas | `indeterminado` | Con al menos un aceptable | Solo aceptables | Citas aceptables / citas |', '|---|---|---|---|---|---|---|');
for (const [v, t] of Object.entries(totales)) {
  out.push(`| ${v} | ${t.corridas} | ${t.validas} | ${t.indeterminado} | ${t.conAceptable} | ${t.todasAceptables} | ${t.citasAceptables} / ${t.citas} |`);
}
console.log(out.join('\n'));
