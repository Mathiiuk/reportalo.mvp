import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));

vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(() => ({ select: mockSelect })) },
}));

import { resolveServiceDbId } from '../services/categoriesService';

// REP-2204: con las categorías de respaldo (sin dbId) el reporte se enviaba sin categoría.
describe('REP-2204: resolveServiceDbId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('UT-SVC-01: si la categoría ya trae el id de base lo usa sin consultar', async () => {
    expect(await resolveServiceDbId({ id: 'TRANSITO', dbId: 'uuid-1' })).toBe('uuid-1');
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('UT-SVC-02: sin dbId lo busca en services por service_code', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'uuid-2' }, error: null });

    expect(await resolveServiceDbId({ id: 'TRANSITO' })).toBe('uuid-2');
    expect(mockEq).toHaveBeenCalledWith('service_code', 'TRANSITO');
  });

  it('UT-SVC-03: si no lo encuentra o falla la consulta devuelve null (no inventa una categoría)', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await resolveServiceDbId({ id: 'NO_EXISTE' })).toBeNull();

    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    expect(await resolveServiceDbId({ id: 'TRANSITO' })).toBeNull();

    mockMaybeSingle.mockRejectedValueOnce(new Error('sin red'));
    expect(await resolveServiceDbId({ id: 'TRANSITO' })).toBeNull();
  });

  it('UT-SVC-04: sin categoría devuelve null', async () => {
    expect(await resolveServiceDbId(null)).toBeNull();
    expect(await resolveServiceDbId({})).toBeNull();
  });
});
