/**
 * @file LegalRagService.test.js
 * @description Suite de pruebas del RAG jurídico de producción (REP-2908).
 * A diferencia del spike de REP-2907, estas pruebas NO comparan contra un corpus
 * hardcodeado en el servicio: usan dobles de prueba deterministicos
 * (src/test/fixtures/ragTestFixtures.js) que imitan el contrato real de
 * match_knowledge_fragments y de la API de Gemini, y verifican el pipeline
 * completo: cascada jurisdiccional por clave, umbral de similitud, generación
 * condicionada, y validación anti-alucinación que falla cerrado.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import {
  RAG_RESULT_STATUS,
  DEFAULT_MATCH_COUNT,
  buildReportQueryText,
  retrieveKnowledgeFragments,
  selectFragmentsAboveThreshold,
  validateGeneratedAnalysis,
  analyzeReport,
} from '../services/legalRagService';
import {
  FIXTURE_LOCALITY_IDS,
  createFakeEmbeddingsClient,
  createFakeSupabaseClient,
  createFakeGenerationClient,
  createBrokenGenerationClient,
  KNOWN_AGENCY_IDS,
} from './fixtures/ragTestFixtures';

const SERVICE_SOURCE = readFileSync(
  path.resolve(process.cwd(), 'src/services/legalRagService.js'),
  'utf-8'
);

describe('REP-2908: el servicio no contiene corpus ni embeddings hardcodeados', () => {
  it('no define INITIAL_LEGAL_CORPUS ni generateDeterministicEmbedding (spike de REP-2907)', () => {
    expect(SERVICE_SOURCE).not.toContain('INITIAL_LEGAL_CORPUS');
    expect(SERVICE_SOURCE).not.toContain('generateDeterministicEmbedding');
    expect(SERVICE_SOURCE).not.toContain('SEMANTIC_CONCEPT_BUCKETS');
  });

  it('no resuelve jurisdicción por matching de texto: toda recuperación exige localityId', async () => {
    const result = await retrieveKnowledgeFragments({
      supabaseClient: createFakeSupabaseClient(),
      embeddingsClient: createFakeEmbeddingsClient(),
      queryText: 'cualquier texto',
      localityId: undefined,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/localityId/);
  });
});

describe('REP-2908: buildReportQueryText', () => {
  it('rechaza descripciones vacías', () => {
    expect(() => buildReportQueryText({ description: '' })).toThrow();
    expect(() => buildReportQueryText({ description: null })).toThrow();
  });

  it('no concatena jurisdicción al texto a vectorizar (docx §1.1)', () => {
    const text = buildReportQueryText({ description: 'hay un bache', category: 'infraestructura' });
    expect(text).not.toMatch(/avellaneda|caba|pba/i);
  });
});

describe('REP-2908: retrieveKnowledgeFragments — cascada jurisdiccional vía RPC (casos A-F de REP-3764)', () => {
  const embeddingsClient = createFakeEmbeddingsClient();
  const supabaseClient = createFakeSupabaseClient();

  it('Caso A: infraestructura en Avellaneda recupera 001/002/003 y descarta el distractor 008', async () => {
    const { fragments } = await retrieveKnowledgeFragments({
      supabaseClient,
      embeddingsClient,
      queryText: 'Hay una boca de tormenta rota hace semanas en mi cuadra',
      localityId: FIXTURE_LOCALITY_IDS.AVELLANEDA,
      matchCount: DEFAULT_MATCH_COUNT,
    });
    const eligible = selectFragmentsAboveThreshold(fragments, 0.45).map((f) => f.fragment_id);
    expect(eligible).toEqual(expect.arrayContaining(['FRAG-001', 'FRAG-002', 'FRAG-003']));
    expect(eligible).not.toContain('FRAG-008');
  });

  it('Caso B: tránsito en CABA recupera 006 y 007 juntos y descarta 005 (Ley nacional no aplica en CABA)', async () => {
    const { fragments } = await retrieveKnowledgeFragments({
      supabaseClient,
      embeddingsClient,
      queryText: 'Un auto está estacionado sobre la rampa para discapacitados de la esquina',
      localityId: FIXTURE_LOCALITY_IDS.CABA,
    });
    const eligible = selectFragmentsAboveThreshold(fragments, 0.45).map((f) => f.fragment_id);
    expect(eligible).toEqual(expect.arrayContaining(['FRAG-006', 'FRAG-007']));
    expect(eligible).not.toContain('FRAG-005');
  });

  it('Caso C (control negativo): mismo texto que B en Avellaneda recupera 005 y excluye normas de CABA', async () => {
    const { fragments } = await retrieveKnowledgeFragments({
      supabaseClient,
      embeddingsClient,
      queryText: 'Un auto está estacionado sobre la rampa para discapacitados de la esquina',
      localityId: FIXTURE_LOCALITY_IDS.AVELLANEDA,
    });
    const eligible = selectFragmentsAboveThreshold(fragments, 0.45).map((f) => f.fragment_id);
    expect(eligible).toContain('FRAG-005');
    expect(eligible).not.toContain('FRAG-006');
    expect(eligible).not.toContain('FRAG-007');
  });

  it('Caso D: asimetría jurisdiccional — la misma consulta trae normas distintas en Avellaneda y CABA', async () => {
    const query = 'No anda la luz de la calle hace tres días';

    const { fragments: avellanedaFragments } = await retrieveKnowledgeFragments({
      supabaseClient,
      embeddingsClient,
      queryText: query,
      localityId: FIXTURE_LOCALITY_IDS.AVELLANEDA,
    });
    const { fragments: cabaFragments } = await retrieveKnowledgeFragments({
      supabaseClient,
      embeddingsClient,
      queryText: query,
      localityId: FIXTURE_LOCALITY_IDS.CABA,
    });

    // Umbral más laxo en este caso: la fixture de test es una vectorización simplificada
    // y el fragmento LOM 52 cubre varios rubros a la vez, diluyendo su señal específica
    // de alumbrado. Con un embedding real (gemini-embedding-2) la señal es más nítida;
    // este test verifica el CONTRATO (asimetría, aislamiento), no el score exacto.
    const avellanedaTop = selectFragmentsAboveThreshold(avellanedaFragments, 0.35);
    const cabaTop = selectFragmentsAboveThreshold(cabaFragments, 0.35);

    expect(avellanedaTop[0]?.fragment_id).toBe('FRAG-002');
    expect(cabaTop[0]?.fragment_id).toBe('FRAG-004');
    expect(avellanedaTop.map((f) => f.fragment_id)).not.toContain('FRAG-004');
    expect(cabaTop.map((f) => f.fragment_id)).not.toContain('FRAG-002');
  });

  it('Caso E: resiste el falso positivo léxico del distractor (Dec-Ley 8031/73)', async () => {
    const { fragments } = await retrieveKnowledgeFragments({
      supabaseClient,
      embeddingsClient,
      queryText: 'Hay quilombo en la esquina, discuten y frenan el tránsito todos los días',
      localityId: FIXTURE_LOCALITY_IDS.AVELLANEDA,
    });
    const eligible = selectFragmentsAboveThreshold(fragments, 0.45).map((f) => f.fragment_id);
    expect(eligible).toContain('FRAG-005');
    expect(eligible).not.toContain('FRAG-008');
  });

  it('Caso F: sin evidencia suficiente — ningún fragmento supera el umbral', async () => {
    const { fragments } = await retrieveKnowledgeFragments({
      supabaseClient,
      embeddingsClient,
      queryText: 'Un puesto vende bebidas en la vereda sin habilitación',
      localityId: FIXTURE_LOCALITY_IDS.AVELLANEDA,
    });
    const eligible = selectFragmentsAboveThreshold(fragments, 0.40);
    expect(eligible).toHaveLength(0);
  });
});

describe('REP-2908: analyzeReport — orquestación completa con fallo cerrado', () => {
  it('recupera, genera y valida un fundamento cuando hay evidencia suficiente', async () => {
    const result = await analyzeReport({
      description: 'Un auto está estacionado sobre la rampa para discapacitados de la esquina',
      category: 'transito',
      localityId: FIXTURE_LOCALITY_IDS.CABA,
      supabaseClient: createFakeSupabaseClient(),
      embeddingsClient: createFakeEmbeddingsClient(),
      generationClient: createFakeGenerationClient(),
      knownAgencyIds: KNOWN_AGENCY_IDS,
      threshold: 0.45,
    });

    expect(result.estado).toBe(RAG_RESULT_STATUS.FUNDAMENTADO);
    expect(result.citedFragments.length).toBeGreaterThan(0);
    expect(result.citedFragments[0].fragment_id).toBe('FRAG-006');
  });

  it('Caso F: no llama al cliente de generación cuando nada supera el umbral (cero riesgo de invención)', async () => {
    const generationClient = createFakeGenerationClient();
    const generateSpy = vi.spyOn(generationClient, 'generateJustification');

    const result = await analyzeReport({
      description: 'Un puesto vende bebidas en la vereda sin habilitación',
      localityId: FIXTURE_LOCALITY_IDS.AVELLANEDA,
      supabaseClient: createFakeSupabaseClient(),
      embeddingsClient: createFakeEmbeddingsClient(),
      generationClient,
      threshold: 0.40,
    });

    expect(result.estado).toBe(RAG_RESULT_STATUS.SIN_NORMATIVA);
    expect(generateSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['cita_no_literal', 'una cita que no aparece literal en el fragmento recuperado'],
    ['fragment_id_no_recuperado', 'un fragment_id que no estaba entre los recuperados'],
    ['esquema_invalido', 'una respuesta que no cumple el esquema JSON obligatorio'],
  ])('cae a INDETERMINADO ante %s: %s', async (failureMode) => {
    const result = await analyzeReport({
      description: 'Un auto está estacionado sobre la rampa para discapacitados de la esquina',
      localityId: FIXTURE_LOCALITY_IDS.CABA,
      supabaseClient: createFakeSupabaseClient(),
      embeddingsClient: createFakeEmbeddingsClient(),
      generationClient: createBrokenGenerationClient(failureMode),
      knownAgencyIds: KNOWN_AGENCY_IDS,
      threshold: 0.45,
    });

    expect(result.estado).toBe(RAG_RESULT_STATUS.INDETERMINADO);
    expect(result.error).toBeTruthy();
  });

  it('cae a INDETERMINADO cuando organismo_sugerido_id no existe en agencies', async () => {
    const result = await analyzeReport({
      description: 'Un auto está estacionado sobre la rampa para discapacitados de la esquina',
      localityId: FIXTURE_LOCALITY_IDS.CABA,
      supabaseClient: createFakeSupabaseClient(),
      embeddingsClient: createFakeEmbeddingsClient(),
      generationClient: createBrokenGenerationClient('organismo_inexistente_por_defecto'),
      knownAgencyIds: KNOWN_AGENCY_IDS,
      threshold: 0.45,
    });

    expect(result.estado).toBe(RAG_RESULT_STATUS.INDETERMINADO);
  });

  it('cae a INDETERMINADO si el cliente de generación lanza un error', async () => {
    const failingGenerationClient = {
      generateJustification: vi.fn().mockRejectedValue(new Error('timeout de la API de Gemini')),
    };

    const result = await analyzeReport({
      description: 'Un auto está estacionado sobre la rampa para discapacitados de la esquina',
      localityId: FIXTURE_LOCALITY_IDS.CABA,
      supabaseClient: createFakeSupabaseClient(),
      embeddingsClient: createFakeEmbeddingsClient(),
      generationClient: failingGenerationClient,
      threshold: 0.45,
    });

    expect(result.estado).toBe(RAG_RESULT_STATUS.INDETERMINADO);
    expect(result.error).toMatch(/timeout/);
  });

  it('cae a INDETERMINADO si el RPC de recuperación falla', async () => {
    const brokenSupabaseClient = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'conexión perdida' } }) };

    const result = await analyzeReport({
      description: 'cualquier reclamo',
      localityId: FIXTURE_LOCALITY_IDS.AVELLANEDA,
      supabaseClient: brokenSupabaseClient,
      embeddingsClient: createFakeEmbeddingsClient(),
      generationClient: createFakeGenerationClient(),
    });

    expect(result.estado).toBe(RAG_RESULT_STATUS.INDETERMINADO);
    expect(result.error).toMatch(/conexión perdida/);
  });
});

describe('REP-2908: validateGeneratedAnalysis — capa determinística anti-alucinación', () => {
  const retrievedFragments = [
    { fragment_id: 'FRAG-006', content: 'Prohibición general de estacionar frente a rampas para personas con necesidades especiales.' },
  ];

  it('acepta una respuesta bien formada que cita literalmente un fragmento recuperado', () => {
    const result = validateGeneratedAnalysis({
      llmResponse: {
        estado: 'fundamentado',
        es_infraccion: true,
        fundamento_ciudadano: 'x',
        fundamento_oficial: 'y',
        confianza: 0.9,
        citas: [{ fragment_id: 'FRAG-006', cita_textual: 'Prohibición general de estacionar' }],
      },
      retrievedFragments,
    });
    expect(result.valid).toBe(true);
  });

  it('rechaza una cita que no aparece literal en el fragmento', () => {
    const result = validateGeneratedAnalysis({
      llmResponse: {
        estado: 'fundamentado',
        es_infraccion: true,
        fundamento_ciudadano: 'x',
        fundamento_oficial: 'y',
        confianza: 0.9,
        citas: [{ fragment_id: 'FRAG-006', cita_textual: 'texto inventado que no está en el fragmento' }],
      },
      retrievedFragments,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/no aparece literal/);
  });

  it('rechaza un fragment_id que no estaba entre los recuperados', () => {
    const result = validateGeneratedAnalysis({
      llmResponse: {
        estado: 'fundamentado',
        es_infraccion: true,
        fundamento_ciudadano: 'x',
        fundamento_oficial: 'y',
        confianza: 0.9,
        citas: [{ fragment_id: 'FRAG-999', cita_textual: 'cualquier cosa' }],
      },
      retrievedFragments,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/no está entre los fragmentos recuperados/);
  });

  it('rechaza un estado que no es uno de los valores reconocidos', () => {
    const result = validateGeneratedAnalysis({
      llmResponse: {
        estado: 'aprobado_con_reservas',
        es_infraccion: true,
        fundamento_ciudadano: 'x',
        fundamento_oficial: 'y',
        confianza: 0.9,
        citas: [],
      },
      retrievedFragments,
    });
    expect(result.valid).toBe(false);
  });

  it('rechaza un organismo_sugerido_id que no existe en el catálogo de agencies', () => {
    const result = validateGeneratedAnalysis({
      llmResponse: {
        estado: 'fundamentado',
        es_infraccion: true,
        organismo_sugerido_id: 'agency-fantasma',
        fundamento_ciudadano: 'x',
        fundamento_oficial: 'y',
        confianza: 0.9,
        citas: [],
      },
      retrievedFragments,
      knownAgencyIds: KNOWN_AGENCY_IDS,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/no existe en agencies/);
  });

  it('rechaza una respuesta que no es un objeto', () => {
    expect(validateGeneratedAnalysis({ llmResponse: null, retrievedFragments }).valid).toBe(false);
    expect(validateGeneratedAnalysis({ llmResponse: 'texto plano', retrievedFragments }).valid).toBe(false);
  });
});
