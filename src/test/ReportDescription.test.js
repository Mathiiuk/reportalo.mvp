import { describe, it, expect } from 'vitest';
import {
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  validateDescription,
} from '../services/reportDescription';

// REP-2203: reglas de la descripción breve del reporte (obligatoria, 10 a 280 caracteres).
describe('REP-2203: validateDescription', () => {
  it('UT-DESC-01: define el límite del MVP (mínimo 10, máximo 280)', () => {
    expect(DESCRIPTION_MIN_LENGTH).toBe(10);
    expect(DESCRIPTION_MAX_LENGTH).toBe(280);
  });

  it('UT-DESC-02: acepta una descripción válida', () => {
    expect(validateDescription('Camión bloqueando la rampa')).toEqual({ valid: true, error: null });
  });

  it('UT-DESC-03: rechaza vacía, nula o indefinida con indicación comprensible', () => {
    for (const value of ['', null, undefined]) {
      const result = validateDescription(value);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/descripción/i);
    }
  });

  it('UT-DESC-04: rechaza texto de solo espacios (cuenta el texto recortado)', () => {
    expect(validateDescription('            ').valid).toBe(false);
  });

  it('UT-DESC-05: rechaza menos de 10 caracteres y dice cuántos faltan', () => {
    const result = validateDescription('bache');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/10/);
  });

  it('UT-DESC-06: acepta exactamente 10 y exactamente 280 caracteres', () => {
    expect(validateDescription('a'.repeat(10)).valid).toBe(true);
    expect(validateDescription('a'.repeat(280)).valid).toBe(true);
  });

  it('UT-DESC-07: rechaza 281 caracteres e informa el límite', () => {
    const result = validateDescription('a'.repeat(281));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/280/);
  });
});
