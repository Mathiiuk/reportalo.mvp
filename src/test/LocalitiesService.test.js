/**
 * @file LocalitiesService.test.js
 * @description Pruebas del selector manual de localidad (REP-2500, Opción 1).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();

vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: vi.fn(() => ({ select: mockSelect })),
  },
}));

import { getSelectableLocalities, formatLocalityLabel, normalizeForSearch } from '../services/localitiesService';

describe('REP-2500: formatLocalityLabel (R-1)', () => {
  it('arma "Localidad — Partido/Comuna, Provincia"', () => {
    expect(
      formatLocalityLabel({ localityName: 'Avellaneda', subdivisionName: 'Avellaneda', provinceName: 'Buenos Aires' })
    ).toBe('Avellaneda — Avellaneda, Buenos Aires');
  });
});

describe('REP-2500: normalizeForSearch (R-5)', () => {
  it('quita tildes y pasa a minúsculas', () => {
    expect(normalizeForSearch('Piñeyro')).toBe('pineyro');
    expect(normalizeForSearch('San Nicolás')).toBe('san nicolas');
  });
});

describe('REP-2500: getSelectableLocalities (R-2)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('incluye CABA y el partido de Avellaneda (BA), excluye Avellaneda (Santa Fe)', async () => {
    mockSelect.mockResolvedValue({
      data: [
        { id: 'l1', name: 'Retiro', subdivisions: { name: 'Comuna 1', states_provinces: { name: 'Ciudad Autónoma de Buenos Aires' } } },
        { id: 'l2', name: 'Piñeyro', subdivisions: { name: 'Avellaneda', states_provinces: { name: 'Buenos Aires' } } },
        { id: 'l3', name: 'Avellaneda', subdivisions: { name: 'Avellaneda', states_provinces: { name: 'Santa Fe' } } },
      ],
      error: null,
    });

    const result = await getSelectableLocalities();

    expect(result.success).toBe(true);
    const ids = result.localities.map((l) => l.id);
    expect(ids).toContain('l1');
    expect(ids).toContain('l2');
    expect(ids).not.toContain('l3');
  });

  it('cada opción trae label (R-1) y searchKey sin tildes (R-5)', async () => {
    mockSelect.mockResolvedValue({
      data: [
        { id: 'l1', name: 'Piñeyro', subdivisions: { name: 'Avellaneda', states_provinces: { name: 'Buenos Aires' } } },
      ],
      error: null,
    });

    const result = await getSelectableLocalities();

    expect(result.localities[0]).toEqual({
      id: 'l1',
      label: 'Piñeyro — Avellaneda, Buenos Aires',
      searchKey: 'pineyro — avellaneda, buenos aires',
    });
  });

  it('devuelve error si falla la consulta', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: 'timeout' } });

    const result = await getSelectableLocalities();

    expect(result.success).toBe(false);
    expect(result.localities).toEqual([]);
  });
});

