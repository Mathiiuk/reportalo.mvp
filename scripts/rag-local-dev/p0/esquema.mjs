// RAG P0 (REP-3859) · Piezas puras del esquema común de M1/M2: set de casos, encabezado del motor, métricas y validador.
// Sin red, probadas con Vitest (src/test/Rep3859RunnersP0.test.js). Las usan los runners existentes:
//   rep-diag-variantes/run.mjs   --p0   → M1 (recuperación)
//   rep-diag-generacion/run.mjs  --p0   → M2 (respuesta jurídica)
//
// Formato acordado con Iván en REP-3859 (comentario del 20/10/2026):
//   - un archivo por corrida; encabezado `motor` (commit, despliegue, prompt, modelos, top-k, umbral, temperatura y
//     huella del corpus), `set_version` y fecha UTC de inicio;
//   - `resultados[]`: una fila por caso y repetición (`caso_id`, `repeticion`, `fecha_utc`, `pendiente_po`);
//   - M1: `candidatos[]` con fragment_id, posición, similitud y en_top8, con ventana 100;
//   - M2: estado, citas con fragment_id/artículo/validador, citas verificadas y excluidas, motivo, tokens y latencia.
// Los casos `pendiente_po` se miden igual pero no computan para la puerta P0 (decisión de Leo, 20/10).
import crypto from 'node:crypto';
// REP-3857: misma regla de citas que analizar-reporte (literal o con elisión por tramos); réplica en un solo lugar
import { quoteMatchesFragment } from '../rep-diag-generacion/lib.mjs';

export const ESQUEMA = 'rag-p0/v1';
export const VENTANA_M1 = 100;
export const REPETICIONES_P0 = 3;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

// ── Set de casos ─────────────────────────────────────────────────────────────────────────────────────────────────
// El set congelado lo entrega Iván (REP-3858, casos-referencia-v1.json). Su borrador v0 trae id, zona, localidad,
// provincia, categoria, descripcion y normas esperadas N1/N2 con id de fragmento. Como el formato exacto de la v1 todavía
// no está cerrado, se aceptan los nombres de campo razonables y se falla con un mensaje claro si falta algo.
const primero = (obj, claves) => {
  for (const clave of claves) {
    const valor = clave.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
    if (valor !== undefined && valor !== null && valor !== '') return valor;
  }
  return undefined;
};

const idsDe = (valor) => {
  if (valor === undefined || valor === null || valor === '') return [];
  const lista = Array.isArray(valor) ? valor : String(valor).split(/[;,]\s*/);
  return lista.map((x) => (typeof x === 'object' && x !== null ? x.fragment_id ?? x.id : x)).map((x) => String(x).trim()).filter(Boolean);
};

/**
 * Normaliza el set de casos. Devuelve { set_version, casos, errores }: si `errores` no está vacío, no se mide.
 * @param {object|Array} raw contenido de casos-referencia-v1.json
 */
export const normalizarSet = (raw) => {
  const lista = Array.isArray(raw) ? raw : raw?.casos;
  const errores = [];
  const set_version = Array.isArray(raw) ? null : primero(raw ?? {}, ['set_version', 'version', 'versión']) ?? null;
  if (!set_version) errores.push('El set no declara su versión (set_version).');
  if (!Array.isArray(lista) || lista.length === 0) return { set_version, casos: [], errores: [...errores, 'El set no tiene casos.'] };

  const vistos = new Set();
  const casos = lista.map((c, i) => {
    const caso_id = primero(c, ['caso_id', 'id']);
    const etiqueta = caso_id ?? `#${i + 1}`;
    const localidad = primero(c, ['localidad_id', 'locality_id', 'localidad']);
    const caso = {
      caso_id,
      descripcion: primero(c, ['descripcion', 'descripción', 'texto']),
      categoria: primero(c, ['categoria', 'categoría', 'service_code']),
      localidad_id: localidad && UUID.test(String(localidad)) ? String(localidad) : null,
      localidad: localidad && !UUID.test(String(localidad)) ? String(localidad) : primero(c, ['localidad_nombre']) ?? null,
      provincia: primero(c, ['provincia']) ?? null,
      zona: primero(c, ['zona']) ?? null,
      esperados_n1: idsDe(primero(c, ['esperados_n1', 'n1', 'N1', 'normas_n1', 'esperados.n1', 'normas_esperadas.n1', 'esperados_aceptables'])),
      esperados_n2: idsDe(primero(c, ['esperados_n2', 'n2', 'N2', 'normas_n2', 'esperados.n2', 'normas_esperadas.n2'])),
      universo: primero(c, ['universo']) ?? null,
      pendiente_po: Boolean(primero(c, ['pendiente_po', 'pendientePO'])),
    };
    if (!caso_id) errores.push(`Caso ${etiqueta}: falta el id.`);
    else if (vistos.has(caso_id)) errores.push(`Caso ${etiqueta}: id repetido.`);
    vistos.add(caso_id);
    if (!caso.descripcion) errores.push(`Caso ${etiqueta}: falta la descripción.`);
    if (!caso.categoria) errores.push(`Caso ${etiqueta}: falta la categoría.`);
    if (!caso.localidad_id && !(caso.localidad && caso.provincia)) errores.push(`Caso ${etiqueta}: falta la localidad (id, o nombre y provincia).`);
    for (const id of [...caso.esperados_n1, ...caso.esperados_n2]) {
      if (!UUID.test(id)) errores.push(`Caso ${etiqueta}: el esperado "${id}" no es un id de fragmento.`);
    }
    return caso;
  });
  return { set_version, casos, errores };
};

// ── Motor ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Estados válidos y forma de contar tokens, leídos del fuente de analizar-reporte (no se copian a mano). */
export const leerReglasValidador = (source) => {
  const m = source.match(/const RAG_RESULT_STATUSES = \[([^\]]+)\];/);
  if (!m) throw new Error('No se encontró RAG_RESULT_STATUSES en analizar-reporte/index.ts');
  const estados = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  const req = source.match(/const requiredFields: \(keyof LlmAnalysis\)\[\] = \[([^\]]+)\];/);
  if (!req) throw new Error('No se encontró requiredFields en validateLlmAnalysis');
  const camposObligatorios = [...req[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  const vulnerabilidad = source.match(/const VULNERABILIDAD_SOCIAL_SERVICE_CODE = '([^']+)';/)?.[1];
  if (!vulnerabilidad) throw new Error('No se encontró VULNERABILIDAD_SOCIAL_SERVICE_CODE');
  return { estados, camposObligatorios, vulnerabilidad };
};

/**
 * Huella del corpus vigente: cantidad, fecha del último fragmento y sha256 de los pares id:sha256(content) ordenados.
 * Si cambia un solo fragmento, cambia la huella.
 */
export const huellaCorpus = (fragments) => {
  const vigentes = fragments.filter((f) => f.is_current !== false);
  const pares = vigentes.map((f) => `${f.id}:${sha256(f.content ?? '')}`).sort();
  const ultimo = vigentes.map((f) => f.created_at).filter(Boolean).sort().at(-1) ?? null;
  return { fragmentos_vigentes: vigentes.length, ultimo_fragmento_utc: ultimo, sha256: sha256(pares.join('\n')) };
};

/** Encabezado `motor` común a M1 y M2. `spec` sale de readGenerationSpec (rep-diag-generacion/lib.mjs). */
export const encabezadoMotor = ({ spec, git, despliegue, corpus }) => ({
  analizar_reporte: {
    commit_codigo: git?.commitCodigo ?? null, // último commit que tocó supabase/functions/analizar-reporte
    commit_repo: git?.head ?? null,
    despliegue: despliegue ?? null, // p. ej. "analizar-reporte v44 (13/10/2026 19:48)": no se lee de la API, se declara
  },
  prompt_version: spec.promptVersion,
  modelo_generacion: spec.model,
  temperatura: spec.temperature,
  thinking: spec.thinkingLevel,
  max_output_tokens: spec.maxOutputTokens,
  modelo_embeddings: spec.embeddingModelCode,
  dimensiones: spec.dimensions,
  top_k: spec.matchCount,
  umbral: spec.threshold,
  rpc: 'match_knowledge_fragments',
  corpus,
});

// ── M1 · recuperación ────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Métricas de un caso y repetición a partir de lo que devuelve match_knowledge_fragments con ventana 100.
 * @param {Array<{fragment_id:string, similarity:number}>} filas orden del RPC (el de producción)
 */
export const filaM1 = (filas, esperadosN1, { matchCount, threshold }) => {
  const esperados = new Set(esperadosN1);
  const candidatos = filas.map((r, i) => ({
    fragment_id: r.fragment_id,
    posicion: i + 1,
    similitud: r.similarity,
    en_top8: i < matchCount,
    supera_umbral: r.similarity >= threshold,
    // Lo que de verdad le llega al modelo en producción: top-k y similitud >= umbral
    entregado: i < matchCount && r.similarity >= threshold,
    esperado: esperados.has(r.fragment_id),
  }));
  const posiciones = candidatos.filter((c) => c.esperado).map((c) => c.posicion);
  return {
    candidatos,
    esperados_elegibles: posiciones.length,
    posicion_primera_esperada: posiciones[0] ?? null,
    posiciones_esperadas: posiciones,
    esperados_en_top8: candidatos.filter((c) => c.esperado && c.en_top8).length,
    esperados_entregados: candidatos.filter((c) => c.esperado && c.entregado).length,
    entregados: candidatos.filter((c) => c.entregado).length,
    reciprocal_rank: posiciones.length ? 1 / posiciones[0] : 0,
  };
};

const promedio = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Resumen de M1. Solo cuentan los casos con norma esperada (universo A); `computables` excluye pendiente_po. */
export const resumenM1 = (resultados) => {
  const conEsperado = resultados.filter((r) => r.esperados_n1.length > 0);
  const calc = (rs) => ({
    filas: rs.length,
    mrr: promedio(rs.map((r) => r.reciprocal_rank)),
    cobertura_top8: rs.length ? rs.filter((r) => r.esperados_en_top8 > 0).length / rs.length : null,
    cobertura_entregados: rs.length ? rs.filter((r) => r.esperados_entregados > 0).length / rs.length : null,
  });
  return { todos: calc(conEsperado), computables: calc(conEsperado.filter((r) => !r.pendiente_po)) };
};

// ── M2 · respuesta jurídica ──────────────────────────────────────────────────────────────────────────────────────
const UUID_ORGANISMO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Réplica FIEL de validateLlmAnalysis + validateOrganismoSugerido de analizar-reporte/index.ts (mismas reglas, mismo
 * orden, misma primera falla). Además informa cada cita por separado (`citas[].pasa`) para diagnóstico: producción
 * corta en la primera cita inválida y rechaza la respuesta entera.
 * @param {Set<string>} agencias ids de agencies (lectura previa), para la regla del organismo sugerido
 */
/**
 * Regla de cita de la línea base P0 (v44): un único tramo literal, tolerando espacios en blanco. La usa
 * --doble-validador para validar LAS MISMAS respuestas con la regla de P0 y con la de P1 (REP-3857).
 */
export const citaLiteralP0 = (quote, content) => {
  const q = normalizeWhitespace(quote ?? '');
  return q !== '' && normalizeWhitespace(content ?? '').includes(q);
};
const normalizeWhitespace = (text) => text.replace(/\s+/g, ' ').trim();

export const validarComoProduccion = (parsed, fragments, category, { estados, camposObligatorios, vulnerabilidad, agencias, citaCoincide = quoteMatchesFragment }) => {
  const porId = new Map(fragments.map((f) => [f.fragment_id, f]));
  const citas = Array.isArray(parsed?.citas)
    ? parsed.citas.map((c) => {
        const fragment = porId.get(c?.fragment_id);
        const enContexto = Boolean(fragment);
        const literal = enContexto && citaCoincide(c?.cita_textual ?? '', fragment.content);
        return { fragment_id: c?.fragment_id ?? null, en_contexto: enContexto, literal, pasa: enContexto && literal };
      })
    : [];
  const falla = (reason) => ({ valid: false, reason, citas });

  if (!parsed || typeof parsed !== 'object') return falla('La respuesta del LLM no es un objeto.');
  for (const campo of camposObligatorios) if (parsed[campo] === undefined) return falla(`Falta el campo obligatorio "${campo}".`);
  if (!estados.includes(parsed.estado)) return falla(`estado "${parsed.estado}" no es un valor reconocido.`);
  if (parsed.estado === 'asistencia' && category !== vulnerabilidad) return falla('estado "asistencia" fuera de VULNERABILIDAD_SOCIAL.');
  if (!Array.isArray(parsed.citas)) return falla('citas debe ser un array.');
  for (const [i, cita] of parsed.citas.entries()) {
    if (!cita?.fragment_id || !cita?.cita_textual) return falla('Cada cita debe tener fragment_id y cita_textual.');
    if (!citas[i].en_contexto) return falla(`fragment_id "${cita.fragment_id}" no está entre los fragmentos recuperados.`);
    if (!citas[i].literal) return falla(`La cita de "${cita.fragment_id}" no aparece literal en el fragmento.`);
  }
  // validateOrganismoSugerido: solo corre si lo anterior pasó (no pisa la razón)
  const org = parsed.organismo_sugerido_id;
  const sinOrganismo = org === null || org === undefined || org === '' || String(org).trim().toLowerCase() === 'null';
  if (!sinOrganismo) {
    if (!UUID_ORGANISMO.test(org)) return falla(`organismo_sugerido_id "${org}" no es un UUID válido.`);
    if (!agencias.has(org)) return falla(`organismo_sugerido_id "${org}" no corresponde a ningún organismo registrado.`);
  }
  return { valid: true, citas };
};

/** Tokens de salida como los cuenta producción: candidatos + razonamiento (P-06); null si Gemini no informa ninguno. */
export const tokensSalida = (usage = {}) =>
  usage.candidatesTokenCount === undefined && usage.thoughtsTokenCount === undefined
    ? null
    : (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);

/**
 * Fila M2 de un caso y repetición, con el estado final que guardaría producción.
 * @param {{ camino: 'asistencia'|'sin_normativa'|'generacion', parsed?, validacion?, usage?, error?, latencia_ms, fragments }} r
 */
/** Marcas de elisión que acepta el validador (REP-3857): «...», «…», «[...]» y «(...)». */
const MARCA_ELISION = /\[\s*(?:\.{3}|…)\s*\]|\(\s*(?:\.{3}|…)\s*\)|\.{3}|…/;

export const filaM2 = (r, esperadosN1, articuloDe = () => null) => {
  const esperados = new Set(esperadosN1);
  if (r.camino === 'asistencia' || r.camino === 'sin_normativa') {
    return {
      camino: r.camino, estado_modelo: null, estado: r.camino, llamo_al_modelo: false,
      citas: [], citas_verificadas: 0, citas_excluidas: 0, rechazo_validador: false, motivo: null,
      cita_esperada_n1: false, fragmentos_entregados: r.fragments?.map((f) => f.fragment_id) ?? [],
      input_tokens: null, output_tokens: null, latencia_ms: r.latencia_ms ?? null,
    };
  }
  if (r.error) {
    return {
      camino: 'generacion', estado_modelo: null, estado: 'indeterminado', llamo_al_modelo: true,
      citas: [], citas_verificadas: 0, citas_excluidas: 0, rechazo_validador: false, motivo: r.error,
      cita_esperada_n1: false, fragmentos_entregados: r.fragments.map((f) => f.fragment_id),
      input_tokens: r.usage?.promptTokenCount ?? null, output_tokens: tokensSalida(r.usage ?? {}), latencia_ms: r.latencia_ms ?? null,
    };
  }
  const v = r.validacion;
  const citas = (r.parsed.citas ?? []).map((c, i) => ({
    fragment_id: c.fragment_id,
    articulo: articuloDe(c.fragment_id),
    pasa_validador: v.citas[i]?.pasa ?? false,
    esperada_n1: esperados.has(c.fragment_id),
    // REP-3857 (P1): el texto que citó el modelo y si usa elisión, para auditar las citas elididas aceptadas
    cita_textual: c.cita_textual ?? null,
    con_elision: MARCA_ELISION.test(c.cita_textual ?? ''),
  }));
  return {
    camino: 'generacion',
    estado_modelo: r.parsed.estado,
    // Igual que producción: cualquier falla del validador termina en indeterminado
    estado: v.valid ? r.parsed.estado : 'indeterminado',
    llamo_al_modelo: true,
    citas,
    citas_verificadas: citas.filter((c) => c.pasa_validador).length,
    citas_excluidas: citas.filter((c) => !c.pasa_validador).length,
    rechazo_validador: !v.valid,
    motivo: v.valid ? null : v.reason,
    // Acierto N1 crudo: la respuesta ACEPTADA cita al menos una norma esperada. Iván recalcula desde las citas.
    cita_esperada_n1: v.valid && citas.some((c) => c.esperada_n1),
    // --doble-validador: la MISMA respuesta del modelo validada con la regla de P0 (cita literal). Así la única
    // diferencia entre P0 y P1 es el validador, sin el ruido de la generación.
    ...(r.validacionP0 && {
      validador_p0: {
        estado: r.validacionP0.valid ? r.parsed.estado : 'indeterminado',
        rechazo_validador: !r.validacionP0.valid,
        motivo: r.validacionP0.valid ? null : r.validacionP0.reason,
        cita_esperada_n1: r.validacionP0.valid && (r.parsed.citas ?? []).some((c) => esperados.has(c.fragment_id)),
        citas_pasan: (r.parsed.citas ?? []).map((_, i) => r.validacionP0.citas[i]?.pasa ?? false),
      },
    }),
    fragmentos_entregados: r.fragments.map((f) => f.fragment_id),
    input_tokens: r.usage?.promptTokenCount ?? null,
    output_tokens: tokensSalida(r.usage ?? {}),
    latencia_ms: r.latencia_ms ?? null,
  };
};

/** Resumen de M2: reparto de estados, rechazos del validador, acierto N1 y tokens; `computables` sin pendiente_po. */
export const resumenM2 = (resultados) => {
  const calc = (rs) => {
    const estados = {};
    for (const r of rs) estados[r.estado] = (estados[r.estado] ?? 0) + 1;
    const conEsperado = rs.filter((r) => r.esperados_n1.length > 0);
    const sum = (k) => rs.reduce((a, r) => a + (r[k] ?? 0), 0);
    return {
      filas: rs.length,
      estados,
      rechazos_validador: rs.filter((r) => r.rechazo_validador).length,
      llamadas_al_modelo: rs.filter((r) => r.llamo_al_modelo).length,
      acierto_n1: conEsperado.length ? conEsperado.filter((r) => r.cita_esperada_n1).length / conEsperado.length : null,
      tokens: { entrada: sum('input_tokens'), salida: sum('output_tokens') },
      ...(rs.some((r) => r.validador_p0) && { doble_validador: dobleValidador(rs, conEsperado) }),
    };
  };
  return { todos: calc(resultados), computables: calc(resultados.filter((r) => !r.pendiente_po)) };
};

/** Mismas respuestas, dos reglas de cita: P0 (literal) contra P1 (elisión por tramos, REP-3857). */
const dobleValidador = (rs, conEsperado) => {
  const conDoble = rs.filter((r) => r.validador_p0);
  const conEsp = conEsperado.filter((r) => r.validador_p0);
  const acierto = (f) => (conEsp.length ? conEsp.filter(f).length / conEsp.length : null);
  return {
    filas_con_respuesta: conDoble.length,
    rechazos_p0: conDoble.filter((r) => r.validador_p0.rechazo_validador).length,
    rechazos_p1: conDoble.filter((r) => r.rechazo_validador).length,
    acierto_n1_p0: acierto((r) => r.validador_p0.cita_esperada_n1),
    acierto_n1_p1: acierto((r) => r.cita_esperada_n1),
    rescatadas_por_p1: conDoble.filter((r) => r.validador_p0.rechazo_validador && !r.rechazo_validador).map((r) => `${r.caso_id} r${r.repeticion}`),
    perdidas_por_p1: conDoble.filter((r) => !r.validador_p0.rechazo_validador && r.rechazo_validador).map((r) => `${r.caso_id} r${r.repeticion}`),
    citas_con_elision: conDoble.reduce((a, r) => a + r.citas.filter((c) => c.con_elision).length, 0),
  };
};

/** Estimación de llamadas a la API para --dry-run (no se llama a nada). */
export const estimarLlamadas = (casos, repeticiones, { vulnerabilidad }) => {
  const conModelo = casos.filter((c) => c.categoria !== vulnerabilidad).length;
  return {
    casos: casos.length,
    repeticiones,
    filas: casos.length * repeticiones,
    embeddings_m1: casos.length * repeticiones,
    embeddings_m2: conModelo * repeticiones,
    // Cota superior: los casos sin fragmentos sobre el umbral no llaman al modelo
    generaciones_m2_max: conModelo * repeticiones,
    pendientes_po: casos.filter((c) => c.pendiente_po).length,
  };
};
