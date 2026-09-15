/**
 * @file legalRagService.js
 * @description Orquestador del RAG jurídico de producción (REP-2908).
 * Reemplaza al spike de REP-2907: NO hay corpus hardcodeado en este archivo,
 * NO hay embedding léxico local, y NADA se resuelve buscando en internet en
 * tiempo de consulta. Todo fundamento sale exclusivamente de:
 *   1. El corpus verificado precargado en las tablas knowledge_sources /
 *      knowledge_fragments (cargadas por docs/REP-3769_seed_y_RAG.sql).
 *   2. Embeddings reales de gemini-embedding-2 (768 dimensiones).
 *   3. La cascada jurisdiccional resuelta en SQL por el RPC
 *      match_knowledge_fragments (nunca por matching de texto en JS).
 *   4. El LLM (gemini-3.8-flash), que solo puede citar lo recuperado.
 * Ver docs/REP-1009_RAG_de_punta_a_punta.docx para la arquitectura completa.
 *
 * Todos los clientes (embeddings, generación, Supabase) se reciben inyectados
 * para que este módulo sea el mismo código que corre en producción y el que
 * se prueba con dobles deterministicos — nunca un camino alternativo con
 * datos de reemplazo hardcodeados.
 */

export const EMBEDDING_MODEL_CODE = 'gemini-embedding-2@768';
export const GENERATION_MODEL_CODE = 'gemini-3.8-flash';
// V-11 (REP-2908-VERIF): espejo de PROMPT_VERSION en supabase/functions/analizar-reporte/index.ts.
export const PROMPT_VERSION = 'v1';

/**
 * Cantidad de fragmentos a recuperar por consulta. Valor provisorio del Sprint 12
 * (docx sección 5): lo fija Hernán en REP-2910 con evidencia real.
 */
export const DEFAULT_MATCH_COUNT = 6;

/**
 * Umbral mínimo de similitud coseno para considerar que hay fundamento normativo.
 * Valor provisorio del Sprint 12: se mide y ajusta en REP-2910, no se inventa.
 */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.45;

/**
 * Estados posibles de un análisis (docx sección 6). "sin_normativa" y
 * "indeterminado" son las dos salidas de "fallar cerrado": nunca se
 * reemplazan por un resultado inventado.
 */
export const RAG_RESULT_STATUS = Object.freeze({
  FUNDAMENTADO: 'fundamentado',
  INDETERMINADO: 'indeterminado',
  SIN_NORMATIVA: 'sin_normativa',
  FUERA_DE_ALCANCE: 'fuera_de_alcance',
  ASISTENCIA: 'asistencia',
});

/**
 * Arma el texto que se vectoriza para un reporte: descripción + categoría elegida.
 * Deliberadamente NO incluye jurisdicción: la jurisdicción se resuelve por clave
 * geográfica (locality_id) en la base, nunca vectorizándola (docx sección 1.1).
 *
 * @param {object} params
 * @param {string} params.description Descripción libre del ciudadano
 * @param {string} [params.category] Categoría elegida en la UI (se pasa, no filtra — R-5 del docx)
 * @returns {string}
 */
export const buildReportQueryText = ({ description, category }) => {
  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    throw new Error('[legalRagService] buildReportQueryText requiere una descripción no vacía.');
  }
  return category ? `${description.trim()} (categoría: ${category})` : description.trim();
};

/**
 * Recupera los fragmentos de conocimiento elegibles para un reporte, vectorizando
 * su texto con el cliente de embeddings real y delegando la cascada jurisdiccional
 * al RPC match_knowledge_fragments (nunca resuelta por texto en este módulo).
 *
 * @param {object} params
 * @param {object} params.supabaseClient Cliente Supabase con permisos de servicio (RPC restringido a service_role)
 * @param {{ embedText: (text: string) => Promise<number[]> }} params.embeddingsClient
 * @param {string} params.queryText Texto ya armado por buildReportQueryText
 * @param {string} params.localityId UUID de la localidad del reporte
 * @param {string} [params.modelCode]
 * @param {number} [params.matchCount]
 * @returns {Promise<{ success: boolean, fragments: Array<object>, error?: string }>}
 */
export const retrieveKnowledgeFragments = async ({
  supabaseClient,
  embeddingsClient,
  queryText,
  localityId,
  modelCode = EMBEDDING_MODEL_CODE,
  matchCount = DEFAULT_MATCH_COUNT,
}) => {
  if (!queryText || typeof queryText !== 'string' || queryText.trim().length === 0) {
    return { success: false, fragments: [], error: 'queryText vacío.' };
  }
  if (!localityId) {
    return { success: false, fragments: [], error: 'localityId es obligatorio: sin localidad no hay cascada jurisdiccional.' };
  }
  if (!supabaseClient || typeof supabaseClient.rpc !== 'function') {
    return { success: false, fragments: [], error: 'supabaseClient inválido: se requiere un cliente con permisos de servicio.' };
  }
  if (!embeddingsClient || typeof embeddingsClient.embedText !== 'function') {
    return { success: false, fragments: [], error: 'embeddingsClient inválido: no hay forma de vectorizar sin él.' };
  }

  let queryEmbedding;
  try {
    queryEmbedding = await embeddingsClient.embedText(queryText);
  } catch (err) {
    return { success: false, fragments: [], error: `Fallo al vectorizar la consulta: ${err.message}` };
  }

  const { data, error } = await supabaseClient.rpc('match_knowledge_fragments', {
    query_embedding: queryEmbedding,
    p_locality_id: localityId,
    p_model_code: modelCode,
    match_count: matchCount,
  });

  if (error) {
    return { success: false, fragments: [], error: `RPC match_knowledge_fragments falló: ${error.message ?? error}` };
  }

  return { success: true, fragments: Array.isArray(data) ? data : [] };
};

/**
 * Filtra y ordena los fragmentos recuperados por el umbral mínimo de similitud.
 * Pura: no toca red ni base. Se usa antes de decidir si corresponde llamar al LLM.
 *
 * @param {Array<object>} fragments Fragmentos con propiedad `similarity`
 * @param {number} [threshold]
 * @returns {Array<object>}
 */
export const selectFragmentsAboveThreshold = (fragments, threshold = DEFAULT_SIMILARITY_THRESHOLD) => {
  if (!Array.isArray(fragments)) return [];
  return fragments
    .filter((f) => typeof f.similarity === 'number' && f.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
};

/**
 * Validación determinística de la respuesta del LLM (docx sección 8, capa 6 —
 * "la más importante: no depende de que el LLM se porte bien"). Nunca confía
 * en el LLM: si algo no se puede verificar contra los fragmentos recuperados
 * o el catálogo de organismos, el análisis cae a INDETERMINADO.
 *
 * @param {object} params
 * @param {object} params.llmResponse Objeto ya parseado, forma esperada del esquema JSON
 * @param {Array<object>} params.retrievedFragments Fragmentos que efectivamente se le pasaron al LLM
 * @param {Array<string>} [params.knownAgencyIds] Ids válidos de agencies; si se omite, no se valida ese campo
 * @returns {{ valid: boolean, reason?: string }}
 */
export const validateGeneratedAnalysis = ({ llmResponse, retrievedFragments, knownAgencyIds }) => {
  if (!llmResponse || typeof llmResponse !== 'object') {
    return { valid: false, reason: 'La respuesta del LLM no es un objeto.' };
  }

  const requiredFields = ['estado', 'es_infraccion', 'fundamento_ciudadano', 'fundamento_oficial', 'confianza', 'citas'];
  for (const field of requiredFields) {
    if (llmResponse[field] === undefined) {
      return { valid: false, reason: `Falta el campo obligatorio "${field}" en la respuesta del LLM.` };
    }
  }

  if (!Object.values(RAG_RESULT_STATUS).includes(llmResponse.estado)) {
    return { valid: false, reason: `estado "${llmResponse.estado}" no es un valor reconocido.` };
  }

  if (!Array.isArray(llmResponse.citas)) {
    return { valid: false, reason: 'citas debe ser un array.' };
  }

  const fragmentsById = new Map(retrievedFragments.map((f) => [f.fragment_id, f]));

  for (const cita of llmResponse.citas) {
    if (!cita || !cita.fragment_id || !cita.cita_textual) {
      return { valid: false, reason: 'Cada cita debe tener fragment_id y cita_textual.' };
    }

    const fragment = fragmentsById.get(cita.fragment_id);
    if (!fragment) {
      return { valid: false, reason: `La cita referencia fragment_id "${cita.fragment_id}", que no está entre los fragmentos recuperados.` };
    }

    if (!fragment.content || !fragment.content.includes(cita.cita_textual)) {
      return { valid: false, reason: `La cita_textual de "${cita.fragment_id}" no aparece literal en el fragmento recuperado.` };
    }
  }

  if (Array.isArray(knownAgencyIds) && llmResponse.organismo_sugerido_id) {
    if (!knownAgencyIds.includes(llmResponse.organismo_sugerido_id)) {
      return { valid: false, reason: `organismo_sugerido_id "${llmResponse.organismo_sugerido_id}" no existe en agencies.` };
    }
  }

  return { valid: true };
};

/**
 * Orquesta el flujo completo de análisis de un reporte (pasos 4 a 9 del docx sección 5):
 * vectorizar -> recuperar con cascada -> umbral -> (solo si corresponde) generar -> validar.
 * Fallar cerrado en cada paso: cualquier problema produce INDETERMINADO o SIN_NORMATIVA,
 * nunca un resultado de reemplazo inventado por este código.
 *
 * @param {object} params
 * @param {string} params.description Descripción del reporte
 * @param {string} [params.category] Categoría elegida por el ciudadano (se pasa al LLM, no filtra — R-5)
 * @param {string} params.localityId UUID de la localidad del reporte
 * @param {object} params.supabaseClient Cliente con permisos de servicio
 * @param {object} params.embeddingsClient Cliente de embeddings (real o doble de prueba)
 * @param {object} params.generationClient Cliente de generación (real o doble de prueba)
 * @param {Array<string>} [params.knownAgencyIds]
 * @param {number} [params.matchCount]
 * @param {number} [params.threshold]
 * @returns {Promise<object>} Resultado con la misma forma que se persiste en report_ai_analysis
 */
export const analyzeReport = async ({
  description,
  category = null,
  localityId,
  supabaseClient,
  embeddingsClient,
  generationClient,
  knownAgencyIds,
  matchCount = DEFAULT_MATCH_COUNT,
  threshold = DEFAULT_SIMILARITY_THRESHOLD,
}) => {
  const startTime = performance.now();

  let queryText;
  try {
    queryText = buildReportQueryText({ description, category });
  } catch (err) {
    return {
      estado: RAG_RESULT_STATUS.INDETERMINADO,
      error: err.message,
      retrievedFragments: [],
      citedFragments: [],
      latencyMs: Number((performance.now() - startTime).toFixed(2)),
    };
  }

  const retrieval = await retrieveKnowledgeFragments({
    supabaseClient,
    embeddingsClient,
    queryText,
    localityId,
    matchCount,
  });

  if (!retrieval.success) {
    return {
      estado: RAG_RESULT_STATUS.INDETERMINADO,
      error: retrieval.error,
      retrievedFragments: [],
      citedFragments: [],
      latencyMs: Number((performance.now() - startTime).toFixed(2)),
    };
  }

  const eligibleFragments = selectFragmentsAboveThreshold(retrieval.fragments, threshold);

  if (eligibleFragments.length === 0) {
    return {
      estado: RAG_RESULT_STATUS.SIN_NORMATIVA,
      es_infraccion: false,
      fundamento_ciudadano: 'No se cuenta con fundamento normativo cargado en el corpus actual para este reclamo.',
      fundamento_oficial: null,
      confianza: 0,
      citas: [],
      retrievedFragments: retrieval.fragments,
      citedFragments: [],
      latencyMs: Number((performance.now() - startTime).toFixed(2)),
    };
  }

  let generation;
  try {
    generation = await generationClient.generateJustification({
      reportText: description,
      category,
      fragments: eligibleFragments,
    });
  } catch (err) {
    return {
      estado: RAG_RESULT_STATUS.INDETERMINADO,
      error: `Fallo al generar el fundamento: ${err.message}`,
      retrievedFragments: eligibleFragments,
      citedFragments: [],
      latencyMs: Number((performance.now() - startTime).toFixed(2)),
    };
  }

  const validation = validateGeneratedAnalysis({
    llmResponse: generation.parsed,
    retrievedFragments: eligibleFragments,
    knownAgencyIds,
  });

  if (!validation.valid) {
    return {
      estado: RAG_RESULT_STATUS.INDETERMINADO,
      error: validation.reason,
      retrievedFragments: eligibleFragments,
      citedFragments: [],
      latencyMs: Number((performance.now() - startTime).toFixed(2)),
    };
  }

  const citedFragmentIds = new Set(generation.parsed.citas.map((c) => c.fragment_id));

  return {
    ...generation.parsed,
    retrievedFragments: eligibleFragments,
    citedFragments: eligibleFragments.filter((f) => citedFragmentIds.has(f.fragment_id)),
    embeddingModelCode: EMBEDDING_MODEL_CODE,
    generationModelCode: GENERATION_MODEL_CODE,
    promptVersion: PROMPT_VERSION,
    inputTokens: generation.inputTokens,
    outputTokens: generation.outputTokens,
    latencyMs: Number((performance.now() - startTime).toFixed(2)),
  };
};
