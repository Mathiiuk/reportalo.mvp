/**
 * @file LegalRagService.test.js
 * @description Suite de pruebas unitarias y de integración para el servicio de RAG Legal (REP-2907).
 * Valida la integridad del corpus oficial consolidado por Hernán (REP-2906), la generación de embeddings,
 * el filtrado en cascada jurisdiccional y los 6 casos de prueba esperados A-F de REP-3764.
 */

import { describe, it, expect } from 'vitest';
import {
  INITIAL_LEGAL_CORPUS,
  VECTOR_DIMENSION,
  normalizeText,
  generateDeterministicEmbedding,
  calculateCosineSimilarity,
  getLegalCorpusWithEmbeddings,
  resolveEligibleJurisdictions,
  searchRelevantNormativas,
  RAG_BENCHMARK_CASES,
  benchmarkRagQueries,
} from '../services/legalRagService';

describe('REP-2907: Servicio de RAG Jurídico — Corpus Oficial (REP-2906) y Benchmark (REP-3764)', () => {
  it('UT-RAG-01: Integridad del corpus oficial de 8 normas y trazabilidad completa (REP-2906)', () => {
    expect(INITIAL_LEGAL_CORPUS).toHaveLength(8);

    const requiredFields = [
      'id',
      'fragment_id',
      'norma_codigo',
      'titulo',
      'categoria',
      'jurisdiccion',
      'autoridad',
      'articulo',
      'tipo_fundamento',
      'regla',
      'fuente_url',
      'vigencia',
      'version',
    ];

    INITIAL_LEGAL_CORPUS.forEach((norma) => {
      requiredFields.forEach((field) => {
        expect(norma[field], `El campo ${field} de ${norma.norma_codigo} debe existir`).toBeDefined();
        expect(typeof norma[field]).toBe('string');
        expect(norma[field].length).toBeGreaterThan(0);
      });
    });

    // Verificamos unicidad de códigos de fragmentos
    const codigos = INITIAL_LEGAL_CORPUS.map((n) => n.norma_codigo);
    const codigosUnicos = new Set(codigos);
    expect(codigosUnicos.size).toBe(8);

    // Verificamos presencia del distractor deliberado (Dec-Ley 8031/73)
    const distractor = INITIAL_LEGAL_CORPUS.find((n) => n.norma_codigo === 'DECLEY-8031-73-INDICE');
    expect(distractor).toBeDefined();
    expect(distractor.tipo_fundamento).toBe('distractor');
  });

  it('UT-RAG-01-B: Generación determinística y normalización L2 del embedding', () => {
    const text = 'Auto estacionado sobre rampa para personas con movilidad reducida';
    const embedding = generateDeterministicEmbedding(text);

    expect(embedding).toHaveLength(VECTOR_DIMENSION);
    expect(Array.isArray(embedding)).toBe(true);

    // Verificamos norma euclidiana L2 (vector unitario = 1.0)
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    expect(norm).toBeCloseTo(1.0, 3);

    // Similitud consigo mismo = 1.0
    const selfSim = calculateCosineSimilarity(embedding, embedding);
    expect(selfSim).toBeCloseTo(1.0, 3);

    // Vector nulo para entrada vacía
    const emptyEmbedding = generateDeterministicEmbedding('');
    expect(emptyEmbedding.every((v) => v === 0)).toBe(true);
  });

  it('UT-RAG-01-C: Resolución en cascada de jurisdicciones elegibles', () => {
    const avellanedaScopes = resolveEligibleJurisdictions('Avellaneda');
    expect(avellanedaScopes.has('Provincial — Buenos Aires')).toBe(true);
    expect(avellanedaScopes.has('Nacional')).toBe(true);
    expect(avellanedaScopes.has('Municipal — CABA')).toBe(false);

    const cabaScopes = resolveEligibleJurisdictions('CABA');
    expect(cabaScopes.has('Municipal — CABA')).toBe(true);
    expect(cabaScopes.has('Provincial — Buenos Aires')).toBe(false);
  });

  it('UT-RAG-02: Caso A — Reclamo de infraestructura en Avellaneda (Boca de tormenta)', async () => {
    const response = await searchRelevantNormativas({
      query: 'Hay una boca de tormenta rota hace semanas en mi cuadra',
      jurisdiction: 'Avellaneda',
      threshold: 0.45,
      limit: 3,
    });

    expect(response.success).toBe(true);
    expect(response.hasGrounding).toBe(true);
    expect(response.results.length).toBe(3);

    const retrievedCodes = response.results.map((r) => r.norma_codigo);

    // Debe recuperar ítems 1, 2 y 3 (Const. PBA 192.4, LOM 52 y LOM 59)
    expect(retrievedCodes).toContain('CONST-PBA-ART192-INC4');
    expect(retrievedCodes).toContain('LOM-DECLEY-6769-ART52');
    expect(retrievedCodes).toContain('LOM-DECLEY-6769-ART59');

    // Debe descartar el ítem 8 (Dec-Ley 8031/73)
    expect(retrievedCodes).not.toContain('DECLEY-8031-73-INDICE');
  });

  it('UT-RAG-03: Caso B — Reclamo de tránsito en CABA (Auto sobre rampa)', async () => {
    const response = await searchRelevantNormativas({
      query: 'Un auto está estacionado sobre la rampa para discapacitados de la esquina',
      jurisdiction: 'CABA',
      threshold: 0.45,
      limit: 3,
    });

    expect(response.success).toBe(true);
    expect(response.hasGrounding).toBe(true);

    const retrievedCodes = response.results.map((r) => r.norma_codigo);

    // Debe recuperar ítems 6 y 7 juntos (conducta Ley 2148 + sanción Ley 451)
    expect(retrievedCodes).toContain('LEY-2148-CABA-ARTS718-719');
    expect(retrievedCodes).toContain('LEY-451-CABA-ART6152');

    // Debe descartar ítem 5 (Ley 24.449 no aplica en CABA para estacionamiento)
    expect(retrievedCodes).not.toContain('LEY-24449-ARTS48-49');
  });

  it('UT-RAG-04: Caso C — Control negativo geográfico en Avellaneda (Mismo texto de rampa)', async () => {
    const response = await searchRelevantNormativas({
      query: 'Un auto está estacionado sobre la rampa para discapacitados de la esquina',
      jurisdiction: 'Avellaneda',
      threshold: 0.45,
      limit: 3,
    });

    expect(response.success).toBe(true);
    expect(response.hasGrounding).toBe(true);

    const retrievedCodes = response.results.map((r) => r.norma_codigo);

    // En Avellaneda rige Ley Nacional 24.449 (adhesión PBA Ley 13.927)
    expect(retrievedCodes).toContain('LEY-24449-ARTS48-49');

    // NO debe traer normas de CABA (prueba el aislamiento jurisdiccional estricto)
    expect(retrievedCodes).not.toContain('LEY-2148-CABA-ARTS718-719');
    expect(retrievedCodes).not.toContain('LEY-451-CABA-ART6152');
  });

  it('UT-RAG-05: Caso D — Asimetría jurisdiccional ante alumbrado público apagado', async () => {
    const query = 'No anda la luz de la calle hace tres días';

    // 1. En Avellaneda
    const respAvellaneda = await searchRelevantNormativas({
      query,
      jurisdiction: 'Avellaneda',
      threshold: 0.45,
      limit: 3,
    });
    expect(respAvellaneda.success).toBe(true);
    const codesAvellaneda = respAvellaneda.results.map((r) => r.norma_codigo);
    expect(codesAvellaneda).toContain('LOM-DECLEY-6769-ART52');
    expect(codesAvellaneda).not.toContain('LEY-210-CABA-ARTS2-3');

    // 2. En CABA
    const respCaba = await searchRelevantNormativas({
      query,
      jurisdiction: 'CABA',
      threshold: 0.45,
      limit: 3,
    });
    expect(respCaba.success).toBe(true);
    const codesCaba = respCaba.results.map((r) => r.norma_codigo);
    expect(codesCaba).toContain('LEY-210-CABA-ARTS2-3');
    expect(codesCaba).not.toContain('LOM-DECLEY-6769-ART52');

    // Validación de asimetría: no deben devolver la misma norma
    expect(codesAvellaneda[0]).not.toBe(codesCaba[0]);
  });

  it('UT-RAG-06: Caso E — Ambiguo y resistencia a falso positivo léxico (Quilombo en la esquina)', async () => {
    const response = await searchRelevantNormativas({
      query: 'Hay quilombo en la esquina, discuten y frenan el tránsito todos los días',
      jurisdiction: 'Avellaneda',
      threshold: 0.40,
      limit: 3,
    });

    expect(response.success).toBe(true);
    expect(response.hasGrounding).toBe(true);

    const retrievedCodes = response.results.map((r) => r.norma_codigo);

    // Debe encuadrar en tránsito (Ley 24.449 por frenar el tránsito)
    expect(retrievedCodes).toContain('LEY-24449-ARTS48-49');

    // Debe descartar terminantemente el distractor Dec-Ley 8031/73
    expect(retrievedCodes).not.toContain('DECLEY-8031-73-INDICE');
  });

  it('UT-RAG-07: Caso F — Sin evidencia suficiente (Puesto sin habilitación en vereda)', async () => {
    const response = await searchRelevantNormativas({
      query: 'Un puesto vende bebidas en la vereda sin habilitación',
      jurisdiction: 'Avellaneda',
      threshold: 0.45,
      limit: 3,
    });

    expect(response.success).toBe(true);

    // Debe retornar 0 resultados y hasGrounding en false
    expect(response.results).toHaveLength(0);
    expect(response.hasGrounding).toBe(false);

    // Debe declarar explícitamente y con transparencia la falta de fundamento normativo cargado
    expect(response.message).toContain('No se cuenta con fundamento normativo cargado');
  });

  it('UT-RAG-08: Benchmark Integral de REP-3764 (Latencia, Precisión y Descarte)', async () => {
    const report = await benchmarkRagQueries();

    expect(report.totalQueries).toBe(RAG_BENCHMARK_CASES.length);
    expect(report.accuracyPercent).toBe(100);
    expect(report.averageLatencyMs).toBeLessThan(50);
    expect(report.status).toBe('GO');

    // Verificamos que cada una de las evaluaciones sea correcta
    report.evaluations.forEach((evaluation) => {
      expect(evaluation.isCorrect, `El caso ${evaluation.caseName} debe ser correcto`).toBe(true);
    });
  });

  it('UT-RAG-09: Resiliencia y manejo de errores ante entradas inválidas', async () => {
    const emptyResponse = await searchRelevantNormativas({ query: '' });
    expect(emptyResponse.success).toBe(false);
    expect(emptyResponse.results).toHaveLength(0);
    expect(emptyResponse.source).toBe('validation_error');

    const nullResponse = await searchRelevantNormativas({ query: null });
    expect(nullResponse.success).toBe(false);
  });
});
