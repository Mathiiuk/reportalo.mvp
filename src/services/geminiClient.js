/**
 * @file geminiClient.js
 * @description Clientes reales de la API de Gemini para el RAG jurídico de producción (REP-2908).
 * Estos clientes son la ÚNICA vía autorizada para producir embeddings y texto de fundamento:
 * no existe ningún corpus ni regla de clasificación hardcodeada como alternativa. Si la API
 * no está configurada o falla, el llamador debe fallar cerrado (ver legalRagService.js),
 * nunca inventar un resultado local de reemplazo.
 *
 * La clave de API se lee de una variable de entorno de servidor y nunca debe llegar al bundle
 * de frontend (docs/REP-1009_RAG_de_punta_a_punta.docx, sección 10, fila "Secretos").
 */

export const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-2';
export const GEMINI_EMBEDDING_DIMENSIONS = 768;
export const GEMINI_GENERATION_MODEL = 'gemini-3.8-flash';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Esquema JSON obligatorio de salida del LLM redactor (docx sección 6).
 * El LLM debe devolver exactamente esta forma; cualquier desvío se trata como fallo de validación.
 */
export const LLM_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    estado: {
      type: 'string',
      enum: ['fundamentado', 'indeterminado', 'sin_normativa', 'fuera_de_alcance', 'asistencia'],
    },
    es_infraccion: { type: 'boolean' },
    categoria: { type: 'string' },
    organismo_sugerido_id: { type: 'string' },
    fundamento_ciudadano: { type: 'string' },
    fundamento_oficial: { type: 'string' },
    confianza: { type: 'number' },
    citas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fragment_id: { type: 'string' },
          cita_textual: { type: 'string' },
        },
        required: ['fragment_id', 'cita_textual'],
      },
    },
  },
  required: ['estado', 'es_infraccion', 'fundamento_ciudadano', 'fundamento_oficial', 'confianza', 'citas'],
};

/**
 * Crea el cliente real de embeddings (gemini-embedding-2, 768 dimensiones).
 * Vectoriza únicamente el texto recibido: nunca agrega jurisdicción ni metadata al contenido,
 * porque la jurisdicción se resuelve por clave geográfica en la base (docx sección 1.1).
 *
 * @param {object} params
 * @param {string} params.apiKey Clave de la API de Gemini (variable de entorno de servidor)
 * @param {typeof fetch} [params.fetchImpl] Implementación de fetch inyectable (tests)
 * @returns {{ embedText: (text: string) => Promise<number[]> }}
 */
export const createGeminiEmbeddingsClient = ({ apiKey, fetchImpl = fetch }) => {
  if (!apiKey) {
    throw new Error('[geminiClient] Falta apiKey: no se puede crear el cliente de embeddings de Gemini.');
  }

  return {
    async embedText(text) {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('[geminiClient] embedText requiere un texto no vacío.');
      }

      const response = await fetchImpl(
        `${GEMINI_API_BASE}/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${GEMINI_EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
            outputDimensionality: GEMINI_EMBEDDING_DIMENSIONS,
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`[geminiClient] embedContent falló (${response.status}): ${errorBody}`);
      }

      const data = await response.json();
      const values = data?.embedding?.values;

      if (!Array.isArray(values) || values.length !== GEMINI_EMBEDDING_DIMENSIONS) {
        throw new Error('[geminiClient] La respuesta de embedContent no tiene 768 valores.');
      }

      return values;
    },
  };
};

/**
 * Crea el cliente real de generación (gemini-3.8-flash) con salida estructurada por esquema.
 * El prompt SIEMPRE incluye la regla explícita: solo puede usar los fragmentos recibidos,
 * y debe declarar falta de fundamento en vez de completar de memoria (docx sección 1 y 8).
 *
 * @param {object} params
 * @param {string} params.apiKey Clave de la API de Gemini (variable de entorno de servidor)
 * @param {typeof fetch} [params.fetchImpl] Implementación de fetch inyectable (tests)
 * @param {string} [params.thinkingLevel] Nivel de pensamiento (bajo por defecto: tarea acotada)
 * @returns {{ generateJustification: (params: object) => Promise<object> }}
 */
export const createGeminiGenerationClient = ({ apiKey, fetchImpl = fetch, thinkingLevel = 'low' }) => {
  if (!apiKey) {
    throw new Error('[geminiClient] Falta apiKey: no se puede crear el cliente de generación de Gemini.');
  }

  return {
    async generateJustification({ reportText, category, fragments }) {
      if (!Array.isArray(fragments) || fragments.length === 0) {
        throw new Error('[geminiClient] generateJustification requiere al menos un fragmento recuperado.');
      }

      const fragmentsBlock = fragments
        .map((f, i) => `[${i + 1}] fragment_id=${f.fragment_id}\n${f.hierarchy_path}\n"""${f.content}"""`)
        .join('\n\n');

      const instructions = [
        'Sos el redactor jurídico de Reportalo. Recibís un reclamo ciudadano y una lista numerada de fragmentos normativos ya recuperados.',
        'Regla estricta: SOLO podés fundamentar con el contenido literal de estos fragmentos. Si no alcanza, tenés que declarar estado "indeterminado" o "sin_normativa" en vez de completar con lo que sabés de memoria.',
        'Cada cita en "citas" tiene que llevar el fragment_id exacto de la lista y una cita_textual que sea un fragmento literal (substring) del contenido de ese fragmento — nunca una paráfrasis.',
        'Nunca mencionés montos ni sanciones al ciudadano; el campo fundamento_ciudadano debe ser llano y el fundamento_oficial, técnico.',
      ].join('\n');

      const response = await fetchImpl(
        `${GEMINI_API_BASE}/models/${GEMINI_GENERATION_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${GEMINI_GENERATION_MODEL}`,
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
              responseSchema: LLM_OUTPUT_SCHEMA,
              thinkingConfig: { thinkingLevel },
            },
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`[geminiClient] generateContent falló (${response.status}): ${errorBody}`);
      }

      const data = await response.json();
      const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!jsonText) {
        throw new Error('[geminiClient] La respuesta de generateContent no trae contenido JSON.');
      }

      const usage = data?.usageMetadata ?? {};

      return {
        parsed: JSON.parse(jsonText),
        inputTokens: usage.promptTokenCount ?? null,
        outputTokens: usage.candidatesTokenCount ?? null,
      };
    },
  };
};
