/**
 * @file Rep3837ParteB.test.js
 * @description REP-3837 parte B (entrega de Hernán del 19/10/2026): 5 fragmentos de la Ley 2628 y la Ley 5688 de CABA,
 * preparados para el loader del corpus y SIN cargar (se cargan después de medir P0–P2). Verifica que los .md generados
 * lleguen a la base con el texto exacto que cotejó el PO: misma huella SHA-256, metadata y categoría, también si el
 * archivo se lee con saltos CRLF (checkout de Windows).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { parseCorpusFile } from '../../scripts/corpus-loader/parse-corpus-md.mjs';

const root = resolve(__dirname, '../..');
const leer = (ruta) => readFileSync(resolve(root, ruta), 'utf8');
const sha256 = (texto) => createHash('sha256').update(Buffer.from(texto, 'utf8')).digest('hex');

// Huellas que declaró Hernán en REP-3837_Normas_nuevas_para_el_corpus.md §4
const HUELLAS_PO = {
  'LEY2628-ART3-INC3': 'd4e4b8429a88c055952f38e995092b37562513e2df5768c3a1bb6079785f28bc',
  'LEY2628-ART3-INC17': '1d346034c32a7bea29cdfee194d4fc7ef777beab27261d3d9be9354897adae0a',
  'LEY5688-ART506': '526bda1b874b907a52d609ea9a454ac75e96ea11aaa2b49fd58880786a9c3eb7',
  'LEY5688-ART507': 'fa8d35adaf487eee9377b47414586f32467f113525b96b5df721b0de0f32f1e2',
  'LEY5688-ART511': 'f146ed8f9048dbd34b92e40b6ba5057eeaa38354e287901a419b689f033b31d6',
};

const json = JSON.parse(leer('scripts/rep3837/fragmentos_propuestos_2628_5688.json'));
const ARCHIVOS = {
  '2628': 'corpus/normativas/ley_2628_caba_apra_art3.md',
  '5688': 'corpus/normativas/ley_5688_caba_agentes_transito.md',
};
const parsear = (numero, { crlf = false } = {}) => {
  const texto = leer(ARCHIVOS[numero]).replace(/\r\n/g, '\n');
  return parseCorpusFile(crlf ? texto.replace(/\n/g, '\r\n') : texto, ARCHIVOS[numero]);
};
const fragmentosCargados = (opts) => [...parsear('2628', opts).fragments, ...parsear('5688', opts).fragments];

describe('REP-3837 parte B · fragmentos de Ley 2628 y Ley 5688', () => {
  it('UT-3837B-01: el JSON del PO trae los 5 fragmentos con las huellas que declaró', () => {
    expect(json).toHaveLength(5);
    for (const f of json) {
      expect(HUELLAS_PO[f.clave]).toBe(f.sha256);
      expect(sha256(f.content)).toBe(f.sha256);
    }
  });

  it.each([false, true])('UT-3837B-02: el parser del loader lee los 5 con la huella exacta (CRLF: %s)', (crlf) => {
    const huellas = fragmentosCargados({ crlf }).map((f) => sha256(f.content)).sort();
    expect(huellas).toEqual(Object.values(HUELLAS_PO).sort());
  });

  it('UT-3837B-03: cada fragmento conserva artículo, inciso, tipo y categoría del JSON', () => {
    const cargados = fragmentosCargados();
    for (const f of json) {
      const c = cargados.find((x) => sha256(x.content) === f.sha256);
      expect(c.article).toBe(f.article);
      expect(c.subsection).toBe(f.subsection);
      expect(c.hierarchy_path).toBe(f.hierarchy_path);
      expect(c.foundation_type).toBe('competencia');
      expect(c.services).toEqual([f.categoria]);
    }
  });

  it('UT-3837B-04: las dos fuentes son leyes de CABA (no de otra jurisdicción), verificadas el 19/10', () => {
    for (const numero of ['2628', '5688']) {
      const { source } = parsear(numero);
      expect(source).toMatchObject({
        source_type: 'corpus_legal',
        document_type: 'ley',
        document_number: numero,
        issuing_authority: 'Legislatura de la Ciudad Autónoma de Buenos Aires',
        scope: 'state_province',
        scope_name: 'Ciudad Autónoma de Buenos Aires',
        requires_adhesion: false,
        verified_at: '2026-10-19T00:00:00Z',
      });
      expect(source.source_url).toMatch(/^https:\/\/boletinoficial\.buenosaires\.gob\.ar\//);
    }
  });

  it('UT-3837B-05: la Ley 5688 usa la numeración del texto consolidado vigente (506/507/511, no 493/498)', () => {
    const arts = parsear('5688').fragments.map((f) => f.article);
    expect(arts).toEqual(['506', '507', '511']);
  });
});

describe('REP-3837 parte B · verificación y rollback', () => {
  const verificar = leer('scripts/rep3837/verificar_huellas.sql');
  const rollback = leer('scripts/rep3837/rollback_parteB.sql');
  const sinComentarios = (sql) => sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');

  it('UT-3837B-06: la verificación es de solo lectura y compara las 5 huellas del PO', () => {
    const code = sinComentarios(verificar);
    expect(code).not.toMatch(/\b(insert|update|delete|drop|alter|create|truncate)\b/i);
    for (const h of Object.values(HUELLAS_PO)) expect(code).toContain(h);
    expect(code).toMatch(/encode\(sha256\(convert_to\(f\.content, 'UTF8'\)\), 'hex'\)/);
  });

  it('UT-3837B-07: el rollback baja la vigencia sin borrar nada y solo toca Ley 2628 y Ley 5688 de CABA', () => {
    const code = sinComentarios(rollback);
    expect(code).not.toMatch(/\bdelete\b|\bdrop\b|\btruncate\b/i);
    expect(code).toMatch(/set is_current = false/);
    expect(code).toMatch(/document_number in \('2628', '5688'\)/);
    expect(code).toMatch(/name = 'Ciudad Autónoma de Buenos Aires'/);
  });
});
