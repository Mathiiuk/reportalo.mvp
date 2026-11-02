// RAG-DIAG-GENERACION · Experimento B: ¿varía la generación con el contexto congelado? (solo lectura en la base).
//
// 1) Congela el contexto de un caso: vectoriza la consulta, llama al RPC match_knowledge_fragments y se queda con lo
//    que hoy llega al modelo (umbral + top-k de producción). Se guarda en salida/contexto-<caso>.json.
// 2) Llama N veces a generateContent con EXACTAMENTE los mismos bytes (se imprime el sha256 del prompt) y la misma
//    configuración que analizar-reporte (modelo, temperatura, thinking, esquema, tope de salida), leídos del fuente.
// 3) Informa estados, conjuntos de citas, validación y tokens de cada corrida.
//
// No escribe en la base y no imprime claves. Cuesta N llamadas de generación a Gemini (por defecto 5).
// Requiere en el .env de la raíz: GEMINI_API_KEY, VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (solo si hay que
// recuperar el contexto; con --reusar y un contexto ya congelado no se necesita Supabase). Apuntar SIEMPRE a staging.
//
// Uso:  node scripts/rag-local-dev/rep-diag-generacion/run.mjs [--caso D2-AVE-4] [--corridas 5] [--temperatura 1] [--reusar]
//        [--env <ruta al .env>]
//
// Contexto de otra recuperación (p. ej. la híbrida, que todavía no tiene RPC desplegado):
//        run.mjs --desde-variantes ../rep-diag-variantes/salida/variantes-bateria81-<fecha>.json --caso B-B1-22 --variante V3
// toma de esa salida los fragmentos que llegan al modelo con la variante pedida (top 8 y umbral, en ese orden) y lee su
// texto de knowledge_fragments (solo lectura). Con --variante B se obtiene el contexto actual del mismo caso.
import fs from 'node:fs';

import { readGenerationSpec, buildQueryText, buildPrompt, sha256, validateRun, summarizeRuns, toMarkdown } from './lib.mjs';

const here = new URL('./', import.meta.url);
const root = new URL('../../../', import.meta.url);

const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
// ── Modo --p0 (REP-3859): M2 de la línea base con el set congelado ───────────────────────────────────────────────
// Reproduce analizar-reporte paso a paso SIN persistir nada: VULNERABILIDAD_SOCIAL → asistencia sin modelo; vectorizar,
// recuperar top-k, filtrar por umbral; sin fragmentos → sin_normativa sin modelo; si hay, generar con el prompt, el esquema
// y la configuración leídos del fuente, y validar con la réplica fiel de validateLlmAnalysis + validateOrganismoSugerido
// (p0/esquema.mjs). El estado final es el que guardaría producción. Esquema común de p0/esquema.mjs.
//   node run.mjs --p0 --set <casos-referencia-v1.json> [--repeticiones 3] [--despliegue "analizar-reporte v44"] [--dry-run] [--prueba]
//                 [--casos P0-069,P0-070] [--doble-validador]
// --doble-validador (REP-3857, P1): cada respuesta se valida con la regla de P0 (literal) y con la de P1 (elisión).
// --casos: solo esos casos; la corrida queda marcada con `subconjunto` y no vale para una puerta.
if (args.includes('--p0')) {
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { ESQUEMA, encabezadoMotor, validarComoProduccion, citaLiteralP0, filaM2, resumenM2, estimarLlamadas, leerReglasValidador } = await import('../p0/esquema.mjs');
  const { leerEnv, crearRest, infoGit, leerCorpus, resolverLocalidades, leerAgencias, cargarSet, argsP0, marcaDeTiempo } = await import('../p0/entorno.mjs');

  const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const opciones = argsP0(args);
  const fuente = fs.readFileSync(new URL('supabase/functions/analizar-reporte/index.ts', root), 'utf-8');
  const spec = readGenerationSpec(fuente);
  const reglas = leerReglasValidador(fuente);
  const set = cargarSet(path.resolve(opciones.rutaSet));
  if (opciones.casos) {
    const faltan = opciones.casos.filter((id) => !set.casos.some((c) => c.caso_id === id));
    if (faltan.length) throw new Error(`--casos: no están en el set: ${faltan.join(', ')}`);
    set.casos = set.casos.filter((c) => opciones.casos.includes(c.caso_id));
  }
  console.log(`Set ${set.set_version}: ${set.casos.length} casos · ${opciones.repeticiones} repeticiones · ${spec.model} · prompt ${spec.promptVersion} · temperatura ${spec.temperature}`);
  if (opciones.dryRun) {
    console.log(`Dry-run (sin red): ${JSON.stringify(estimarLlamadas(set.casos, opciones.repeticiones, reglas))}`);
    process.exit(0);
  }

  const { need } = leerEnv(argValue('--env') ? path.resolve(argValue('--env')) : new URL('.env', root));
  const apiKey = need('GEMINI_API_KEY');
  const supabaseUrl = need('VITE_SUPABASE_URL').replace(/\/$/, '');
  const rest = crearRest(supabaseUrl, need('SUPABASE_SERVICE_ROLE_KEY'));
  console.log(`Proyecto Supabase: ${new URL(supabaseUrl).host} (confirmar que es STAGING).`);

  const git = infoGit(fileURLToPath(root));
  if (git.cambiosLocalesEnFuncion) console.warn('ATENCIÓN: analizar-reporte tiene cambios sin commitear: el código medido no es el del commit.');
  const corpus = await leerCorpus(rest);
  const articulos = new Map(corpus.fragments.map((f) => [f.id, [f.article, f.subsection].filter(Boolean).join(' inc. ') || null]));
  const agencias = await leerAgencias(rest);
  await resolverLocalidades(rest, set.casos);
  const inicio = new Date().toISOString();
  const motor = encabezadoMotor({ spec, git, despliegue: opciones.despliegue, corpus: corpus.huella });

  const gemini = async (metodo, modelo, body) => {
    const backoffs = [2000, 5000, 10000, 20000];
    for (let attempt = 0; ; attempt += 1) {
      let res;
      try {
        res = await fetch(`${GEMINI_API}/models/${modelo}:${metodo}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body),
        });
      } catch (e) {
        // 23/10: una caída de red (UND_ERR_CONNECT_TIMEOUT) tiraba abajo toda la corrida. Se reintenta igual que un 503
        if (attempt >= backoffs.length) throw new Error(`${metodo} falló (red: ${e.cause?.code ?? e.message})`);
        await espera(backoffs[attempt]);
        continue;
      }
      if (res.ok) return res.json();
      if (attempt >= backoffs.length || ![429, 500, 503].includes(res.status)) throw new Error(`${metodo} falló (${res.status})`);
      await espera(backoffs[attempt]);
    }
  };

  const resultados = [];
  for (let repeticion = 1; repeticion <= opciones.repeticiones; repeticion += 1) {
    for (const caso of set.casos) {
      const fecha_utc = new Date().toISOString();
      const t0 = Date.now();
      let r;
      if (caso.categoria === reglas.vulnerabilidad) {
        // Producción corta antes de vectorizar: estado asistencia, sin modelo
        r = { camino: 'asistencia', fragments: [], latencia_ms: Date.now() - t0 };
      } else {
        const emb = await gemini('embedContent', spec.embeddingModel, {
          model: `models/${spec.embeddingModel}`,
          content: { parts: [{ text: buildQueryText(caso.descripcion, caso.categoria) }] },
          outputDimensionality: spec.dimensions,
        });
        const filas = await rest('rpc/match_knowledge_fragments', {
          method: 'POST',
          body: JSON.stringify({
            query_embedding: (() => {
              const values = emb?.embedding?.values;
              if (!Array.isArray(values) || values.length !== spec.dimensions) throw new Error('Vector inválido');
              return values;
            })(),
            p_locality_id: caso.localidad_id,
            p_model_code: spec.embeddingModelCode,
            match_count: spec.matchCount,
            p_service_code: caso.categoria.toUpperCase(),
          }),
        });
        const fragments = filas.filter((f) => f.similarity >= spec.threshold);
        if (fragments.length === 0) {
          r = { camino: 'sin_normativa', fragments, latencia_ms: Date.now() - t0 };
        } else {
          const prompt = buildPrompt(spec.instructions, { reportText: caso.descripcion, category: caso.categoria, fragments });
          try {
            const data = await gemini('generateContent', spec.model, {
              model: `models/${spec.model}`,
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: spec.schema,
                thinkingConfig: { thinkingLevel: spec.thinkingLevel },
                temperature: spec.temperature,
                maxOutputTokens: spec.maxOutputTokens,
              },
            });
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error(`sin contenido (finishReason: ${data?.candidates?.[0]?.finishReason ?? '?'})`);
            const parsed = JSON.parse(text);
            r = {
              camino: 'generacion', parsed, fragments, usage: data.usageMetadata ?? {}, prompt_sha256: sha256(prompt),
              validacion: validarComoProduccion(parsed, fragments, caso.categoria, { ...reglas, agencias }),
              ...(opciones.dobleValidador && {
                validacionP0: validarComoProduccion(parsed, fragments, caso.categoria, { ...reglas, agencias, citaCoincide: citaLiteralP0 }),
              }),
              latencia_ms: Date.now() - t0,
            };
          } catch (e) {
            // Producción falla cerrado a indeterminado ante cualquier error de la generación
            r = { camino: 'generacion', error: String(e.message).slice(0, 300), fragments, latencia_ms: Date.now() - t0 };
          }
        }
      }
      const fila = filaM2(r, caso.esperados_n1, (id) => articulos.get(id) ?? null);
      resultados.push({
        caso_id: caso.caso_id,
        repeticion,
        fecha_utc,
        pendiente_po: caso.pendiente_po,
        universo: caso.universo,
        categoria: caso.categoria,
        esperados_n1: caso.esperados_n1,
        esperados_n2: caso.esperados_n2,
        prompt_sha256: r.prompt_sha256 ?? null,
        ...fila,
      });
      console.log(`${caso.caso_id.padEnd(16)} r${repeticion} · ${fila.estado}${fila.rechazo_validador ? ' (rechazo del validador)' : ''} · citas ${fila.citas.length} · N1 ${fila.cita_esperada_n1 ? 'sí' : 'no'}`);
    }
  }

  const salida = {
    esquema: ESQUEMA,
    medicion: 'M2',
    prueba: opciones.prueba,
    set_version: set.set_version,
    subconjunto: opciones.casos,
    doble_validador: opciones.dobleValidador,
    inicio_utc: inicio,
    fin_utc: new Date().toISOString(),
    repeticiones: opciones.repeticiones,
    motor,
    resumen: resumenM2(resultados),
    resultados,
  };
  const dir = new URL('salida/', here);
  fs.mkdirSync(dir, { recursive: true });
  const nombre = `RAG-P0_M2${opciones.prueba ? '_PRUEBA' : ''}${opciones.dobleValidador ? '_DOBLE' : ''}${opciones.casos ? '_SUBSET' : ''}_${marcaDeTiempo(inicio)}.json`;
  fs.writeFileSync(new URL(nombre, dir), JSON.stringify(salida, null, 2));
  console.log(`\nResumen: ${JSON.stringify(salida.resumen)}`);
  console.log(`Salida: scripts/rag-local-dev/rep-diag-generacion/salida/${nombre}`);
  process.exit(0);
}

const casoId = argValue('--caso') ?? 'D2-AVE-4';
const corridas = Number(argValue('--corridas') ?? 5);
const reuse = args.includes('--reusar');
const desdeVariantes = argValue('--desde-variantes');
const variante = argValue('--variante') ?? 'B';
if (!Number.isInteger(corridas) || corridas < 1 || corridas > 20) throw new Error('--corridas debe ser un entero entre 1 y 20');

const env = Object.fromEntries(
  fs.readFileSync(argValue('--env') ?? new URL('.env', root), 'utf-8')
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()])
);
const need = (name) => {
  if (!env[name]) throw new Error(`Falta ${name} en el .env de la raíz (no se imprime su valor).`);
  return env[name];
};
const geminiKey = need('GEMINI_API_KEY');

const spec = readGenerationSpec(fs.readFileSync(new URL('supabase/functions/analizar-reporte/index.ts', root), 'utf-8'));
const temperature = argValue('--temperatura') !== null ? Number(argValue('--temperatura')) : spec.temperature;
if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw new Error('--temperatura debe estar entre 0 y 2');

let caso;
let variantesCaso = null;
if (desdeVariantes) {
  variantesCaso = JSON.parse(fs.readFileSync(desdeVariantes, 'utf-8')).results.find((r) => r.id === casoId);
  if (!variantesCaso) throw new Error(`No existe el caso "${casoId}" en ${desdeVariantes}`);
  if (!variantesCaso.metrics[variante]?.entregadosIds) throw new Error(`La salida no tiene la variante ${variante} con entregadosIds (regenerarla con run.mjs)`);
  caso = { id: `${casoId}-${variante}`, categoria: variantesCaso.categoria, descripcion: variantesCaso.descripcion, escenario: variantesCaso.escenario, variante };
} else {
  caso = JSON.parse(fs.readFileSync(new URL('casos.json', here), 'utf-8')).find((c) => c.id === casoId);
  if (!caso) throw new Error(`No existe el caso "${casoId}" en casos.json`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';

/** Reintenta 429/500/503 con espera creciente; devuelve la respuesta cruda. */
const geminiFetch = async (url, body) => {
  const backoffs = [2000, 5000, 10000];
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify(body),
    });
    if (res.ok || attempt >= backoffs.length || ![429, 500, 503].includes(res.status)) return res;
    await sleep(backoffs[attempt]);
  }
};

const salidaDir = new URL('salida/', here);
fs.mkdirSync(salidaDir, { recursive: true });
const fixtureUrl = new URL(`contexto-${caso.id}.json`, salidaDir);

// --- 1) Contexto congelado ---------------------------------------------------------------------------------------
let fragments;
if (reuse && fs.existsSync(fixtureUrl)) {
  fragments = JSON.parse(fs.readFileSync(fixtureUrl, 'utf-8')).fragments;
  console.log(`Contexto reutilizado de salida/contexto-${caso.id}.json (${fragments.length} fragmentos).`);
} else {
  const supabaseUrl = need('VITE_SUPABASE_URL').replace(/\/$/, '');
  const serviceKey = need('SUPABASE_SERVICE_ROLE_KEY');
  console.log(`Proyecto Supabase: ${new URL(supabaseUrl).host} (confirmar que es STAGING).`);

  const rest = async (path, init = {}) => {
    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        // La clave legacy service_role es un JWT y va también como Bearer; las sb_secret_... solo en apikey.
        ...(serviceKey.startsWith('eyJ') ? { Authorization: `Bearer ${serviceKey}` } : {}),
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Supabase ${path.split('?')[0]} falló (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return res.json();
  };

  if (variantesCaso) {
    const m = variantesCaso.metrics[variante];
    const rows = await rest(`knowledge_fragments?select=id,source_id,hierarchy_path,content&id=in.(${m.entregadosIds.join(',')})`);
    const byId = new Map(rows.map((r) => [r.id, r]));
    fragments = m.entregadosIds.map((id, i) => {
      const r = byId.get(id);
      if (!r) throw new Error(`No se encontró el fragmento ${id}`);
      return { fragment_id: id, source_id: r.source_id, hierarchy_path: r.hierarchy_path, content: r.content, similarity: m.entregadosSim[i] };
    });
  } else {
    const locs = await rest(
      `localities?select=id,name,subdivisions!inner(name,states_provinces!inner(name))` +
        `&name=eq.${encodeURIComponent(caso.localidad)}&subdivisions.states_provinces.name=eq.${encodeURIComponent(caso.provincia)}`
    );
    if (locs.length !== 1) throw new Error(`Se esperaba 1 localidad "${caso.localidad}" (${caso.provincia}) y hay ${locs.length}.`);

    const embRes = await geminiFetch(`${GEMINI}/models/${spec.embeddingModel}:embedContent`, {
      model: `models/${spec.embeddingModel}`,
      content: { parts: [{ text: buildQueryText(caso.descripcion, caso.categoria) }] },
      outputDimensionality: spec.dimensions,
    });
    if (!embRes.ok) throw new Error(`embedContent falló (${embRes.status})`);
    const vector = (await embRes.json())?.embedding?.values;
    if (!Array.isArray(vector) || vector.length !== spec.dimensions) throw new Error('Vector inválido');

    const rows = await rest('rpc/match_knowledge_fragments', {
      method: 'POST',
      body: JSON.stringify({
        query_embedding: vector,
        p_locality_id: locs[0].id,
        p_model_code: spec.embeddingModelCode,
        match_count: spec.matchCount,
        p_service_code: caso.categoria ?? null,
      }),
    });
    // Igual que la función: solo lo que supera el umbral llega al modelo.
    fragments = rows.filter((r) => r.similarity >= spec.threshold);
  }
  fs.writeFileSync(fixtureUrl, JSON.stringify({ caso, congeladoEn: new Date().toISOString(), fragments }, null, 2));
  console.log(`Contexto congelado en salida/contexto-${caso.id}.json (${fragments.length} fragmentos).`);
}
if (fragments.length === 0) throw new Error('Ningún fragmento supera el umbral: en producción este caso sería sin_normativa sin llamar al modelo.');

// --- 2) N corridas con los mismos bytes --------------------------------------------------------------------------
const prompt = buildPrompt(spec.instructions, { reportText: caso.descripcion, category: caso.categoria, fragments });
const promptHash = sha256(prompt);
console.log(`Prompt ${spec.promptVersion} · sha256 ${promptHash.slice(0, 16)}… · ${corridas} corridas · temperatura ${temperature}${temperature !== spec.temperature ? ` (producción: ${spec.temperature})` : ''}.`);

const body = {
  model: `models/${spec.model}`,
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: spec.schema,
    thinkingConfig: { thinkingLevel: spec.thinkingLevel },
    temperature,
    maxOutputTokens: spec.maxOutputTokens,
  },
};

const runs = [];
for (let i = 1; i <= corridas; i += 1) {
  const started = performance.now();
  try {
    const res = await geminiFetch(`${GEMINI}/models/${spec.model}:generateContent`, body);
    if (!res.ok) throw new Error(`generateContent falló (${res.status})`);
    const data = await res.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`sin contenido (finishReason: ${candidate?.finishReason ?? '?'})`);
    const parsed = JSON.parse(text);
    const validation = validateRun(parsed, fragments, caso.categoria);
    runs.push({ parsed, validation, usage: data.usageMetadata ?? {}, finishReason: candidate.finishReason, ms: Math.round(performance.now() - started) });
    console.log(`  #${i}: ${parsed.estado} · citas ${(parsed.citas ?? []).length} · ${validation.valid ? 'válida' : `NO válida (${validation.reason})`} · ${Math.round(performance.now() - started)} ms`);
  } catch (e) {
    runs.push({ parsed: null, error: String(e.message).slice(0, 200), usage: null });
    console.log(`  #${i}: ERROR ${String(e.message).slice(0, 120)}`);
  }
}

// --- 3) Informe ---------------------------------------------------------------------------------------------------
const summary = summarizeRuns(runs);
const generatedAt = new Date().toISOString();
const stamp = generatedAt.replace(/[:.]/g, '-');
const md = toMarkdown({ caso, spec, temperature, promptHash, fragments, runs, summary, generatedAt });
fs.writeFileSync(new URL(`generacion-${caso.id}-${stamp}.md`, salidaDir), md);
fs.writeFileSync(new URL(`generacion-${caso.id}-${stamp}.json`, salidaDir), JSON.stringify({ generatedAt, caso, temperature, promptHash, spec: { ...spec, instructions: undefined, schema: undefined }, summary, runs }, null, 2));
console.log(`\nEstados: ${JSON.stringify(summary.estados)} · conjuntos de citas distintos: ${summary.conjuntosDeCitasDistintos}`);
console.log(`Informe: scripts/rag-local-dev/rep-diag-generacion/salida/generacion-${caso.id}-${stamp}.md`);
