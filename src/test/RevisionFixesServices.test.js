/**
 * @file RevisionFixesServices.test.js
 * @description Arreglos de servicios salidos de la revision de codigo de la rama REP-3787.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const attachedRows = { data: [], error: null };
const historyCalls = [];

vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: vi.fn((table) => {
      if (table === 'report_images') {
        return { select: () => ({ eq: async () => attachedRows }) };
      }
      if (table === 'citizen_reports') {
        return {
          select: () => ({
            eq: async () => ({
              // 120 reportes: mas que el tope de ids que admite el `in` del historial
              data: Array.from({ length: 120 }, (_, i) => ({
                id: `rep-${String(i).padStart(3, '0')}`,
                created_at: new Date(2026, 0, 1 + i).toISOString(),
              })),
              error: null,
            }),
          }),
        };
      }
      return {
        select: () => ({
          in: (_col, ids) => {
            historyCalls.push(ids);
            return { order: () => ({ limit: async () => ({ data: [], error: null }) }) };
          },
        }),
      };
    }),
  },
}));

vi.mock('../services/offlineStorageService', () => ({ getAllPendingSyncReports: vi.fn().mockResolvedValue([]) }));

import { getAttachedEvidenceUrls } from '../services/reportSubmissionService';
import { getMyNotifications } from '../services/notificationsService';

describe('Revision REP-3787: evidencia ya adjunta', () => {
  beforeEach(() => {
    attachedRows.data = [];
    attachedRows.error = null;
  });

  it('UT-FIX-03: devuelve las URLs ya registradas, para que el reintento no las duplique', async () => {
    attachedRows.data = [{ image_url: 'https://cdn.example/a.jpg' }, { image_url: 'https://cdn.example/b.jpg' }];
    const urls = await getAttachedEvidenceUrls('rep-1');
    expect(urls.has('https://cdn.example/a.jpg')).toBe(true);
    expect(urls.size).toBe(2);
  });

  it('UT-FIX-04: sin reportId devuelve vacio en vez de consultar', async () => {
    const urls = await getAttachedEvidenceUrls(null);
    expect(urls.size).toBe(0);
  });
});

describe('Revision REP-3787: tope de ids en la consulta del historial', () => {
  it('UT-FIX-05: no manda los 120 reportes en el `in`, que desbordaria la URL', async () => {
    historyCalls.length = 0;
    await getMyNotifications('u1');

    expect(historyCalls).toHaveLength(1);
    expect(historyCalls[0].length).toBeLessThanOrEqual(50);
    // Se consultan los mas recientes: rep-119 es el ultimo por created_at
    expect(historyCalls[0]).toContain('rep-119');
    expect(historyCalls[0]).not.toContain('rep-000');
  });
});
