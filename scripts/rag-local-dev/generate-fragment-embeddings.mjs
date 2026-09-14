// Genera embeddings reales (gemini-embedding-2, 768d) para los knowledge_fragments
// ya cargados en el Supabase real, y emite el SQL de INSERT para fragment_embeddings.
// No escribe nada en la base: solo imprime el SQL para revisarlo antes de aplicarlo
// vía apply_migration. Parte de REP-DEPLOY-RAG-SUPABASE, punto 1 (backfill de embeddings).
import fs from 'node:fs';

const envText = fs.readFileSync(new URL('../../.env', import.meta.url), 'utf-8');
const apiKey = envText.match(/^GEMINI_API_KEY=(.*)$/m)?.[1]?.trim();
if (!apiKey) throw new Error('GEMINI_API_KEY no encontrada en .env');

const MODEL_CODE = 'gemini-embedding-2@768';
const EMBED_MODEL = 'gemini-embedding-2';
const DIMENSIONS = 768;

const fragments = JSON.parse(fs.readFileSync(new URL('./fragments-to-embed.json', import.meta.url), 'utf-8'));

async function embedText(text) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: DIMENSIONS,
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`embedContent falló (${res.status}): ${body}`);
  }
  const data = await res.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values) || values.length !== DIMENSIONS) {
    throw new Error(`Respuesta sin ${DIMENSIONS} valores: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return values;
}

const results = [];
for (const frag of fragments) {
  console.error(`Embedding ${frag.id}...`);
  const vec = await embedText(frag.content);
  results.push({ id: frag.id, vec });
  await new Promise((r) => setTimeout(r, 300));
}

const values = results
  .map(({ id, vec }) => `('${id}', '${MODEL_CODE}', '[${vec.join(',')}]'::vector, now())`)
  .join(',\n  ');

const sql = `insert into public.fragment_embeddings (fragment_id, model_code, embedding, created_at)\nvalues\n  ${values}\non conflict (fragment_id, model_code) do update set embedding = excluded.embedding;\n`;

fs.writeFileSync(new URL('./fragment-embeddings-insert.sql', import.meta.url), sql, 'utf-8');
console.error(`OK: ${results.length} embeddings generados -> fragment-embeddings-insert.sql`);
