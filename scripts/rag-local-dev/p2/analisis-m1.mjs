// REP-3860 (RAG P2) · Puerta intermedia de M1 con los umbrales de Hernán (REP-3862/REP-3880, 02/11/2026):
//   1. ≥ 6 de los 10 casos únicos D4 (baches CABA) con la norma esperada en el top 8;
//   2. P0-012 (semáforo) con la norma esperada en el top 8;
//   3. 0 pérdidas: ninguna norma esperada que en P0 estaba en el top 8 sale del top 8 con P2, en todo el set.
// Lee un RAG-P2_M1_<fecha>.json (rep-diag-variantes/run.mjs --p0 --p2), donde cada fila trae P0 y P2 sobre el MISMO
// RPC. Un caso cumple si cumple en las 3 repeticiones (no se elige la favorable); igual se informan las 3.
// Cuenta dos cosas: «top 8» (los 8 primeros) y «entregado» (top 8 con similitud ≥ 0,45, lo que le llega a Gemini).
//
// Uso: node analisis-m1.mjs <RAG-P2_M1.json> <casos-referencia-v1.json> [--md salida.md]
import fs from 'node:fs';
import path from 'node:path';

const [rutaM1, rutaSet] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const rutaMd = process.argv.includes('--md') ? process.argv[process.argv.indexOf('--md') + 1] : null;
if (!rutaM1 || !rutaSet) throw new Error('Uso: node analisis-m1.mjs <RAG-P2_M1.json> <casos-referencia-v1.json> [--md salida.md]');

const m1 = JSON.parse(fs.readFileSync(path.resolve(rutaM1), 'utf-8'));
const set = JSON.parse(fs.readFileSync(path.resolve(rutaSet), 'utf-8'));
const casoSet = new Map(set.casos.map((c) => [c.id, c]));
const D4 = set.casos.filter((c) => JSON.stringify(c).includes('D4')).map((c) => c.id);

const porCaso = new Map();
for (const r of m1.resultados) {
  if (!porCaso.has(r.caso_id)) porCaso.set(r.caso_id, []);
  porCaso.get(r.caso_id).push(r);
}

const esperadosEn = (m, campo) => new Set(m.candidatos.filter((c) => c.esperado && c[campo]).map((c) => c.fragment_id));
const conteo = (filas, fn) => filas.filter(fn).length;

/** Resultado de un caso en sus repeticiones, para P0 y P2. */
const caso = (id) => {
  const filas = porCaso.get(id) ?? [];
  const r = (m) => ({
    top8: conteo(filas, (f) => m(f).esperados_en_top8 > 0),
    entregado: conteo(filas, (f) => m(f).esperados_entregados > 0),
    primera: filas.map((f) => m(f).posicion_primera_esperada ?? '-').join('/'),
  });
  return { id, reps: filas.length, n1: filas[0]?.esperados_n1.length ?? 0, p0: r((f) => f), p2: r((f) => f.p2) };
};

// Pérdidas y mejoras por norma: en la misma repetición, esperado en el top 8 de P0 y no en el de P2 (y al revés)
const cambios = (campo) => {
  const perdidas = [];
  const mejoras = [];
  for (const [id, filas] of porCaso) {
    for (const f of filas) {
      const a = esperadosEn(f, campo);
      const b = esperadosEn(f.p2, campo);
      for (const x of a) if (!b.has(x)) perdidas.push({ caso: id, rep: f.repeticion, fragment_id: x });
      for (const x of b) if (!a.has(x)) mejoras.push({ caso: id, rep: f.repeticion, fragment_id: x });
    }
  }
  return { perdidas, mejoras };
};

const d4 = D4.map(caso);
const semaforo = caso('P0-012');
const controles = ['P0-011', 'P0-030'].map(caso);
const top8 = cambios('en_top8');
const entregados = cambios('entregado');
const cumpleD4 = (campo) => d4.filter((c) => c.p2[campo] === c.reps && c.reps > 0).length;

const puerta = (campo) => ({
  d4_casos_con_esperada_3_de_3: cumpleD4(campo),
  d4_cumple: cumpleD4(campo) >= 6,
  semaforo_3_de_3: semaforo.p2[campo] === semaforo.reps,
  perdidas: (campo === 'top8' ? top8 : entregados).perdidas.length,
  cumple: cumpleD4(campo) >= 6 && semaforo.p2[campo] === semaforo.reps && (campo === 'top8' ? top8 : entregados).perdidas.length === 0,
});

const resultado = {
  archivo: path.basename(rutaM1),
  inicio_utc: m1.inicio_utc,
  corpus: m1.motor?.corpus?.sha256 ?? null,
  resumen_p0: m1.resumen,
  resumen_p2: m1.resumen_p2,
  puerta_top8: puerta('top8'),
  puerta_entregado: puerta('entregado'),
  d4,
  semaforo,
  controles,
  perdidas_top8: top8.perdidas,
  mejoras_top8: top8.mejoras,
  perdidas_entregado: entregados.perdidas,
  mejoras_entregado: entregados.mejoras,
};
console.log(JSON.stringify(resultado, null, 2));

if (rutaMd) {
  const pct = (x) => (x == null ? '-' : `${(x * 100).toFixed(1)} %`);
  const fila = (c) => `| ${c.id} | ${casoSet.get(c.id)?.categoria ?? ''} | ${c.n1} | ${c.p0.primera} | ${c.p2.primera} | ${c.p0.top8}/${c.reps} → **${c.p2.top8}/${c.reps}** | ${c.p0.entregado}/${c.reps} → **${c.p2.entregado}/${c.reps}** |`;
  const encabezado = '| Caso | Categoría | Normas N1 | 1.ª esperada P0 (r1/r2/r3) | 1.ª esperada P2 | Top 8 P0 → P2 | Entregado P0 → P2 |\n|---|---|---|---|---|---|---|';
  const lista = (xs) => (xs.length ? xs.map((x) => `${x.caso} r${x.rep} \`${x.fragment_id}\``).join(' · ') : 'ninguna');
  const md = `# M1 de P2 · ${resultado.archivo}

Corpus \`${resultado.corpus?.slice(0, 8)}…\` · 108 casos × 3 · mismo vector por fila: P0 = orden vectorial del RPC, P2 = orden híbrido (RRF k=60).

## Resumen (universo A, ${m1.resumen.todos.filas} filas)

| | MRR | Esperada en el top 8 | Esperada entregada (≥ 0,45) |
|---|---|---|---|
| P0 vectorial | ${m1.resumen.todos.mrr.toFixed(3)} | ${pct(m1.resumen.todos.cobertura_top8)} | ${pct(m1.resumen.todos.cobertura_entregados)} |
| P2 híbrida | ${m1.resumen_p2.todos.mrr.toFixed(3)} | ${pct(m1.resumen_p2.todos.cobertura_top8)} | ${pct(m1.resumen_p2.todos.cobertura_entregados)} |

## Puerta de Hernán

| Umbral | Con «top 8» | Con «entregado» |
|---|---|---|
| ≥ 6 de 10 D4 con la esperada (3 de 3 repeticiones) | ${resultado.puerta_top8.d4_casos_con_esperada_3_de_3} de 10 | ${resultado.puerta_entregado.d4_casos_con_esperada_3_de_3} de 10 |
| P0-012 semáforo (3 de 3) | ${resultado.puerta_top8.semaforo_3_de_3 ? 'sí' : 'no'} | ${resultado.puerta_entregado.semaforo_3_de_3 ? 'sí' : 'no'} |
| Pérdidas (norma esperada que estaba y sale) | ${resultado.puerta_top8.perdidas} | ${resultado.puerta_entregado.perdidas} |
| **¿Cumple?** | **${resultado.puerta_top8.cumple ? 'SÍ' : 'NO'}** | **${resultado.puerta_entregado.cumple ? 'SÍ' : 'NO'}** |

## D4 · baches CABA (10 casos)

${encabezado}
${d4.map(fila).join('\n')}

## Semáforo y controles

${encabezado}
${[semaforo, ...controles].map(fila).join('\n')}

## Pérdidas y mejoras por norma (todo el set)

- Pérdidas en el top 8: ${lista(top8.perdidas)}
- Pérdidas entre los entregados: ${lista(entregados.perdidas)}
- Mejoras en el top 8: ${top8.mejoras.length} (en ${new Set(top8.mejoras.map((x) => x.caso)).size} casos)
- Mejoras entre los entregados: ${entregados.mejoras.length} (en ${new Set(entregados.mejoras.map((x) => x.caso)).size} casos)
`;
  fs.writeFileSync(path.resolve(rutaMd), md);
}
