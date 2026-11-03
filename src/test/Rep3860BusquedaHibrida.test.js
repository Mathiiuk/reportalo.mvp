/**
 * @file Rep3860BusquedaHibrida.test.js
 * @description REP-3860 (RAG P2), etapa A: búsqueda híbrida (vectores + texto completo con RRF k=60), apagada por defecto.
 * Cubre la réplica en JS del orden de la función SQL (la que se compara con staging en los 48 controles), la migración
 * sin aplicar y el interruptor RAG_BUSQUEDA de analizar-reporte.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MIGRACION_HIBRIDA,
  RRF_K,
  cuerpoFuncion,
  ordenHibrido,
  idCorto,
  expandirIds,
  sqlFuncionCaso,
  sqlOrdenTexto,
  compararTops,
} from '../../scripts/rag-local-dev/p2/lib.mjs';
import { readProdConfig } from '../../scripts/rag-local-dev/rep-diag-ranking/lib.mjs';

const leer = (ruta) => readFileSync(resolve(__dirname, '../..', ruta), 'utf8').replace(/\r\n/g, '\n');
const MIGRACION = leer(MIGRACION_HIBRIDA);
const FUNCION = leer('supabase/functions/analizar-reporte/index.ts');
const ids = (filas) => filas.map((f) => f.fragment_id);

describe('REP-3860 · réplica del orden híbrido', () => {
  const vector = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

  it('sin coincidencias de texto, el orden es el vectorial', () => {
    expect(ids(ordenHibrido({ vectorOrder: vector, textOrder: [] }))).toEqual(vector.slice(0, 8));
  });

  it('RRF k=60: un fragmento con texto sube sobre los que solo tienen vector', () => {
    // j: 1/(60+10) + 1/(60+1) ≈ 0,0307 · a: 1/(60+1) ≈ 0,0164
    const top = ordenHibrido({ vectorOrder: vector, textOrder: ['j'] });
    expect(top[0]).toMatchObject({ fragment_id: 'j', vector_rank: 10, text_rank: 1, procedencia: 'vector+texto' });
    expect(top[0].rrf_score).toBeCloseTo(1 / 70 + 1 / 61, 12);
    expect(top[1]).toMatchObject({ fragment_id: 'a', text_rank: null, procedencia: 'vector' });
    expect(RRF_K).toBe(60);
  });

  it('empate de puntaje: gana el mejor puesto vectorial', () => {
    // b (v2, t1) y a (v1, t2) suman lo mismo
    const top = ordenHibrido({ vectorOrder: ['a', 'b', 'c'], textOrder: ['b', 'a'] });
    expect(ids(top)).toEqual(['a', 'b', 'c']);
  });

  it('el texto solo cuenta entre los candidatos: un id que no es candidato se ignora', () => {
    expect(ids(ordenHibrido({ vectorOrder: ['a', 'b'], textOrder: ['zz', 'b'] }))).toEqual(['b', 'a']);
  });

  it('forzados (P5) entran primero; vacío en P2 da el mismo resultado', () => {
    const conForzado = ordenHibrido({ vectorOrder: vector, textOrder: ['c'], forced: ['h'] });
    expect(conForzado[0]).toMatchObject({ fragment_id: 'h', procedencia: 'forzado' });
    expect(ids(ordenHibrido({ vectorOrder: vector, textOrder: ['c'], forced: [] }))).toEqual(ids(ordenHibrido({ vectorOrder: vector, textOrder: ['c'] })));
  });

  it('respeta el top pedido', () => {
    expect(ordenHibrido({ vectorOrder: vector, top: 3 })).toHaveLength(3);
  });
});

describe('REP-3860 · ids abreviados de la consulta de texto', () => {
  const candidatos = ['40000000-0000-4000-8000-000000000061', '60000000-0000-4000-8000-000000000002'];

  it('se expanden contra los candidatos del caso', () => {
    expect(idCorto(candidatos[0])).toBe('400061');
    expect(expandirIds(['600002', '400061'], candidatos)).toEqual([candidatos[1], candidatos[0]]);
  });

  it('un id que no es candidato corta el control (no se descarta en silencio)', () => {
    expect(() => expandirIds(['800002'], candidatos)).toThrow(/no está entre los candidatos/);
  });

  it('dos candidatos con la misma abreviatura cortan el control', () => {
    expect(() => expandirIds([], ['40000000-0000-4000-8000-000000000061', '40000000-aaaa-4000-8000-000000000061'])).toThrow(/repetido/);
  });
});

describe('REP-3860 · migración de la función híbrida (sin aplicar)', () => {
  it('avisa que no está aplicada y no toca match_knowledge_fragments', () => {
    expect(MIGRACION).toMatch(/NO APLICADA/);
    expect(MIGRACION).not.toMatch(/create or replace function public\.match_knowledge_fragments\(/);
  });

  it('firma con forzados vacíos por defecto, k=60 y top 8', () => {
    expect(MIGRACION).toMatch(/p_rrf_k integer default 60/);
    expect(MIGRACION).toMatch(/p_forced_ids uuid\[\] default '\{\}'/);
    expect(MIGRACION).toMatch(/match_count integer default 8/);
    expect(MIGRACION).toMatch(/procedencia text/);
  });

  it('solo la invoca el servidor', () => {
    expect(MIGRACION).toMatch(/revoke execute on function public\.match_knowledge_fragments_hibrida\([^)]*\)\s+from public, anon, authenticated;/);
    expect(MIGRACION).toMatch(/grant execute on function public\.match_knowledge_fragments_hibrida\([^)]*\)\s+to service_role;/);
  });

  it('mismos candidatos que match_knowledge_fragments: jurisdicción, vigencia, modelo y categoría', () => {
    const cuerpo = cuerpoFuncion(MIGRACION);
    expect(cuerpo).toMatch(/from eligible_knowledge_sources\(p_locality_id\) e/);
    expect(cuerpo).toMatch(/join knowledge_fragments f\s+on f\.source_id = e\.source_id and f\.is_current/);
    expect(cuerpo).toMatch(/fe\.model_code = p_model_code/);
    expect(cuerpo).toMatch(/where p_service_code is null or exists/);
  });

  it('la consulta de texto del control usa la misma regla que la función (lexemas unidos con OR)', () => {
    const regla = "nullif(replace(plainto_tsquery('spanish', coalesce(";
    expect(cuerpoFuncion(MIGRACION)).toContain(regla);
    expect(sqlOrdenTexto([{ id: 'X', localidad: '00000000-0000-0000-0000-000000000000', categoria: 'TRANSITO', descripcion: "auto d'la vereda" }], 'm@1')).toContain(regla);
  });

  it('el SELECT del control reemplaza todos los parámetros y escapa las comillas', () => {
    const sql = sqlFuncionCaso(cuerpoFuncion(MIGRACION), { id: 'C1', descripcion: "d'Avellaneda", localidad: '11111111-1111-1111-1111-111111111111', categoria: 'INFRAESTRUCTURA' }, [0.1, -0.2], {
      embeddingModelCode: 'gemini-embedding-2@768',
      matchCount: 8,
    });
    expect(sql).not.toMatch(/\b(query_embedding|p_query_text|p_locality_id|p_model_code|match_count|p_service_code|p_rrf_k|p_forced_ids)\b/);
    expect(sql).toContain("'[0.1,-0.2]'::vector");
    expect(sql).toContain("'d''Avellaneda'");
    expect(sql).toContain("'{}'::uuid[]");
  });

  it('compararTops informa cada caso distinto', () => {
    const runner = [{ caso: 'A', hibrida: [{ fragment_id: 'x' }, { fragment_id: 'y' }] }, { caso: 'B', hibrida: [{ fragment_id: 'x' }] }];
    const sql = [{ caso: 'A', top: [['x'], ['y']] }, { caso: 'B', top: [['y']] }];
    expect(compararTops(sql, runner)).toEqual([{ caso: 'B', motivo: 'orden distinto', sql: ['y'], js: ['x'] }]);
  });
});

describe('REP-3860 · interruptor RAG_BUSQUEDA en analizar-reporte', () => {
  it('por defecto la búsqueda es vectorial: solo «hibrida» cambia el RPC', () => {
    expect(FUNCION).toMatch(/value\?\.trim\(\)\.toLowerCase\(\) === 'hibrida' \? 'hibrida' : 'vectorial'/);
    expect(FUNCION).toMatch(/retrievalMode\(Deno\.env\.get\('RAG_BUSQUEDA'\)\) === 'hibrida'/);
  });

  it('la híbrida recibe los mismos parámetros, más la descripción sola y k=60', () => {
    expect(FUNCION).toMatch(/rpc\('match_knowledge_fragments_hibrida', \{ \.\.\.searchParams, p_query_text: description\.trim\(\), p_rrf_k: RRF_K \}\)/);
    expect(FUNCION).toMatch(/: await supabaseAdmin\.rpc\('match_knowledge_fragments', searchParams\)/);
    expect(FUNCION).toMatch(/const RRF_K = 60;/);
  });

  it('los runners siguen leyendo la configuración de producción', () => {
    expect(readProdConfig(FUNCION)).toMatchObject({ matchCount: 8, threshold: 0.45, embeddingModelCode: 'gemini-embedding-2@768' });
  });
});
