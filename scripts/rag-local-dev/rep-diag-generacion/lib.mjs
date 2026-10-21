// RAG-DIAG-GENERACION · Piezas puras del diagnóstico de repetibilidad de la generación (sin red, probadas con Vitest).
//
// Experimento B de la guía técnica del Sprint 15 (§8.1): congelar el contexto (reporte + fragmentos + orden) y llamar
// N veces a la etapa generativa con exactamente los mismos bytes, para saber si lo que varía es la generación o la
// recuperación.
//
// El prompt, el esquema y la configuración NO se copian: se leen del fuente de supabase/functions/analizar-reporte/index.ts
// (código del propio repo), así el diagnóstico siempre prueba lo que está desplegado.
import crypto from 'node:crypto';

const evalLiteral = (code, what) => {
  try {
    // Solo se evalúan literales (arreglo de strings / objeto) extraídos del fuente del repo; nada de entrada externa.
    return new Function(`return (${code});`)();
  } catch (e) {
    throw new Error(`No se pudo interpretar ${what} de analizar-reporte/index.ts: ${e.message}`);
  }
};

const between = (source, startMarker, endMarker, what) => {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`No se encontró ${what} en analizar-reporte/index.ts`);
  const from = start + startMarker.length;
  const end = source.indexOf(endMarker, from);
  if (end < 0) throw new Error(`No se encontró el cierre de ${what} en analizar-reporte/index.ts`);
  return source.slice(from, end);
};

const grab = (source, regex, what) => {
  const m = source.match(regex);
  if (!m) throw new Error(`No se encontró ${what} en analizar-reporte/index.ts`);
  return m[1];
};

/** Todo lo que gobierna la recuperación y la generación, leído del fuente de la Edge Function. */
export const readGenerationSpec = (source) => {
  const instructionsList = evalLiteral(
    `[${between(source, 'const instructions = [', "].join('\\n');", 'las instrucciones')}]`,
    'las instrucciones'
  );
  if (!Array.isArray(instructionsList) || !instructionsList.every((x) => typeof x === 'string')) {
    throw new Error('Las instrucciones de analizar-reporte/index.ts no son un arreglo de strings.');
  }
  const schema = evalLiteral(between(source, 'const LLM_OUTPUT_SCHEMA = ', '\n};', 'el esquema de salida') + '\n}', 'el esquema de salida');

  return {
    instructions: instructionsList.join('\n'),
    schema,
    model: grab(source, /const GENERATION_MODEL = '([^']+)';/, 'GENERATION_MODEL'),
    promptVersion: grab(source, /const PROMPT_VERSION = '([^']+)';/, 'PROMPT_VERSION'),
    temperature: Number(grab(source, /const GENERATION_TEMPERATURE = ([0-9.]+);/, 'GENERATION_TEMPERATURE')),
    thinkingLevel: grab(source, /thinkingConfig: \{ thinkingLevel: '([^']+)' \}/, 'thinkingLevel'),
    maxOutputTokens: Number(grab(source, /maxOutputTokens: ([0-9]+),/, 'maxOutputTokens')),
    matchCount: Number(grab(source, /const DEFAULT_MATCH_COUNT = ([0-9.]+);/, 'DEFAULT_MATCH_COUNT')),
    threshold: Number(grab(source, /const DEFAULT_SIMILARITY_THRESHOLD = ([0-9.]+);/, 'DEFAULT_SIMILARITY_THRESHOLD')),
    dimensions: Number(grab(source, /const EMBEDDING_DIMENSIONS = ([0-9]+);/, 'EMBEDDING_DIMENSIONS')),
    embeddingModel: grab(source, /const EMBEDDING_MODEL = '([^']+)';/, 'EMBEDDING_MODEL'),
    embeddingModelCode: grab(source, /const EMBEDDING_MODEL_CODE = '([^']+)';/, 'EMBEDDING_MODEL_CODE'),
  };
};

/** Mismo texto de consulta para vectorizar que arma la función (descripción + categoría). */
export const buildQueryText = (description, category) =>
  category ? `${description.trim()} (categoría: ${category})` : description.trim();

/** Réplica del prompt de generateJustification: mismas instrucciones, mismo orden, mismos delimitadores. */
export const buildPrompt = (instructions, { reportText, category, fragments }) => {
  const fragmentsBlock = fragments
    .map((f, i) => `[${i + 1}] fragment_id=${f.fragment_id}\n${f.hierarchy_path}\n"""${f.content}"""`)
    .join('\n\n');
  return `${instructions}\n\nCategoría elegida por el ciudadano: ${category ?? 'sin categoría'}\n\nReclamo:\n"""${reportText}"""\n\nFragmentos recuperados:\n${fragmentsBlock}`;
};

export const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

const normalizeWhitespace = (text) => text.replace(/\s+/g, ' ').trim();

/**
 * Réplica de index.ts (RAG-S16, citas con elisión): se acepta una cita con "...", "…" o "[...]" solo si
 * cada tramo es literal, en el orden de la cita, de al menos MIN_ELIDED_SEGMENT_CHARS caracteres, y lo
 * salteado no contiene una negación ni una excepción. Ver docs/RAG-S16_citas_con_elision.md.
 */
const ELISION_MARKER = /\[\s*(?:\.{3}|…)\s*\]|\(\s*(?:\.{3}|…)\s*\)|\.{3}|…/;
const MIN_ELIDED_SEGMENT_CHARS = 15;
const ELIDED_TEXT_GUARD = /(?:^|[^\p{L}])(?:no|ni|nunca|jamás|salvo|excepto|excepción|siempre que|sin perjuicio)(?![\p{L}])/iu;
// REP-3857: marca al principio o al final de la cita. Lo omitido ahí se revisa hasta el borde de la oración.
const ELISION_AT_START = /^(?:\[\s*(?:\.{3}|…)\s*\]|\(\s*(?:\.{3}|…)\s*\)|\.{3}|…)/;
const ELISION_AT_END = /(?:\[\s*(?:\.{3}|…)\s*\]|\(\s*(?:\.{3}|…)\s*\)|\.{3}|…)$/;
const SENTENCE_BREAK = /[.;:]\s/g;

/** Inicio de la oración que contiene `at` (después del último «. », «; » o «: »). */
const sentenceStartBefore = (text, at) => {
  let start = 0;
  for (const m of text.slice(0, at).matchAll(SENTENCE_BREAK)) start = m.index + m[0].length;
  return start;
};
/** Fin de la oración que sigue a `from` (el próximo «.», «;» o «:»), o el final del texto. */
const sentenceEndAfter = (text, from) => {
  const m = /[.;:](?:\s|$)/.exec(text.slice(from));
  return m ? from + m.index : text.length;
};

export const quoteMatchesFragment = (quote, content) => {
  const normalizedQuote = normalizeWhitespace(quote);
  // Una cita solo de espacios quedaría vacía y `includes('')` siempre da true.
  if (normalizedQuote === '') return false;
  const normalizedContent = normalizeWhitespace(content);
  if (normalizedContent.includes(normalizedQuote)) return true;
  if (!ELISION_MARKER.test(normalizedQuote)) return false;

  const segments = normalizedQuote.split(ELISION_MARKER).map((s) => s.trim()).filter((s) => s !== '');
  if (segments.length === 0) return false;
  let searchFrom = 0;
  let previousEnd = null;
  let firstStart = null;
  for (const segment of segments) {
    if (segment.length < MIN_ELIDED_SEGMENT_CHARS) return false;
    const at = normalizedContent.indexOf(segment, searchFrom);
    if (at < 0) return false;
    if (previousEnd !== null && ELIDED_TEXT_GUARD.test(normalizedContent.slice(previousEnd, at))) return false;
    if (firstStart === null) firstStart = at;
    previousEnd = at + segment.length;
    searchFrom = previousEnd;
  }
  // REP-3857: con «...» al principio o al final, lo omitido llega hasta el borde de la oración. Ahí tampoco puede
  // haber una negación ni una salvedad (p. ej. citar «... se permite estacionar» de «No se permite estacionar»).
  if (ELISION_AT_START.test(normalizedQuote)
    && ELIDED_TEXT_GUARD.test(normalizedContent.slice(sentenceStartBefore(normalizedContent, firstStart), firstStart))) return false;
  if (ELISION_AT_END.test(normalizedQuote)
    && ELIDED_TEXT_GUARD.test(normalizedContent.slice(previousEnd, sentenceEndAfter(normalizedContent, previousEnd)))) return false;
  return true;
};

/**
 * Réplica reducida de validateLlmAnalysis: id citado dentro del contexto, cita literal (tolerando espacios en
 * blanco y elisiones por tramos) y regla de "asistencia". Sirve para ver si una respuesta habría pasado la validación del servidor.
 */
export const validateRun = (parsed, fragments, category) => {
  if (!parsed || typeof parsed !== 'object') return { valid: false, reason: 'La respuesta no es un objeto.' };
  if (parsed.estado === 'asistencia' && category !== 'VULNERABILIDAD_SOCIAL') {
    return { valid: false, reason: 'estado "asistencia" fuera de VULNERABILIDAD_SOCIAL.' };
  }
  if (!Array.isArray(parsed.citas)) return { valid: false, reason: 'citas no es un arreglo.' };
  const byId = new Map(fragments.map((f) => [f.fragment_id, f]));
  for (const cita of parsed.citas) {
    const fragment = byId.get(cita?.fragment_id);
    if (!fragment) return { valid: false, reason: `fragment_id "${cita?.fragment_id}" fuera del contexto.` };
    if (!quoteMatchesFragment(cita.cita_textual ?? '', fragment.content)) {
      return { valid: false, reason: `cita de "${cita.fragment_id}" no literal.` };
    }
  }
  return { valid: true };
};

/** Resume las N corridas: reparto de estados, conjuntos de citas distintos y consumo de tokens. */
export const summarizeRuns = (runs) => {
  const ok = runs.filter((r) => r.parsed);
  const estados = {};
  for (const r of ok) estados[r.parsed.estado] = (estados[r.parsed.estado] ?? 0) + 1;

  // Un conjunto de citas = ids de fragmento citados, sin duplicados y ordenados (el orden y la redacción no cuentan).
  const setKey = (r) => [...new Set((r.parsed.citas ?? []).map((c) => c.fragment_id))].sort().join(',');
  const citeSets = new Map();
  for (const r of ok) {
    const key = setKey(r);
    citeSets.set(key, (citeSets.get(key) ?? 0) + 1);
  }

  const sum = (field) => runs.reduce((acc, r) => acc + (r.usage?.[field] ?? 0), 0);
  return {
    corridas: runs.length,
    conRespuesta: ok.length,
    fallidas: runs.length - ok.length,
    estados,
    estadosDistintos: Object.keys(estados).length,
    conjuntosDeCitas: [...citeSets.entries()].map(([ids, veces]) => ({ ids: ids === '' ? [] : ids.split(','), veces })),
    conjuntosDeCitasDistintos: citeSets.size,
    validas: ok.filter((r) => r.validation.valid).length,
    tokens: { entrada: sum('promptTokenCount'), salida: sum('candidatesTokenCount'), razonamiento: sum('thoughtsTokenCount') },
  };
};

/** Informe en Markdown de una corrida. */
export const toMarkdown = ({ caso, spec, temperature, promptHash, fragments, runs, summary, generatedAt }) => {
  const L = [];
  L.push(`# Repetibilidad de la generación · ${caso.id}`);
  L.push('');
  L.push(`Generado: ${generatedAt}. Modelo ${spec.model}, prompt ${spec.promptVersion}, temperatura ${temperature}${temperature !== spec.temperature ? ` (**distinta** de producción: ${spec.temperature})` : ''}, thinking ${spec.thinkingLevel}, maxOutputTokens ${spec.maxOutputTokens}.`);
  L.push(`Mismos bytes en las ${summary.corridas} corridas: sha256 del prompt \`${promptHash.slice(0, 16)}…\`. Caso ${caso.exploratorio ? 'EXPLORATORIO (no es un reporte original de Hernán)' : 'original'}.`);
  L.push('');
  L.push(`- Texto: ${caso.descripcion}`);
  L.push(`- Zona: ${caso.zona} · Categoría: ${caso.categoria}`);
  L.push('');
  L.push('## Contexto congelado (lo que recibe el modelo, en orden)');
  L.push('');
  fragments.forEach((f, i) => L.push(`${i + 1}. ${f.hierarchy_path} · similitud ${f.similarity.toFixed(3)}`));
  L.push('');
  L.push('## Resultado');
  L.push('');
  L.push(`- Estados: ${Object.entries(summary.estados).map(([e, n]) => `${e} ×${n}`).join(', ') || 'ninguno'}${summary.fallidas ? ` · ${summary.fallidas} corrida(s) sin respuesta` : ''}`);
  L.push(`- Conjuntos de citas distintos: **${summary.conjuntosDeCitasDistintos}**`);
  summary.conjuntosDeCitas.forEach((s) => L.push(`  - ×${s.veces}: ${s.ids.length ? s.ids.join(', ') : '(sin citas)'}`));
  L.push(`- Pasarían la validación del servidor: ${summary.validas} de ${summary.conRespuesta}`);
  L.push(`- Tokens totales: entrada ${summary.tokens.entrada}, salida ${summary.tokens.salida}, razonamiento ${summary.tokens.razonamiento}`);
  L.push('');
  L.push('| # | Estado | Infracción | Confianza | Citas | Válida | Motivo si no |');
  L.push('|---|---|---|---|---|---|---|');
  runs.forEach((r, i) => {
    if (!r.parsed) L.push(`| ${i + 1} | (sin respuesta) | | | | | ${r.error} |`);
    else L.push(`| ${i + 1} | ${r.parsed.estado} | ${r.parsed.es_infraccion} | ${r.parsed.confianza} | ${(r.parsed.citas ?? []).length} | ${r.validation.valid ? 'sí' : 'no'} | ${r.validation.reason ?? ''} |`);
  });
  L.push('');
  return L.join('\n');
};
