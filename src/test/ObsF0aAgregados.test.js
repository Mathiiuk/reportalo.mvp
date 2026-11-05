/**
 * @file ObsF0aAgregados.test.js
 * @description OBS · F0a · Funciones de agregados del observatorio y su servicio en el front.
 * Decisiones de Matías (04/11/2026): solo con sesión, con los reportes reales, sin Vulnerabilidad social.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rpc = vi.fn();
vi.mock('../lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: { rpc: (...a) => rpc(...a) } }));

const {
  paramsDeFiltro,
  fetchResumen,
  fetchPorMes,
  fetchPorCategoria,
  fetchHijos,
} = await import('../services/observatorioService');

const SQL = readFileSync(
  resolve(__dirname, '../../supabase/migrations/20261104120000_obs_f0a_agregados_del_observatorio.sql'),
  'utf8'
);
// Sin comentarios, para que las reglas se lean en el código y no en la explicación
const CODIGO = SQL.replace(/--.*$/gm, '');

describe('OBS-F0a · la migración', () => {
  it('UT-OBS-F0a-1: ninguna función se otorga a anon y la base por reporte no se otorga a nadie', () => {
    expect(CODIGO).not.toMatch(/grant[^;]*to[^;]*\banon\b/i);
    expect(CODIGO).not.toMatch(/grant[^;]*obs_base/i);
    expect(CODIGO).toMatch(/revoke execute on function public\.obs_base\([^)]*\) from public, anon, authenticated;/);
    ['obs_zonas', 'obs_resumen', 'obs_por_mes', 'obs_por_categoria', 'obs_hijos'].forEach((fn) =>
      expect(CODIGO, fn).toMatch(new RegExp(`grant\\s+execute on function public\\.${fn}\\([^)]*\\)\\s+to authenticated;`))
    );
  });

  it('UT-OBS-F0a-2: Vulnerabilidad social queda afuera y el umbral es 5', () => {
    expect(CODIGO).toMatch(/s\.service_code <> 'VULNERABILIDAD_SOCIAL'/);
    expect(CODIGO).toMatch(/obs_min_casos\(\)[\s\S]*?select 5/);
  });

  it('UT-OBS-F0a-3: los plazos son los del PO (03/11)', () => {
    expect(CODIGO).toMatch(/'INFRAESTRUCTURA',\s+90/);
    expect(CODIGO).toMatch(/'TRANSITO',\s+7/);
    expect(CODIGO).toMatch(/'AMBIENTE',\s+7/);
    expect(CODIGO).toMatch(/'COMERCIO_IRREGULAR',\s+30/);
  });

  it('UT-OBS-F0a-4: las funciones públicas no devuelven ids de reporte, coordenadas, direcciones ni textos', () => {
    // Columnas de salida de cada «returns table (...)» de las funciones que se otorgan
    const salidas = [...CODIGO.matchAll(/function public\.(obs_\w+)\([\s\S]*?returns table \(([\s\S]*?)\)\s*language/g)]
      .filter(([, fn]) => fn !== 'obs_base')
      .map(([, , cols]) => cols)
      .join('\n');
    expect(salidas).not.toMatch(/report_id|latitud|longitud|address|description|image|user_id/);
  });

  it('UT-OBS-F0a-5: tiene reversión documentada', () => {
    expect(SQL).toMatch(/REVERSIÓN:[\s\S]*drop table if exists public\.observatorio_plazos;/);
  });
});

describe('OBS-F0a · observatorioService', () => {
  beforeEach(() => rpc.mockReset());

  it('UT-OBS-F0a-6: el país va sin zona y los demás niveles la exigen', () => {
    expect(paramsDeFiltro({ nivel: 'pais', zona: 'x' })).toEqual({ p_nivel: 'pais', p_zona: null, p_desde: null, p_hasta: null });
    expect(() => paramsDeFiltro({ nivel: 'subdivision' })).toThrow(/Falta la zona/);
    expect(() => paramsDeFiltro({ nivel: 'barrio', zona: 'x' })).toThrow(/Nivel desconocido/);
  });

  it('UT-OBS-F0a-7: el resumen convierte los numeric y deja null lo que la base ocultó', async () => {
    rpc.mockResolvedValue({
      data: [{ reportes: 4, resueltos: 1, pct_resueltos: null, mediana_dias: null, p90_dias: null, elegibles_plazo: 2, en_plazo: 0, pct_en_plazo: null, abiertos: 3 }],
      error: null,
    });
    const r = await fetchResumen({ nivel: 'localidad', zona: 'loc-1' });
    expect(rpc).toHaveBeenCalledWith('obs_resumen', { p_nivel: 'localidad', p_zona: 'loc-1', p_desde: null, p_hasta: null, p_categoria: null });
    expect(r).toMatchObject({ reportes: 4, pctResueltos: null, medianaDias: null, abiertos: 3 });

    rpc.mockResolvedValue({ data: [{ reportes: 518, resueltos: 5, pct_resueltos: '1.0', mediana_dias: '7.8', p90_dias: '13.3' }], error: null });
    expect(await fetchResumen({ nivel: 'pais' })).toMatchObject({ pctResueltos: 1, medianaDias: 7.8, p90Dias: 13.3 });
  });

  it('UT-OBS-F0a-8: la torta no se filtra por categoría', async () => {
    rpc.mockResolvedValue({ data: [{ service_code: 'TRANSITO', service_name: 'Tránsito', reportes: 180, resueltos: 2, pct_resueltos: '1.1', mediana_dias: null, plazo_dias: 7 }], error: null });
    const filas = await fetchPorCategoria({ nivel: 'pais', categoria: 'AMBIENTE' });
    expect(rpc).toHaveBeenCalledWith('obs_por_categoria', { p_nivel: 'pais', p_zona: null, p_desde: null, p_hasta: null });
    expect(filas[0]).toEqual({ categoria: 'TRANSITO', nombre: 'Tránsito', reportes: 180, resueltos: 2, pctResueltos: 1.1, medianaDias: null, plazoDias: 7 });
  });

  it('UT-OBS-F0a-9: por mes separa el total del mes (categoría null) de cada categoría', async () => {
    rpc.mockResolvedValue({ data: [{ mes: '2026-10-01', service_code: null, reportes: 312, resueltos: 3, pct_resueltos: '1.0' }, { mes: '2026-10-01', service_code: 'AMBIENTE', reportes: 80, resueltos: 0, pct_resueltos: '0.0' }], error: null });
    const filas = await fetchPorMes({ nivel: 'pais', categoria: 'AMBIENTE' });
    expect(rpc.mock.calls[0][1].p_categoria).toBe('AMBIENTE');
    expect(filas.map((f) => f.categoria)).toEqual([null, 'AMBIENTE']);
  });

  it('UT-OBS-F0a-10: la localidad no tiene hijos y no consulta la base', async () => {
    expect(await fetchHijos({ nivel: 'localidad', zona: 'loc-1' })).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('UT-OBS-F0a-11: un error de la base se propaga (la pantalla muestra el estado de error)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'permission denied for function obs_resumen' } });
    await expect(fetchResumen({ nivel: 'pais' })).rejects.toMatchObject({ message: /permission denied/ });
  });
});
