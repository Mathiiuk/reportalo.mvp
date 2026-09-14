/**
 * @file ragTestFixtures.js
 * @description Dobles de prueba deterministicos para REP-2908. Esto NO es el corpus de
 * producción (ese vive en la base, cargado por docs/REP-3769_seed_y_RAG.sql) ni un
 * embedding real: es una fixture de test que imita, de forma reproducible y sin red,
 * lo que el RPC match_knowledge_fragments y la API de Gemini devolverían para los
 * 6 casos oficiales de docs/REP-3764_casos_esperados.md. Sirve solo para probar el
 * CONTRATO del pipeline (cascada, umbral, validación anti-alucinación), no la calidad
 * semántica real de un modelo de embeddings.
 */

const STOPWORDS = new Set([
  'de', 'la', 'el', 'en', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o',
  'con', 'por', 'para', 'sobre', 'su', 'al', 'del', 'que', 'se', 'es', 'son',
  'hay', 'lo', 'a', 'sin', 'muy', 'mas', 'pero', 'como', 'este', 'esta',
  'todo', 'toda', 'hace', 'dias', 'semanas', 'todos', 'mi', 'categoria',
]);

const normalize = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Buckets temáticos solo para que la fixture de test produzca vectores estables y
// separables entre sí — no representan ningún modelo real de embeddings.
const CONCEPT_BUCKETS = [
  { dims: [0, 1, 2, 3], stems: ['boc', 'torment', 'desagu', 'pluvial', 'sumider', 'calzad', 'bache', 'pozo', 'paviment', 'repaviment', 'vial', 'salubridad'] },
  { dims: [4, 5, 6, 7], stems: ['luz', 'alumbr', 'farol', 'iluminac', 'foc'] },
  { dims: [8, 9, 10, 11], stems: ['ramp', 'discapacit', 'movil', 'reduc', 'accesib'] },
  { dims: [12, 13, 14, 15], stems: ['auto', 'vehicul', 'estacion', 'parado', 'deten', 'send', 'peaton', 'esquin', 'bloque', 'obstru', 'doble', 'fila', 'transit', 'fren', 'circulac'] },
  { dims: [16, 17, 18, 19], stems: ['sancion', 'mult', 'agrava', 'falt', 'infraccion', 'antirreglamentari'] },
  { dims: [20, 21, 22, 23], stems: ['moralidad', 'patrimoni', 'tranquilidad', 'orden', 'publico', 'contravenc'] },
];
// Espacio de hash amplio (40 bins) para que dos textos sin concepto en común casi
// nunca colisionen por azar — el Caso F (sin evidencia) depende de esto.
const HASH_BASE = 24;
const HASH_BINS = 40;
const VECTOR_DIM = HASH_BASE + HASH_BINS;
const BUCKET_MATCH_WEIGHT = 3.0;
const HASH_MATCH_WEIGHT = 0.25;

const embed = (text) => {
  const words = normalize(text).split(/\s+/).filter((w) => w.length > 1 && !STOPWORDS.has(w));
  const vector = new Array(VECTOR_DIM).fill(0);
  for (const word of words) {
    let matched = false;
    for (const bucket of CONCEPT_BUCKETS) {
      if (bucket.stems.some((stem) => word.startsWith(stem) || stem.startsWith(word))) {
        bucket.dims.forEach((d) => (vector[d] += BUCKET_MATCH_WEIGHT));
        matched = true;
        break;
      }
    }
    if (!matched) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) hash = (hash * 31 + word.charCodeAt(i)) % HASH_BINS;
      vector[HASH_BASE + hash] += HASH_MATCH_WEIGHT;
    }
  }
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return magnitude === 0 ? vector : vector.map((v) => v / magnitude);
};

const cosineSimilarity = (a, b) => {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(0, Math.min(1, dot));
};

/**
 * Fixture de 8 fragmentos que refleja el corpus verificado de REP-2906 (7 fuentes,
 * 8 fragmentos), ya con la forma que devuelve match_knowledge_fragments.
 */
export const FIXTURE_FRAGMENTS = [
  {
    fragment_id: 'FRAG-001',
    source_id: 'SRC-CONST-PBA',
    hierarchy_path: 'Constitución PBA > Art. 192 inc. 4',
    content: 'Tener a su cargo el ornato y salubridad, los establecimientos de beneficencia... y la vialidad pública.',
    scope: 'provincial-pba',
    requiresAdhesion: false,
  },
  {
    fragment_id: 'FRAG-002',
    source_id: 'SRC-LOM',
    hierarchy_path: 'Ley Orgánica de las Municipalidades (Dec-Ley 6769/58) > Art. 52',
    content: 'Corresponde al Concejo disponer la prestación de los servicios públicos de barrido, riego, limpieza, alumbrado, provisión de agua, obras sanitarias y desagües pluviales.',
    scope: 'provincial-pba',
    requiresAdhesion: false,
  },
  {
    fragment_id: 'FRAG-003',
    source_id: 'SRC-LOM',
    hierarchy_path: 'Ley Orgánica de las Municipalidades (Dec-Ley 6769/58) > Art. 59 inc. d',
    content: 'Constituyen obras públicas municipales: pavimentación, repavimentación, nivelación, ensanche, conservación de calles, veredas y caminos vecinales.',
    scope: 'provincial-pba',
    requiresAdhesion: false,
  },
  {
    fragment_id: 'FRAG-004',
    source_id: 'SRC-LEY-210',
    hierarchy_path: 'Ley 210 CABA (Ente Único Regulador) > Arts. 2 y 3 inc. j',
    content: 'El Ente ejerce el control, seguimiento y resguardo de la calidad de los servicios públicos: alumbrado, barrido y limpieza, mantenimiento de desagües pluviales.',
    scope: 'caba',
    requiresAdhesion: false,
  },
  {
    fragment_id: 'FRAG-005',
    source_id: 'SRC-LEY-24449',
    hierarchy_path: 'Ley Nacional de Tránsito 24.449 > Arts. 48 inc. i, 49 inc. b',
    content: 'Está prohibido en la vía pública: estacionar en zona urbana sobre la senda para peatones o en las esquinas, obstruir la circulación vehicular o peatonal, o estacionar en doble fila afectando el tránsito libre.',
    scope: 'nacional',
    requiresAdhesion: true,
  },
  {
    fragment_id: 'FRAG-006',
    source_id: 'SRC-LEY-2148',
    hierarchy_path: 'Código de Tránsito y Transporte CABA (Ley 2148) > Arts. 7.1.8 inc. c, 7.1.9',
    content: 'Prohibición general de estacionar frente a rampas para personas con necesidades especiales o movilidad reducida, y en las esquinas entre su vértice y la prolongación de la ochava.',
    scope: 'caba',
    requiresAdhesion: false,
  },
  {
    fragment_id: 'FRAG-007',
    source_id: 'SRC-LEY-451',
    hierarchy_path: 'Régimen de Faltas CABA (Ley 451) > Art. 6.1.52',
    content: 'Estacionamiento indebido. Cuando el estacionamiento se produzca en rampas para personas con movilidad reducida la sanción se agravará.',
    scope: 'caba',
    requiresAdhesion: false,
  },
  {
    fragment_id: 'FRAG-008',
    source_id: 'SRC-DECLEY-8031',
    hierarchy_path: 'Código de Faltas PBA (Dec-Ley 8031/73) > Índice Títulos I a III',
    content: 'Régimen contravencional general de la provincia: faltas contra la seguridad de las personas, el patrimonio, la moralidad pública, la tranquilidad y el orden público. No regula la vía pública vehicular ni el tránsito urbano.',
    scope: 'provincial-pba',
    requiresAdhesion: false,
  },
];

// Cascada jurisdiccional de la fixture (equivalente de eligible_knowledge_sources):
// qué scopes son elegibles por localidad de test.
const LOCALITY_ELIGIBLE_SCOPES = {
  'loc-avellaneda': new Set(['provincial-pba', 'nacional']), // PBA adhirió a la 24.449 (Ley 13.927)
  'loc-caba': new Set(['caba']), // sin adhesión verificada de CABA a la 24.449
};

export const FIXTURE_LOCALITY_IDS = {
  AVELLANEDA: 'loc-avellaneda',
  CABA: 'loc-caba',
};

const FRAGMENT_EMBEDDINGS = new Map(FIXTURE_FRAGMENTS.map((f) => [f.fragment_id, embed(f.content)]));

/**
 * Doble de prueba del cliente de embeddings: mismo contrato que geminiClient.js,
 * pero determinístico y sin red.
 */
export const createFakeEmbeddingsClient = () => ({
  embedText: async (text) => embed(text),
});

/**
 * Doble de prueba del cliente Supabase: implementa únicamente `.rpc('match_knowledge_fragments', ...)`
 * aplicando la misma cascada jurisdiccional por clave (no por texto) que el RPC real.
 */
export const createFakeSupabaseClient = ({ fragments = FIXTURE_FRAGMENTS } = {}) => ({
  rpc: async (fnName, args) => {
    if (fnName !== 'match_knowledge_fragments') {
      return { data: null, error: { message: `RPC no soportado en el doble de prueba: ${fnName}` } };
    }

    const eligibleScopes = LOCALITY_ELIGIBLE_SCOPES[args.p_locality_id];
    if (!eligibleScopes) {
      return { data: null, error: { message: `Localidad no reconocida en la fixture: ${args.p_locality_id}` } };
    }

    const results = fragments
      .filter((f) => eligibleScopes.has(f.scope))
      .map((f) => ({
        fragment_id: f.fragment_id,
        source_id: f.source_id,
        hierarchy_path: f.hierarchy_path,
        content: f.content,
        similarity: cosineSimilarity(args.query_embedding, FRAGMENT_EMBEDDINGS.get(f.fragment_id)),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, args.match_count ?? 6);

    return { data: results, error: null };
  },
});

/**
 * Doble de prueba del cliente de generación: en vez de llamar a Gemini, arma una
 * respuesta que cita textualmente el/los fragmento(s) mejor rankeados — replica
 * el comportamiento correcto que se espera de un LLM bien instruido, para poder
 * probar la validación determinística por separado (con otro doble que sí rompe reglas).
 */
export const createFakeGenerationClient = () => ({
  generateJustification: async ({ fragments }) => {
    const best = fragments[0];
    const citedSnippet = best.content.slice(0, Math.min(40, best.content.length));
    return {
      parsed: {
        estado: 'fundamentado',
        es_infraccion: true,
        categoria: 'transito',
        organismo_sugerido_id: null,
        fundamento_ciudadano: `Fundamento basado en ${best.hierarchy_path}.`,
        fundamento_oficial: `Conducta encuadrada en ${best.hierarchy_path}.`,
        confianza: 0.8,
        citas: [{ fragment_id: best.fragment_id, cita_textual: citedSnippet }],
      },
      inputTokens: 120,
      outputTokens: 80,
    };
  },
});

/**
 * Doble de prueba que devuelve una respuesta que rompe una regla de validación a propósito,
 * para probar que analyzeReport falla cerrado (INDETERMINADO) en cada caso.
 */
export const createBrokenGenerationClient = (failureMode) => ({
  generateJustification: async ({ fragments }) => {
    const best = fragments[0];
    const base = {
      estado: 'fundamentado',
      es_infraccion: true,
      categoria: 'transito',
      organismo_sugerido_id: 'agency-inexistente',
      fundamento_ciudadano: 'Fundamento de prueba.',
      fundamento_oficial: 'Fundamento oficial de prueba.',
      confianza: 0.8,
      citas: [{ fragment_id: best.fragment_id, cita_textual: best.content.slice(0, 30) }],
    };

    if (failureMode === 'cita_no_literal') {
      base.citas = [{ fragment_id: best.fragment_id, cita_textual: 'esto no está en el fragmento original' }];
    }
    if (failureMode === 'fragment_id_no_recuperado') {
      base.citas = [{ fragment_id: 'FRAG-999-INEXISTENTE', cita_textual: 'cualquier texto' }];
    }
    if (failureMode === 'esquema_invalido') {
      delete base.confianza;
    }

    return { parsed: base, inputTokens: 100, outputTokens: 60 };
  },
});

export const KNOWN_AGENCY_IDS = ['agency-caba-01', 'agency-avellaneda-01'];
