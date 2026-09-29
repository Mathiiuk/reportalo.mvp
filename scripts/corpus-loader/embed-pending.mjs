#!/usr/bin/env node
// REP-3797 / REP-3774 — genera embeddings SOLO para los fragmentos vigentes que
// todavia no tienen vector con el modelo activo (la consulta V-5 del lote SQL).
// Sirve cuando los fragmentos entraron por SQL y no por el loader de .md.
//
// Uso:
//   node scripts/corpus-loader/embed-pending.mjs [--dry-run]
//   node scripts/corpus-loader/embed-pending.mjs --refresh <id> [<id>...] [--dry-run]
//   node scripts/corpus-loader/embed-pending.mjs --refresh-all [--dry-run]
//
// --refresh: recalcula el vector de esos fragmentos aunque ya tengan uno (upsert sobre el
// existente, sin borrar antes: nunca queda un fragmento sin vector). Sirve cuando cambio
// el texto guardado (p. ej. al normalizar saltos de linea) y el vector viejo quedo
// calculado sobre el texto anterior. Sin --refresh solo procesa los que no tienen vector.
//
// Env: SUPABASE_URL (o VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY.
// Idempotente: no toca fragmentos que ya tienen embedding; se puede reintentar.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const REPO_ROOT = new URL('../../', import.meta.url);

function loadDotEnv() {
  const envPath = new URL('.env', REPO_ROOT);
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '');
  }
}

async function embedText(model, apiKey, text) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model.model_name}:embedContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        model: `models/${model.model_name}`,
        content: { parts: [{ text }] },
        outputDimensionality: model.dimensions,
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`embedContent fallo (${res.status}): ${body.slice(0, 300)}`);
  }
  const values = (await res.json())?.embedding?.values;
  if (!Array.isArray(values) || values.length !== model.dimensions) {
    throw new Error(`Respuesta sin ${model.dimensions} valores`);
  }
  return values;
}

async function main() {
  loadDotEnv();
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const refreshAll = args.includes('--refresh-all');
  const refreshAt = args.indexOf('--refresh');
  const refreshIds = refreshAt === -1
    ? null
    : args.slice(refreshAt + 1).filter((arg) => !arg.startsWith('--'));
  if (refreshIds && refreshIds.length === 0) throw new Error('--refresh necesita al menos un id de fragmento');
  if (refreshAll && refreshIds) throw new Error('--refresh y --refresh-all no se combinan');
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!url) throw new Error('Falta SUPABASE_URL (o VITE_SUPABASE_URL)');
  if (!serviceKey) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY');
  if (!dryRun && !apiKey) throw new Error('Falta GEMINI_API_KEY');

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: model, error: modelError } = await db
    .from('embedding_models')
    .select('code, model_name, dimensions')
    .eq('is_active', true)
    .maybeSingle();
  if (modelError) throw modelError;
  if (!model) throw new Error('No hay un embedding_model activo');

  const { data: current, error: fragError } = await db
    .from('knowledge_fragments')
    .select('id, article, subsection, content')
    .eq('is_current', true);
  if (fragError) throw fragError;

  const { data: done, error: doneError } = await db
    .from('fragment_embeddings')
    .select('fragment_id')
    .eq('model_code', model.code);
  if (doneError) throw doneError;

  const embedded = new Set(done.map((row) => row.fragment_id));
  if (refreshIds) {
    const known = new Set(current.map((fragment) => fragment.id));
    const unknown = refreshIds.filter((id) => !known.has(id));
    if (unknown.length > 0) throw new Error(`Ids que no son fragmentos vigentes: ${unknown.join(', ')}`);
  }
  const pending = refreshAll
    ? current
    : refreshIds
      ? current.filter((fragment) => refreshIds.includes(fragment.id))
      : current.filter((fragment) => !embedded.has(fragment.id));

  console.log(`Modelo activo: ${model.code} (${model.model_name}, ${model.dimensions}d)`);
  console.log(
    refreshAll || refreshIds
      ? `Fragmentos vigentes: ${current.length} | a recalcular (--refresh): ${pending.length}`
      : `Fragmentos vigentes: ${current.length} | con embedding: ${current.length - pending.length} | pendientes: ${pending.length}`
  );
  if (dryRun) {
    for (const f of pending) console.log(`  pendiente ${f.id}  art. ${f.article ?? '-'} ${f.subsection ?? ''}`);
    console.log('[DRY RUN — no escribe nada]');
    return;
  }

  let ok = 0;
  for (const fragment of pending) {
    const embedding = await embedText(model, apiKey, fragment.content);
    const { error } = await db
      .from('fragment_embeddings')
      .upsert(
        { fragment_id: fragment.id, model_code: model.code, embedding: `[${embedding.join(',')}]` },
        { onConflict: 'fragment_id,model_code' }
      );
    if (error) throw new Error(`No se pudo guardar el embedding ${fragment.id}: ${error.message}`);
    ok += 1;
    console.log(`  [${ok}/${pending.length}] ${fragment.id} art. ${fragment.article ?? '-'} ${fragment.subsection ?? ''}`);
  }
  console.log(`\nListo: ${ok} embedding(s) generados.`);
}

main().catch((error) => {
  console.error(`\nERROR: ${error.message}`);
  process.exit(1);
});
