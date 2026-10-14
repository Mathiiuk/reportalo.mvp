/**
 * @file legalFoundationService.js
 * @description REP-2902 · Fundamento legal preliminar trazable de un reporte.
 *
 * Lee `get_report_legal_foundation` (una función de la base que verifica cada cita contra el corpus y la
 * jurisdicción del reporte) y arma el bloque de TEXTO jurídico que REP-2801 pondrá en el reporte al organismo.
 *
 * Reglas que este módulo no rompe:
 *  - Nunca inventa texto jurídico: si no hay fundamento verificado, el bloque lo dice y no cita nada.
 *  - Separa siempre el «fundamento preliminar» (asistencia de IA) de una decisión administrativa.
 *  - Solo usa lo que devuelve la función, que ya excluyó el texto para el ciudadano y el puntaje de confianza.
 *  - Quien no es autor ni receptor autorizado recibe `null` (la función no revela si hay análisis).
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const LEGAL_FOUNDATION_STATUS = Object.freeze({
  VERIFIED: 'fundamento_preliminar',
  NOT_VERIFIED: 'sin_fundamento_verificado',
  PENDING: 'pendiente',
});

/** Aviso fijo de respaldo, igual al que devuelve la base. Se usa solo si por algún motivo faltara en la respuesta. */
export const LEGAL_FOUNDATION_DISCLAIMER =
  'Fundamento preliminar generado con asistencia de inteligencia artificial a partir del corpus normativo ' +
  'verificado del proyecto. No es una decisión administrativa ni una resolución estatal: la decisión ' +
  'corresponde exclusivamente al organismo competente.';

/**
 * Pide a la base el fundamento legal preliminar de un reporte.
 * @param {string} reportId
 * @returns {Promise<{ success: boolean, data: object|null, error?: string }>}
 *   `data` es null cuando quien llama no tiene acceso (o el reporte no existe): no se distingue a propósito.
 */
export const getReportLegalFoundation = async (reportId) => {
  if (!reportId) return { success: false, data: null, error: 'Falta el id del reporte.' };
  if (!isSupabaseConfigured) return { success: false, data: null, error: 'La base no está configurada.' };

  try {
    const { data, error } = await supabase.rpc('get_report_legal_foundation', { p_report_id: reportId });
    if (error) return { success: false, data: null, error: error.message || 'No se pudo leer el fundamento legal.' };
    return { success: true, data: data ?? null };
  } catch (err) {
    return { success: false, data: null, error: err?.message || 'No se pudo leer el fundamento legal.' };
  }
};

/**
 * ¿Hay un fundamento verificado que se pueda presentar como tal? Exige estado verificado Y al menos una cita:
 * un estado «verificado» sin citas nunca se presenta como fundamento.
 * @param {object|null} foundation
 */
export const hasVerifiedLegalFoundation = (foundation) =>
  foundation?.status === LEGAL_FOUNDATION_STATUS.VERIFIED &&
  Array.isArray(foundation.citations) &&
  foundation.citations.length > 0;

const jurisdictionLabel = (jurisdiction) =>
  [jurisdiction?.locality, jurisdiction?.subdivision, jurisdiction?.state_province].filter(Boolean).join(', ');

const documentLabel = (citation) => {
  const type = citation.document_type ? String(citation.document_type).replace(/_/g, '-') : '';
  const number = citation.document_number ? String(citation.document_number) : '';
  const head = [type, number].filter(Boolean).join(' ');
  return [head, citation.source_title].filter(Boolean).join(' — ');
};

const verifiedDate = (value) => (value ? String(value).slice(0, 10) : null);

/**
 * Arma el bloque de texto del fundamento legal preliminar para el reporte al organismo.
 * @param {object|null} foundation Lo que devuelve getReportLegalFoundation (data)
 * @returns {string|null} null si quien llama no tiene acceso (no hay nada que mostrar ni enviar)
 */
export const buildLegalFoundationText = (foundation) => {
  if (!foundation) return null;

  const disclaimer = foundation.disclaimer || LEGAL_FOUNDATION_DISCLAIMER;
  const place = jurisdictionLabel(foundation.jurisdiction);
  const lines = ['FUNDAMENTO LEGAL PRELIMINAR (generado con asistencia de IA)'];
  if (place) lines.push(`Jurisdicción del reporte: ${place}`);

  if (hasVerifiedLegalFoundation(foundation)) {
    lines.push('', 'Normas citadas:');
    foundation.citations.forEach((citation, index) => {
      lines.push(`${index + 1}. ${citation.reference || 'Norma del corpus'}`);
      const doc = documentLabel(citation);
      if (doc) lines.push(`   Norma: ${doc}${citation.issuing_authority ? ` (${citation.issuing_authority})` : ''}`);
      if (citation.source_url) {
        const date = verifiedDate(citation.verified_at);
        lines.push(`   Fuente: ${citation.source_url}${date ? ` (verificada el ${date})` : ''}`);
      }
      if (citation.quoted_text) lines.push(`   Cita textual: «${citation.quoted_text}»`);
    });
    // H-4 (decisión del PO, 14/10): al organismo viaja norma, artículo, cita textual y fuente oficial.
    // El resumen técnico de la IA (`official_foundation`) NO viaja: no es una cita verificable contra el corpus.
  } else if (foundation.status === LEGAL_FOUNDATION_STATUS.PENDING) {
    lines.push('', 'Estado: análisis pendiente. Todavía no hay fundamento legal para este reporte.');
  } else {
    // Sin fundamento verificado: se dice y se explica, sin ningún texto jurídico
    lines.push(
      '',
      'Estado: sin fundamento verificado.',
      `Motivo: ${foundation.abstention_reason || 'No hay un fundamento normativo verificado para este reclamo.'}`
    );
  }

  lines.push('', `Aviso: ${disclaimer}`);
  return lines.join('\n');
};
