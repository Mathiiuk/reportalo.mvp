// REP-3786 · Llamada a generateContent idéntica a generateJustification de
// supabase/functions/analizar-reporte/index.ts, con la configuración parametrizable.
// La clave se lee del .env y nunca se imprime.
import fs from 'node:fs';

const envText = fs.readFileSync(new URL('../../../.env', import.meta.url), 'utf-8');
const apiKey = envText.match(/^GEMINI_API_KEY=(.*)$/m)?.[1]?.trim();
if (!apiKey) throw new Error('GEMINI_API_KEY no encontrada en .env');

export const GENERATION_MODEL = 'gemini-3.8-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const LLM_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    estado: { type: 'string', enum: ['fundamentado', 'indeterminado', 'sin_normativa', 'fuera_de_alcance', 'asistencia'] },
    es_infraccion: { type: 'boolean' },
    categoria: { type: 'string', nullable: true },
    organismo_sugerido_id: { type: 'string', nullable: true },
    fundamento_ciudadano: { type: 'string' },
    fundamento_oficial: { type: 'string', nullable: true },
    confianza: { type: 'number' },
    citas: {
      type: 'array',
      items: {
        type: 'object',
        properties: { fragment_id: { type: 'string' }, cita_textual: { type: 'string' } },
        required: ['fragment_id', 'cita_textual'],
      },
    },
  },
  required: ['estado', 'es_infraccion', 'fundamento_ciudadano', 'fundamento_oficial', 'confianza', 'citas'],
};

const BASE_INSTRUCTIONS = [
  'Sos el redactor jurídico de Reportalo. Recibís un reclamo ciudadano y una lista numerada de fragmentos normativos ya recuperados.',
  'Regla estricta: SOLO podés fundamentar con el contenido literal de estos fragmentos. Si no alcanza, declará estado "indeterminado" o "sin_normativa" en vez de completar con lo que sabés de memoria.',
  'Cada cita en "citas" tiene que llevar el fragment_id exacto de la lista y una cita_textual que sea un fragmento literal (substring) del contenido de ese fragmento — nunca una paráfrasis.',
  'Nunca mencionés montos ni sanciones al ciudadano; fundamento_ciudadano tiene que ser llano y fundamento_oficial, técnico.',
  'SIEMPRE incluís todos los campos del esquema (estado, es_infraccion, categoria, organismo_sugerido_id, fundamento_ciudadano, fundamento_oficial, confianza, citas), sin importar el estado que declares. Si un campo no aplica, usá null o un array vacío, pero nunca lo omitas.',
  'No tenés acceso a los IDs reales de organismos/agencias de Reportalo — nunca inventes un valor para "organismo_sugerido_id" (ni un slug como "caba_transito" ni un UUID inventado). Dejalo en null salvo que se te haya pasado explícitamente la lista de organismos elegibles con sus IDs reales.',
];

// Instrucción de concisión de la propuesta REP-3778 §4.3 (solo en las configuraciones «+»)
const CONCISION = [
  'fundamento_ciudadano debe ser claro, conciso y redactado en un máximo de dos oraciones breves (menos de 40 palabras).',
  'fundamento_oficial debe resumir la imputación técnica en un único párrafo de no más de 60 palabras.',
];

export const buildPrompt = ({ reportText, category, fragments, concise }) => {
  const fragmentsBlock = fragments
    .map((f, i) => `[${i + 1}] fragment_id=${f.fragment_id}\n${f.hierarchy_path}\n"""${f.content}"""`)
    .join('\n\n');
  const instructions = [...BASE_INSTRUCTIONS, ...(concise ? CONCISION : [])].join('\n');
  return `${instructions}\n\nCategoría elegida por el ciudadano: ${category ?? 'sin categoría'}\n\nReclamo:\n"""${reportText}"""\n\nFragmentos recuperados:\n${fragmentsBlock}`;
};

/**
 * @param {object} p
 * @param {string} p.prompt
 * @param {object|null} p.thinkingConfig  null = sin thinkingConfig
 * @param {number} p.maxOutputTokens
 * @returns {Promise<{ ok: boolean, status: number, latencyMs: number, attempts: number, data?: any, errorText?: string }>}
 */
export const callGemini = async ({ prompt, thinkingConfig, maxOutputTokens }) => {
  const generationConfig = {
    responseMimeType: 'application/json',
    responseSchema: LLM_OUTPUT_SCHEMA,
    ...(thinkingConfig ? { thinkingConfig } : {}),
    maxOutputTokens,
  };
  const body = JSON.stringify({
    model: `models/${GENERATION_MODEL}`,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig,
  });

  const backoffs = [2000, 5000, 10000];
  for (let attempt = 1; ; attempt += 1) {
    const started = performance.now();
    let res;
    try {
      res = await fetch(`${GEMINI_API_BASE}/models/${GENERATION_MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } catch (err) {
      if (attempt <= backoffs.length) { await new Promise((r) => setTimeout(r, backoffs[attempt - 1])); continue; }
      return { ok: false, status: 0, latencyMs: performance.now() - started, attempts: attempt, errorText: String(err?.message ?? err) };
    }
    const text = await res.text();
    const latencyMs = performance.now() - started;
    // Se reintenta solo ante límite de cuota o error del servidor; el resto (400) es un resultado
    if ((res.status === 429 || res.status >= 500) && attempt <= backoffs.length) {
      await new Promise((r) => setTimeout(r, backoffs[attempt - 1]));
      continue;
    }
    if (!res.ok) return { ok: false, status: res.status, latencyMs, attempts: attempt, errorText: text.slice(0, 400) };
    try {
      return { ok: true, status: res.status, latencyMs, attempts: attempt, data: JSON.parse(text) };
    } catch {
      return { ok: false, status: res.status, latencyMs, attempts: attempt, errorText: 'Respuesta HTTP no es JSON' };
    }
  }
};
