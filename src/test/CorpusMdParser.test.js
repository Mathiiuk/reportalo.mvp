// REP-3774 — Parser del formato de corpus verificado (.md).
//
// El loader escribe en el corpus jurídico con clave de servicio: un archivo mal
// formado que pase el parser termina en una norma cargada a medias o en un
// fragmento citable con texto equivocado. Por eso lo que más se prueba acá es
// que rechace, no que acepte.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseCorpusFile } from '../../scripts/corpus-loader/parse-corpus-md.mjs';

const FRONTMATTER = `---
source_type: corpus_legal
document_type: ley
document_number: 210
title: Ente Único Regulador de los Servicios Públicos
issuing_authority: Legislatura de la Ciudad Autónoma de Buenos Aires
scope: state_province
scope_name: Ciudad Autónoma de Buenos Aires
requires_adhesion: false
source_url: https://boletinoficial.buenosaires.gob.ar/normativaba/norma/4623
verified_at: 2026-09-07
last_amended_by:
---
`;

const fragment = ({ article = '2', subsection = 'b', text = 'b) Alumbrado público' } = {}) => `
## fragmento
article: ${article}
subsection: ${subsection}
hierarchy_path: Ley 210 > Artículo ${article} > inciso ${subsection})
foundation_type: competencia
services: INFRAESTRUCTURA

\`\`\`texto
${text}
\`\`\`
`;

describe('parseCorpusFile — cabecera', () => {
  it('UT-CRP-01 lee la metadata de la fuente', () => {
    const { source } = parseCorpusFile(`${FRONTMATTER}${fragment()}`);

    expect(source).toMatchObject({
      source_type: 'corpus_legal',
      document_type: 'ley',
      document_number: '210',
      scope: 'state_province',
      scope_name: 'Ciudad Autónoma de Buenos Aires',
      requires_adhesion: false,
    });
  });

  it('UT-CRP-02 normaliza verified_at a timestamp UTC', () => {
    const { source } = parseCorpusFile(`${FRONTMATTER}${fragment()}`);

    expect(source.verified_at).toBe('2026-09-07T00:00:00Z');
  });

  it('UT-CRP-03 deja en null los campos opcionales vacíos', () => {
    const { source } = parseCorpusFile(`${FRONTMATTER}${fragment()}`);

    expect(source.last_amended_by).toBeNull();
  });

  it('UT-CRP-04 rechaza el archivo sin cabecera', () => {
    expect(() => parseCorpusFile(`# Ley 210${fragment()}`)).toThrow(/falta la cabecera/i);
  });

  it('UT-CRP-05 rechaza la cabecera sin campos obligatorios', () => {
    const incompleto = `---
source_type: corpus_legal
document_type: ley
---
${fragment()}`;

    expect(() => parseCorpusFile(incompleto)).toThrow(/faltan campos obligatorios/i);
  });

  it('UT-CRP-06 rechaza un ámbito que no existe en el árbol geográfico', () => {
    const malScope = FRONTMATTER.replace('scope: state_province', 'scope: barrio');

    expect(() => parseCorpusFile(`${malScope}${fragment()}`)).toThrow(/scope invalido/i);
  });

  // Hay dos "Avellaneda" en subdivisions (Buenos Aires y Santa Fe). Sin la
  // provincia, una ordenanza municipal se puede cargar contra la jurisdicción
  // equivocada y recién se nota cuando el RAG le cita a un vecino una norma
  // de otra provincia.
  it('UT-CRP-17 exige scope_parent cuando el ámbito es un municipio', () => {
    const municipal = FRONTMATTER.replace('scope: state_province', 'scope: subdivision').replace(
      'scope_name: Ciudad Autónoma de Buenos Aires',
      'scope_name: Avellaneda'
    );

    expect(() => parseCorpusFile(`${municipal}${fragment()}`)).toThrow(/scope_parent es obligatorio/i);
  });

  it('UT-CRP-18 acepta el municipio desambiguado por provincia', () => {
    const municipal = FRONTMATTER.replace('scope: state_province', 'scope: subdivision').replace(
      'scope_name: Ciudad Autónoma de Buenos Aires',
      'scope_name: Avellaneda\nscope_parent: Buenos Aires'
    );

    const { source } = parseCorpusFile(`${municipal}${fragment()}`);
    expect(source).toMatchObject({ scope: 'subdivision', scope_name: 'Avellaneda', scope_parent: 'Buenos Aires' });
  });
});

describe('parseCorpusFile — fragmentos', () => {
  it('UT-CRP-07 lee el texto verbatim sin tocar el contenido', () => {
    const texto = 'j) Recibir y tramitar las quejas y reclamos que efectúen los usuarios.';
    const { fragments } = parseCorpusFile(`${FRONTMATTER}${fragment({ article: '3', subsection: 'j', text: texto })}`);

    expect(fragments).toHaveLength(1);
    expect(fragments[0].content).toBe(texto);
    expect(fragments[0].label).toBe('art. 3 inc. j');
  });

  it('UT-CRP-08 conserva los saltos de línea internos del artículo', () => {
    const texto = 'a) Primero;\n\nb) Segundo;';
    const { fragments } = parseCorpusFile(`${FRONTMATTER}${fragment({ text: texto })}`);

    expect(fragments[0].content).toBe(texto);
  });

  it('UT-CRP-09 separa los services en una lista', () => {
    const conDos = fragment().replace('services: INFRAESTRUCTURA', 'services: INFRAESTRUCTURA, AMBIENTE');
    const { fragments } = parseCorpusFile(`${FRONTMATTER}${conDos}`);

    expect(fragments[0].services).toEqual(['INFRAESTRUCTURA', 'AMBIENTE']);
  });

  it('UT-CRP-10 acepta un artículo sin inciso', () => {
    const sinInciso = fragment({ subsection: '' });
    const { fragments } = parseCorpusFile(`${FRONTMATTER}${sinInciso}`);

    expect(fragments[0].subsection).toBeNull();
    expect(fragments[0].label).toBe('art. 2');
  });

  it('UT-CRP-11 rechaza un fragmento sin bloque de texto verbatim', () => {
    const sinTexto = `
## fragmento
article: 2
hierarchy_path: Ley 210 > Artículo 2
foundation_type: competencia
`;

    expect(() => parseCorpusFile(`${FRONTMATTER}${sinTexto}`)).toThrow(/texto verbatim/i);
  });

  it('UT-CRP-12 rechaza un fragmento sin hierarchy_path', () => {
    const sinPath = fragment().replace(/^hierarchy_path:.*$/m, '');

    expect(() => parseCorpusFile(`${FRONTMATTER}${sinPath}`)).toThrow(/hierarchy_path/i);
  });

  it('UT-CRP-13 rechaza el archivo sin ningún fragmento', () => {
    expect(() => parseCorpusFile(`${FRONTMATTER}\n# Solo notas\n`)).toThrow(/no hay ningun bloque/i);
  });

  // knowledge_fragments_current_uq no admite dos vigentes con el mismo
  // (source_id, article, subsection): si el archivo los repite, la carga
  // fallaría a mitad de camino, con la norma ya escrita.
  it('UT-CRP-14 rechaza dos fragmentos con el mismo artículo e inciso', () => {
    const duplicado = `${fragment()}${fragment({ text: 'otro texto' })}`;

    expect(() => parseCorpusFile(`${FRONTMATTER}${duplicado}`)).toThrow(/mismo articulo\/inciso/i);
  });

  it('UT-CRP-15 ignora el texto fuera de los bloques de fragmento', () => {
    const conNotas = `${FRONTMATTER}
# Título libre

Una nota de investigación que no debe cargarse.
${fragment()}
## Anexo

Otra nota más.
`;

    const { fragments } = parseCorpusFile(conNotas);
    expect(fragments).toHaveLength(1);
    expect(fragments[0].content).toBe('b) Alumbrado público');
  });
});

describe('parseCorpusFile — norma de prueba del repo', () => {
  it('UT-CRP-16 parsea corpus/normativas/ley_210_caba_ente_regulador.md', () => {
    const texto = fs.readFileSync(path.resolve('corpus/normativas/ley_210_caba_ente_regulador.md'), 'utf-8');
    const { source, fragments } = parseCorpusFile(texto, 'ley_210_caba_ente_regulador.md');

    expect(source.document_number).toBe('210');
    expect(fragments).toHaveLength(3);
    expect(fragments.map((f) => f.label)).toEqual(['art. 2 inc. b', 'art. 2 inc. c', 'art. 3 inc. j']);
    // Mismo texto exacto que el seed de REP-3769: cargarlo tiene que dar unchanged.
    expect(fragments[2].content).toBe(
      'j) Recibir y tramitar las quejas y reclamos que efectúen los usuarios en sede administrativa tendiente a resolver el conflicto planteado con el prestador.'
    );
  });
});
