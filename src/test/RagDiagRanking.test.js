/**
 * @file RagDiagRanking.test.js
 * @description RAG-DIAG-RANKING: lógica pura del script de diagnóstico de ranking
 * (scripts/rag-local-dev/rep-diag-ranking/lib.mjs). Sin red.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  readProdConfig,
  buildQueryText,
  classifyCandidates,
  toMarkdown,
} from '../../scripts/rag-local-dev/rep-diag-ranking/lib.mjs';

const prodSource = readFileSync(
  resolve(__dirname, '../../supabase/functions/analizar-reporte/index.ts'),
  'utf8'
);

describe('readProdConfig', () => {
  it('lee top-k, umbral, dimensión y modelo del fuente real de la Edge Function', () => {
    const config = readProdConfig(prodSource);
    expect(config.matchCount).toBe(8);
    expect(config.threshold).toBe(0.45);
    expect(config.dimensions).toBe(768);
    expect(config.embeddingModel).toBe('gemini-embedding-2');
    expect(config.embeddingModelCode).toBe('gemini-embedding-2@768');
  });

  it('falla fuerte si falta una constante (no usa valores por defecto en silencio)', () => {
    expect(() => readProdConfig('const otra = 1;')).toThrow(/DEFAULT_MATCH_COUNT/);
  });
});

describe('buildQueryText', () => {
  it('replica el texto de la función: descripción recortada + categoría', () => {
    expect(buildQueryText('  venden en la calle ', 'COMERCIO_IRREGULAR')).toBe(
      'venden en la calle (categoría: COMERCIO_IRREGULAR)'
    );
  });
  it('sin categoría, solo la descripción', () => {
    expect(buildQueryText('bache', null)).toBe('bache');
  });
});

const rows = [
  { fragment_id: 'a', hierarchy_path: 'Ley 451 > 4.1.2', similarity: 0.62, scope_level: 1 },
  { fragment_id: 'b', hierarchy_path: 'Ley 1166 > 11.1.2', similarity: 0.5, scope_level: 1 },
  { fragment_id: 'c', hierarchy_path: 'Ley 451 > 4.1.1', similarity: 0.44, scope_level: 1 },
  { fragment_id: 'd', hierarchy_path: 'Otra > 9', similarity: 0.3, scope_level: 2 },
];

describe('classifyCandidates', () => {
  it('marca umbral y top-k por candidato y cuenta los que llegan al modelo', () => {
    const r = classifyCandidates(rows, { matchCount: 3, threshold: 0.45 });
    expect(r.candidates.map((c) => c.llegaAlModelo)).toEqual([true, true, false, false]);
    expect(r.candidates[2].superaUmbral).toBe(false);
    expect(r.candidates[3].dentroTopK).toBe(false);
    expect(r.veredicto).toMatch(/2 fragmento/);
    expect(r.primerBajoUmbral).toEqual({ rank: 3, similarity: 0.44 });
  });

  it('sin candidatos sobre el umbral el veredicto es sin_normativa', () => {
    const r = classifyCandidates(rows.slice(2), { matchCount: 8, threshold: 0.45 });
    expect(r.veredicto).toMatch(/sin_normativa/);
  });

  it('el umbral es inclusivo: similitud igual al umbral cuenta', () => {
    const r = classifyCandidates([{ ...rows[0], similarity: 0.45 }], { matchCount: 8, threshold: 0.45 });
    expect(r.candidates[0].superaUmbral).toBe(true);
  });

  it('informa dónde quedó el artículo esperado: llega, bajo el umbral, fuera del top-k o ausente', () => {
    expect(classifyCandidates(rows, { matchCount: 8, threshold: 0.45, esperado: '4.1.2' }).esperadoEstado).toMatch(/llega al modelo \(puesto 1\)/);
    expect(classifyCandidates(rows, { matchCount: 8, threshold: 0.45, esperado: '4.1.1' }).esperadoEstado).toMatch(/BAJO el umbral \(0\.440\)/);
    expect(classifyCandidates(rows, { matchCount: 1, threshold: 0.45, esperado: '11.1.2' }).esperadoEstado).toMatch(/FUERA del top-1 \(puesto 2\)/);
    expect(classifyCandidates(rows, { matchCount: 8, threshold: 0.45, esperado: '99.9' }).esperadoEstado).toMatch(/no aparece/);
  });

  it('sin esperado definido no inventa un estado', () => {
    expect(classifyCandidates(rows, { matchCount: 8, threshold: 0.45 }).esperadoEstado).toBeNull();
  });
});

describe('toMarkdown', () => {
  it('rotula los casos como exploratorios y lista la configuración usada', () => {
    const config = { matchCount: 8, threshold: 0.45, embeddingModelCode: 'gemini-embedding-2@768' };
    const analysis = classifyCandidates(rows, { matchCount: 8, threshold: 0.45, esperado: '4.1.2' });
    const md = toMarkdown({
      config,
      generatedAt: '2026-10-08T00:00:00Z',
      results: [{ id: 'X1', zona: 'CABA', categoria: 'COMERCIO_IRREGULAR', descripcion: 'venden en la calle', exploratorio: true, analysis }],
    });
    expect(md).toContain('EXPLORATORIOS');
    expect(md).toContain('top-k 8, umbral 0.45');
    expect(md).toContain('**Ley 451 > 4.1.2** (esperado)');
  });
});
