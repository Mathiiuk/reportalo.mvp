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

/**
 * Espejo de index.ts (RAG-S16, citas con elisión): se acepta una cita con "...", "…" o "[...]" solo si
 * cada tramo es literal, en el orden de la cita, de al menos MIN_ELIDED_SEGMENT_CHARS caracteres, y lo
 * salteado no contiene una negación ni una excepción. Ver docs/RAG-S16_citas_con_elision.md.
 */
const ELISION_MARKER = /\[\s*(?:\.{3}|…)\s*\]|\(\s*(?:\.{3}|…)\s*\)|\.{3}|…/;
const MIN_ELIDED_SEGMENT_CHARS = 15;
const ELIDED_TEXT_GUARD = /(?:^|[^\p{L}])(?:no|ni|nunca|jamás|salvo|excepto|excepción|siempre que|sin perjuicio)(?![\p{L}])/iu;
// REP-3857: marca al principio o al final de la cita. Lo omitido ahí se revisa hasta el borde de la oración.
const ELISION_AT_START = /^(?:\[\s*(?:\.{3}|…)\s*\]|\(\s*(?:\.{3}|…)\s*\)|\.{3}|…)/;
const ELISION_AT_END = /(?:\[\s*(?:\.{3}|…)\s*\]|\(\s*(?:\.{3}|…)\s*\)|\.{3}|…)$/;
const SENTENCE_BREAK = /[.;:]\s/g;

/** Inicio de la oración que contiene `at` (después del último «. », «; » o «: »). */
const sentenceStartBefore = (text, at) => {
  let start = 0;
  for (const m of text.slice(0, at).matchAll(SENTENCE_BREAK)) start = m.index + m[0].length;
  return start;
};
/** Fin de la oración que sigue a `from` (el próximo «.», «;» o «:»), o el final del texto. */
const sentenceEndAfter = (text, from) => {
  const m = /[.;:](?:\s|$)/.exec(text.slice(from));
  return m ? from + m.index : text.length;
};

export const quoteMatchesFragment = (quote, content) => {
  const normalizedQuote = normalizeWhitespace(quote);
  // Una cita solo de espacios quedaría vacía y `includes('')` siempre da true.
  if (normalizedQuote === '') return false;
  const normalizedContent = normalizeWhitespace(content);
  if (normalizedContent.includes(normalizedQuote)) return true;
  if (!ELISION_MARKER.test(normalizedQuote)) return false;

  const segments = normalizedQuote.split(ELISION_MARKER).map((s) => s.trim()).filter((s) => s !== '');
  if (segments.length === 0) return false;
  let searchFrom = 0;
  let previousEnd = null;
  let firstStart = null;
  for (const segment of segments) {
    if (segment.length < MIN_ELIDED_SEGMENT_CHARS) return false;
    const at = normalizedContent.indexOf(segment, searchFrom);
    if (at < 0) return false;
    if (previousEnd !== null && ELIDED_TEXT_GUARD.test(normalizedContent.slice(previousEnd, at))) return false;
    if (firstStart === null) firstStart = at;
    previousEnd = at + segment.length;
    searchFrom = previousEnd;
  }
  // REP-3857: con «...» al principio o al final, lo omitido llega hasta el borde de la oración. Ahí tampoco puede
  // haber una negación ni una salvedad (p. ej. citar «... se permite estacionar» de «No se permite estacionar»).
  if (ELISION_AT_START.test(normalizedQuote)
    && ELIDED_TEXT_GUARD.test(normalizedContent.slice(sentenceStartBefore(normalizedContent, firstStart), firstStart))) return false;
  if (ELISION_AT_END.test(normalizedQuote)
    && ELIDED_TEXT_GUARD.test(normalizedContent.slice(previousEnd, sentenceEndAfter(normalizedContent, previousEnd)))) return false;
  return true;
};

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
    if (!quoteMatchesFragment(cita.cita_textual, fragment.content)) {
      // Espejo de supabase/functions/analizar-reporte/index.ts: se guarda lo que el modelo intentó citar.
      return { valid: false, reason: `La cita de "${cita.fragment_id}" no aparece literal en el fragmento. Cita del modelo: "${truncateForReason(cita.cita_textual)}"` };
    }
  }

  return { valid: true };
};
