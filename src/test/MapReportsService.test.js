/**
 * @file MapReportsService.test.js
 * @description H-36: el mapa de inicio se alimenta de citizen_reports, no de datos de prueba.
 *
 * Antes CitizenMap importaba src/data/mockReports.js, asi que la pantalla principal de la
 * app mostraba cinco reclamos inventados, con categorias que no existen en la base, y
 * "Ver el reporte" navegaba a un detalle que devolvia "No encontramos este reporte".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryResult = { data: null, error: null };

vi.mock('../lib/supabaseClient', () => {
  const builder = {
    select: vi.fn(() => builder),
    not: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(async () => queryResult),
  };
  return {
    isSupabaseConfigured: true,
    supabase: { from: vi.fn(() => builder) },
  };
});

import { getPublicMapReports, mapRowToMarker } from '../services/mapReportsService';

const row = (overrides = {}) => ({
  id: 'rep-1',
  description: 'Bache profundo sobre la calzada. Dificulta el paso de los autos.',
  latitud: -34.6037,
  longitud: -58.3816,
  current_state_code: 'EN_ANALISIS',
  created_at: '2026-08-24T14:00:00Z',
  services: { service_name: 'Infraestructura' },
  localities: { name: 'San Nicolás' },
  ...overrides,
});

describe('REP-3787 H-36: reportes reales en el mapa', () => {
  beforeEach(() => {
    queryResult.data = null;
    queryResult.error = null;
  });

  it('UT-MAP-01: traduce el codigo de estado de la base a la etiqueta del §10', () => {
    expect(mapRowToMarker(row()).status).toBe('En revisión');
    expect(mapRowToMarker(row({ current_state_code: 'DERIVADO' })).status).toBe('Notificado al responsable');
    expect(mapRowToMarker(row({ current_state_code: 'DESESTIMADO' })).status).toBe('Descartado');
  });

  it('UT-MAP-02: entrega las coordenadas en el orden que espera MapLibre', () => {
    // MapLibre usa [lng, lat], al reves que la intuicion. Invertirlo pone los
    // reportes de Buenos Aires en el oceano Indico.
    expect(mapRowToMarker(row()).coordinates).toEqual([-58.3816, -34.6037]);
  });

  it('UT-MAP-03: arma el titulo con la primera oracion y conserva la descripcion entera', () => {
    const marker = mapRowToMarker(row());
    expect(marker.title).toBe('Bache profundo sobre la calzada');
    expect(marker.description).toContain('Dificulta el paso de los autos');
  });

  it('UT-MAP-04: una descripcion vacia no deja la tarjeta sin titulo', () => {
    expect(mapRowToMarker(row({ description: null })).title).toBe('Reporte sin descripción');
  });

  it('UT-MAP-05: descarta las filas cuyas coordenadas no se pueden dibujar', async () => {
    // Un NaN en las coordenadas rompe el mapa entero, no solo ese marcador.
    queryResult.data = [row(), row({ id: 'rep-2', latitud: null, longitud: null })];

    const result = await getPublicMapReports();

    expect(result.success).toBe(true);
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0].id).toBe('rep-1');
  });

  it('UT-MAP-06: si la consulta falla devuelve lista vacia, no datos inventados', async () => {
    queryResult.error = { message: 'RLS denied' };

    const result = await getPublicMapReports();

    expect(result.success).toBe(false);
    expect(result.reports).toEqual([]);
    expect(result.error).toBe('RLS denied');
  });
});
