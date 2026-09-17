// Replica exacta de generateJustification + validateLlmAnalysis de
// supabase/functions/analizar-reporte/index.ts, corriendo local contra los
// fragmentos ya recuperados por match_knowledge_fragments (retrieved.json).
// No persiste nada, no pasa por la Edge Function (que ya exige el token de
// despacho de R5-05) -- reproduce el mismo pipeline de generacion+validacion
// para volver a correr P-01 tras el fix de R5-08.
import fs from 'node:fs';

const envText = fs.readFileSync(new URL('../../../.env', import.meta.url), 'utf-8');
const apiKey = envText.match(/^GEMINI_API_KEY=(.*)$/m)?.[1]?.trim();
if (!apiKey) throw new Error('GEMINI_API_KEY no encontrada en .env');

const GENERATION_MODEL = 'gemini-3.8-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const LLM_OUTPUT_SCHEMA = {
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

async function generateJustification({ reportText, category, fragments }) {
  const fragmentsBlock = fragments
    .map((f, i) => `[${i + 1}] fragment_id=${f.fragment_id}\n${f.hierarchy_path}\n"""${f.content}"""`)
    .join('\n\n');

  const instructions = [
    'Sos el redactor jurídico de Reportalo. Recibís un reclamo ciudadano y una lista numerada de fragmentos normativos ya recuperados.',
    'Regla estricta: SOLO podés fundamentar con el contenido literal de estos fragmentos. Si no alcanza, declará estado "indeterminado" o "sin_normativa" en vez de completar con lo que sabés de memoria.',
    'Cada cita en "citas" tiene que llevar el fragment_id exacto de la lista y una cita_textual que sea un fragmento literal (substring) del contenido de ese fragmento — nunca una paráfrasis.',
    'Nunca mencionés montos ni sanciones al ciudadano; fundamento_ciudadano tiene que ser llano y fundamento_oficial, técnico.',
    'SIEMPRE incluís todos los campos del esquema (estado, es_infraccion, categoria, organismo_sugerido_id, fundamento_ciudadano, fundamento_oficial, confianza, citas), sin importar el estado que declares. Si un campo no aplica, usá null o un array vacío, pero nunca lo omitas.',
    'No tenés acceso a los IDs reales de organismos/agencias de Reportalo — nunca inventes un valor para "organismo_sugerido_id" (ni un slug como "caba_transito" ni un UUID inventado). Dejalo en null salvo que se te haya pasado explícitamente la lista de organismos elegibles con sus IDs reales.',
  ].join('\n');

  const res = await fetch(`${GEMINI_API_BASE}/models/${GENERATION_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${GENERATION_MODEL}`,
      contents: [{ role: 'user', parts: [{ text: `${instructions}\n\nCategoría elegida por el ciudadano: ${category ?? 'sin categoría'}\n\nReclamo:\n"""${reportText}"""\n\nFragmentos recuperados:\n${fragmentsBlock}` }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: LLM_OUTPUT_SCHEMA,
        thinkingConfig: { thinkingLevel: 'low' },
        maxOutputTokens: 2048,
      },
    }),
  });
  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const jsonText = candidate?.content?.parts?.[0]?.text;
  if (!jsonText) throw new Error(`Sin JSON (finishReason=${candidate?.finishReason}): ${JSON.stringify(data).slice(0,300)}`);
  return JSON.parse(jsonText);
}

function validateLlmAnalysis(analysis, retrievedFragments) {
  const requiredFields = ['estado', 'es_infraccion', 'fundamento_ciudadano', 'fundamento_oficial', 'confianza', 'citas'];
  for (const f of requiredFields) if (analysis[f] === undefined) return { valid: false, reason: `Falta el campo obligatorio "${f}".` };
  if (!Array.isArray(analysis.citas)) return { valid: false, reason: 'citas debe ser un array.' };
  const byId = new Map(retrievedFragments.map((f) => [f.fragment_id, f]));
  for (const cita of analysis.citas) {
    if (!cita?.fragment_id || !cita?.cita_textual) return { valid: false, reason: 'Cada cita debe tener fragment_id y cita_textual.' };
    const frag = byId.get(cita.fragment_id);
    if (!frag) return { valid: false, reason: `fragment_id "${cita.fragment_id}" no está entre los recuperados.` };
    if (!frag.content.includes(cita.cita_textual)) return { valid: false, reason: `La cita de "${cita.fragment_id}" no aparece literal en el fragmento.` };
  }
  return { valid: true };
}

const cases = JSON.parse(fs.readFileSync(new URL('./cases.json', import.meta.url), 'utf-8'));
const retrieved = JSON.parse(fs.readFileSync(new URL('./retrieved.json', import.meta.url), 'utf-8'));

const results = [];
for (const c of cases) {
  const fragments = retrieved[c.name];
  for (let run = 1; run <= c.runs; run++) {
    let result;
    try {
      const parsed = await generateJustification({ reportText: c.desc, category: c.cat, fragments });
      const validation = validateLlmAnalysis(parsed, fragments);
      result = validation.valid ? { ...parsed } : { estado: 'indeterminado', error: validation.reason, citas: [] };
    } catch (err) {
      result = { estado: 'indeterminado', error: String(err?.message || err), citas: [] };
    }
    results.push({ case: c.name, run, estado: result.estado, es_infraccion: result.es_infraccion, citas: result.citas, error: result.error, fundamento_oficial: result.fundamento_oficial });
    console.error(`${c.name} run${run}: ${result.estado}${result.error ? ' (' + result.error + ')' : ''}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

fs.writeFileSync(new URL('./final-results.json', import.meta.url), JSON.stringify(results, null, 2), 'utf-8');
console.error(`OK: ${results.length} corridas -> final-results.json`);
