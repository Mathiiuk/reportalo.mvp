/**
 * @file ValidateLlmAnalysis.test.js
 * @description REP-2908-VERIF ronda 6, C-2: regla de estado "asistencia".
 */

import { describe, it, expect } from 'vitest';
import { validateLlmAnalysis } from '../services/validateLlmAnalysis';

const baseResponse = {
  estado: 'fundamentado',
  es_infraccion: false,
  fundamento_ciudadano: 'texto',
  fundamento_oficial: 'texto',
  confianza: 0.8,
  citas: [],
};

describe('REP-2908-VERIF ronda 6, C-2: regla de "asistencia"', () => {
  it('rechaza "asistencia" cuando la categoría del reporte no es VULNERABILIDAD_SOCIAL', () => {
    const result = validateLlmAnalysis({ ...baseResponse, estado: 'asistencia' }, [], 'INFRAESTRUCTURA');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/asistencia/i);
    expect(result.reason).toMatch(/INFRAESTRUCTURA/);
  });

  it('rechaza "asistencia" cuando no hay categoría', () => {
    const result = validateLlmAnalysis({ ...baseResponse, estado: 'asistencia' }, [], null);
    expect(result.valid).toBe(false);
  });

  it('acepta "asistencia" cuando la categoría es VULNERABILIDAD_SOCIAL', () => {
    const result = validateLlmAnalysis({ ...baseResponse, estado: 'asistencia' }, [], 'VULNERABILIDAD_SOCIAL');
    expect(result.valid).toBe(true);
  });

  it('no afecta otros estados', () => {
    const result = validateLlmAnalysis({ ...baseResponse, estado: 'fundamentado' }, [], 'INFRAESTRUCTURA');
    expect(result.valid).toBe(true);
  });
});

describe('REP-2908-VERIF ronda 6, C-2: validaciones existentes sin regresión', () => {
  const retrievedFragments = [{ fragment_id: 'F-1', content: 'texto literal del fragmento' }];

  it('rechaza una cita fuera de lo recuperado', () => {
    const result = validateLlmAnalysis(
      { ...baseResponse, citas: [{ fragment_id: 'F-999', cita_textual: 'x' }] },
      retrievedFragments,
      null
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/no está entre los fragmentos recuperados/);
  });

  it('rechaza una cita no literal', () => {
    const result = validateLlmAnalysis(
      { ...baseResponse, citas: [{ fragment_id: 'F-1', cita_textual: 'texto que no aparece' }] },
      retrievedFragments,
      null
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/no aparece literal/);
  });

  it('el motivo de una cita no literal incluye lo que el modelo intentó citar', () => {
    const result = validateLlmAnalysis(
      { ...baseResponse, citas: [{ fragment_id: 'F-1', cita_textual: 'texto que no aparece' }] },
      retrievedFragments,
      null
    );
    expect(result.reason).toContain('Cita del modelo: "texto que no aparece"');
  });

  it('trunca la cita del modelo en el motivo para no inflar la fila', () => {
    const longQuote = 'x'.repeat(500);
    const result = validateLlmAnalysis(
      { ...baseResponse, citas: [{ fragment_id: 'F-1', cita_textual: longQuote }] },
      retrievedFragments,
      null
    );
    expect(result.reason).toContain(`${'x'.repeat(300)}…`);
    expect(result.reason).not.toContain('x'.repeat(301));
  });

  it('acepta una cita literal de lo recuperado', () => {
    const result = validateLlmAnalysis(
      { ...baseResponse, citas: [{ fragment_id: 'F-1', cita_textual: 'texto literal' }] },
      retrievedFragments,
      null
    );
    expect(result.valid).toBe(true);
  });
});
