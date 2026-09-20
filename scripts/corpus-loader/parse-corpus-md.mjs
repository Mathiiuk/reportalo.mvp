// REP-3774 — Parser del formato de corpus verificado (.md).
//
// El formato existe para que una norma se pueda revisar como texto (diff en el
// PR, lectura por Hernan) y cargarse sin intervencion manual. Es deliberadamente
// chico: cabecera de metadata + un bloque por fragmento, con el texto citable
// dentro de un bloque cercado para que no haya ambiguedad sobre donde empieza y
// termina lo verbatim.
//
//   ---
//   source_type: corpus_legal
//   document_type: ley
//   document_number: 24.449
//   title: Ley de Transito
//   issuing_authority: Congreso de la Nacion Argentina
//   scope: country                # country | state_province | subdivision
//   scope_name: AR                # iso_code del pais, o nombre exacto de la jurisdiccion
//   scope_parent:                 # obligatorio si scope es subdivision: la provincia
//   requires_adhesion: true
//   source_url: https://...
//   verified_at: 2026-09-06
//   last_amended_by:
//   ---
//
//   ## fragmento
//   article: 48
//   subsection: i
//   hierarchy_path: Ley 24.449 > Articulo 48 > inciso i)
//   foundation_type: conducta_prohibida
//   services: TRANSITO
//
//   ```texto
//   i) La detencion irregular sobre la calzada...
//   ```
//
// Todo lo que este fuera de un bloque `## fragmento` (titulos, notas de
// investigacion) se ignora: sirve para que el archivo siga siendo legible.

const REQUIRED_SOURCE_FIELDS = [
  'source_type',
  'document_type',
  'title',
  'issuing_authority',
  'scope',
  'scope_name',
  'source_url',
  'verified_at',
];

const VALID_SCOPES = ['country', 'state_province', 'subdivision'];

function parseKeyValueBlock(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!match) throw new Error(`Linea de metadata invalida: "${rawLine}"`);
    values[match[1]] = match[2].trim();
  }
  return values;
}

function emptyToNull(value) {
  return value === undefined || value === '' ? null : value;
}

function parseBoolean(value, field) {
  if (value === undefined || value === '') return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${field} tiene que ser true o false, no "${value}"`);
}

// Se acepta fecha sola (2026-09-06) o timestamp completo. La fecha de
// verificacion es parte de la trazabilidad de la norma: sin ella no se carga.
function parseVerifiedAt(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00Z`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`verified_at invalido: "${value}"`);
  return parsed.toISOString();
}

function parseFragment(block, index, fileName) {
  const fenceMatch = block.match(/^```texto\r?\n([\s\S]*?)\r?\n```\s*$/m);
  if (!fenceMatch) {
    throw new Error(
      `Fragmento #${index + 1} de ${fileName}: falta el bloque \`\`\`texto ... \`\`\` con el texto verbatim`
    );
  }

  const metadata = parseKeyValueBlock(block.slice(0, fenceMatch.index));
  const content = fenceMatch[1].trim();
  if (content === '') throw new Error(`Fragmento #${index + 1} de ${fileName}: el texto verbatim esta vacio`);
  if (!metadata.hierarchy_path) {
    throw new Error(`Fragmento #${index + 1} de ${fileName}: falta hierarchy_path`);
  }

  const article = emptyToNull(metadata.article);
  const subsection = emptyToNull(metadata.subsection);
  const services = (metadata.services || '')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);

  return {
    label: article ? `art. ${article}${subsection ? ` inc. ${subsection}` : ''}` : metadata.hierarchy_path,
    hierarchy_path: metadata.hierarchy_path,
    article,
    subsection,
    content,
    foundation_type: emptyToNull(metadata.foundation_type),
    services,
  };
}

export function parseCorpusFile(text, fileName = 'corpus.md') {
  const frontmatterMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!frontmatterMatch) throw new Error(`${fileName}: falta la cabecera de metadata entre --- y ---`);

  const raw = parseKeyValueBlock(frontmatterMatch[1]);
  const missing = REQUIRED_SOURCE_FIELDS.filter((field) => !raw[field]);
  if (missing.length > 0) throw new Error(`${fileName}: faltan campos obligatorios: ${missing.join(', ')}`);
  if (!VALID_SCOPES.includes(raw.scope)) {
    throw new Error(`${fileName}: scope invalido "${raw.scope}" (${VALID_SCOPES.join(' | ')})`);
  }
  // Hay dos "Avellaneda" en subdivisions (Buenos Aires y Santa Fe). Cargar una
  // norma municipal contra la jurisdiccion equivocada la haria aplicable a
  // ciudadanos de otra provincia, asi que el nombre del partido solo no alcanza.
  if (raw.scope === 'subdivision' && !raw.scope_parent) {
    throw new Error(`${fileName}: scope_parent es obligatorio con scope: subdivision (el nombre de la provincia)`);
  }

  const source = {
    source_type: raw.source_type,
    document_type: raw.document_type,
    document_number: emptyToNull(raw.document_number),
    title: raw.title,
    issuing_authority: raw.issuing_authority,
    scope: raw.scope,
    scope_name: raw.scope_name,
    scope_parent: emptyToNull(raw.scope_parent),
    requires_adhesion: parseBoolean(raw.requires_adhesion, 'requires_adhesion'),
    source_url: raw.source_url,
    verified_at: parseVerifiedAt(raw.verified_at),
    last_amended_by: emptyToNull(raw.last_amended_by),
  };

  const body = text.slice(frontmatterMatch[0].length);
  const blocks = body.split(/^##\s+fragmento\s*$/m).slice(1);
  if (blocks.length === 0) throw new Error(`${fileName}: no hay ningun bloque "## fragmento"`);

  const fragments = blocks.map((block, index) => parseFragment(block, index, fileName));

  // El indice knowledge_fragments_current_uq no admite dos fragmentos vigentes
  // con el mismo (source_id, article, subsection): si el archivo los repite, la
  // carga fallaria a mitad de camino. Mejor avisar antes de tocar la base.
  const seen = new Set();
  for (const fragment of fragments) {
    const key = `${fragment.article}|${fragment.subsection}`;
    if (seen.has(key)) throw new Error(`${fileName}: hay dos fragmentos con el mismo articulo/inciso (${fragment.label})`);
    seen.add(key);
  }

  return { source, fragments };
}
