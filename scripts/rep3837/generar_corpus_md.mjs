// REP-3837 parte B — Genera los .md del loader del corpus (scripts/corpus-loader) a partir del JSON que entregó
// Hernán (PO) el 19/10/2026: 5 fragmentos de la Ley 2628 (APRA) y la Ley 5688 (Agentes de Tránsito), cotejados
// contra el texto oficial actualizado del Boletín Oficial de la Ciudad.
//
// El texto citable no se transcribe a mano: sale del campo `content` del JSON, byte por byte. Antes de escribir,
// el script verifica que el SHA-256 de cada `content` coincida con el que declaró Hernán; si alguno no coincide,
// no escribe nada.
//
// Uso:  node scripts/rep3837/generar_corpus_md.mjs
// Salida: corpus/normativas/ley_2628_caba_apra_art3.md y corpus/normativas/ley_5688_caba_agentes_transito.md
//
// NO carga nada en la base. La carga se hace con load-corpus.mjs en la ventana acordada con el PM
// (después de medir P0–P2): ver docs/corpus/REP-3837_parteB_INSTRUCTIVO.md.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const fragments = JSON.parse(readFileSync(join(here, 'fragmentos_propuestos_2628_5688.json'), 'utf8'));

// Metadata de cada fuente: mismo formato que las leyes de CABA ya cargadas (document_number sin puntos, Legislatura)
const SOURCES = {
  'Ley 2628': {
    file: 'ley_2628_caba_apra_art3.md',
    document_number: '2628',
    title: 'Agencia de Protección Ambiental de la Ciudad Autónoma de Buenos Aires',
    last_amended_by: 'Texto actualizado al 29/02/2024; consolidada por Ley N 6764',
    intro: [
      '# Ley 2628 (CABA) — Agencia de Protección Ambiental (APRA)',
      '',
      'Norma de **competencia** para ambiente en CABA: la APRA vela por el cumplimiento de las normas de control',
      'ambiental y ejerce el contralor y la fiscalización en la Ciudad. Cubre el hueco de fundamento de la matriz',
      'REP-2806 para contaminación en CABA (el destino ya era la APRA, pero su ley no estaba en el corpus).',
    ],
  },
  'Ley 5688': {
    file: 'ley_5688_caba_agentes_transito.md',
    document_number: '5688',
    title: 'Sistema Integral de Seguridad Pública de la Ciudad Autónoma de Buenos Aires',
    last_amended_by: 'Texto consolidado vigente (Ley Q N° 5.688)',
    intro: [
      '# Ley 5688 (CABA) — Cuerpo de Agentes de Control de Tránsito y Transporte',
      '',
      'Norma de **competencia** para tránsito en CABA: quién controla. La conducta sigue fundamentándose con la',
      'Ley 2148 (arts. 7.1.8 y 7.1.9) y la Ley 451. **Numeración del texto consolidado vigente:** arts. 506, 507 y 511',
      '(en el texto original de 2016 eran 493, 494 y 498; la matriz REP-2806 citaba la numeración vieja).',
    ],
  },
};

// 1) Verificar huellas antes de escribir nada
const sha256 = (text) => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
const mismatches = fragments.filter((f) => sha256(f.content) !== f.sha256);
if (mismatches.length > 0) {
  console.error('Huella distinta en:', mismatches.map((f) => f.clave).join(', '));
  process.exit(1);
}
const withFence = fragments.filter((f) => f.content.includes('```') || /\r/.test(f.content));
if (withFence.length > 0) {
  console.error('Contenido con ``` o \\r (rompería el bloque del loader):', withFence.map((f) => f.clave).join(', '));
  process.exit(1);
}

// 2) Un .md por fuente, en el formato de scripts/corpus-loader/parse-corpus-md.mjs
for (const [norma, meta] of Object.entries(SOURCES)) {
  const own = fragments.filter((f) => f.norma === norma);
  const first = own[0];
  const lines = [
    '---',
    'source_type: corpus_legal',
    'document_type: ley',
    `document_number: ${meta.document_number}`,
    `title: ${meta.title}`,
    'issuing_authority: Legislatura de la Ciudad Autónoma de Buenos Aires',
    'scope: state_province',
    'scope_name: Ciudad Autónoma de Buenos Aires',
    'scope_parent: AR',
    'requires_adhesion: false',
    `source_url: ${first.source_url}`,
    'verified_at: 2026-10-19',
    `last_amended_by: ${meta.last_amended_by}`,
    '---',
    '',
    ...meta.intro,
    '',
    `Generado por \`scripts/rep3837/generar_corpus_md.mjs\` desde \`fragmentos_propuestos_2628_5688.json\` (Hernán, 19/10/2026).`,
    `Texto oficial: ${first.texto_oficial_url} · Versión: ${first.version}.`,
    'No editar a mano el texto de los bloques: cambiaría la huella SHA-256 verificada por el PO.',
    '',
  ];
  for (const f of own) {
    lines.push(
      `<!-- ${f.clave} · sha256 ${f.sha256} -->`,
      '## fragmento',
      `article: ${f.article}`,
      `subsection: ${f.subsection ?? ''}`,
      `hierarchy_path: ${f.hierarchy_path}`,
      `foundation_type: ${f.foundation_type}`,
      `services: ${f.categoria}`,
      '',
      '```texto',
      f.content,
      '```',
      ''
    );
  }
  const out = join(root, 'corpus', 'normativas', meta.file);
  writeFileSync(out, lines.join('\n'), 'utf8');
  console.log(`${meta.file}: ${own.length} fragmentos`);
}
