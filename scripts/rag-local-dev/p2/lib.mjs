// REP-3860 (RAG P2) · Piezas puras del control de la búsqueda híbrida. Sin red; probadas con Vitest
// (src/test/Rep3860BusquedaHibrida.test.js). Las usa control.mjs.
//
// La función SQL está en supabase/migrations/20261103000000_rep3860_busqueda_hibrida.sql. Acá se replica su orden en
// JS para compararlo, caso por caso, con lo que devuelve el SQL en staging (los 48 controles que pide el ticket).
import crypto from 'node:crypto';

export const MIGRACION_HIBRIDA = 'supabase/migrations/20261103000000_rep3860_busqueda_hibrida.sql';
export const RRF_K = 60;

/** Cuerpo de la función tal como está en la migración (entre `as $$` y `$$;`). */
export const cuerpoFuncion = (sqlMigracion) => {
  const cuerpo = sqlMigracion.replace(/\r\n/g, '\n').match(/\nas \$\$\n([\s\S]*?)\n\$\$;/)?.[1];
  if (!cuerpo) throw new Error('No se encontró el cuerpo de match_knowledge_fragments_hibrida en la migración');
  return cuerpo;
};

/**
 * Réplica del orden de match_knowledge_fragments_hibrida.
 * vectorOrder: TODOS los candidatos, del más cercano al más lejano (el orden del RPC con ventana amplia).
 * textOrder: los que tienen coincidencia de texto completo, por ts_rank (los que no son candidatos se ignoran).
 * Primero los forzados; después rrf = 1/(k + puesto vectorial) + 1/(k + puesto de texto); empate: mejor puesto vectorial.
 */
export const ordenHibrido = ({ vectorOrder, textOrder = [], k = RRF_K, forced = [], top = 8 }) => {
  const candidatos = new Set(vectorOrder);
  const puestoVector = new Map(vectorOrder.map((id, i) => [id, i + 1]));
  const puestoTexto = new Map(textOrder.filter((id) => candidatos.has(id)).map((id, i) => [id, i + 1]));
  const forzados = new Set(forced);
  const filas = vectorOrder.map((id) => {
    const v = puestoVector.get(id);
    const t = puestoTexto.get(id) ?? null;
    return {
      fragment_id: id,
      vector_rank: v,
      text_rank: t,
      rrf_score: 1 / (k + v) + (t === null ? 0 : 1 / (k + t)),
      procedencia: forzados.has(id) ? 'forzado' : t === null ? 'vector' : 'vector+texto',
    };
  });
  filas.sort(
    (a, b) =>
      Number(forzados.has(b.fragment_id)) - Number(forzados.has(a.fragment_id)) ||
      b.rrf_score - a.rrf_score ||
      a.vector_rank - b.vector_rank
  );
  return filas.slice(0, top);
};

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

/**
 * SELECT de solo lectura: por caso, el orden de texto completo entre los mismos candidatos que usa la función
 * (jurisdicción, vigencia, vector del modelo y categoría). Es el CTE `por_texto` de la migración, sin vectores de
 * consulta: no hace falta el embedding para saber qué fragmentos coinciden por texto.
 */
export const sqlOrdenTexto = (casos, modelCode) => {
  const valores = casos.map((c) => `(${lit(c.id)}, ${lit(c.localidad)}::uuid, ${lit(c.categoria)}, ${lit(c.descripcion)})`).join(',\n  ');
  return `-- REP-3860 · Solo lectura. Orden de texto completo por caso, igual que el CTE por_texto de
-- match_knowledge_fragments_hibrida. Guardar el JSON que devuelve como salida/P2_texto.json.
with q(caso, localidad, svc, txt) as (values
  ${valores}
), consulta as (
  select caso, localidad, svc, nullif(replace(plainto_tsquery('spanish', coalesce(txt, ''))::text, ' & ', ' | '), '')::tsquery as tq from q
), candidatos as (
  select c.caso, f.id, f.fts, c.tq
  from consulta c
  cross join lateral eligible_knowledge_sources(c.localidad) e
  join knowledge_fragments f  on f.source_id = e.source_id and f.is_current
  join fragment_embeddings fe on fe.fragment_id = f.id and fe.model_code = ${lit(modelCode)}
  where c.svc is null or exists (
    select 1 from fragment_services fs join services s on s.id = fs.service_id
    where fs.fragment_id = f.id and s.service_code = c.svc
  )
)
select json_object_agg(c.caso, coalesce(t.orden, '[]'::json)) as orden_texto
from consulta c
left join (
  select caso, json_agg(left(id::text, 2) || right(id::text, 4) order by r desc, id) as orden
  from (select caso, id, ts_rank(fts, tq) as r from candidatos where tq is not null and fts @@ tq) h
  group by caso
) t using (caso);`;
};

/** Id abreviado de --sql-texto (2 primeros + 4 últimos caracteres): la salida queda chica. */
export const idCorto = (id) => id.slice(0, 2) + id.slice(-4);

/** Expande los ids abreviados contra los candidatos del caso; corta si alguno es ambiguo o desconocido. */
export const expandirIds = (cortos, candidatos) => {
  const porCorto = new Map();
  for (const id of candidatos) {
    const c = idCorto(id);
    if (porCorto.has(c)) throw new Error(`Id abreviado repetido entre los candidatos: ${c}`);
    porCorto.set(c, id);
  }
  return cortos.map((c) => {
    if (!porCorto.has(c)) throw new Error(`Id abreviado ${c} no está entre los candidatos del RPC`);
    return porCorto.get(c);
  });
};

/** Clave del vector de la consulta en la caché (la misma que usa rep-diag-variantes/verificar-rpc.mjs). */
export const claveCache = ({ embeddingModel, dimensions }, queryText) =>
  crypto.createHash('sha256').update(`${embeddingModel}@${dimensions}\n${queryText}`).digest('hex');

/**
 * SELECT de solo lectura con el cuerpo de la función y los parámetros de un caso (no crea nada). Es lo que hace
 * la función de verdad, con el vector literal de la consulta: sirve para comparar el SQL con la réplica en JS.
 */
export const sqlFuncionCaso = (cuerpo, caso, vector, { embeddingModelCode, matchCount }) => {
  const params = {
    query_embedding: `${lit(`[${vector.join(',')}]`)}::vector`,
    p_query_text: lit(caso.descripcion),
    p_locality_id: `${lit(caso.localidad)}::uuid`,
    p_model_code: lit(embeddingModelCode),
    match_count: String(matchCount),
    p_service_code: lit(caso.categoria),
    p_rrf_k: String(RRF_K),
    p_forced_ids: `'{}'::uuid[]`,
  };
  const body = cuerpo
    .replace(/\b(query_embedding|p_query_text|p_locality_id|p_model_code|match_count|p_service_code|p_rrf_k|p_forced_ids)\b/g, (m) => params[m])
    .replace(/;\s*$/, '');
  return `select ${lit(caso.id)} as caso,
       json_agg(json_build_array(x.fragment_id, x.vector_rank, x.text_rank, x.procedencia) order by x.rrf_score desc, x.vector_rank) as top
from (
${body}
) x(fragment_id, source_id, hierarchy_path, content, scope_level, similarity, vector_rank, text_rank, rrf_score, procedencia)`;
};

/** Compara el top del SQL con el de la réplica, caso por caso. Devuelve las discrepancias (vacío = iguales). */
export const compararTops = (filasSql, resultadosRunner) => {
  const porCaso = new Map(resultadosRunner.map((r) => [r.caso, r]));
  return filasSql.flatMap((fila) => {
    const r = porCaso.get(fila.caso);
    if (!r) return [{ caso: fila.caso, motivo: 'el runner no tiene el caso' }];
    const sql = (fila.top ?? []).map((t) => t[0]);
    const js = r.hibrida.map((t) => t.fragment_id);
    return sql.join(',') === js.join(',') ? [] : [{ caso: fila.caso, motivo: 'orden distinto', sql, js }];
  });
};
