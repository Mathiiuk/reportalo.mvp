import fs from 'node:fs';

const envText = fs.readFileSync(new URL('../../.env', import.meta.url), 'utf-8');
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
  return data.embedding.values;
}

const cases = [
  { name: 'Prueba2', text: 'Venta ambulante sin habilitacion ocupando la vereda (categoría: TRANSITO)' },
  { name: 'CasoE', text: 'Dos personas discuten en plena calle y frenan el transito, hay bocinazos y quejas de vecinos (categoría: TRANSITO)' },
];

for (const c of cases) {
  const vec = await embedText(c.text);
  console.log(`-- ${c.name}`);
  console.log(`select fragment_id, left(content,60) as preview, similarity from public.match_knowledge_fragments('[${vec.join(',')}]'::vector, '2fe4cf09-c3d9-4514-ae99-cac0256494e4'::uuid, 'gemini-embedding-2@768', 6, 'TRANSITO') order by similarity desc;`);
  console.log();
}
