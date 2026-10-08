/**
 * @file AnalizarReporteAsistenciaLlm.test.js
 * @description RAG-ASISTENCIA-INFRA: en staging, 13 análisis quedaron "indeterminado" porque Gemini devolvió el
 * estado "asistencia" para reportes de INFRAESTRUCTURA y el validador (correctamente) lo rechaza.
 *
 * "asistencia" solo es válido para VULNERABILIDAD_SOCIAL, y esa categoría se resuelve ANTES de llamar al modelo
 * (corte de costo cero). Entonces el modelo nunca tiene un caso legítimo para elegirlo: se lo saca del enum de
 * salida estructurada. El validador queda igual, como defensa.
 *
 * index.ts no se puede importar desde Vitest, así que se verifica leyendo el fuente
 * (mismo patrón que AnalizarReporteRep3795.test.js).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(__dirname, '../../supabase/functions/analizar-reporte/index.ts'),
  'utf8'
);

/** Solo el arreglo `enum: [...]` de estado dentro de LLM_OUTPUT_SCHEMA (sin los comentarios de al lado). */
const schemaEstadoBlock = () => {
  const start = source.indexOf('const LLM_OUTPUT_SCHEMA = {');
  const end = source.indexOf('es_infraccion: { type', start);
  const enumMatch = source.slice(start, end).match(/enum: \[([^\]]*)\]/);
  return enumMatch ? enumMatch[0] : '';
};

describe('RAG-ASISTENCIA-INFRA: el modelo no puede elegir "asistencia"', () => {
  it('el enum de estado que se le exige a Gemini no incluye "asistencia"', () => {
    const block = schemaEstadoBlock();
    expect(block).toMatch(/^enum: \[/);
    expect(block).not.toMatch(/asistencia/);
  });

  it('el enum conserva los otros cuatro estados', () => {
    const block = schemaEstadoBlock();
    for (const estado of ['fundamentado', 'indeterminado', 'sin_normativa', 'fuera_de_alcance']) {
      expect(block).toContain(`'${estado}'`);
    }
  });

  it('el validador sigue rechazando "asistencia" fuera de VULNERABILIDAD_SOCIAL (defensa en profundidad)', () => {
    expect(source).toMatch(/analysis\.estado === 'asistencia' && reportCategory !== 'VULNERABILIDAD_SOCIAL'/);
  });

  it('el corte de VULNERABILIDAD_SOCIAL sigue produciendo "asistencia" sin pasar por el modelo', () => {
    const start = source.indexOf('category === VULNERABILIDAD_SOCIAL_SERVICE_CODE');
    const end = source.indexOf('} else if (!geminiApiKey) {');
    expect(source.slice(start, end)).toMatch(/estado: 'asistencia'/);
  });

  it('PROMPT_VERSION se incrementó a v4 para poder comparar antes/después en report_ai_analysis', () => {
    expect(source).toMatch(/const PROMPT_VERSION = 'v4';/);
  });
});
