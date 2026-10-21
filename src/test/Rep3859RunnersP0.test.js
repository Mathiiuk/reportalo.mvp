/**
 * @file Rep3859RunnersP0.test.js
 * @description REP-3859 (P0): esquema común de los runners M1/M2 en modo --p0. Cubre el set de casos, las métricas, el
 * validador fiel a producción (paridad con analizar-reporte), el encabezado del motor y el --dry-run sin red.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  ESQUEMA,
  VENTANA_M1,
  normalizarSet,
  leerReglasValidador,
  huellaCorpus,
  encabezadoMotor,
  filaM1,
  resumenM1,
  validarComoProduccion,
  tokensSalida,
  filaM2,
  resumenM2,
  estimarLlamadas,
} from '../../scripts/rag-local-dev/p0/esquema.mjs';
import { crearRest, argsP0 } from '../../scripts/rag-local-dev/p0/entorno.mjs';
import { readGenerationSpec } from '../../scripts/rag-local-dev/rep-diag-generacion/lib.mjs';

const root = resolve(__dirname, '../..');
const fuente = readFileSync(resolve(root, 'supabase/functions/analizar-reporte/index.ts'), 'utf8');
const reglas = leerReglasValidador(fuente);
const spec = readGenerationSpec(fuente);
const F1 = '11111111-1111-4111-8111-111111111111';
const F2 = '22222222-2222-4222-8222-222222222222';
const AG = '33333333-3333-4333-8333-333333333333';

describe('REP-3859 · set de casos', () => {
  it('UT-3859-01: acepta los nombres de campo del borrador de Iván y normaliza esperados y pendiente_po', () => {
    const set = normalizarSet(JSON.parse(readFileSync(resolve(__dirname, 'fixtures/p0-set-prueba.json'), 'utf8')));
    expect(set.errores).toEqual([]);
    expect(set.set_version).toBe('prueba-0');
    expect(set.casos[0]).toMatchObject({ caso_id: 'T-01', localidad: 'Balvanera', localidad_id: null, esperados_n1: ['a439a0c1-d577-4ce0-adb9-ec14cd275b89'], pendiente_po: false });
    expect(set.casos[1]).toMatchObject({ caso_id: 'T-02', localidad_id: 'cba99f1c-1290-4873-b4fb-af8ae61122e1', esperados_n1: [], pendiente_po: true, universo: 'B' });
  });

  it('UT-3859-02: un set incompleto se rechaza con la lista de problemas (no se mide)', () => {
    const set = normalizarSet({ casos: [{ id: 'X' }, { id: 'X', descripcion: 'a', categoria: 'AMBIENTE', localidad: 'Wilde', n1: 'no-es-uuid' }] });
    expect(set.errores).toEqual(
      expect.arrayContaining([
        'El set no declara su versión (set_version).',
        'Caso X: falta la descripción.',
        'Caso X: id repetido.',
        'Caso X: falta la localidad (id, o nombre y provincia).',
        'Caso X: el esperado "no-es-uuid" no es un id de fragmento.',
      ])
    );
  });
});

describe('REP-3859 · M1', () => {
  const filas = [
    { fragment_id: F2, similarity: 0.71 },
    ...[0.6, 0.57, 0.54, 0.51, 0.48, 0.45, 0.42, 0.39].map((similarity, i) => ({ fragment_id: `0000000${i}-0000-4000-8000-000000000000`, similarity })),
    { fragment_id: F1, similarity: 0.4 },
  ];

  it('UT-3859-03: posición del esperado, top 8, entregados (top-k y umbral) y reciprocal rank', () => {
    const m = filaM1(filas, [F1], spec);
    expect(m.candidatos).toHaveLength(10);
    expect(m.posicion_primera_esperada).toBe(10);
    expect(m.esperados_en_top8).toBe(0);
    expect(m.reciprocal_rank).toBeCloseTo(0.1);
    // Top 8 con similitud >= 0.45: F2 y los primeros seis (0.60 … 0.45)
    expect(m.entregados).toBe(7);
    expect(m.candidatos[9]).toMatchObject({ fragment_id: F1, posicion: 10, en_top8: false, supera_umbral: false, entregado: false, esperado: true });
  });

  it('UT-3859-04: el resumen solo cuenta casos con norma esperada, y computables excluye pendiente_po', () => {
    const a = { ...filaM1(filas, [F2], spec), esperados_n1: [F2], pendiente_po: false };
    const b = { ...filaM1(filas, [F1], spec), esperados_n1: [F1], pendiente_po: true };
    const sinNorma = { ...filaM1(filas, [], spec), esperados_n1: [], pendiente_po: false };
    const r = resumenM1([a, b, sinNorma]);
    expect(r.todos).toMatchObject({ filas: 2, cobertura_top8: 0.5 });
    expect(r.todos.mrr).toBeCloseTo((1 + 0.1) / 2);
    expect(r.computables).toMatchObject({ filas: 1, mrr: 1, cobertura_top8: 1, cobertura_entregados: 1 });
  });
});

describe('REP-3859 · validador fiel a producción', () => {
  const fragments = [{ fragment_id: F1, content: 'Prohíbese estacionar\nsobre las rampas.' }];
  const base = { estado: 'fundamentado', es_infraccion: true, fundamento_ciudadano: 'x', fundamento_oficial: 'y', confianza: 0.9, organismo_sugerido_id: null };
  const v = (parsed, category = 'TRANSITO', agencias = new Set([AG])) => validarComoProduccion(parsed, fragments, category, { ...reglas, agencias });

  it('UT-3859-05: lee del fuente los estados válidos, los campos obligatorios y la categoría sin modelo', () => {
    expect(reglas.estados).toEqual(['fundamentado', 'indeterminado', 'sin_normativa', 'fuera_de_alcance', 'asistencia']);
    expect(reglas.camposObligatorios).toEqual(['estado', 'es_infraccion', 'fundamento_ciudadano', 'fundamento_oficial', 'confianza', 'citas']);
    expect(reglas.vulnerabilidad).toBe('VULNERABILIDAD_SOCIAL');
    // Paridad: las mismas reglas que valida la función, en el mismo orden
    const cuerpo = fuente.slice(fuente.indexOf('export const validateLlmAnalysis'), fuente.indexOf('type AnalysisResult'));
    const orden = ['requiredFields', 'RAG_RESULT_STATUSES.includes', "'asistencia'", 'Array.isArray(analysis.citas)', 'fragmentsById.get', 'normalizeWhitespace(fragment.content).includes'];
    const posiciones = orden.map((t) => cuerpo.indexOf(t));
    expect(posiciones.every((p) => p >= 0)).toBe(true);
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
  });

  it('UT-3859-06: acepta una cita literal que solo difiere en espacios en blanco', () => {
    const r = v({ ...base, citas: [{ fragment_id: F1, cita_textual: 'Prohíbese estacionar sobre las rampas.' }] });
    expect(r).toMatchObject({ valid: true, citas: [{ fragment_id: F1, pasa: true }] });
  });

  it.each([
    ['falta un campo obligatorio', { ...base, citas: [], confianza: undefined }, 'Falta el campo obligatorio "confianza".'],
    ['estado desconocido', { ...base, estado: 'quizas', citas: [] }, 'estado "quizas" no es un valor reconocido.'],
    ['asistencia fuera de vulnerabilidad', { ...base, estado: 'asistencia', citas: [] }, 'estado "asistencia" fuera de VULNERABILIDAD_SOCIAL.'],
    ['cita fuera del contexto', { ...base, citas: [{ fragment_id: F2, cita_textual: 'algo' }] }, `fragment_id "${F2}" no está entre los fragmentos recuperados.`],
    ['cita no literal', { ...base, citas: [{ fragment_id: F1, cita_textual: 'Se prohíbe estacionar' }] }, `La cita de "${F1}" no aparece literal en el fragmento.`],
    ['organismo con formato inválido', { ...base, citas: [], organismo_sugerido_id: 'caba_transito' }, 'organismo_sugerido_id "caba_transito" no es un UUID válido.'],
    ['organismo inexistente', { ...base, citas: [], organismo_sugerido_id: F2 }, `organismo_sugerido_id "${F2}" no corresponde a ningún organismo registrado.`],
  ])('UT-3859-07: rechaza como producción: %s', (_caso, parsed, motivo) => {
    expect(v(parsed)).toMatchObject({ valid: false, reason: motivo });
  });

  it('UT-3859-08: el string "null" como organismo se acepta (defensa de producción)', () => {
    expect(v({ ...base, citas: [], organismo_sugerido_id: 'null' }).valid).toBe(true);
    expect(v({ ...base, citas: [], organismo_sugerido_id: AG }).valid).toBe(true);
  });
});

describe('REP-3859 · M2', () => {
  const fragments = [{ fragment_id: F1, content: 'Prohíbese estacionar sobre las rampas.' }];
  const parsed = { estado: 'fundamentado', citas: [{ fragment_id: F1, cita_textual: 'estacionar sobre las rampas' }] };

  it('UT-3859-09: los tres caminos de producción y el estado final tras el validador', () => {
    expect(filaM2({ camino: 'asistencia', fragments: [] }, [])).toMatchObject({ estado: 'asistencia', llamo_al_modelo: false });
    expect(filaM2({ camino: 'sin_normativa', fragments: [] }, [F1])).toMatchObject({ estado: 'sin_normativa', llamo_al_modelo: false, cita_esperada_n1: false });

    const ok = filaM2({ camino: 'generacion', parsed, fragments, validacion: { valid: true, citas: [{ pasa: true }] }, usage: { promptTokenCount: 900, candidatesTokenCount: 120, thoughtsTokenCount: 80 }, latencia_ms: 1500 }, [F1], () => '6.1.52');
    expect(ok).toMatchObject({
      estado: 'fundamentado', estado_modelo: 'fundamentado', rechazo_validador: false, cita_esperada_n1: true,
      citas: [{ fragment_id: F1, articulo: '6.1.52', pasa_validador: true, esperada_n1: true }],
      citas_verificadas: 1, citas_excluidas: 0, input_tokens: 900, output_tokens: 200, latencia_ms: 1500,
    });

    const rechazo = filaM2({ camino: 'generacion', parsed, fragments, validacion: { valid: false, reason: 'no literal', citas: [{ pasa: false }] }, usage: {} }, [F1]);
    expect(rechazo).toMatchObject({ estado: 'indeterminado', estado_modelo: 'fundamentado', rechazo_validador: true, motivo: 'no literal', cita_esperada_n1: false, citas_excluidas: 1 });

    expect(filaM2({ camino: 'generacion', error: 'timeout', fragments, usage: null }, [F1])).toMatchObject({ estado: 'indeterminado', motivo: 'timeout' });
  });

  it('UT-3859-10: tokens de salida como producción (candidatos + razonamiento) y resumen con computables', () => {
    expect(tokensSalida({})).toBeNull();
    expect(tokensSalida({ candidatesTokenCount: 10 })).toBe(10);
    const filas = [
      { estado: 'fundamentado', rechazo_validador: false, llamo_al_modelo: true, cita_esperada_n1: true, esperados_n1: [F1], pendiente_po: false, input_tokens: 100, output_tokens: 50 },
      { estado: 'indeterminado', rechazo_validador: true, llamo_al_modelo: true, cita_esperada_n1: false, esperados_n1: [F1], pendiente_po: true, input_tokens: 100, output_tokens: 50 },
    ];
    const r = resumenM2(filas);
    expect(r.todos).toMatchObject({ filas: 2, estados: { fundamentado: 1, indeterminado: 1 }, rechazos_validador: 1, acierto_n1: 0.5, tokens: { entrada: 200, salida: 100 } });
    expect(r.computables).toMatchObject({ filas: 1, acierto_n1: 1, rechazos_validador: 0 });
  });
});

describe('REP-3859 · motor, solo lectura y dry-run', () => {
  it('UT-3859-11: encabezado del motor con los parámetros del fuente y huella del corpus determinística', () => {
    const corpus = huellaCorpus([
      { id: F2, content: 'b', created_at: '2026-10-13T21:34:45Z' },
      { id: F1, content: 'a', created_at: '2026-10-01T00:00:00Z' },
    ]);
    expect(huellaCorpus([{ id: F1, content: 'a' }, { id: F2, content: 'b' }]).sha256).toBe(corpus.sha256);
    expect(huellaCorpus([{ id: F1, content: 'a' }, { id: F2, content: 'B' }]).sha256).not.toBe(corpus.sha256);
    const motor = encabezadoMotor({ spec, git: { commitCodigo: 'abc', head: 'def' }, despliegue: 'v44', corpus });
    expect(motor).toMatchObject({ prompt_version: spec.promptVersion, temperatura: spec.temperature, top_k: 8, umbral: 0.45, rpc: 'match_knowledge_fragments', corpus: { fragmentos_vigentes: 2 } });
    expect(ESQUEMA).toBe('rag-p0/v1');
    expect(VENTANA_M1).toBe(100);
  });

  it('UT-3859-12: el cliente REST del modo P0 no permite escribir', async () => {
    const rest = crearRest('https://x.supabase.co', 'clave');
    await expect(rest('report_ai_analysis', { method: 'POST', body: '{}' })).rejects.toThrow(/solo lectura/);
    await expect(rest('knowledge_fragments?id=eq.1', { method: 'PATCH', body: '{}' })).rejects.toThrow(/solo lectura/);
  });

  it('UT-3859-13: 3 repeticiones por defecto, y --set es obligatorio', () => {
    expect(argsP0(['--p0', '--set', 'x.json'])).toMatchObject({ repeticiones: 3, dryRun: false, prueba: false });
    expect(() => argsP0(['--p0'])).toThrow(/--set/);
    expect(() => argsP0(['--p0', '--set', 'x.json', '--repeticiones', '0'])).toThrow(/--repeticiones/);
  });

  it.each(['rep-diag-variantes', 'rep-diag-generacion'])('UT-3859-14: %s --p0 --dry-run valida el set y estima sin red ni .env', (runner) => {
    const out = execFileSync(process.execPath, [
      resolve(root, `scripts/rag-local-dev/${runner}/run.mjs`),
      '--p0', '--set', resolve(__dirname, 'fixtures/p0-set-prueba.json'), '--dry-run', '--env', resolve(__dirname, 'fixtures/no-existe.env'),
    ], { encoding: 'utf8' });
    expect(out).toMatch(/Set prueba-0: 2 casos · 3 repeticiones/);
    const estimacion = JSON.parse(out.match(/Dry-run \(sin red\): (\{.*\})/)[1]);
    expect(estimacion).toEqual(estimarLlamadas(normalizarSet(JSON.parse(readFileSync(resolve(__dirname, 'fixtures/p0-set-prueba.json'), 'utf8'))).casos, 3, reglas));
    expect(estimacion).toMatchObject({ filas: 6, generaciones_m2_max: 3, pendientes_po: 1 });
  });
});
