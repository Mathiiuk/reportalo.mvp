// RAG-DIAG-VARIANTES · Comprueba que el SQL de la migración híbrida devuelve lo mismo que la emulación de run.mjs.
//
// No crea la función: toma el cuerpo de match_knowledge_fragments_hibrida tal como está en la migración, reemplaza
// los parámetros por los valores de cada caso (el vector de la consulta sale de salida/cache-embeddings.json) y
// arma un SELECT de solo lectura que se corre en staging. Después compara su top 8 con el de V3 en la última salida.
//
// Uso:  node verificar-rpc.mjs --sql <caso> [<caso> …] > salida/verificar.sql   (correr en staging, solo SELECT)
//       node verificar-rpc.mjs --comparar salida/verificar-resultado.json [salida/variantes-<…>.json]
import fs from 'node:fs';
import crypto from 'node:crypto';

import { readProdConfig, buildQueryText } from '../rep-diag-ranking/lib.mjs';

const here = new URL('./', import.meta.url);
const root = new URL('../../../', import.meta.url);
const args = process.argv.slice(2);

const MIGRACION = 'docs/rag/PROPUESTA_REP-3860_busqueda_hibrida_rrf.sql';
const salidas = fs.readdirSync(new URL('salida/', here)).filter((f) => f.startsWith('variantes-')).sort();

if (args[0] === '--sql') {
  const config = readProdConfig(fs.readFileSync(new URL('supabase/functions/analizar-reporte/index.ts', root), 'utf-8'));
  const { casos } = JSON.parse(fs.readFileSync(new URL('casos-bateria81.json', here), 'utf-8'));
  const cache = JSON.parse(fs.readFileSync(new URL('salida/cache-embeddings.json', here), 'utf-8'));
  const sqlMig = fs.readFileSync(new URL(MIGRACION, root), 'utf-8');
  const cuerpo = sqlMig.match(/as \$\$\n([\s\S]*?)\n\$\$;/)?.[1];
  if (!cuerpo) throw new Error('No se encontró el cuerpo de la función en la migración');
  const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const partes = args.slice(1).map((id) => {
    const c = casos.find((x) => x.id === id);
    if (!c) throw new Error(`No existe el caso ${id}`);
    const key = crypto.createHash('sha256').update(`${config.embeddingModel}@${config.dimensions}\n${buildQueryText(c.descripcion, c.categoria)}`).digest('hex');
    if (!cache[key]) throw new Error(`Sin vector en caché para ${id}: correr run.mjs primero`);
    const params = {
      query_embedding: `${lit(`[${cache[key].join(',')}]`)}::vector`,
      p_query_text: lit(c.descripcion),
      p_locality_id: `${lit(c.localidad)}::uuid`,
      p_model_code: lit(config.embeddingModelCode),
      match_count: String(config.matchCount),
      p_service_code: lit(c.categoria),
      p_rrf_k: '60',
    };
    const body = cuerpo.replace(/\b(query_embedding|p_query_text|p_locality_id|p_model_code|match_count|p_service_code|p_rrf_k)\b/g, (m) => params[m]).replace(/;\s*$/, '');
    return `select ${lit(id)} as caso, json_agg(json_build_array(left(x.fragment_id::text, 2) || right(x.fragment_id::text, 3), x.vector_rank, x.text_rank, round(x.similarity::numeric, 4))) as top
from (
${body}
) x(fragment_id, source_id, hierarchy_path, content, scope_level, similarity, vector_rank, text_rank, rrf_score)`;
  });
  console.log(`-- Solo lectura: cuerpo de ${MIGRACION} con los parámetros de cada caso.\nset search_path to public, extensions;\n${partes.join('\nunion all\n')};`);
} else if (args[0] === '--comparar') {
  const sqlRes = JSON.parse(fs.readFileSync(new URL(args[1], here), 'utf-8'));
  const salida = JSON.parse(fs.readFileSync(new URL(args[2] ?? `salida/${salidas.filter((f) => f.includes('bateria81')).at(-1)}`, here), 'utf-8'));
  const short = (id) => id.slice(0, 2) + id.slice(-3);
  let ok = true;
  for (const fila of sqlRes) {
    const r = salida.results.find((x) => x.id === fila.caso);
    const esperado = r.metrics.V3.top8Ids.map(short);
    const obtenido = fila.top.map((t) => t[0]);
    const igual = esperado.join(',') === obtenido.join(',');
    ok &&= igual;
    console.log(`${fila.caso.padEnd(10)} ${igual ? 'IGUAL' : 'DISTINTO'}  SQL ${obtenido.join(',')}${igual ? '' : `\n${' '.repeat(18)}JS  ${esperado.join(',')}`}`);
  }
  console.log(ok ? 'El SQL de la migración reproduce el top 8 de V3 en todos los casos.' : 'Hay diferencias: revisar.');
  process.exitCode = ok ? 0 : 1;
} else {
  throw new Error('Uso: --sql <caso…> | --comparar <resultado.json> [salida.json]');
}
