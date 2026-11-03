// REP-3860 (RAG P2) · Control de la búsqueda híbrida: el SQL de la migración contra su réplica en JS, en los 48 casos de
// rep-diag-variantes/casos.json. Solo lectura: no crea la función, no escribe en la base y no despliega nada.
//
// Pasos:
//   1. node control.mjs --sql-texto > salida/P2_texto.sql
//      Correr el SELECT en staging (solo lectura) y guardar el JSON de `orden_texto` en salida/P2_texto.json.
//   2. node control.mjs --runner [--env ruta/.env]
//      Por caso: vector de la consulta (Gemini, con caché), RPC match_knowledge_fragments con ventana 100 (el orden
//      vectorial de la base) y la réplica del orden híbrido. Escribe salida/P2_control_runner_<fecha>.json.
//   3. node control.mjs --sql-funcion [--desde 0 --hasta 12] > salida/P2_control_funcion_1.sql
//      Arma el SELECT con el cuerpo de la función y el vector literal de cada caso (de la caché del paso 2). Se corre
//      en el editor SQL de staging, solo lectura; guardar el resultado como JSON (lista de {caso, top}).
//   4. node control.mjs --comparar salida/<resultado.json> [salida/P2_control_runner_<fecha>.json]
//      Lista cada caso con IGUAL o DISTINTO; sale con código 1 si hay alguna diferencia.
import fs from 'node:fs';
import path from 'node:path';

import { readProdConfig, buildQueryText } from '../rep-diag-ranking/lib.mjs';
import { leerEnv, crearRest } from '../p0/entorno.mjs';
import { MIGRACION_HIBRIDA, cuerpoFuncion, ordenHibrido, sqlOrdenTexto, claveCache, sqlFuncionCaso, compararTops, expandirIds } from './lib.mjs';

const here = new URL('./', import.meta.url);
const root = new URL('../../../', import.meta.url);
const salidaDir = new URL('salida/', here);
const args = process.argv.slice(2);
const valor = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const config = readProdConfig(fs.readFileSync(new URL('supabase/functions/analizar-reporte/index.ts', root), 'utf-8'));
const { casos } = JSON.parse(fs.readFileSync(new URL('rep-diag-variantes/casos.json', new URL('../', here)), 'utf-8'));
const cachePath = new URL('cache-embeddings.json', salidaDir);
const leerCache = () => (fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf-8')) : {});
const ultimo = (prefijo) => fs.readdirSync(salidaDir).filter((f) => f.startsWith(prefijo)).sort().at(-1);

if (args.includes('--sql-texto')) {
  console.log(sqlOrdenTexto(casos, config.embeddingModelCode));
} else if (args.includes('--runner')) {
  const textoPath = new URL('P2_texto.json', salidaDir);
  if (!fs.existsSync(textoPath)) throw new Error('Falta salida/P2_texto.json: correr el SELECT de --sql-texto en staging y guardar su JSON.');
  const ordenTexto = JSON.parse(fs.readFileSync(textoPath, 'utf-8'));
  const { need } = leerEnv(valor('--env') ? path.resolve(valor('--env')) : new URL('.env', root));
  const geminiKey = need('GEMINI_API_KEY');
  const supabaseUrl = need('VITE_SUPABASE_URL').replace(/\/$/, '');
  const rest = crearRest(supabaseUrl, need('SUPABASE_SERVICE_ROLE_KEY'));
  console.log(`Proyecto Supabase: ${new URL(supabaseUrl).host} (confirmar que es STAGING).`);

  const cache = leerCache();
  let llamadasApi = 0;
  const embed = async (text) => {
    const clave = claveCache(config, text);
    if (cache[clave]) return cache[clave];
    for (const demora of [0, 2000, 5000, 10000, 20000]) {
      if (demora) await new Promise((r) => setTimeout(r, demora));
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.embeddingModel}:embedContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({ model: `models/${config.embeddingModel}`, content: { parts: [{ text }] }, outputDimensionality: config.dimensions }),
      });
      llamadasApi += 1;
      if (res.ok) {
        const values = (await res.json())?.embedding?.values;
        if (!Array.isArray(values) || values.length !== config.dimensions) throw new Error('Vector inválido');
        cache[clave] = values;
        return values;
      }
      if (![429, 500, 503].includes(res.status)) throw new Error(`embedContent falló (${res.status})`);
    }
    throw new Error('embedContent falló después de 5 intentos');
  };

  const inicio = new Date().toISOString();
  const resultados = [];
  for (const caso of casos) {
    if (!(caso.id in ordenTexto)) throw new Error(`P2_texto.json no tiene el caso ${caso.id}: regenerarlo con --sql-texto`);
    const vector = await embed(buildQueryText(caso.descripcion, caso.categoria));
    const filas = await rest('rpc/match_knowledge_fragments', {
      method: 'POST',
      body: JSON.stringify({ query_embedding: vector, p_locality_id: caso.localidad, p_model_code: config.embeddingModelCode, match_count: 100, p_service_code: caso.categoria }),
    });
    const vectorOrder = filas.map((f) => f.fragment_id);
    // Empates exactos de distancia: el RPC no fija el desempate y la función desempata por id. Se informan.
    const empates = filas.filter((f, i) => i > 0 && f.similarity === filas[i - 1].similarity).length;
    // Los ids de texto vienen abreviados y solo entre los candidatos (mismo filtro que el RPC): todos tienen que expandirse
    const textOrder = expandirIds(ordenTexto[caso.id], vectorOrder);
    const hibrida = ordenHibrido({ vectorOrder, textOrder, top: config.matchCount });
    resultados.push({
      caso: caso.id,
      escenario: caso.escenario,
      candidatos: vectorOrder.length,
      coincidencias_texto: textOrder.length,
      empates_de_distancia: empates,
      vectorial: vectorOrder.slice(0, config.matchCount),
      hibrida,
    });
    console.log(`${caso.id.padEnd(14)} cand ${String(vectorOrder.length).padStart(2)} · texto ${String(resultados.at(-1).coincidencias_texto).padStart(2)} · cambia el top ${config.matchCount}: ${hibrida.map((h) => h.fragment_id).join() === vectorOrder.slice(0, config.matchCount).join() ? 'no' : 'sí'}`);
  }
  fs.writeFileSync(cachePath, JSON.stringify(cache));
  const nombre = `P2_control_runner_${inicio.replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(new URL(nombre, salidaDir), JSON.stringify({ esquema: 'rep3860-control/v1', inicio_utc: inicio, fin_utc: new Date().toISOString(), config, migracion: MIGRACION_HIBRIDA, llamadas_api: llamadasApi, resultados }, null, 2));
  console.log(`Salida: scripts/rag-local-dev/p2/salida/${nombre} · llamadas a Gemini: ${llamadasApi}`);
} else if (args.includes('--sql-funcion')) {
  const cuerpo = cuerpoFuncion(fs.readFileSync(new URL(MIGRACION_HIBRIDA, root), 'utf-8'));
  const cache = leerCache();
  const desde = Number(valor('--desde') ?? 0);
  const hasta = Number(valor('--hasta') ?? casos.length);
  const partes = casos.slice(desde, hasta).map((caso) => {
    const vector = cache[claveCache(config, buildQueryText(caso.descripcion, caso.categoria))];
    if (!vector) throw new Error(`Sin vector en caché para ${caso.id}: correr --runner primero`);
    return sqlFuncionCaso(cuerpo, caso, vector, config);
  });
  console.log(`-- REP-3860 · Solo lectura: cuerpo de ${MIGRACION_HIBRIDA} con los parámetros de los casos ${desde} a ${hasta - 1}.
-- No crea la función. Guardar el resultado como JSON (lista de {caso, top}).
set search_path to public, extensions;
${partes.join('\nunion all\n')};`);
} else if (args.includes('--comparar')) {
  const sqlRes = JSON.parse(fs.readFileSync(path.resolve(valor('--comparar')), 'utf-8'));
  const runnerPath = args.find((a, i) => i > 0 && args[i - 1] !== '--comparar' && a.endsWith('.json') && a !== valor('--comparar'));
  const runner = JSON.parse(fs.readFileSync(runnerPath ? path.resolve(runnerPath) : new URL(ultimo('P2_control_runner_'), salidaDir), 'utf-8'));
  const filas = Array.isArray(sqlRes) ? sqlRes : sqlRes.filas ?? [];
  const diferencias = compararTops(filas, runner.resultados);
  for (const fila of filas) {
    const d = diferencias.find((x) => x.caso === fila.caso);
    console.log(`${fila.caso.padEnd(14)} ${d ? `DISTINTO (${d.motivo})` : 'IGUAL'}`);
  }
  console.log(`${filas.length - diferencias.length} de ${filas.length} iguales.`);
  process.exitCode = diferencias.length ? 1 : 0;
} else {
  throw new Error('Uso: --sql-texto | --runner [--env ruta] | --sql-funcion [--desde N --hasta M] | --comparar resultado.json [runner.json]');
}
