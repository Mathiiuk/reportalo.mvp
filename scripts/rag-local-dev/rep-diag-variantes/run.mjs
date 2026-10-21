// RAG-DIAG-VARIANTES · Compara variantes de recuperación contra la actual, SIN tocar la base (solo lectura).
//
// Para cada caso de casos.json:
//   1. Llama al RPC match_knowledge_fragments con ventana 100: devuelve TODOS los candidatos elegibles
//      (mismo filtro de categoría y jurisdicción que producción) con la similitud de producción (baseline).
//   2. Recalcula en memoria el ranking de esos mismos candidatos con vectores nuevos (variantes de texto e
//      instrucción de tarea) y con fusión por rango (RRF) contra el ranking de texto completo (columna fts).
//   3. Mide en qué posición queda la norma esperada (escenarios de casos.json, tomados del LEEME de Hernán §5).
//
// No escribe en fragment_embeddings, no crea funciones y no despliega nada. Los vectores de las variantes
// quedan en salida/cache-embeddings.json (carpeta no versionada) para no repetir llamadas a la API.
// El ranking de texto completo se lee de fts-ranks.json, que se genera con la consulta SELECT de fts.sql
// (se corre aparte, solo lectura: `node run.mjs --sql-fts` imprime la consulta).
//
// Requiere en el .env (por defecto el de la raíz del repo; --env <ruta> para otro):
// GEMINI_API_KEY, VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Apuntar SIEMPRE a staging.
//
// Uso:  node scripts/rag-local-dev/rep-diag-variantes/run.mjs [--env ../.env] [--sql-fts]
//        [--casos casos-bateria81.json --fts fts-ranks-bateria81.json] [--sin-sonda]
// --casos y --fts eligen otro juego de casos (por defecto casos.json y fts-ranks.json); casos-bateria81.json lo arma
// bateria.mjs. --sin-sonda omite las 2 llamadas que comprueban taskType (ya documentado en el informe del 16/10).
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

import { readProdConfig, buildQueryText } from '../rep-diag-ranking/lib.mjs';

const here = new URL('./', import.meta.url);
const root = new URL('../../../', import.meta.url);

const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

// ── Modo --p0 (REP-3859): M1 de la línea base con el set congelado, sin variantes ─────────────────────────────────
// Mide SOLO la recuperación de producción (ranking del RPC con ventana 100, top-k y umbral reales) con el esquema común
// de scripts/rag-local-dev/p0/esquema.mjs. Cada repetición vuelve a vectorizar la consulta (sin caché), como producción.
//   node run.mjs --p0 --set <casos-referencia-v1.json> [--repeticiones 3] [--despliegue "analizar-reporte v44"] [--dry-run] [--prueba]
// --dry-run valida el set y estima llamadas sin red. --prueba marca la salida como prueba (no vale para la puerta P0).
if (args.includes('--p0')) {
  const { ESQUEMA, VENTANA_M1, encabezadoMotor, filaM1, resumenM1, estimarLlamadas, leerReglasValidador } = await import('../p0/esquema.mjs');
  const { leerEnv, crearRest, infoGit, leerCorpus, resolverLocalidades, cargarSet, argsP0, marcaDeTiempo } = await import('../p0/entorno.mjs');
  const { readGenerationSpec, buildQueryText: queryTextOf } = await import('../rep-diag-generacion/lib.mjs');

  const { fileURLToPath } = await import('node:url');
  const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const opciones = argsP0(args);
  const fuente = fs.readFileSync(new URL('supabase/functions/analizar-reporte/index.ts', root), 'utf-8');
  const spec = readGenerationSpec(fuente);
  const reglas = leerReglasValidador(fuente);
  const set = cargarSet(path.resolve(opciones.rutaSet));
  console.log(`Set ${set.set_version}: ${set.casos.length} casos · ${opciones.repeticiones} repeticiones · ventana ${VENTANA_M1} · top-k ${spec.matchCount} · umbral ${spec.threshold}`);
  if (opciones.dryRun) {
    console.log(`Dry-run (sin red): ${JSON.stringify(estimarLlamadas(set.casos, opciones.repeticiones, reglas))}`);
    process.exit(0);
  }

  const { need } = leerEnv(argValue('--env') ? path.resolve(argValue('--env')) : new URL('.env', root));
  const geminiKey = need('GEMINI_API_KEY');
  const supabaseUrl = need('VITE_SUPABASE_URL').replace(/\/$/, '');
  const rest = crearRest(supabaseUrl, need('SUPABASE_SERVICE_ROLE_KEY'));
  console.log(`Proyecto Supabase: ${new URL(supabaseUrl).host} (confirmar que es STAGING).`);

  const git = infoGit(fileURLToPath(root));
  if (git.cambiosLocalesEnFuncion) console.warn('ATENCIÓN: analizar-reporte tiene cambios sin commitear: el código medido no es el del commit.');
  const corpus = await leerCorpus(rest);
  await resolverLocalidades(rest, set.casos);
  const inicio = new Date().toISOString();
  const motor = encabezadoMotor({ spec, git, despliegue: opciones.despliegue, corpus: corpus.huella });

  const embed = async (text) => {
    const backoffs = [2000, 5000, 10000, 20000];
    for (let attempt = 0; ; attempt += 1) {
      const res = await fetch(`${GEMINI_API}/models/${spec.embeddingModel}:embedContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({ model: `models/${spec.embeddingModel}`, content: { parts: [{ text }] }, outputDimensionality: spec.dimensions }),
      });
      if (res.ok) {
        const values = (await res.json())?.embedding?.values;
        if (!Array.isArray(values) || values.length !== spec.dimensions) throw new Error('Vector inválido');
        return values;
      }
      if (attempt >= backoffs.length || ![429, 500, 503].includes(res.status)) throw new Error(`embedContent falló (${res.status})`);
      await espera(backoffs[attempt]);
    }
  };

  const resultados = [];
  for (let repeticion = 1; repeticion <= opciones.repeticiones; repeticion += 1) {
    for (const caso of set.casos) {
      const fecha_utc = new Date().toISOString();
      const vector = await embed(queryTextOf(caso.descripcion, caso.categoria));
      const filas = await rest('rpc/match_knowledge_fragments', {
        method: 'POST',
        body: JSON.stringify({
          query_embedding: vector,
          p_locality_id: caso.localidad_id,
          p_model_code: spec.embeddingModelCode,
          match_count: VENTANA_M1,
          p_service_code: caso.categoria,
        }),
      });
      const m = filaM1(filas, caso.esperados_n1, spec);
      resultados.push({
        caso_id: caso.caso_id,
        repeticion,
        fecha_utc,
        pendiente_po: caso.pendiente_po,
        universo: caso.universo,
        categoria: caso.categoria,
        // Producción no recupera para VULNERABILIDAD_SOCIAL (corta antes, estado asistencia): se mide igual, informativo
        recupera_en_produccion: caso.categoria !== reglas.vulnerabilidad,
        esperados_n1: caso.esperados_n1,
        esperados_n2: caso.esperados_n2,
        ...m,
      });
      console.log(`${caso.caso_id.padEnd(16)} r${repeticion} · cand ${String(filas.length).padStart(3)} · 1.ª esperada ${m.posicion_primera_esperada ?? '-'} · entregados ${m.entregados}`);
    }
  }

  const salida = {
    esquema: ESQUEMA,
    medicion: 'M1',
    prueba: opciones.prueba,
    set_version: set.set_version,
    inicio_utc: inicio,
    fin_utc: new Date().toISOString(),
    repeticiones: opciones.repeticiones,
    ventana: VENTANA_M1,
    motor,
    resumen: resumenM1(resultados),
    resultados,
  };
  fs.mkdirSync(new URL('salida/', here), { recursive: true });
  const nombre = `RAG-P0_M1${opciones.prueba ? '_PRUEBA' : ''}_${marcaDeTiempo(inicio)}.json`;
  fs.writeFileSync(new URL(`salida/${nombre}`, here), JSON.stringify(salida, null, 2));
  console.log(`\nResumen: ${JSON.stringify(salida.resumen)}`);
  console.log(`Salida: scripts/rag-local-dev/rep-diag-variantes/salida/${nombre}`);
  process.exit(0);
}

const casosFile = argValue('--casos') ?? 'casos.json';
const ftsFile = argValue('--fts') ?? 'fts-ranks.json';
const { escenarios, casos } = JSON.parse(fs.readFileSync(new URL(casosFile, here), 'utf-8'));

// ── Modo --sql-fts: imprime la consulta de solo lectura que genera fts-ranks.json ──────────────────────
// Texto de búsqueda = solo la descripción (sin «(categoría: X)», que agregaría lexemas del código).
// plainto_tsquery une los términos con AND (casi nunca hay match en textos largos): se pasan a OR.
// Se filtra por la categoría del caso (la jurisdicción la aplica después el script con los candidatos del RPC)
// y se devuelve solo el ORDEN, con ids abreviados (2 primeros + 3 últimos caracteres) para que la salida sea chica.
if (args.includes('--sql-fts')) {
  const esc = (s) => s.replace(/'/g, "''");
  const values = casos.map((c) => `('${c.id}', '${c.categoria}', '${esc(c.descripcion)}')`).join(',\n  ');
  console.log(`-- Solo lectura. Orden por ts_rank sobre knowledge_fragments.fts, por caso. Guardar el JSON en ${ftsFile}.
-- La consulta de texto (lexemas unidos con OR) es la misma que arma match_knowledge_fragments_hibrida.
with q(caso, svc, txt) as (values
  ${values}
), tq as (
  select caso, svc, nullif(replace(plainto_tsquery('spanish', txt)::text, ' & ', ' | '), '') as qs from q
), hits as (
  select tq.caso, f.id, ts_rank(f.fts, tq.qs::tsquery) as r
  from tq
  join knowledge_fragments f on f.is_current and tq.qs is not null and f.fts @@ tq.qs::tsquery
  where exists (select 1 from fragment_services fs join services s on s.id = fs.service_id
                where fs.fragment_id = f.id and s.service_code = tq.svc)
)
select json_object_agg(tq.caso, coalesce(h.orden, '')) as fts_ranks
from tq left join (
  select caso, string_agg(left(id::text, 2) || right(id::text, 3), ',' order by r desc, id) as orden from hits group by caso
) h using (caso);`);
  process.exit(0);
}

// ── Configuración y credenciales (sin imprimir valores) ─────────────────────────────────────────────
const envPath = argValue('--env') ? path.resolve(argValue('--env')) : new URL('.env', root);
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf-8')
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()])
);
const need = (name) => {
  if (!env[name]) throw new Error(`Falta ${name} en el .env (no se imprime su valor).`);
  return env[name];
};
const geminiKey = need('GEMINI_API_KEY');
const supabaseUrl = need('VITE_SUPABASE_URL').replace(/\/$/, '');
const serviceKey = need('SUPABASE_SERVICE_ROLE_KEY');

const config = readProdConfig(fs.readFileSync(new URL('supabase/functions/analizar-reporte/index.ts', root), 'utf-8'));
const API = 'https://generativelanguage.googleapis.com/v1beta';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const apiCalls = { embedContent: 0, batchEmbedContents: 0, textosVectorizados: 0, caracteresVectorizados: 0 };

const gemini = async (method, body) => {
  const backoffs = [2000, 5000, 10000, 20000];
  for (let attempt = 0; ; attempt += 1) {
    apiCalls[method] += 1;
    const res = await fetch(`${API}/models/${config.embeddingModel}:${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const text = (await res.text()).slice(0, 400);
    if (attempt >= backoffs.length || ![429, 500, 503].includes(res.status)) {
      const err = new Error(`${method} falló (${res.status}): ${text}`);
      err.status = res.status;
      throw err;
    }
    await sleep(backoffs[attempt]);
  }
};

// ── Caché local de vectores (clave = hash del texto exacto que se vectoriza) ────────────────────────
fs.mkdirSync(new URL('salida/', here), { recursive: true });
const cacheUrl = new URL('salida/cache-embeddings.json', here);
const cache = fs.existsSync(cacheUrl) ? JSON.parse(fs.readFileSync(cacheUrl, 'utf-8')) : {};
const keyOf = (text) => crypto.createHash('sha256').update(`${config.embeddingModel}@${config.dimensions}\n${text}`).digest('hex');

/** Vectoriza en lotes de 100 con batchEmbedContents (mismo modelo y dimensiones que la función, sin taskType). */
const embedAll = async (texts) => {
  const pending = [...new Set(texts)].filter((t) => !cache[keyOf(t)]);
  for (let i = 0; i < pending.length; i += 100) {
    const chunk = pending.slice(i, i + 100);
    const out = await gemini('batchEmbedContents', {
      requests: chunk.map((text) => ({
        model: `models/${config.embeddingModel}`,
        content: { parts: [{ text }] },
        outputDimensionality: config.dimensions,
      })),
    });
    if (!Array.isArray(out.embeddings) || out.embeddings.length !== chunk.length) throw new Error('Respuesta de lote inválida');
    out.embeddings.forEach((e, j) => {
      if (e.values?.length !== config.dimensions) throw new Error('Vector inválido');
      cache[keyOf(chunk[j])] = e.values;
    });
    apiCalls.textosVectorizados += chunk.length;
    apiCalls.caracteresVectorizados += chunk.reduce((n, t) => n + t.length, 0);
    fs.writeFileSync(cacheUrl, JSON.stringify(cache));
  }
  return (t) => cache[keyOf(t)];
};

const cosine = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / Math.sqrt(na * nb);
};

// ── Supabase (solo lectura) ─────────────────────────────────────────────────────────────────────────
const rest = async (path, init = {}) => {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      ...(serviceKey.startsWith('eyJ') ? { Authorization: `Bearer ${serviceKey}` } : {}),
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path.split('?')[0]} falló (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
};

console.log(`Proyecto Supabase: ${new URL(supabaseUrl).host} (confirmar que es STAGING). Modelo: ${config.embeddingModelCode}.`);

// ── 0. ¿gemini-embedding-2 acepta taskType? (una llamada, para dejar constancia) ─────────────────────
let taskTypeProbe = 'no medido en esta corrida (--sin-sonda)';
if (!args.includes('--sin-sonda')) try {
  const r = await gemini('embedContent', {
    model: `models/${config.embeddingModel}`,
    content: { parts: [{ text: 'bache grande' }] },
    taskType: 'RETRIEVAL_QUERY',
    outputDimensionality: config.dimensions,
  });
  const plain = await gemini('embedContent', {
    model: `models/${config.embeddingModel}`,
    content: { parts: [{ text: 'bache grande' }] },
    outputDimensionality: config.dimensions,
  });
  taskTypeProbe = `aceptado; coseno contra el mismo texto sin taskType = ${cosine(r.embedding.values, plain.embedding.values).toFixed(6)}`;
} catch (e) {
  taskTypeProbe = `rechazado (${e.status ?? '?'}): ${e.message.slice(0, 200)}`;
}
if (!args.includes('--sin-sonda')) console.log(`taskType en ${config.embeddingModel}: ${taskTypeProbe}`);

// ── 1. Fragmentos vigentes y textos de cada variante ────────────────────────────────────────────────
const fragments = await rest(
  'knowledge_fragments?select=id,hierarchy_path,article,content,knowledge_sources(title,document_number)&is_current=eq.true'
);
const norma = (f) => {
  const s = f.knowledge_sources ?? {};
  return s.document_number && !s.title.includes(s.document_number) ? `${s.title} (${s.document_number})` : s.title;
};
// Texto enriquecido: norma + ruta jerárquica (que ya trae el artículo y el inciso) + contenido.
// El artículo suelto no se repite: `article` es un código ("anexo-3", "11.1.4") ya presente en la ruta.
const docTexts = {
  plano: (f) => f.content,
  prefijo: (f) => `title: none | text: ${f.content}`,
  enriquecido: (f) => `${norma(f)}\n${f.hierarchy_path}\n${f.content}`,
  enriquecido_prefijo: (f) => `title: ${norma(f)} — ${f.hierarchy_path} | text: ${f.content}`,
};
const queryTexts = {
  plano: (c) => buildQueryText(c.descripcion, c.categoria),
  prefijo: (c) => `task: search result | query: ${buildQueryText(c.descripcion, c.categoria)}`,
};

// Variantes de vector: [texto de la consulta, texto del fragmento]
const vectorVariants = {
  B: ['plano', 'plano'],
  V1: ['prefijo', 'prefijo'],
  V2: ['plano', 'enriquecido'],
  'V1+V2': ['prefijo', 'enriquecido_prefijo'],
};

const allTexts = [
  ...Object.values(docTexts).flatMap((fn) => fragments.map(fn)),
  ...Object.values(queryTexts).flatMap((fn) => casos.map(fn)),
];
const vec = await embedAll(allTexts);

// ── 2. Ranking de texto completo (generado con fts.sql) ─────────────────────────────────────────────
const ftsUrl = new URL(ftsFile, here);
if (!fs.existsSync(ftsUrl)) throw new Error(`Falta ${ftsFile}: correr la consulta de \`--sql-fts\` y guardar su salida.`);
const ftsRanks = JSON.parse(fs.readFileSync(ftsUrl, 'utf-8'));
const shortId = (id) => id.slice(0, 2) + id.slice(-3);
const byShort = new Map();
for (const f of fragments) {
  if (byShort.has(shortId(f.id))) throw new Error(`Id abreviado repetido: ${shortId(f.id)}`);
  byShort.set(shortId(f.id), f.id);
}
/** Orden de texto completo del caso, ya expandido a ids completos. */
const ftsOrderOf = (caseId) => {
  const raw = ftsRanks[caseId];
  if (raw === undefined) throw new Error(`${ftsFile} no tiene el caso ${caseId}: regenerarlo con --sql-fts`);
  return raw ? raw.split(',').map((s) => {
    if (!byShort.has(s)) throw new Error(`Id abreviado desconocido en fts-ranks.json: ${s}`);
    return byShort.get(s);
  }) : [];
};

const RRF_K = 60;
const rankMap = (ids) => new Map(ids.map((id, i) => [id, i + 1]));
const rrf = (vectorOrder, ftsOrder, pesoTexto = 1) => {
  const rv = rankMap(vectorOrder);
  const rf = rankMap(ftsOrder);
  const score = (id) => 1 / (RRF_K + rv.get(id)) + (rf.has(id) ? pesoTexto / (RRF_K + rf.get(id)) : 0);
  return [...vectorOrder].sort((a, b) => score(b) - score(a) || rv.get(a) - rv.get(b));
};

// ── 3. Casos ────────────────────────────────────────────────────────────────────────────────────────
const fragById = new Map(fragments.map((f) => [f.id, f]));
const results = [];
let maxBaselineDiff = 0;
for (const c of casos) {
  const qPlain = vec(queryTexts.plano(c));
  const rows = await rest('rpc/match_knowledge_fragments', {
    method: 'POST',
    body: JSON.stringify({
      query_embedding: qPlain,
      p_locality_id: c.localidad,
      p_model_code: config.embeddingModelCode,
      match_count: 100,
      p_service_code: c.categoria,
    }),
  });
  const candidates = rows.map((r) => r.fragment_id);

  const sims = {};
  const orders = {};
  for (const [name, [qMode, dMode]] of Object.entries(vectorVariants)) {
    const q = vec(queryTexts[qMode](c));
    sims[name] = Object.fromEntries(candidates.map((id) => [id, cosine(q, vec(docTexts[dMode](fragById.get(id))))]));
    orders[name] = [...candidates].sort((a, b) => sims[name][b] - sims[name][a]);
  }
  // Producción guarda el vector del fragmento; el local se recalcula. Deben coincidir (control de la medición).
  for (const r of rows) maxBaselineDiff = Math.max(maxBaselineDiff, Math.abs(r.similarity - sims.B[r.fragment_id]));
  orders.B_prod = candidates;

  const candSet = new Set(candidates);
  const ftsOrder = ftsOrderOf(c.id).filter((id) => candSet.has(id));
  orders.V3 = rrf(orders.B, ftsOrder);
  orders['V3+V2'] = rrf(orders.V2, ftsOrder);
  orders['V3+V1+V2'] = rrf(orders['V1+V2'], ftsOrder);
  // Sensibilidad: mismo RRF con el lado de texto a la mitad de peso (no es la variante propuesta).
  orders['V3t05'] = rrf(orders.B, ftsOrder, 0.5);

  const expected = new Set(escenarios[c.escenario].esperados);
  const metrics = {};
  for (const [name, order] of Object.entries(orders)) {
    const positions = order.map((id, i) => (expected.has(id) ? i + 1 : null)).filter(Boolean);
    const simName = name.startsWith('V3') ? null : name === 'B_prod' ? 'B' : name;
    // Similitud con la que se aplica el umbral: la del ranking vectorial de base (RRF no cambia el coseno).
    const simUmbral = sims[{ V3: 'B', V3t05: 'B', 'V3+V2': 'V2', 'V3+V1+V2': 'V1+V2', B_prod: 'B' }[name] ?? name];
    const top = order.slice(0, config.matchCount);
    const entregados = top.filter((id) => simUmbral[id] >= config.threshold);
    metrics[name] = {
      primera: positions[0] ?? null,
      posiciones: positions,
      enTop8: positions.filter((p) => p <= config.matchCount).length,
      simMax: simName ? sims[simName][order[0]] : null,
      top8: top.map((id) => fragById.get(id).hierarchy_path),
      top8Ids: top,
      // Lo que llega al modelo en producción: top-k y similitud >= umbral.
      entregados: entregados.length,
      entregadosIds: entregados,
      entregadosSim: entregados.map((id) => simUmbral[id]),
      esperadosEntregados: entregados.filter((id) => expected.has(id)).length,
    };
  }
  results.push({
    id: c.id, grupo: c.grupo, escenario: c.escenario, categoria: c.categoria, descripcion: c.descripcion,
    filas: c.filas ?? [c.id], estadosObservados: c.estadosObservados ?? null,
    candidatos: candidates.length, esperadosElegibles: candidates.filter((id) => expected.has(id)).length,
    ftsCoincidencias: ftsOrder.length, metrics,
    esperadosDetalle: candidates.filter((id) => expected.has(id)).map((id) => ({
      id, ruta: fragById.get(id).hierarchy_path,
      posicion: Object.fromEntries(Object.entries(orders).map(([n, o]) => [n, o.indexOf(id) + 1])),
      similitud: sims.B[id],
    })),
  });
  const m = metrics;
  console.log(`${c.id.padEnd(16)} cand ${String(candidates.length).padStart(2)} · 1.ª esperada B ${m.B.primera ?? '-'} · V1 ${m.V1.primera ?? '-'} · V2 ${m.V2.primera ?? '-'} · V1+V2 ${m['V1+V2'].primera ?? '-'} · V3 ${m.V3.primera ?? '-'} · V3+V2 ${m['V3+V2'].primera ?? '-'}`);
}

const generatedAt = new Date().toISOString();
const stamp = `${casosFile === 'casos.json' ? '' : `${casosFile.replace(/^casos-?|\.json$/g, '')}-`}${generatedAt.replace(/[:.]/g, '-')}`;
fs.writeFileSync(
  new URL(`salida/variantes-${stamp}.json`, here),
  JSON.stringify({ generatedAt, casosFile, ftsFile, config, taskTypeProbe, apiCalls, maxBaselineDiff, rrfK: RRF_K, results }, null, 2)
);
console.log(`\nControl: diferencia máxima entre similitud de producción y recalculada = ${maxBaselineDiff.toExponential(2)}`);
console.log(`Llamadas a la API en esta corrida: ${JSON.stringify(apiCalls)}`);
console.log(`Salida: scripts/rag-local-dev/rep-diag-variantes/salida/variantes-${stamp}.json`);
