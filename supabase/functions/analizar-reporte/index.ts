/**
 * @file index.ts
 * @description Supabase Edge Function: análisis jurídico asíncrono de un reporte (REP-2908).
 * Runtime: Deno / TypeScript en Supabase Edge Functions.
 *
 * Implementa los pasos 4 a 9 del flujo de docs/REP-1009_RAG_de_punta_a_punta.docx §5:
 *   4. Arma el texto de consulta (descripción + categoría elegida).
 *   5. Vectoriza ese texto con gemini-embedding-2 (768 dimensiones).
 *   6. Recupera los fragmentos elegibles vía el RPC match_knowledge_fragments,
 *      que resuelve la cascada jurisdiccional en SQL (nunca por texto acá).
 *   7. Si ninguno supera el umbral de similitud: `sin_normativa`, CERO llamadas al LLM.
 *   8. Si hay fragmentos, llama a gemini-3.8-flash con esquema JSON obligatorio,
 *      citando solo lo recuperado.
 *   9. Valida la respuesta de forma determinística (sin confiar en el LLM): cada
 *      fragment_id citado tiene que estar entre los recuperados y cada cita_textual
 *      tiene que aparecer literal en ese fragmento. Ante cualquier fallo: `indeterminado`.
 *
 * NADA en este archivo tiene un corpus ni una regla de clasificación hardcodeada:
 * toda normativa sale de knowledge_fragments (cargada por docs/REP-3769_seed_y_RAG.sql)
 * y todo el texto de fundamento lo redacta el LLM a partir de lo recuperado.
 *
 * Paso 10 (REP-2909, bloque 2): persiste el resultado — CUALQUIER resultado,
 * incluidos indeterminado/sin_normativa, no solo fundamentado — en
 * report_ai_analysis + report_ai_evidence, dentro de una transacción, y solo
 * entonces borra el mensaje de la cola pgmq que la disparó
 * (supabase/rag_async_pipeline.sql, bloque 1). Si la persistencia falla, el
 * mensaje NO se borra: pgmq lo vuelve a hacer visible después del timeout y
 * se reintenta solo — ese es el "fallar cerrado" a nivel de la cola, no solo
 * a nivel del contenido del análisis.
 *
 * El mapeo de campos de result_status_code/is_infraction/etc. replica a propósito
 * src/services/reportAiAnalysisPersistence.js (mismo contrato, probado con Vitest
 * del lado Node) — se duplica en vez de importarse porque esta función, igual que
 * quarantine-anonymize, se despliega de forma autocontenida.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMBEDDING_MODEL = 'gemini-embedding-2';
const EMBEDDING_MODEL_CODE = 'gemini-embedding-2@768';
const EMBEDDING_DIMENSIONS = 768;
const GENERATION_MODEL = 'gemini-3.8-flash';

// Valores provisorios del Sprint 12 (docx §5): Hernán los fija con evidencia real en REP-2910.
const DEFAULT_MATCH_COUNT = 6;
const DEFAULT_SIMILARITY_THRESHOLD = 0.45;

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

type AnalyzeRequestPayload = {
  reportId: string;
  description: string;
  category?: string | null;
  localityId: string;
  /** msg_id de pgmq (bloque 1, rag_async_pipeline.sql). Si viene, se borra el mensaje al persistir con éxito. */
  queueMessageId?: number | null;
};

type RetrievedFragment = {
  fragment_id: string;
  source_id: string;
  hierarchy_path: string;
  content: string;
  scope_level: number;
  similarity: number;
};

type LlmCita = { fragment_id: string; cita_textual: string };

type LlmAnalysis = {
  estado: 'fundamentado' | 'indeterminado' | 'sin_normativa' | 'fuera_de_alcance' | 'asistencia';
  es_infraccion: boolean;
  categoria?: string;
  organismo_sugerido_id?: string | null;
  fundamento_ciudadano: string;
  fundamento_oficial: string | null;
  confianza: number;
  citas: LlmCita[];
};

const RAG_RESULT_STATUSES = ['fundamentado', 'indeterminado', 'sin_normativa', 'fuera_de_alcance', 'asistencia'];

/**
 * Vectoriza un texto con gemini-embedding-2. Nunca cae a un embedding local
 * de reemplazo: si falla, el llamador debe tratarlo como error (fallar cerrado).
 */
const embedText = async (text: string, apiKey: string): Promise<number[]> => {
  const response = await fetch(`${GEMINI_API_BASE}/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    throw new Error(`embedContent falló (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error('embedContent no devolvió un vector de 768 dimensiones.');
  }
  return values;
};

/**
 * Llama a gemini-3.8-flash con el esquema JSON obligatorio, citando solo los
 * fragmentos recibidos. El prompt autoriza explícitamente decir "no sé".
 */
const generateJustification = async (
  { reportText, category, fragments }: { reportText: string; category?: string | null; fragments: RetrievedFragment[] },
  apiKey: string
): Promise<{ parsed: LlmAnalysis; inputTokens: number | null; outputTokens: number | null }> => {
  const fragmentsBlock = fragments
    .map((f, i) => `[${i + 1}] fragment_id=${f.fragment_id}\n${f.hierarchy_path}\n"""${f.content}"""`)
    .join('\n\n');

  const instructions = [
    'Sos el redactor jurídico de Reportalo. Recibís un reclamo ciudadano y una lista numerada de fragmentos normativos ya recuperados.',
    'Regla estricta: SOLO podés fundamentar con el contenido literal de estos fragmentos. Si no alcanza, declará estado "indeterminado" o "sin_normativa" en vez de completar con lo que sabés de memoria.',
    'Cada cita en "citas" tiene que llevar el fragment_id exacto de la lista y una cita_textual que sea un fragmento literal (substring) del contenido de ese fragmento — nunca una paráfrasis.',
    'Nunca mencionés montos ni sanciones al ciudadano; fundamento_ciudadano tiene que ser llano y fundamento_oficial, técnico.',
  ].join('\n');

  const response = await fetch(`${GEMINI_API_BASE}/models/${GENERATION_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${GENERATION_MODEL}`,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${instructions}\n\nCategoría elegida por el ciudadano: ${category ?? 'sin categoría'}\n\nReclamo:\n"""${reportText}"""\n\nFragmentos recuperados:\n${fragmentsBlock}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: 'low' },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`generateContent falló (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!jsonText) {
    throw new Error('generateContent no devolvió contenido JSON.');
  }

  const usage = data?.usageMetadata ?? {};
  return {
    parsed: JSON.parse(jsonText),
    inputTokens: usage.promptTokenCount ?? null,
    outputTokens: usage.candidatesTokenCount ?? null,
  };
};

/**
 * Validación determinística (docx §8, capa 6 — "la más importante: no depende
 * de que el LLM se porte bien"). Nunca confía en el LLM.
 */
export const validateLlmAnalysis = (
  llmResponse: unknown,
  retrievedFragments: RetrievedFragment[]
): { valid: boolean; reason?: string } => {
  if (!llmResponse || typeof llmResponse !== 'object') {
    return { valid: false, reason: 'La respuesta del LLM no es un objeto.' };
  }

  const analysis = llmResponse as LlmAnalysis;
  const requiredFields: (keyof LlmAnalysis)[] = ['estado', 'es_infraccion', 'fundamento_ciudadano', 'fundamento_oficial', 'confianza', 'citas'];
  for (const field of requiredFields) {
    if (analysis[field] === undefined) {
      return { valid: false, reason: `Falta el campo obligatorio "${field}".` };
    }
  }

  if (!RAG_RESULT_STATUSES.includes(analysis.estado)) {
    return { valid: false, reason: `estado "${analysis.estado}" no es un valor reconocido.` };
  }

  if (!Array.isArray(analysis.citas)) {
    return { valid: false, reason: 'citas debe ser un array.' };
  }

  const fragmentsById = new Map(retrievedFragments.map((f) => [f.fragment_id, f]));

  for (const cita of analysis.citas) {
    if (!cita?.fragment_id || !cita?.cita_textual) {
      return { valid: false, reason: 'Cada cita debe tener fragment_id y cita_textual.' };
    }
    const fragment = fragmentsById.get(cita.fragment_id);
    if (!fragment) {
      return { valid: false, reason: `fragment_id "${cita.fragment_id}" no está entre los fragmentos recuperados.` };
    }
    if (!fragment.content.includes(cita.cita_textual)) {
      return { valid: false, reason: `La cita de "${cita.fragment_id}" no aparece literal en el fragmento.` };
    }
  }

  return { valid: true };
};

type AnalysisResult = {
  estado: string;
  es_infraccion?: boolean | null;
  categoria?: string | null;
  organismo_sugerido_id?: string | null;
  fundamento_ciudadano?: string | null;
  fundamento_oficial?: string | null;
  confianza?: number | null;
  citas?: LlmCita[];
  embeddingModelCode?: string | null;
  generationModelCode?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  latencyMs?: number | null;
  error?: string;
};

/** Espejo de src/services/reportAiAnalysisPersistence.js#buildAnalysisRow */
const buildAnalysisRow = (reportId: string, result: AnalysisResult, suggestedServiceId: string | null) => ({
  report_id: reportId,
  result_status_code: result.estado,
  is_infraction: result.es_infraccion ?? null,
  suggested_service_id: suggestedServiceId,
  suggested_agency_id: result.organismo_sugerido_id ?? null,
  citizen_feedback: result.fundamento_ciudadano ?? null,
  official_legal_foundation: result.fundamento_oficial ?? null,
  confidence_score: result.confianza ?? null,
  embedding_model_code: result.embeddingModelCode ?? null,
  generation_model_code: result.generationModelCode ?? null,
  input_tokens: result.inputTokens ?? null,
  output_tokens: result.outputTokens ?? null,
  latency_ms: result.latencyMs !== undefined && result.latencyMs !== null ? Math.round(result.latencyMs) : null,
});

/** Espejo de src/services/reportAiAnalysisPersistence.js#buildEvidenceRows */
const buildEvidenceRows = (analysisId: string, retrievedFragments: RetrievedFragment[], citas: LlmCita[]) => {
  const citaByFragmentId = new Map(citas.map((c) => [c.fragment_id, c.cita_textual]));
  return retrievedFragments.map((fragment, index) => ({
    analysis_id: analysisId,
    fragment_id: fragment.fragment_id,
    rank: index + 1,
    similarity: fragment.similarity ?? 0,
    was_cited: citaByFragmentId.has(fragment.fragment_id),
    quoted_text: citaByFragmentId.get(fragment.fragment_id) ?? null,
  }));
};

/**
 * Paso 10: persiste el análisis (cualquier estado) + su evidencia, y borra el
 * mensaje de la cola SOLO si la escritura tuvo éxito. Nunca lanza: si algo
 * falla acá, se loguea y el mensaje de la cola queda para que pgmq lo
 * reintente — es preferible reintentar de más que perder un reporte sin analizar.
 */
const persistAnalysis = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  reportId: string,
  result: AnalysisResult,
  retrievedFragments: RetrievedFragment[],
  queueMessageId: number | null | undefined
): Promise<void> => {
  try {
    let suggestedServiceId: string | null = null;
    if (result.categoria) {
      const { data: service } = await supabaseAdmin
        .from('services')
        .select('id')
        .eq('service_code', result.categoria.toUpperCase())
        .maybeSingle();
      suggestedServiceId = service?.id ?? null;
    }

    const analysisRow = buildAnalysisRow(reportId, result, suggestedServiceId);
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('report_ai_analysis')
      .insert(analysisRow)
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error('[analizar-reporte] No se pudo persistir report_ai_analysis:', insertError?.message);
      return; // no se borra el mensaje de la cola: se reintenta
    }

    if (retrievedFragments.length > 0) {
      const evidenceRows = buildEvidenceRows(inserted.id, retrievedFragments, result.citas ?? []);
      const { error: evidenceError } = await supabaseAdmin.from('report_ai_evidence').insert(evidenceRows);
      if (evidenceError) {
        console.error('[analizar-reporte] No se pudo persistir report_ai_evidence:', evidenceError.message);
        return; // análisis quedó guardado pero sin evidencia: se reintenta el mensaje igual
      }
    }

    if (queueMessageId !== undefined && queueMessageId !== null) {
      // pgmq expone sus funciones en su propio schema; supabase-js >= 2.x permite
      // apuntar a un schema distinto de "public" con .schema(...).
      const { error: deleteError } = await supabaseAdmin
        .schema('pgmq')
        .rpc('delete', { queue_name: 'rag_analysis_queue', msg_id: queueMessageId });
      if (deleteError) {
        console.error('[analizar-reporte] Análisis guardado pero no se pudo borrar el mensaje de la cola:', deleteError.message);
      }
    }
  } catch (err) {
    console.error('[analizar-reporte] Error inesperado persistiendo el análisis:', err instanceof Error ? err.message : err);
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || '';

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  let payload: AnalyzeRequestPayload | null = null;
  let retrievedFragments: RetrievedFragment[] = [];
  let result: AnalysisResult;

  try {
    payload = await req.json();
    const { description, category, localityId } = payload!;

    if (!description || !localityId) {
      return new Response(
        JSON.stringify({ error: 'Faltan parámetros requeridos: description o localityId.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    if (!geminiApiKey) {
      // Fallar cerrado: sin clave no hay vectorización ni generación real posible.
      // Nunca se cae a un embedding o corpus local de reemplazo.
      result = { estado: 'indeterminado', error: 'GEMINI_API_KEY no configurada en los secrets de la función.' };
    } else {
      // Paso 4-5: armar el texto de consulta (sin jurisdicción: se resuelve por locality_id) y vectorizar.
      const queryText = category ? `${description.trim()} (categoría: ${category})` : description.trim();
      const queryEmbedding = await embedText(queryText, geminiApiKey);

      // Paso 6: recuperar con cascada jurisdiccional resuelta en SQL.
      const { data: fragments, error: rpcError } = await supabaseAdmin.rpc('match_knowledge_fragments', {
        query_embedding: queryEmbedding,
        p_locality_id: localityId,
        p_model_code: EMBEDDING_MODEL_CODE,
        match_count: DEFAULT_MATCH_COUNT,
      });

      if (rpcError) {
        result = { estado: 'indeterminado', error: `match_knowledge_fragments falló: ${rpcError.message}` };
      } else {
        const eligibleFragments: RetrievedFragment[] = (fragments ?? []).filter(
          (f: RetrievedFragment) => f.similarity >= DEFAULT_SIMILARITY_THRESHOLD
        );
        retrievedFragments = eligibleFragments;

        // Paso 7: sin fragmentos sobre el umbral, no se llama al LLM. Cero riesgo de invención.
        if (eligibleFragments.length === 0) {
          result = {
            estado: 'sin_normativa',
            es_infraccion: false,
            fundamento_ciudadano: 'No se cuenta con fundamento normativo cargado en el corpus actual para este reclamo.',
            fundamento_oficial: null,
            confianza: 0,
            citas: [],
          };
        } else {
          // Paso 8: generar citando solo lo recuperado.
          const generation = await generateJustification(
            { reportText: description, category, fragments: eligibleFragments },
            geminiApiKey
          );

          // Paso 9: validar de forma determinística. Fallar cerrado ante cualquier incumplimiento.
          const validation = validateLlmAnalysis(generation.parsed, eligibleFragments);
          if (!validation.valid) {
            result = { estado: 'indeterminado', error: validation.reason };
          } else {
            result = {
              ...generation.parsed,
              embeddingModelCode: EMBEDDING_MODEL_CODE,
              generationModelCode: GENERATION_MODEL,
              inputTokens: generation.inputTokens,
              outputTokens: generation.outputTokens,
            };
          }
        }
      }
    }
  } catch (error) {
    // Cualquier error no previsto también falla cerrado: nunca un resultado inventado.
    result = { estado: 'indeterminado', error: error instanceof Error ? error.message : String(error) };
  }

  // Paso 10: persistir SIEMPRE (cualquier estado), y borrar el mensaje de la
  // cola solo si la escritura tuvo éxito. Si no hay reportId (p. ej. una
  // prueba manual desde el panel local sin cola de por medio), se omite.
  if (payload?.reportId) {
    await persistAnalysis(supabaseAdmin, payload.reportId, result, retrievedFragments, payload.queueMessageId);
  }

  return new Response(
    JSON.stringify({ ...result, retrievedFragmentIds: retrievedFragments.map((f) => f.fragment_id) }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
  );
});
