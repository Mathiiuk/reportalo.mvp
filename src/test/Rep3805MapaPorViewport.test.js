/**
 * @file Rep3805MapaPorViewport.test.js
 * @description REP-3805: el mapa deja de depender de un «limit 200» global y consulta los reportes de la zona visible.
 * Cubre el servicio (consulta por límites geográficos, límite defensivo sin truncar en silencio), los cálculos de
 * viewport (relleno, contención, cuándo hace falta volver a consultar) y el hook (debounce, respuestas viejas, falla).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const queryResult = { data: [], error: null };
const calls = [];

vi.mock('../lib/supabaseClient', () => {
  const builder = {};
  for (const name of ['select', 'not', 'gte', 'lte', 'order']) {
    builder[name] = vi.fn((...args) => {
      calls.push([name, ...args]);
      return builder;
    });
  }
  builder.limit = vi.fn(async (...args) => {
    calls.push(['limit', ...args]);
    return queryResult;
  });
  return { isSupabaseConfigured: true, supabase: { from: vi.fn(() => builder) } };
});

import {
  MAP_REPORTS_LIMIT,
  getPublicMapReports,
  padBounds,
  boundsContain,
  boundsArea,
  shouldRefetchViewport,
} from '../services/mapReportsService';
import { useViewportReports, VIEWPORT_DEBOUNCE_MS, INITIAL_FALLBACK_MS } from '../hooks/useViewportReports';

const fila = (n, extra = {}) => ({
  id: `rep-${n}`,
  description: `Reporte ${n} con descripción suficiente.`,
  latitud: -34.6 - n / 10000,
  longitud: -58.4 - n / 10000,
  current_state_code: 'EN_ANALISIS',
  created_at: '2026-09-01T10:00:00Z',
  services: { service_name: 'Tránsito' },
  localities: { name: 'Almagro' },
  ...extra,
});
const filas = (n) => Array.from({ length: n }, (_, i) => fila(i + 1));
const VIEW = { west: -58.45, south: -34.65, east: -58.35, north: -34.58 };

describe('REP-3805: getPublicMapReports por zona visible', () => {
  beforeEach(() => {
    calls.length = 0;
    queryResult.data = [];
    queryResult.error = null;
  });

  it('UT-V3805-01: con límites geográficos filtra por longitud y latitud (no por «los últimos 200»)', async () => {
    await getPublicMapReports({ bounds: VIEW });

    expect(calls).toContainEqual(['gte', 'longitud', VIEW.west]);
    expect(calls).toContainEqual(['lte', 'longitud', VIEW.east]);
    expect(calls).toContainEqual(['gte', 'latitud', VIEW.south]);
    expect(calls).toContainEqual(['lte', 'latitud', VIEW.north]);
  });

  it('UT-V3805-02: pide el columnado de siempre: no amplía lo que el mapa expone (sin usuario, fotos ni análisis)', async () => {
    await getPublicMapReports({ bounds: VIEW });
    const columnas = calls.find((c) => c[0] === 'select')[1];
    expect(columnas).not.toMatch(/user_id|report_images|report_ai|client_side_id|image/);
  });

  it('UT-V3805-03: pide un registro de más que el límite para saber si llegó al tope, y no devuelve ese extra', async () => {
    queryResult.data = filas(MAP_REPORTS_LIMIT + 1);
    const r = await getPublicMapReports({ bounds: VIEW });

    expect(calls).toContainEqual(['limit', MAP_REPORTS_LIMIT + 1]);
    expect(r.truncated).toBe(true);
    expect(r.reports).toHaveLength(MAP_REPORTS_LIMIT);
  });

  it('UT-V3805-04: con exactamente el límite NO se marca como truncado (no hay nada oculto)', async () => {
    queryResult.data = filas(MAP_REPORTS_LIMIT);
    const r = await getPublicMapReports({ bounds: VIEW });
    expect(r.truncated).toBe(false);
    expect(r.reports).toHaveLength(MAP_REPORTS_LIMIT);
  });

  it('UT-V3805-05: con pocos reportes devuelve todos y no está truncado', async () => {
    queryResult.data = filas(3);
    expect(await getPublicMapReports({ bounds: VIEW })).toMatchObject({ success: true, truncated: false });
  });

  it('UT-V3805-06: sin límites geográficos conserva la consulta global anterior, pero igual avisa si se truncó', async () => {
    queryResult.data = filas(MAP_REPORTS_LIMIT + 1);
    const r = await getPublicMapReports();

    expect(calls.some((c) => c[0] === 'gte' || c[0] === 'lte')).toBe(false);
    expect(calls).toContainEqual(['not', 'latitud', 'is', null]);
    expect(r.truncated).toBe(true);
  });

  it('UT-V3805-07: ante un error devuelve lista vacía, el motivo y no truncado', async () => {
    queryResult.error = { message: 'RLS denied' };
    expect(await getPublicMapReports({ bounds: VIEW })).toEqual({ success: false, reports: [], error: 'RLS denied' });
  });

  it('UT-V3805-08: el límite por consulta sigue siendo 200', () => {
    expect(MAP_REPORTS_LIMIT).toBe(200);
  });
});

describe('REP-3805: cálculos de viewport', () => {
  it('UT-V3805-09: padBounds agranda la zona en cada lado y boundsContain lo verifica', () => {
    const padded = padBounds(VIEW, 0.2);
    expect(padded.west).toBeLessThan(VIEW.west);
    expect(padded.east).toBeGreaterThan(VIEW.east);
    expect(padded.south).toBeLessThan(VIEW.south);
    expect(padded.north).toBeGreaterThan(VIEW.north);
    expect(boundsContain(padded, VIEW)).toBe(true);
    expect(boundsContain(VIEW, padded)).toBe(false);
    expect(boundsArea(padded)).toBeGreaterThan(boundsArea(VIEW));
  });

  it('UT-V3805-10: sin consulta previa hay que consultar', () => {
    expect(shouldRefetchViewport(null, VIEW)).toBe(true);
  });

  it('UT-V3805-11: una pequeña panorámica dentro de lo ya cargado no vuelve a consultar', () => {
    const prev = { bounds: padBounds(VIEW, 0.2), truncated: false };
    const movida = { west: VIEW.west + 0.01, east: VIEW.east + 0.01, south: VIEW.south, north: VIEW.north };
    expect(shouldRefetchViewport(prev, movida)).toBe(false);
  });

  it('UT-V3805-12: salirse de lo cargado obliga a consultar', () => {
    const prev = { bounds: padBounds(VIEW, 0.2), truncated: false };
    const lejos = { west: VIEW.west - 0.2, east: VIEW.east - 0.2, south: VIEW.south, north: VIEW.north };
    expect(shouldRefetchViewport(prev, lejos)).toBe(true);
  });

  it('UT-V3805-13: acercar el mapa sobre una zona que se había truncado vuelve a consultar (para ver los que faltaban)', () => {
    const prev = { bounds: padBounds(VIEW, 0.2), viewport: VIEW, truncated: true };
    const acercada = { west: -58.41, east: -58.39, south: -34.62, north: -34.60 };
    expect(shouldRefetchViewport(prev, acercada)).toBe(true);
  });

  it('UT-V3805-13b: la MISMA zona visible sobre una consulta truncada no reconsulta (el margen no cuenta como «acercar»)', () => {
    const prev = { bounds: padBounds(VIEW, 0.2), viewport: VIEW, truncated: true };
    expect(shouldRefetchViewport(prev, VIEW)).toBe(false);
    expect(shouldRefetchViewport(prev, { ...VIEW, west: VIEW.west + 0.001 })).toBe(false);
  });

  it('UT-V3805-14: acercar el mapa sobre una zona completa no vuelve a consultar', () => {
    const prev = { bounds: padBounds(VIEW, 0.2), truncated: false };
    const acercada = { west: -58.41, east: -58.39, south: -34.62, north: -34.60 };
    expect(shouldRefetchViewport(prev, acercada)).toBe(false);
  });
});

describe('REP-3805: useViewportReports', () => {
  let fetchReports;
  beforeEach(() => {
    vi.useFakeTimers();
    fetchReports = vi.fn().mockResolvedValue({ success: true, reports: [{ id: 'a' }], truncated: false });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const montar = (extra = {}) => renderHook(() => useViewportReports({ fetchReports, ...extra }));
  const avanzar = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

  it('UT-V3805-15: consulta con la zona visible (más un margen) cuando el mapa termina de moverse', async () => {
    const { result } = montar();
    act(() => result.current.onViewportChange(VIEW));
    await avanzar(VIEWPORT_DEBOUNCE_MS);

    expect(fetchReports).toHaveBeenCalledTimes(1);
    const { bounds } = fetchReports.mock.calls[0][0];
    expect(boundsContain(bounds, VIEW)).toBe(true);
    expect(result.current.reports).toEqual([{ id: 'a' }]);
    expect(result.current.isLoading).toBe(false);
  });

  it('UT-V3805-16: varios movimientos seguidos son una sola consulta (debounce), con la última zona', async () => {
    const { result } = montar();
    const zona = (d) => ({ west: VIEW.west + d, east: VIEW.east + d, south: VIEW.south, north: VIEW.north });
    act(() => result.current.onViewportChange(zona(0)));
    await avanzar(VIEWPORT_DEBOUNCE_MS - 50);
    act(() => result.current.onViewportChange(zona(0.3)));
    await avanzar(VIEWPORT_DEBOUNCE_MS - 50);
    act(() => result.current.onViewportChange(zona(0.6)));
    await avanzar(VIEWPORT_DEBOUNCE_MS);

    expect(fetchReports).toHaveBeenCalledTimes(1);
    expect(boundsContain(fetchReports.mock.calls[0][0].bounds, zona(0.6))).toBe(true);
  });

  it('UT-V3805-17: moverse dentro de lo ya cargado no genera otra consulta', async () => {
    const { result } = montar();
    act(() => result.current.onViewportChange(VIEW));
    await avanzar(VIEWPORT_DEBOUNCE_MS);
    act(() => result.current.onViewportChange({ ...VIEW, west: VIEW.west + 0.005, east: VIEW.east + 0.005 }));
    await avanzar(VIEWPORT_DEBOUNCE_MS);

    expect(fetchReports).toHaveBeenCalledTimes(1);
  });

  it('UT-V3805-17b: dos avisos de la misma zona mientras la primera consulta sigue en curso son UN solo pedido', async () => {
    fetchReports.mockImplementation(() => new Promise(() => {})); // nunca responde
    const { result } = montar();
    act(() => result.current.onViewportChange(VIEW));
    await avanzar(VIEWPORT_DEBOUNCE_MS);
    act(() => result.current.onViewportChange({ ...VIEW }));
    await avanzar(VIEWPORT_DEBOUNCE_MS);

    expect(fetchReports).toHaveBeenCalledTimes(1);
  });

  it('UT-V3805-17c: si la consulta en curso falla, la misma zona se puede volver a pedir', async () => {
    fetchReports.mockResolvedValueOnce({ success: false, reports: [], error: 'sin red' });
    const { result } = montar();
    act(() => result.current.onViewportChange(VIEW));
    await avanzar(VIEWPORT_DEBOUNCE_MS);
    act(() => result.current.onViewportChange(VIEW));
    await avanzar(VIEWPORT_DEBOUNCE_MS);

    expect(fetchReports).toHaveBeenCalledTimes(2);
    expect(result.current.reports).toEqual([{ id: 'a' }]);
  });

  it('UT-V3805-18: expone si la zona llegó al tope (para avisar «acercá el mapa»)', async () => {
    fetchReports.mockResolvedValue({ success: true, reports: [{ id: 'a' }], truncated: true });
    const { result } = montar();
    act(() => result.current.onViewportChange(VIEW));
    await avanzar(VIEWPORT_DEBOUNCE_MS);

    expect(result.current.truncated).toBe(true);
  });

  it('UT-V3805-19: una respuesta vieja no pisa a una más nueva', async () => {
    let resolverPrimera;
    fetchReports
      .mockImplementationOnce(() => new Promise((resolve) => { resolverPrimera = resolve; }))
      .mockResolvedValueOnce({ success: true, reports: [{ id: 'nueva' }], truncated: false });
    const { result } = montar();

    act(() => result.current.onViewportChange(VIEW));
    await avanzar(VIEWPORT_DEBOUNCE_MS);
    const lejos = { west: -58.60, east: -58.5, south: -34.65, north: -34.58 };
    act(() => result.current.onViewportChange(lejos));
    await avanzar(VIEWPORT_DEBOUNCE_MS);
    expect(result.current.reports).toEqual([{ id: 'nueva' }]);

    await act(async () => { resolverPrimera({ success: true, reports: [{ id: 'vieja' }], truncated: false }); });
    expect(result.current.reports).toEqual([{ id: 'nueva' }]);
  });

  it('UT-V3805-20: si una consulta falla conserva los reportes que ya tenía y expone el error', async () => {
    const { result } = montar();
    act(() => result.current.onViewportChange(VIEW));
    await avanzar(VIEWPORT_DEBOUNCE_MS);

    fetchReports.mockResolvedValue({ success: false, reports: [], error: 'sin red' });
    act(() => result.current.onViewportChange({ west: -58.6, east: -58.5, south: -34.65, north: -34.58 }));
    await avanzar(VIEWPORT_DEBOUNCE_MS);

    expect(result.current.reports).toEqual([{ id: 'a' }]);
    expect(result.current.error).toBe('sin red');
    expect(result.current.isLoading).toBe(false);
  });

  it('UT-V3805-21: si el mapa nunca avisa su zona (sin WebGL), carga igual la zona completa tras una espera', async () => {
    const { result } = montar();
    expect(fetchReports).not.toHaveBeenCalled();
    await avanzar(INITIAL_FALLBACK_MS);

    expect(fetchReports).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
  });

  it('UT-V3805-22: si el mapa avisa su zona a tiempo, no se dispara la carga de respaldo', async () => {
    const { result } = montar();
    act(() => result.current.onViewportChange(VIEW));
    await avanzar(INITIAL_FALLBACK_MS * 2);
    expect(fetchReports).toHaveBeenCalledTimes(1);
  });

  it('UT-V3805-23: con la carga por zona desactivada (reversión) hace una sola consulta global y no reacciona al mapa', async () => {
    const { result } = montar({ enabled: false });
    await avanzar(0);
    expect(fetchReports).toHaveBeenCalledTimes(1);
    expect(fetchReports.mock.calls[0][0].bounds).toBeUndefined();

    act(() => result.current.onViewportChange(VIEW));
    await avanzar(VIEWPORT_DEBOUNCE_MS * 2);
    expect(fetchReports).toHaveBeenCalledTimes(1);
  });

  it('UT-V3805-24: al desmontar no quedan timers vivos ni se actualiza el estado', async () => {
    const { result, unmount } = montar();
    act(() => result.current.onViewportChange(VIEW));
    unmount();
    await avanzar(VIEWPORT_DEBOUNCE_MS * 3);
    expect(vi.getTimerCount()).toBe(0);
  });
});
