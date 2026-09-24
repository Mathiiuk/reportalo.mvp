// REP-3790 · Vectoriza el contenido de cada fragmento del corpus (igual que generate-fragment-embeddings:
// solo el content, sin taskType) y lo guarda en raw/fragment-vectors.json para la recuperación local.
import fs from 'node:fs';
import { loadCorpus, embedText, fileUrl } from './lib.mjs';

const { fragments } = loadCorpus();
const out = {};
for (const [id, f] of Object.entries(fragments)) {
  const { values } = await embedText(f.content);
  out[id] = values;
  console.error(`ok ${f.hierarchy_path.slice(0, 70)}`);
}
fs.mkdirSync(fileUrl('raw/'), { recursive: true });
fs.writeFileSync(fileUrl('raw/fragment-vectors.json'), JSON.stringify(out));
console.error(`${Object.keys(out).length} vectores guardados.`);
