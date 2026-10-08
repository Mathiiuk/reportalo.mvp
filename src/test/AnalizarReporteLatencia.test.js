/**
 * @file AnalizarReporteLatencia.test.js
 * @description RAG-LATENCIA: report_ai_analysis.latency_ms quedaba en NULL en todos los análisis.
 * buildAnalysisRow lee result.latencyMs, pero la Edge Function nunca lo asignaba.
 *
 * index.ts no se puede importar desde Vitest (arranca Deno.serve y trae supabase-js
 * desde esm.sh), así que se verifica leyendo el fuente — mismo patrón que
 * AnalizarReporteRep3795.test.js.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(__dirname, '../../supabase/functions/analizar-reporte/index.ts'),
  'utf8'
);

describe('RAG-LATENCIA: la función mide y persiste la latencia del análisis', () => {
  it('toma la hora de inicio antes de empezar el análisis', () => {
    const startIndex = source.indexOf('const startedAt = Date.now();');
    const tryIndex = source.indexOf('payload = await req.json();');
    expect(startIndex).toBeGreaterThan(-1);
    expect(startIndex).toBeLessThan(tryIndex);
  });

  it('asigna result.latencyMs después de resolver el resultado y antes de persistirlo', () => {
    const assignIndex = source.indexOf('result.latencyMs = Date.now() - startedAt;');
    const persistCallIndex = source.indexOf('await persistAnalysis(supabaseAdmin, payload.reportId');
    const catchIndex = source.indexOf('// Cualquier error no previsto también falla cerrado');
    expect(assignIndex).toBeGreaterThan(-1);
    expect(assignIndex).toBeGreaterThan(catchIndex);
    expect(assignIndex).toBeLessThan(persistCallIndex);
  });

  it('buildAnalysisRow sigue mapeando latencyMs a latency_ms redondeado', () => {
    expect(source).toMatch(/latency_ms: result\.latencyMs !== undefined && result\.latencyMs !== null \? Math\.round\(result\.latencyMs\) : null/);
  });
});
