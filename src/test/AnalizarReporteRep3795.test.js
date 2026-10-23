/**
 * @file AnalizarReporteRep3795.test.js
 * @description Puntos 4 y 5 del diagnóstico de REP-3795 (docs/sprint14/RAG_diagnostico_puntos_rotos.docx).
 *
 * index.ts no se puede importar desde Vitest (arranca Deno.serve y trae supabase-js
 * desde esm.sh), así que se verifica leyendo el fuente — mismo patrón que
 * AnalizarReporteGeminiKey.test.js.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(__dirname, '../../supabase/functions/analizar-reporte/index.ts'),
  'utf8'
);

describe('Punto 4: vulnerabilidad social devuelve asistencia sin consultar al LLM', () => {
  it('corta antes del chequeo de geminiApiKey (costo cero, ni embedding ni generación)', () => {
    const vulnerabilidadIndex = source.indexOf("category === VULNERABILIDAD_SOCIAL_SERVICE_CODE");
    const geminiApiKeyCheckIndex = source.indexOf('} else if (!geminiApiKey) {');
    expect(vulnerabilidadIndex).toBeGreaterThan(-1);
    expect(geminiApiKeyCheckIndex).toBeGreaterThan(-1);
    expect(vulnerabilidadIndex).toBeLessThan(geminiApiKeyCheckIndex);
  });

  it('la constante usa el service_code real de la categoría', () => {
    expect(source).toMatch(/VULNERABILIDAD_SOCIAL_SERVICE_CODE = 'VULNERABILIDAD_SOCIAL'/);
  });

  it('el resultado directo declara estado "asistencia"', () => {
    const block = source.slice(
      source.indexOf('category === VULNERABILIDAD_SOCIAL_SERVICE_CODE'),
      source.indexOf('} else if (!geminiApiKey) {')
    );
    expect(block).toMatch(/estado: 'asistencia'/);
    expect(block).toMatch(/citas: \[\]/);
  });

  it('setea embeddingModelCode (NOT NULL en report_ai_analysis, si no el insert falla en silencio)', () => {
    const block = source.slice(
      source.indexOf('category === VULNERABILIDAD_SOCIAL_SERVICE_CODE'),
      source.indexOf('} else if (!geminiApiKey) {')
    );
    expect(block).toMatch(/embeddingModelCode: EMBEDDING_MODEL_CODE/);
  });
});

describe('Punto 5: temperature fija y regla de precisión en el prompt', () => {
  it('GENERATION_TEMPERATURE está en 0 y se pasa a generationConfig', () => {
    expect(source).toMatch(/const GENERATION_TEMPERATURE = 0;/);
    expect(source).toMatch(/temperature: GENERATION_TEMPERATURE,/);
  });

  it('PROMPT_VERSION se incrementó a v5 (v2: precisión; v3: regla de excepciones; v4: sin "asistencia" en el esquema; v5: permiso no aclarado)', () => {
    expect(source).toMatch(/const PROMPT_VERSION = 'v5';/);
  });

  it('la nueva regla de precisión está en las instrucciones', () => {
    expect(source).toMatch(/No exijas al reclamo más precisión que la que pide el fragmento citado\./);
  });

  it('deja documentado que falta correr P-01 con este cambio antes de producción', () => {
    expect(source).toMatch(/RIESGO[\s\S]{0,10}ACEPTADO SIN VALIDAR/);
    expect(source).toMatch(/run-p01-post-filtro\.mjs/);
  });
});

describe('Prompt v3: regla de excepciones (REP-3795 / REP-3797)', () => {
  const instructionsBlock = source.slice(
    source.indexOf('const instructions = ['),
    source.indexOf("].join('\\n');", source.indexOf('const instructions = ['))
  );
  // Cada regla es un string entre comillas simples terminado en coma, uno por línea
  const rules = instructionsBlock.split('\n').filter((line) => line.trim().startsWith("'"));

  it('el prompt tiene 9 reglas: las 7 de v2, la de excepciones (v3) y la del permiso no aclarado (v5)', () => {
    expect(rules).toHaveLength(9);
  });

  it('la regla de excepciones (v3) sigue presente y pide mencionar la salvedad sin absolutizar', () => {
    const last = rules.find((rule) => /excepción, condición o salvedad/.test(rule));
    expect(last).toMatch(/excepción, condición o salvedad/);
    expect(last).toMatch(/no afirmar una prohibición u obligación absoluta/);
    expect(last).toMatch(/Incluí esa parte del texto en la cita_textual/);
  });

  it('la regla prohíbe inventar excepciones que el fragmento no trae', () => {
    expect(rules.find((rule) => /excepción, condición o salvedad/.test(rule))).toMatch(/no agregues ni supongas ninguna/);
  });

  it('las reglas de v2 siguen presentes (literalidad de las citas y precisión)', () => {
    expect(instructionsBlock).toMatch(/SOLO podés fundamentar con el contenido literal/);
    expect(instructionsBlock).toMatch(/una cita_textual que sea un fragmento literal \(substring\)/);
    expect(instructionsBlock).toMatch(/No exijas al reclamo más precisión que la que pide el fragmento citado/);
  });

  it('el texto implementado es EL MISMO que se probó en el experimento (generation-experiment.mjs)', () => {
    const experiment = readFileSync(
      resolve(__dirname, '../../scripts/rag-local-dev/rep3797/generation-experiment.mjs'),
      'utf8'
    ).replace(/\r\n/g, '\n');
    const start = experiment.indexOf("const REGLA_EXCEPCIONES =\n  '") + "const REGLA_EXCEPCIONES =\n  '".length;
    const tested = experiment.slice(start, experiment.indexOf("';", start));
    expect(tested.length).toBeGreaterThan(100);
    expect(source.replace(/\r\n/g, '\n')).toContain(`'${tested}',`);
  });
});

describe('Recuperación: 8 fragmentos por consulta (REP-3795 / REP-3797)', () => {
  it('DEFAULT_MATCH_COUNT es 8', () => {
    expect(source).toMatch(/const DEFAULT_MATCH_COUNT = 8;/);
  });

  it('el RPC match_knowledge_fragments recibe DEFAULT_MATCH_COUNT (no un número fijo)', () => {
    expect(source).toMatch(/match_count: DEFAULT_MATCH_COUNT,/);
    expect(source).not.toMatch(/match_count: \d+/);
  });

  it('el umbral de similitud no cambió (0.45)', () => {
    expect(source).toMatch(/const DEFAULT_SIMILARITY_THRESHOLD = 0\.45;/);
  });

  it('los fragmentos recuperados se filtran por el umbral antes de llamar al modelo', () => {
    expect(source).toMatch(/f\.similarity >= DEFAULT_SIMILARITY_THRESHOLD/);
  });
});

describe('Validador: tolerancia a espacios en blanco (espejo en src/services/validateLlmAnalysis.js)', () => {
  it('normalizeWhitespace solo colapsa espacios en blanco (no toca mayúsculas ni tildes)', () => {
    expect(source).toMatch(/const normalizeWhitespace = \(text: string\): string => text\.replace\(\/\\s\+\/g, ' '\)\.trim\(\);/);
  });

  it('compara cita y fragmento normalizados y rechaza la cita vacía', () => {
    expect(source).toMatch(/if \(normalizedQuote === ''\) return false;/);
    expect(source).toMatch(/if \(normalizedContent\.includes\(normalizedQuote\)\) return true;/);
    expect(source).toMatch(/if \(!quoteMatchesFragment\(cita\.cita_textual, fragment\.content\)\) \{/);
  });

  it('la elisión por tramos tiene los mismos topes que el espejo (RAG-S16)', () => {
    expect(source).toMatch(/const MIN_ELIDED_SEGMENT_CHARS = 15;/);
    expect(source).toContain('const ELISION_MARKER = /\\[\\s*(?:\\.{3}|…)\\s*\\]|\\(\\s*(?:\\.{3}|…)\\s*\\)|\\.{3}|…/;');
    expect(source).toContain('(?:no|ni|nunca|jamás|salvo|excepto|excepción|siempre que|sin perjuicio)');
  });

  it('ya no usa el includes exacto sobre el contenido crudo', () => {
    expect(source).not.toMatch(/fragment\.content\.includes\(cita\.cita_textual\)/);
  });
});

describe('Observabilidad: un rechazo de la validación conserva lo que se generó', () => {
  const block = source.slice(
    source.indexOf('const generationMetadata = {'),
    source.indexOf("result = { ...generation.parsed, ...generationMetadata };") + 60
  );

  it('generationMetadata incluye modelo, versión de prompt y tokens', () => {
    expect(block).toMatch(/generationModelCode: GENERATION_MODEL/);
    expect(block).toMatch(/promptVersion: PROMPT_VERSION/);
    expect(block).toMatch(/inputTokens: generation\.inputTokens/);
    expect(block).toMatch(/outputTokens: generation\.outputTokens/);
  });

  it('las dos ramas de rechazo y la de éxito usan generationMetadata', () => {
    expect(block).toMatch(/error: validation\.reason, \.\.\.generationMetadata/);
    expect(block).toMatch(/error: organismoValidation\.reason, \.\.\.generationMetadata/);
    expect(block).toMatch(/\.\.\.generation\.parsed, \.\.\.generationMetadata/);
  });

  it('el rechazo sigue siendo indeterminado (no cambia lo que ve el ciudadano)', () => {
    expect(block).toMatch(/estado: 'indeterminado', error: validation\.reason/);
  });

  it('la cita rechazada se guarda en el motivo, truncada', () => {
    expect(source).toMatch(/MAX_REJECTED_CITA_CHARS = 300/);
    expect(source).toMatch(/Cita del modelo: "\$\{truncateForReason\(cita\.cita_textual\)\}"/);
  });
});

describe('Prompt v5: permiso no aclarado => fundamentado con salvedad (RAG-D5, decisión del PO opción A)', () => {
  it('la regla del permiso está en las instrucciones, con la salvedad en los dos fundamentos', () => {
    expect(source).toMatch(/prohíbe o exige contar con un permiso, habilitación o autorización previa/);
    expect(source).toMatch(/no declares "indeterminado" solo por eso: declará "fundamentado"/);
    expect(source).toMatch(/aclará en fundamento_ciudadano y en fundamento_oficial que la norma aplica si no cuentan con el permiso/);
    expect(source).toMatch(/corresponde que el organismo lo verifique/);
  });

  it('la regla no se activa si el reclamo dice que el permiso existe o describe otra conducta', () => {
    expect(source).toMatch(/Si el reclamo dice que el permiso existe, o describe otra conducta, no uses esta regla\./);
  });

  it('no afloja las reglas de base: sigue citando solo literal y sin montos ni sanciones al ciudadano', () => {
    expect(source).toMatch(/SOLO podés fundamentar con el contenido literal de estos fragmentos/);
    expect(source).toMatch(/Nunca mencionés montos ni sanciones al ciudadano/);
  });

  it('deja documentada la medición con el diagnóstico de generación (v4 vs v5, 10 corridas)', () => {
    expect(source).toMatch(/MEDIDO el 13\/10\/2026/);
    expect(source).toMatch(/rep-diag-generacion/);
    expect(source).not.toMatch(/SIN MEDIR TODAVÍA/);
  });
});
