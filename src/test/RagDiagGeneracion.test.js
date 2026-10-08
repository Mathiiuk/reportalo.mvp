/**
 * @file RagDiagGeneracion.test.js
 * @description RAG-DIAG-GENERACION: lógica pura del script de repetibilidad de la generación
 * (scripts/rag-local-dev/rep-diag-generacion/lib.mjs). Sin red.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  readGenerationSpec,
  buildQueryText,
  buildPrompt,
  sha256,
  validateRun,
  summarizeRuns,
  toMarkdown,
} from '../../scripts/rag-local-dev/rep-diag-generacion/lib.mjs';

const prodSource = readFileSync(
  resolve(__dirname, '../../supabase/functions/analizar-reporte/index.ts'),
  'utf8'
);

describe('readGenerationSpec (lee el fuente real de la Edge Function)', () => {
  const spec = readGenerationSpec(prodSource);

  it('trae modelo, versión de prompt y configuración de generación', () => {
    expect(spec.model).toBe('gemini-3.8-flash');
    expect(spec.promptVersion).toMatch(/^v\d+$/);
    expect(spec.temperature).toBe(0);
    expect(spec.thinkingLevel).toBe('low');
    expect(spec.maxOutputTokens).toBe(2048);
  });

  it('trae la configuración de recuperación', () => {
    expect(spec.matchCount).toBe(8);
    expect(spec.threshold).toBe(0.45);
    expect(spec.dimensions).toBe(768);
    expect(spec.embeddingModelCode).toBe('gemini-embedding-2@768');
  });

  it('reconstruye las instrucciones completas del prompt, igual que el fuente', () => {
    expect(spec.instructions.split('\n').length).toBeGreaterThanOrEqual(8);
    expect(spec.instructions).toContain('Sos el redactor jurídico de Reportalo');
    expect(spec.instructions).toContain('Regla estricta: SOLO podés fundamentar con el contenido literal');
    expect(spec.instructions).toContain('excepción, condición o salvedad');
  });

  it('reconstruye el esquema de salida estructurada con sus campos obligatorios', () => {
    expect(spec.schema.type).toBe('object');
    expect(spec.schema.required).toEqual(
      expect.arrayContaining(['estado', 'es_infraccion', 'fundamento_ciudadano', 'fundamento_oficial', 'confianza', 'citas'])
    );
    expect(spec.schema.properties.estado.enum).toContain('fundamentado');
  });

  it('falla fuerte si falta una pieza (no usa valores por defecto en silencio)', () => {
    expect(() => readGenerationSpec('const otra = 1;')).toThrow(/instrucciones/);
  });
});

const fragments = [
  { fragment_id: 'f1', hierarchy_path: 'Ley 451 > 4.1.2', content: 'El que venda mercaderías\nen la vía pública sin permiso.', similarity: 0.8 },
  { fragment_id: 'f2', hierarchy_path: 'Ley 1166 > 11.1.2', content: 'Prohíbese la venta ambulante.', similarity: 0.7 },
];

describe('buildQueryText / buildPrompt', () => {
  it('la consulta lleva la categoría entre paréntesis, como en la función', () => {
    expect(buildQueryText(' hola ', 'AMBIENTE')).toBe('hola (categoría: AMBIENTE)');
    expect(buildQueryText('hola', null)).toBe('hola');
  });

  it('arma el prompt con categoría, reclamo y fragmentos numerados en el mismo orden', () => {
    const prompt = buildPrompt('INSTR', { reportText: 'venden en la calle', category: 'COMERCIO_IRREGULAR', fragments });
    expect(prompt.startsWith('INSTR\n\nCategoría elegida por el ciudadano: COMERCIO_IRREGULAR\n\nReclamo:\n"""venden en la calle"""\n\nFragmentos recuperados:\n')).toBe(true);
    expect(prompt).toContain('[1] fragment_id=f1\nLey 451 > 4.1.2\n"""El que venda');
    expect(prompt.indexOf('fragment_id=f1')).toBeLessThan(prompt.indexOf('fragment_id=f2'));
  });

  it('sin categoría usa el mismo texto que la función', () => {
    expect(buildPrompt('I', { reportText: 'x', category: null, fragments: [] })).toContain('sin categoría');
  });

  it('el mismo contexto da el mismo hash (bytes idénticos) y un cambio de orden lo cambia', () => {
    const a = buildPrompt('I', { reportText: 'x', category: 'C', fragments });
    const b = buildPrompt('I', { reportText: 'x', category: 'C', fragments: [...fragments] });
    const c = buildPrompt('I', { reportText: 'x', category: 'C', fragments: [...fragments].reverse() });
    expect(sha256(a)).toBe(sha256(b));
    expect(sha256(a)).not.toBe(sha256(c));
  });
});

describe('validateRun', () => {
  const ok = { estado: 'fundamentado', citas: [{ fragment_id: 'f1', cita_textual: 'El que venda mercaderías en la vía pública' }] };

  it('acepta una cita literal aunque difieran los saltos de línea', () => {
    expect(validateRun(ok, fragments, 'COMERCIO_IRREGULAR').valid).toBe(true);
  });
  it('rechaza un id fuera del contexto', () => {
    expect(validateRun({ estado: 'fundamentado', citas: [{ fragment_id: 'zz', cita_textual: 'x' }] }, fragments, 'C').valid).toBe(false);
  });
  it('rechaza una cita parafraseada', () => {
    expect(validateRun({ estado: 'fundamentado', citas: [{ fragment_id: 'f1', cita_textual: 'vender cosas en la calle' }] }, fragments, 'C').valid).toBe(false);
  });
  it('rechaza "asistencia" fuera de VULNERABILIDAD_SOCIAL', () => {
    expect(validateRun({ estado: 'asistencia', citas: [] }, fragments, 'INFRAESTRUCTURA').valid).toBe(false);
    expect(validateRun({ estado: 'asistencia', citas: [] }, fragments, 'VULNERABILIDAD_SOCIAL').valid).toBe(true);
  });
});

describe('summarizeRuns', () => {
  const run = (estado, ids, usage = { promptTokenCount: 100, candidatesTokenCount: 10, thoughtsTokenCount: 5 }) => ({
    parsed: { estado, citas: ids.map((id) => ({ fragment_id: id, cita_textual: 'x' })) },
    validation: { valid: true },
    usage,
  });

  it('cuenta estados y conjuntos de citas distintos ignorando orden y duplicados', () => {
    const s = summarizeRuns([run('fundamentado', ['f1', 'f2']), run('fundamentado', ['f2', 'f1', 'f1']), run('indeterminado', [])]);
    expect(s.estados).toEqual({ fundamentado: 2, indeterminado: 1 });
    expect(s.estadosDistintos).toBe(2);
    expect(s.conjuntosDeCitasDistintos).toBe(2);
    expect(s.conjuntosDeCitas.find((x) => x.ids.length === 2).veces).toBe(2);
  });

  it('cuenta las corridas sin respuesta y suma los tokens', () => {
    const s = summarizeRuns([run('fundamentado', ['f1']), { parsed: null, error: 'x', usage: null }]);
    expect(s.fallidas).toBe(1);
    expect(s.conRespuesta).toBe(1);
    expect(s.tokens).toEqual({ entrada: 100, salida: 10, razonamiento: 5 });
  });
});

describe('toMarkdown', () => {
  it('avisa si la temperatura difiere de producción y rotula el caso exploratorio', () => {
    const spec = { model: 'm', promptVersion: 'v4', temperature: 0, thinkingLevel: 'low', maxOutputTokens: 2048 };
    const runs = [{ parsed: { estado: 'fundamentado', es_infraccion: true, confianza: 0.9, citas: [] }, validation: { valid: true }, usage: {} }];
    const md = toMarkdown({
      caso: { id: 'X', descripcion: 'd', zona: 'CABA', categoria: 'C', exploratorio: true },
      spec, temperature: 1, promptHash: 'a'.repeat(64), fragments, runs, summary: summarizeRuns(runs), generatedAt: 'ahora',
    });
    expect(md).toContain('**distinta** de producción');
    expect(md).toContain('EXPLORATORIO');
    expect(md).toContain('Conjuntos de citas distintos');
  });
});
