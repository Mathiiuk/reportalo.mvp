// RAG-DIAG-RANKING · Piezas puras del diagnóstico de ranking de recuperación (sin red, probadas con Vitest).
//
// Reproduce lo que hace supabase/functions/analizar-reporte/index.ts para armar la consulta y para
// decidir qué fragmentos llegan al modelo, pero conservando TODO el ranking (también lo que queda
// bajo el umbral o fuera del top-k), que en producción se descarta.

/**
 * Lee del fuente de la Edge Function los valores que gobiernan la recuperación, para que el
 * diagnóstico no se desfase si alguien los cambia. Falla fuerte si no los encuentra.
 */
export const readProdConfig = (source) => {
  const num = (name) => {
    const m = source.match(new RegExp(`const ${name} = ([0-9.]+);`));
    if (!m) throw new Error(`No se encontró ${name} en analizar-reporte/index.ts`);
    return Number(m[1]);
  };
  const str = (name) => {
    const m = source.match(new RegExp(`const ${name} = '([^']+)';`));
    if (!m) throw new Error(`No se encontró ${name} en analizar-reporte/index.ts`);
    return m[1];
  };
  return {
    matchCount: num('DEFAULT_MATCH_COUNT'),
    threshold: num('DEFAULT_SIMILARITY_THRESHOLD'),
    dimensions: num('EMBEDDING_DIMENSIONS'),
    embeddingModel: str('EMBEDDING_MODEL'),
    embeddingModelCode: str('EMBEDDING_MODEL_CODE'),
  };
};

/** Mismo texto de consulta que arma la función (descripción + categoría, sin jurisdicción). */
export const buildQueryText = (description, category) =>
  category ? `${description.trim()} (categoría: ${category})` : description.trim();

/**
 * Marca cada candidato (ya ordenado por similitud descendente) según lo que habría pasado en
 * producción: ¿supera el umbral?, ¿entra en el top-k?, ¿llega al modelo? (ambas cosas).
 * `esperado` es un texto que debe aparecer en hierarchy_path; si se informa, se calcula su puesto.
 */
export const classifyCandidates = (rows, { matchCount, threshold, esperado = null }) => {
  const candidates = rows.map((row, index) => {
    const rank = index + 1;
    const superaUmbral = row.similarity >= threshold;
    const dentroTopK = rank <= matchCount;
    return {
      rank,
      similarity: row.similarity,
      hierarchy_path: row.hierarchy_path,
      fragment_id: row.fragment_id,
      scope_level: row.scope_level,
      superaUmbral,
      dentroTopK,
      llegaAlModelo: superaUmbral && dentroTopK,
      esEsperado: esperado ? row.hierarchy_path.includes(esperado) : false,
    };
  });

  const expected = candidates.find((c) => c.esEsperado) ?? null;
  const delivered = candidates.filter((c) => c.llegaAlModelo);
  const firstBelow = candidates.find((c) => !c.superaUmbral) ?? null;

  let veredicto;
  if (delivered.length === 0) veredicto = 'sin_normativa (ningún candidato llega al modelo)';
  else veredicto = `${delivered.length} fragmento(s) llegan al modelo`;

  let esperadoEstado = null;
  if (esperado) {
    if (!expected) esperadoEstado = 'no aparece entre los candidatos de la ventana';
    else if (expected.llegaAlModelo) esperadoEstado = `llega al modelo (puesto ${expected.rank})`;
    else if (!expected.superaUmbral) esperadoEstado = `puesto ${expected.rank} pero BAJO el umbral (${expected.similarity.toFixed(3)})`;
    else esperadoEstado = `supera el umbral pero queda FUERA del top-${matchCount} (puesto ${expected.rank})`;
  }

  return {
    candidates,
    veredicto,
    esperadoEstado,
    mejorSimilitud: candidates[0]?.similarity ?? null,
    primerBajoUmbral: firstBelow ? { rank: firstBelow.rank, similarity: firstBelow.similarity } : null,
  };
};

const fmt = (n) => (typeof n === 'number' ? n.toFixed(3) : '-');

/** Informe en Markdown de una corrida completa. */
export const toMarkdown = ({ config, results, generatedAt }) => {
  const lines = [];
  lines.push('# Diagnóstico de ranking de recuperación (RAG)');
  lines.push('');
  lines.push(`Generado: ${generatedAt}. Configuración leída de analizar-reporte/index.ts: top-k ${config.matchCount}, umbral ${config.threshold}, embeddings ${config.embeddingModelCode}.`);
  lines.push('');
  lines.push('Los textos de los casos son EXPLORATORIOS salvo que digan lo contrario: no son los reportes originales de Hernán.');
  lines.push('');
  lines.push('| Caso | Zona | Categoría | Mejor similitud | Resultado en producción | Artículo esperado |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of results) {
    lines.push(`| ${r.id} | ${r.zona} | ${r.categoria} | ${fmt(r.analysis.mejorSimilitud)} | ${r.analysis.veredicto} | ${r.analysis.esperadoEstado ?? 'sin definir'} |`);
  }
  for (const r of results) {
    lines.push('');
    lines.push(`## ${r.id}`);
    lines.push('');
    lines.push(`- Zona: ${r.zona} · Categoría: ${r.categoria}${r.exploratorio ? ' · exploratorio' : ''}`);
    lines.push(`- Texto: ${r.descripcion}`);
    lines.push('');
    lines.push('| # | Similitud | Umbral | Top-k | Fragmento |');
    lines.push('|---|---|---|---|---|');
    for (const c of r.analysis.candidates) {
      lines.push(`| ${c.rank} | ${fmt(c.similarity)} | ${c.superaUmbral ? 'sí' : 'no'} | ${c.dentroTopK ? 'sí' : 'no'} | ${c.esEsperado ? '**' : ''}${c.hierarchy_path}${c.esEsperado ? '** (esperado)' : ''} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
};
