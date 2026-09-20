#!/usr/bin/env node
// REP-3774 — Loader reproducible del corpus RAG.
//
// Carga una norma verificada desde un archivo .md hacia las estructuras que ya
// existen (knowledge_sources / knowledge_fragments / fragment_services /
// fragment_embeddings) y deja el snapshot del archivo en el bucket privado
// `corpus-fuentes`, para que despues se pueda auditar contra que texto exacto
// se genero cada fragmento.
//
// No rediseña nada del esquema: las reglas de vigencia y versionado viven en
// los RPC `upsert_knowledge_source` / `upsert_knowledge_fragment`
// (migracion 20260920210000), porque necesitan una transaccion por fragmento.
//
// Uso:
//   node scripts/corpus-loader/load-corpus.mjs corpus/normativas/*.md
//   node scripts/corpus-loader/load-corpus.mjs <archivo.md> --dry-run
//
// Variables de entorno (se leen de .env o del ambiente):
//   SUPABASE_URL              (o VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY  clave de servicio — nunca se commitea
//   GEMINI_API_KEY             para los embeddings (omitible con --skip-embeddings)
//
// Salida: una linea por fragmento con la accion aplicada
// (created / versioned / unchanged) y un resumen final. Idempotente: correrlo
// dos veces sobre el mismo archivo no duplica filas ni crea versiones nuevas.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { parseCorpusFile } from './parse-corpus-md.mjs';

const REPO_ROOT = new URL('../../', import.meta.url);

// --- entorno --------------------------------------------------------------

function loadDotEnv() {
  const envPath = new URL('.env', REPO_ROOT);
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf-8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue; // el ambiente real gana
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '');
  }
}

// --- CLI ------------------------------------------------------------------

function parseArgs(argv) {
  const files = [];
  const flags = { dryRun: false, skipEmbeddings: false };
  for (const arg of argv) {
    if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--skip-embeddings') flags.skipEmbeddings = true;
    else if (arg.startsWith('--')) throw new Error(`Opcion desconocida: ${arg}`);
    else files.push(arg);
  }
  if (files.length === 0) {
    throw new Error(
      'Falta el archivo .md a cargar.\n' +
        '  node scripts/corpus-loader/load-corpus.mjs corpus/normativas/<norma>.md [--dry-run] [--skip-embeddings]'
    );
  }
  return { files, flags };
}

// --- geografia ------------------------------------------------------------

// El ambito nunca se resuelve por texto libre contra las normas: se resuelve
// contra el arbol geografico real, y si el nombre no existe el loader corta.
//
// Tampoco alcanza con el nombre: en subdivisions hay dos "Avellaneda" (Buenos
// Aires y Santa Fe). Una norma municipal cargada contra la equivocada queda
// aplicandose a ciudadanos de otra provincia, y eso no se nota hasta que el RAG
// cita una ordenanza ajena. Por eso una coincidencia ambigua es un error, nunca
// "agarrar la primera".
function exactlyOne(rows, what, hint) {
  if (!rows || rows.length === 0) throw new Error(`No existe ${what} en el arbol geografico`);
  if (rows.length > 1) throw new Error(`${what} es ambiguo: hay ${rows.length} coincidencias. ${hint}`);
  return rows[0].id;
}

async function resolveScope(db, source) {
  const { scope, scope_name: scopeName, scope_parent: scopeParent } = source;

  if (scope === 'country') {
    const { data, error } = await db.from('countries').select('id').eq('iso_code', scopeName);
    if (error) throw error;
    return {
      country_id: exactlyOne(data, `el pais con iso_code "${scopeName}"`, ''),
      state_province_id: null,
      subdivision_id: null,
    };
  }

  if (scope === 'state_province') {
    let query = db.from('states_provinces').select('id, countries!inner(iso_code)').eq('name', scopeName);
    if (scopeParent) query = query.eq('countries.iso_code', scopeParent);
    const { data, error } = await query;
    if (error) throw error;
    return {
      country_id: null,
      state_province_id: exactlyOne(data, `la provincia "${scopeName}"`, 'Desambiguar con scope_parent (iso_code del pais).'),
      subdivision_id: null,
    };
  }

  if (scope === 'subdivision') {
    const { data, error } = await db
      .from('subdivisions')
      .select('id, states_provinces!inner(name)')
      .eq('name', scopeName)
      .eq('states_provinces.name', scopeParent);
    if (error) throw error;
    return {
      country_id: null,
      state_province_id: null,
      subdivision_id: exactlyOne(
        data,
        `el partido/comuna "${scopeName}" de "${scopeParent}"`,
        'Revisar scope_parent.'
      ),
    };
  }

  throw new Error(`scope invalido: "${scope}" (country | state_province | subdivision)`);
}

// --- validacion de catalogos ----------------------------------------------

// Mejor fallar aca, con el codigo que falta a la vista, que recibir un error de
// foreign key en el medio de la carga con media norma escrita.
async function validateCatalogs(db, doc) {
  const problems = [];

  const check = async (table, column, value, hint) => {
    if (value == null) return;
    const { data, error } = await db.from(table).select(column).eq(column, value).maybeSingle();
    if (error) throw error;
    if (!data) problems.push(`${hint}: "${value}" no existe en ${table}`);
  };

  await check('source_types', 'code', doc.source.source_type, 'source_type');
  await check('document_types', 'code', doc.source.document_type, 'document_type');

  for (const fragment of doc.fragments) {
    await check('foundation_types', 'code', fragment.foundation_type, `foundation_type (${fragment.label})`);
    for (const serviceCode of fragment.services) {
      const { data, error } = await db
        .from('services')
        .select('service_code')
        .eq('service_code', serviceCode)
        .maybeSingle();
      if (error) throw error;
      if (!data) problems.push(`services (${fragment.label}): "${serviceCode}" no existe en services`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Catalogos faltantes. Agregarlos es un INSERT en la tabla de catalogo, no una migracion:\n  - ${problems.join('\n  - ')}`
    );
  }
}

// --- snapshot en el bucket -------------------------------------------------

// El nombre del snapshot incluye el hash del contenido: dos cargas del mismo
// texto escriben el mismo objeto, y un texto distinto nunca pisa al anterior.
function snapshotPathFor(doc, fileContent, fileName) {
  const hash = crypto.createHash('sha256').update(fileContent).digest('hex').slice(0, 12);
  const verifiedDay = doc.source.verified_at.slice(0, 10);
  const slug = path.basename(fileName, '.md').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${doc.source.document_type}/${slug}/${verifiedDay}--${hash}.md`;
}

async function uploadSnapshot(db, objectPath, fileContent) {
  const { error } = await db.storage
    .from('corpus-fuentes')
    .upload(objectPath, new Blob([fileContent], { type: 'text/markdown' }), {
      contentType: 'text/markdown',
      upsert: true,
    });
  if (error) throw new Error(`No se pudo subir el snapshot a corpus-fuentes: ${error.message}`);
  return objectPath;
}

// --- embeddings ------------------------------------------------------------

async function activeEmbeddingModel(db) {
  const { data, error } = await db
    .from('embedding_models')
    .select('code, model_name, dimensions')
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('No hay un embedding_model activo (embedding_models.is_active)');
  return data;
}

async function embedText(model, apiKey, text) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model.model_name}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  const data = await res.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values) || values.length !== model.dimensions) {
    throw new Error(`Respuesta sin ${model.dimensions} valores: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return values;
}

async function hasEmbedding(db, fragmentId, modelCode) {
  const { data, error } = await db
    .from('fragment_embeddings')
    .select('fragment_id')
    .eq('fragment_id', fragmentId)
    .eq('model_code', modelCode)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

// --- carga de un archivo ---------------------------------------------------

async function loadFile(db, filePath, flags) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const doc = parseCorpusFile(fileContent, path.basename(filePath));

  console.log(`\n=== ${path.relative(process.cwd(), filePath)}`);
  console.log(`    ${doc.source.title} — ${doc.fragments.length} fragmento(s)`);

  await validateCatalogs(db, doc);
  const scopeIds = await resolveScope(db, doc.source);
  const objectPath = snapshotPathFor(doc, fileContent, path.basename(filePath));

  if (flags.dryRun) {
    console.log(`    [dry-run] ambito: ${JSON.stringify(scopeIds)}`);
    console.log(`    [dry-run] snapshot: corpus-fuentes/${objectPath}`);
    for (const fragment of doc.fragments) {
      console.log(
        `    [dry-run] fragmento ${fragment.label} — ${fragment.content.length} caracteres — services: ${
          fragment.services.join(', ') || '(ninguno)'
        }`
      );
    }
    return { file: filePath, dryRun: true, fragments: doc.fragments.length };
  }

  await uploadSnapshot(db, objectPath, fileContent);
  console.log(`    snapshot -> corpus-fuentes/${objectPath}`);

  const { data: sourceRows, error: sourceError } = await db.rpc('upsert_knowledge_source', {
    p_source_type_code: doc.source.source_type,
    p_document_type_code: doc.source.document_type,
    p_document_number: doc.source.document_number,
    p_title: doc.source.title,
    p_issuing_authority: doc.source.issuing_authority,
    p_country_id: scopeIds.country_id,
    p_state_province_id: scopeIds.state_province_id,
    p_subdivision_id: scopeIds.subdivision_id,
    p_requires_adhesion: doc.source.requires_adhesion,
    p_source_url: doc.source.source_url,
    p_snapshot_path: objectPath,
    p_verified_at: doc.source.verified_at,
    p_last_amended_by: doc.source.last_amended_by,
  });
  if (sourceError) throw new Error(`upsert_knowledge_source fallo: ${sourceError.message}`);
  const { source_id: sourceId, action: sourceAction } = sourceRows[0];
  console.log(`    fuente ${sourceAction}: ${sourceId}`);

  const model = flags.skipEmbeddings ? null : await activeEmbeddingModel(db);
  const apiKey = process.env.GEMINI_API_KEY;
  if (model && !apiKey) {
    throw new Error('Falta GEMINI_API_KEY (o correr con --skip-embeddings y embeber despues)');
  }

  const counts = { created: 0, versioned: 0, unchanged: 0, embedded: 0 };

  for (const fragment of doc.fragments) {
    const { data: fragmentRows, error: fragmentError } = await db.rpc('upsert_knowledge_fragment', {
      p_source_id: sourceId,
      p_hierarchy_path: fragment.hierarchy_path,
      p_article: fragment.article,
      p_subsection: fragment.subsection,
      p_content: fragment.content,
      p_foundation_type_code: fragment.foundation_type,
      p_service_codes: fragment.services,
    });
    if (fragmentError) throw new Error(`upsert_knowledge_fragment fallo (${fragment.label}): ${fragmentError.message}`);

    const { fragment_id: fragmentId, action } = fragmentRows[0];
    counts[action] += 1;
    console.log(`    fragmento ${fragment.label}: ${action} (${fragmentId})`);

    if (!model) continue;

    // Un fragmento sin cambios ya tiene su vector: re-embeberlo es gastar
    // cuota de Gemini para escribir el mismo numero.
    if (action === 'unchanged' && (await hasEmbedding(db, fragmentId, model.code))) continue;

    const embedding = await embedText(model, apiKey, fragment.content);
    const { error: embeddingError } = await db
      .from('fragment_embeddings')
      .upsert(
        { fragment_id: fragmentId, model_code: model.code, embedding: `[${embedding.join(',')}]` },
        { onConflict: 'fragment_id,model_code' }
      );
    if (embeddingError) throw new Error(`No se pudo guardar el embedding (${fragment.label}): ${embeddingError.message}`);
    counts.embedded += 1;
    console.log(`      embedding ${model.code} guardado`);
    await new Promise((resolve) => setTimeout(resolve, 300)); // cuota de Gemini
  }

  return { file: filePath, sourceId, snapshotPath: objectPath, counts };
}

// --- main ------------------------------------------------------------------

async function main() {
  loadDotEnv();
  const { files, flags } = parseArgs(process.argv.slice(2));

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Falta SUPABASE_URL (o VITE_SUPABASE_URL)');
  if (!serviceKey) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY. El corpus se escribe solo con clave de servicio:\n' +
        '  los RPC de carga y el bucket corpus-fuentes estan cerrados para anon/authenticated.'
    );
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  console.log(`Proyecto: ${url}${flags.dryRun ? '  [DRY RUN — no escribe nada]' : ''}`);

  const results = [];
  for (const file of files) {
    const absolute = path.resolve(file);
    if (!fs.existsSync(absolute)) throw new Error(`No existe el archivo: ${file}`);
    results.push(await loadFile(db, absolute, flags));
  }

  console.log('\n--- resumen ---');
  for (const result of results) {
    if (result.dryRun) {
      console.log(`${path.basename(result.file)}: ${result.fragments} fragmento(s) validados (dry-run)`);
      continue;
    }
    const { created, versioned, unchanged, embedded } = result.counts;
    console.log(
      `${path.basename(result.file)}: ${created} nuevo(s), ${versioned} versionado(s), ` +
        `${unchanged} sin cambios, ${embedded} embedding(s)`
    );
  }
}

main().catch((error) => {
  console.error(`\nERROR: ${error.message}`);
  process.exit(1);
});
