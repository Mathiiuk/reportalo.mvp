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

  describe('tolerancia a espacios y saltos de línea (literalidad estricta en todo lo demás)', () => {
    const validate = (fragmentContent, citaTextual) =>
      validateLlmAnalysis(
        { ...baseResponse, citas: [{ fragment_id: 'F-1', cita_textual: citaTextual }] },
        [{ fragment_id: 'F-1', content: fragmentContent }],
        null
      );

    it('acepta una cita que une con un espacio lo que el fragmento separa con salto de línea', () => {
      expect(validate('primera frase.\nSegunda frase.', 'primera frase. Segunda frase.').valid).toBe(true);
    });

    it('acepta si el fragmento tiene \\r\\n y la cita usa \\n', () => {
      expect(validate('Está prohibido:\r\nt) vender productos', 'Está prohibido:\nt) vender productos').valid).toBe(true);
    });

    it('acepta espacios repetidos y tabulaciones', () => {
      expect(validate('uno   dos\t\ttres', 'uno dos tres').valid).toBe(true);
    });

    it('caso real: Ley 13.592 art. 9 (basural, 29/09/2026)', () => {
      const fragmento =
        'objetivos erradicar la práctica del arrojo en basurales a cielo abierto e impedir el establecimiento de nuevos basurales a cielo abierto en sus respectivas jurisdicciones.\n' +
        'Las Autoridades Municipales quedan obligadas a clausurar dichos basurales, conforme a los principios establecidos.';
      const cita =
        'erradicar la práctica del arrojo en basurales a cielo abierto e impedir el establecimiento de nuevos basurales a cielo abierto en sus respectivas jurisdicciones. Las Autoridades Municipales quedan obligadas a clausurar dichos basurales';
      expect(fragmento.includes(cita)).toBe(false); // lo que hacía la validación anterior
      expect(validate(fragmento, cita).valid).toBe(true);
    });

    it('sigue rechazando una paráfrasis', () => {
      const result = validate('Las Autoridades Municipales quedan obligadas a clausurar dichos basurales', 'Los municipios deben cerrar los basurales');
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/no aparece literal/);
    });

    it('sigue rechazando un cambio de mayúsculas', () => {
      expect(validate('Las Autoridades Municipales quedan obligadas', 'las autoridades municipales quedan obligadas').valid).toBe(false);
    });

    it('sigue rechazando un cambio de tildes o puntuación', () => {
      expect(validate('Está prohibido estacionar, salvo autorización', 'Esta prohibido estacionar, salvo autorización').valid).toBe(false);
      expect(validate('Está prohibido estacionar, salvo autorización', 'Está prohibido estacionar salvo autorización').valid).toBe(false);
    });

    it('sigue rechazando palabras que no están, aunque se junten con espacios', () => {
      expect(validate('uno dos tres', 'uno tres').valid).toBe(false);
    });

    it('rechaza una cita compuesta solo de espacios (quedaría vacía y includes("") da true)', () => {
      const result = validate('texto del fragmento', '   \n  ');
      expect(result.valid).toBe(false);
    });

    it('el motivo del rechazo conserva la cita original del modelo, sin normalizar', () => {
      const result = validate('uno dos tres', 'uno\ncuatro');
      expect(result.reason).toContain('Cita del modelo: "uno\ncuatro"');
    });
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
