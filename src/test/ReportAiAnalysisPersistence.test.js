/**
 * @file ReportAiAnalysisPersistence.test.js
 * @description Pruebas del armado de filas para persistir el análisis del RAG (REP-2909).
 */

import { describe, it, expect } from 'vitest';
import { buildAnalysisRow, buildEvidenceRows } from '../services/reportAiAnalysisPersistence';

describe('REP-2909: buildAnalysisRow', () => {
  const baseResult = {
    estado: 'fundamentado',
    es_infraccion: true,
    fundamento_ciudadano: 'texto ciudadano',
    fundamento_oficial: 'texto oficial',
    confianza: 0.9,
    embeddingModelCode: 'gemini-embedding-2@768',
    generationModelCode: 'gemini-3.8-flash',
    promptVersion: 'v1',
    inputTokens: 100,
    outputTokens: 50,
    latencyMs: 1234.56,
  };

  it('mapea los campos del resultado a las columnas documentadas', () => {
    const row = buildAnalysisRow({ reportId: 'report-1', result: baseResult, suggestedServiceId: 'service-1' });
    expect(row).toEqual({
      report_id: 'report-1',
      result_status_code: 'fundamentado',
      is_infraction: true,
      suggested_service_id: 'service-1',
      suggested_agency_id: null,
      citizen_feedback: 'texto ciudadano',
      official_legal_foundation: 'texto oficial',
      confidence_score: 0.9,
      embedding_model_code: 'gemini-embedding-2@768',
      generation_model_code: 'gemini-3.8-flash',
      prompt_version: 'v1',
      input_tokens: 100,
      output_tokens: 50,
      latency_ms: 1235,
    });
  });

  it('persiste tambien los estados de fallo cerrado (indeterminado, sin_normativa)', () => {
    const row = buildAnalysisRow({
      reportId: 'report-1',
      result: { estado: 'sin_normativa', es_infraccion: false, confianza: 0, latencyMs: 5 },
    });
    expect(row.result_status_code).toBe('sin_normativa');
    expect(row.is_infraction).toBe(false);
  });

  it('rechaza si falta reportId o result.estado', () => {
    expect(() => buildAnalysisRow({ result: baseResult })).toThrow();
    expect(() => buildAnalysisRow({ reportId: 'x', result: {} })).toThrow();
  });
});

describe('REP-2909: buildEvidenceRows', () => {
  const retrievedFragments = [
    { fragment_id: 'FRAG-A', similarity: 0.91 },
    { fragment_id: 'FRAG-B', similarity: 0.62 },
    { fragment_id: 'FRAG-C', similarity: 0.5 },
  ];

  it('arma una fila por fragmento recuperado, no solo los citados', () => {
    const rows = buildEvidenceRows({
      analysisId: 'analysis-1',
      retrievedFragments,
      citas: [{ fragment_id: 'FRAG-A', cita_textual: 'cita literal' }],
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      analysis_id: 'analysis-1',
      fragment_id: 'FRAG-A',
      rank: 1,
      similarity: 0.91,
      was_cited: true,
      quoted_text: 'cita literal',
    });
    expect(rows[1].was_cited).toBe(false);
    expect(rows[1].quoted_text).toBeNull();
  });

  it('devuelve un array vacío si no hay fragmentos recuperados', () => {
    expect(buildEvidenceRows({ analysisId: 'a', retrievedFragments: [] })).toEqual([]);
    expect(buildEvidenceRows({ analysisId: 'a', retrievedFragments: undefined })).toEqual([]);
  });

  it('rechaza si falta analysisId', () => {
    expect(() => buildEvidenceRows({ retrievedFragments })).toThrow();
  });
});
