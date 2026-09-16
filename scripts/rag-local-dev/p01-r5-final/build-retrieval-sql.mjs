import fs from 'node:fs';

const cases = JSON.parse(fs.readFileSync(new URL('./cases-with-embeddings.json', import.meta.url), 'utf-8'));

const parts = cases.map((c) => {
  const catSql = c.cat ? `'${c.cat}'` : 'null';
  return `select '${c.name}' as case_name, fragment_id, hierarchy_path, content, similarity
from public.match_knowledge_fragments('[${c.embedding.join(',')}]'::vector, '${c.locality}'::uuid, 'gemini-embedding-2@768', 6, ${catSql})`;
});

const sql = parts.join('\nunion all\n') + '\norder by case_name, similarity desc;';
fs.writeFileSync(new URL('./retrieval-query.sql', import.meta.url), sql, 'utf-8');
console.error(`OK -> retrieval-query.sql (${sql.length} chars)`);
