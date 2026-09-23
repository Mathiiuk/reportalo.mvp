// REP-3786 · Fase 0. Genera una consulta SQL por vector de consulta distinto, que recupera
// con k=6 (el máximo de las variantes) para poder derivar top-3 y los umbrales sin volver a
// llamar al RPC: match_knowledge_fragments ordena por similitud y corta con LIMIT.
//
// Los vectores se redondean a 5 decimales para que la consulta sea manejable: el error en la
// similitud es del orden de 1e-5 y se comprueba después contra la recuperación de referencia.
// La salida NO trae el texto de los fragmentos sino su md5: el contenido se toma del arnés
// anterior y se verifica contra este hash, así no se copia texto legal a mano.
import fs from 'node:fs';
import crypto from 'node:crypto';

const cases = JSON.parse(
  fs.readFileSync(new URL('../p01-r5-final/cases-with-embeddings.json', import.meta.url), 'utf-8')
);

// Casos que comparten texto de consulta comparten vector
const groups = new Map();
for (const c of cases) {
  if (!groups.has(c.queryText)) groups.set(c.queryText, { embedding: c.embedding, cases: [] });
  groups.get(c.queryText).cases.push(c);
}

let n = 0;
const index = [];
for (const [, group] of groups) {
  n += 1;
  const vec = `[${group.embedding.map((x) => Number(x).toFixed(5)).join(',')}]`;
  const values = group.cases
    .map((c) => `('${c.name}', '${c.locality}'::uuid, ${c.cat ? `'${c.cat}'::text` : 'null::text'})`)
    .join(',\n    ');
  const sql = `with q as (select t, t::vector as v from (select '${vec}'::text as t) s)
select c.case_name, r.rank, r.fragment_id, r.similarity, r.content_md5, r.hierarchy_path,
       md5(q.t) as vec_md5
from (values
    ${values}
) as c(case_name, loc, cat)
cross join q
cross join lateral (
  select row_number() over (order by m.similarity desc) as rank, m.fragment_id, m.similarity,
         md5(m.content) as content_md5, m.hierarchy_path
  from public.match_knowledge_fragments(q.v, c.loc, 'gemini-embedding-2@768', 6, c.cat) m
) r
order by c.case_name, r.rank;`;
  const file = `sql/retrieval-${String(n).padStart(2, '0')}.sql`;
  fs.writeFileSync(new URL(file, import.meta.url), sql, 'utf-8');
  index.push({ file, cases: group.cases.map((c) => c.name), chars: sql.length, vec_md5: crypto.createHash('md5').update(vec).digest('hex') });
}
console.log(JSON.stringify(index, null, 2));
