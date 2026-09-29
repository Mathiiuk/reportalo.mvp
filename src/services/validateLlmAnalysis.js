/**
 * @file validateLlmAnalysis.js
 * @description Espejo testeable de validateLlmAnalysis en
 * supabase/functions/analizar-reporte/index.ts (REP-2908, docx §8 capa 6).
 * Se duplica en vez de importarse porque el original vive en un archivo Deno
 * con `Deno.serve(...)` a nivel de módulo — Vitest/Node no puede importarlo
 * sin que eso tire al no existir el global `Deno` (mismo motivo por el que
 * reportAiAnalysisPersistence.js espeja buildAnalysisRow/buildEvidenceRows).
 */

const RAG_RESULT_STATUSES = ['fundamentado', 'indeterminado', 'sin_normativa', 'fuera_de_alcance', 'asistencia'];

/**
 * @param {unknown} llmResponse
 * @param {Array<{fragment_id: string, content: string}>} retrievedFragments
 * @param {string|null} [reportCategory]
 * @returns {{ valid: boolean, reason?: string }}
 */
/** Espejo de index.ts: colapsa espacios en blanco; NO toca mayúsculas, tildes ni puntuación. */
const normalizeWhitespace = (text) => text.replace(/\s+/g, ' ').trim();

/** Tope de la cita del modelo dentro de status_reason (espejo de index.ts). */
const MAX_REJECTED_CITA_CHARS = 300;
const truncateForReason = (text) =>
  text.length > MAX_REJECTED_CITA_CHARS ? `${text.slice(0, MAX_REJECTED_CITA_CHARS)}…` : text;

export const validateLlmAnalysis = (llmResponse, retrievedFragments, reportCategory) => {
  if (!llmResponse || typeof llmResponse !== 'object') {
    return { valid: false, reason: 'La respuesta del LLM no es un objeto.' };
  }

  const analysis = llmResponse;
  const requiredFields = ['estado', 'es_infraccion', 'fundamento_ciudadano', 'fundamento_oficial', 'confianza', 'citas'];
  for (const field of requiredFields) {
    if (analysis[field] === undefined) {
      return { valid: false, reason: `Falta el campo obligatorio "${field}".` };
    }
  }

  if (!RAG_RESULT_STATUSES.includes(analysis.estado)) {
    return { valid: false, reason: `estado "${analysis.estado}" no es un valor reconocido.` };
  }

  // C-2 (REP-2908-VERIF ronda 6): "asistencia" solo tiene sentido para
  // reclamos de VULNERABILIDAD_SOCIAL -- el LLM lo devolvió una vez para
  // "no anda la luz" (D-CABA), y un ciudadano que reporta un poste de luz
  // no puede leer que su caso es de asistencia social.
  if (analysis.estado === 'asistencia' && reportCategory !== 'VULNERABILIDAD_SOCIAL') {
    return { valid: false, reason: `estado "asistencia" no es válido para la categoría "${reportCategory ?? 'sin categoría'}" (solo aplica a VULNERABILIDAD_SOCIAL).` };
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
    const normalizedQuote = normalizeWhitespace(cita.cita_textual);
    // Una cita solo de espacios quedaría vacía y `includes('')` siempre da true.
    if (normalizedQuote === '' || !normalizeWhitespace(fragment.content).includes(normalizedQuote)) {
      // Espejo de supabase/functions/analizar-reporte/index.ts: se guarda lo que el modelo intentó citar.
      return { valid: false, reason: `La cita de "${cita.fragment_id}" no aparece literal en el fragmento. Cita del modelo: "${truncateForReason(cita.cita_textual)}"` };
    }
  }

  return { valid: true };
};
