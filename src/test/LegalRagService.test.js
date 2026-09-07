/**
 * @file LegalRagService.test.js
 * @description Suite de pruebas unitarias y de integración para el servicio de RAG Legal (REP-2907).
 * Valida la integridad del corpus normativo inicial (REP-2906), la generación y similitud de embeddings,
 * las consultas de recuperación y el benchmarking de rendimiento/precisión (REP-3764).
 */

import { describe, it, expect } from 'vitest';
import {
  INITIAL_LEGAL_CORPUS,
  VECTOR_DIMENSION,
  normalizeText,
  generateDeterministicEmbedding,
  calculateCosineSimilarity,
  getLegalCorpusWithEmbeddings,
  searchRelevantNormativas,
  RAG_BENCHMARK_CASES,
  benchmarkRagQueries,
} from '../services/legalRagService';

describe('REP-2907: Servicio de RAG Jurídico y Búsqueda Vectorial de Normativas', () => {
  it('UT-RAG-01: Integridad del corpus inicial de 8 normativas (REP-2906)', () => {
    expect(INITIAL_LEGAL_CORPUS).toHaveLength(8);

    const requiredFields = [
      'id',
      'norma_codigo',
      'titulo',
      'categoria',
      'jurisdiccion',
      'autoridad',
      'articulo',
      'regla',
      'fuente_url',
      'vigencia',
      'version',
    ];

    INITIAL_LEGAL_CORPUS.forEach((norma) => {
      requiredFields.forEach((field) => {
        expect(norma[field], `El campo ${field} de la norma ${norma.norma_codigo} debe existir`).toBeDefined();
        expect(typeof norma[field]).toBe('string');
        expect(norma[field].length).toBeGreaterThan(0);
      });
    });

    // Verificamos unicidad de códigos de norma
    const codigos = INITIAL_LEGAL_CORPUS.map((n) => n.norma_codigo);
    const codigosUnicos = new Set(codigos);
    expect(codigosUnicos.size).toBe(8);
  });

  it('UT-RAG-01-B: Generación y propiedades matemáticas del embedding determinístico', () => {
    const text = 'Auto mal estacionado bloqueando rampa';
    const embedding = generateDeterministicEmbedding(text);

    expect(embedding).toHaveLength(VECTOR_DIMENSION);
    expect(Array.isArray(embedding)).toBe(true);

    // Verificamos norma euclidiana L2 (vector unitario aproximadamente 1.0)
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    expect(norm).toBeCloseTo(1.0, 3);

    // Similitud idéntica consigo mismo debe ser 1.0
    const selfSim = calculateCosineSimilarity(embedding, embedding);
    expect(selfSim).toBeCloseTo(1.0, 3);

    // Vector vacío para texto en blanco
    const emptyEmbedding = generateDeterministicEmbedding('');
    expect(emptyEmbedding.every((v) => v === 0)).toBe(true);
  });

  it('UT-RAG-02: Recuperación Positiva - Obstrucción de rampa de movilidad reducida', async () => {
    const response = await searchRelevantNormativas({
      query: 'Hay un auto bloqueando la rampa para discapacitados en la esquina',
      threshold: 0.5,
      limit: 3,
    });

    expect(response.success).toBe(true);
    expect(response.results.length).toBeGreaterThan(0);

    const topMatch = response.results[0];
    expect(topMatch.norma_codigo).toBe('LEY-24449-ART49B');
    expect(topMatch.similarity).toBeGreaterThan(0.70);
    expect(topMatch.categoria).toBe('mal_estacionado');
  });

  it('UT-RAG-03: Recuperación Positiva - Estacionamiento sobre senda peatonal', async () => {
    const response = await searchRelevantNormativas({
      query: 'Camioneta parada arriba de la senda peatonal tapando el paso',
      threshold: 0.5,
      limit: 3,
    });

    expect(response.success).toBe(true);
    expect(response.results.length).toBeGreaterThan(0);

    const topMatch = response.results[0];
    expect(topMatch.norma_codigo).toBe('LEY-24449-ART49');
    expect(topMatch.similarity).toBeGreaterThan(0.70);
  });

  it('UT-RAG-04: Recuperación Positiva - Disposición clandestina de basura y escombros', async () => {
    const response = await searchRelevantNormativas({
      query: 'Tiraron escombros y bolsas de basura en medio de la vereda',
      threshold: 0.5,
      limit: 3,
    });

    expect(response.success).toBe(true);
    expect(response.results.length).toBeGreaterThan(0);

    const topMatch = response.results[0];
    expect(topMatch.norma_codigo).toBe('ORD-RESIDUOS-CLAND');
    expect(topMatch.similarity).toBeGreaterThan(0.70);
    expect(topMatch.categoria).toBe('basura');
  });

  it('UT-RAG-05: Recuperación Positiva - Violación de semáforo en rojo', async () => {
    const response = await searchRelevantNormativas({
      query: 'Un auto cruzó el semáforo con luz roja a toda velocidad',
      threshold: 0.5,
      limit: 3,
    });

    expect(response.success).toBe(true);
    expect(response.results.length).toBeGreaterThan(0);

    const topMatch = response.results[0];
    expect(topMatch.norma_codigo).toBe('LEY-24449-ART44');
    expect(topMatch.similarity).toBeGreaterThan(0.70);
    expect(topMatch.categoria).toBe('semaforo');
  });

  it('UT-RAG-06: Recuperación Positiva - Ruidos molestos en horario de descanso', async () => {
    const response = await searchRelevantNormativas({
      query: 'Música altísima a todo volumen y fiesta a las tres de la madrugada',
      threshold: 0.5,
      limit: 3,
    });

    expect(response.success).toBe(true);
    expect(response.results.length).toBeGreaterThan(0);

    const topMatch = response.results[0];
    expect(topMatch.norma_codigo).toBe('ORD-RUIDOS-MOL');
    expect(topMatch.similarity).toBeGreaterThan(0.65);
  });

  it('UT-RAG-07: Caso Negativo - Rechazo de consultas fuera de dominio (Out-of-Domain)', async () => {
    const response = await searchRelevantNormativas({
      query: 'Receta casera de empanadas de carne cortadas a cuchillo',
      threshold: 0.5,
      limit: 3,
    });

    expect(response.success).toBe(true);
    // Ningún resultado debe superar el umbral de 0.5
    expect(response.results).toHaveLength(0);
  });

  it('UT-RAG-08: Caso Ambiguo - Poca especificidad semántica', async () => {
    const response = await searchRelevantNormativas({
      query: 'Hay un desorden tremendo y cosas raras tiradas en la cuadra',
      threshold: 0.5,
      limit: 3,
    });

    expect(response.success).toBe(true);
    // En caso ambiguo, la similitud del primer resultado (si existe) debe ser moderada (< 0.75)
    if (response.results.length > 0) {
      expect(response.results[0].similarity).toBeLessThan(0.75);
    }
  });

  it('UT-RAG-09: Filtro por categoría temática', async () => {
    const response = await searchRelevantNormativas({
      query: 'Auto y escombros en la vía pública',
      category: 'mal_estacionado',
      threshold: 0.2,
      limit: 5,
    });

    expect(response.success).toBe(true);
    response.results.forEach((match) => {
      expect(match.categoria).toBe('mal_estacionado');
    });
  });

  it('UT-RAG-10: Benchmarking de consultas de evaluación y latencia (REP-3764)', async () => {
    const benchmarkResult = await benchmarkRagQueries();

    expect(benchmarkResult.totalQueries).toBe(RAG_BENCHMARK_CASES.length);
    expect(benchmarkResult.averageLatencyMs).toBeLessThan(50); // En emulador local < 50ms
    expect(benchmarkResult.accuracyPositivePercent).toBeGreaterThanOrEqual(80);
    expect(benchmarkResult.rejectionRateOutOfDomainPercent).toBe(100);
    expect(benchmarkResult.status).toBe('GO');

    // Validamos el formato de las evaluaciones individuales
    benchmarkResult.evaluations.forEach((evalItem) => {
      expect(evalItem).toHaveProperty('caseId');
      expect(evalItem).toHaveProperty('isCorrect');
      expect(evalItem).toHaveProperty('latencyMs');
    });
  });

  it('UT-RAG-11: Manejo de errores de validación y resiliencia ante inputs anómalos', async () => {
    // Consulta vacía
    const emptyResult = await searchRelevantNormativas({ query: '' });
    expect(emptyResult.success).toBe(false);
    expect(emptyResult.results).toHaveLength(0);
    expect(emptyResult.error).toBeDefined();

    // Consulta nula o tipo inválido
    const nullResult = await searchRelevantNormativas({ query: null });
    expect(nullResult.success).toBe(false);

    // Texto con caracteres especiales y acentos debe normalizarse sin error
    const specialChars = normalizeText('¡¿Atención?! AUTO ESTACIONADO sobre Vereda con áéíóú');
    expect(specialChars).toBe('atencion auto estacionado sobre vereda con aeiou');
  });
});
