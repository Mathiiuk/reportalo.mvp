import { describe, it, expect } from 'vitest';
import { getSubmissionReadiness } from '../services/reportReadiness';

// REP-2204: el botón de envío solo queda disponible con los datos mínimos del MVP
describe('REP-2204: getSubmissionReadiness', () => {
  const completo = {
    evidenceList: [{ id: 'foto-1' }],
    selectedCategory: { id: 'INFRAESTRUCTURA', name: 'Infraestructura' },
    description: 'Bache profundo en la esquina',
    hasConfirmedLocality: true,
  };

  it('UT-RDY-01: con todos los datos mínimos está listo y no falta nada', () => {
    expect(getSubmissionReadiness(completo)).toEqual({ ready: true, missing: [] });
  });

  it('UT-RDY-02: sin fotos no está listo', () => {
    const result = getSubmissionReadiness({ ...completo, evidenceList: [] });
    expect(result.ready).toBe(false);
    expect(result.missing.map((item) => item.key)).toEqual(['evidence']);
  });

  it('UT-RDY-03: sin categoría no está listo', () => {
    const result = getSubmissionReadiness({ ...completo, selectedCategory: null });
    expect(result.missing.map((item) => item.key)).toEqual(['category']);
  });

  it('UT-RDY-04: con la descripción vacía o corta no está listo, y explica el motivo', () => {
    for (const description of ['', '   ', 'bache']) {
      const result = getSubmissionReadiness({ ...completo, description });
      expect(result.ready).toBe(false);
      expect(result.missing[0].key).toBe('description');
      expect(result.missing[0].label).toMatch(/descripción/i);
    }
  });

  it('UT-RDY-05: sin ubicación confirmada no está listo', () => {
    const result = getSubmissionReadiness({ ...completo, hasConfirmedLocality: false });
    expect(result.missing.map((item) => item.key)).toEqual(['location']);
  });

  it('UT-RDY-06: junta todo lo que falta, en el orden del flujo', () => {
    const result = getSubmissionReadiness({});
    expect(result.ready).toBe(false);
    expect(result.missing.map((item) => item.key)).toEqual([
      'evidence',
      'category',
      'description',
      'location',
    ]);
  });
});
