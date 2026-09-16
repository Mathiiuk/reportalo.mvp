// Calcula los embeddings de los 9 textos de consulta distintos de P-01
// (5 corridas de cada caso usan el MISMO texto, asi que el embedding es
// identico -- no hace falta llamar a Gemini 37 veces para esta parte).
import fs from 'node:fs';

const envText = fs.readFileSync(new URL('../../../.env', import.meta.url), 'utf-8');
const apiKey = envText.match(/^GEMINI_API_KEY=(.*)$/m)?.[1]?.trim();
if (!apiKey) throw new Error('GEMINI_API_KEY no encontrada en .env');

const EMBED_MODEL = 'gemini-embedding-2';
const DIMENSIONS = 768;

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
  const data = await res.json();
  if (!data?.embedding?.values) throw new Error(`Sin embedding: ${JSON.stringify(data).slice(0,200)}`);
  return data.embedding.values;
}

const cases = JSON.parse(fs.readFileSync(new URL('./cases.json', import.meta.url), 'utf-8'));

const out = [];
for (const c of cases) {
  const queryText = c.cat ? `${c.desc} (categoría: ${c.cat})` : c.desc;
  console.error(`Embedding ${c.name}...`);
  const vec = await embedText(queryText);
  out.push({ ...c, queryText, embedding: vec });
  await new Promise((r) => setTimeout(r, 200));
}

fs.writeFileSync(new URL('./cases-with-embeddings.json', import.meta.url), JSON.stringify(out), 'utf-8');
console.error(`OK: ${out.length} embeddings -> cases-with-embeddings.json`);
