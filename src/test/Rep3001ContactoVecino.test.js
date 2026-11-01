/**
 * @file Rep3001ContactoVecino.test.js
 * @description REP-3001 (decisión 3A): el vecino ve el contacto del destino del escalado junto a «corresponde a»,
 * para seguir el reclamo. Es un dato que carga el operador; no es del vecino.
 */
import { describe, it, expect, vi } from 'vitest';

const fromMock = vi.fn();
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { from: (...args) => fromMock(...args) },
}));

import { buildTimeline } from '../components/report/reportStatus';
import { getReportStateHistory } from '../services/reportDetailService';

const H = (state_code, changed_at, extra = {}) => ({ id: `${state_code}-${changed_at}`, state_code, changed_at, notes: null, ...extra });

describe('REP-3001 · contacto del escalado para el vecino', () => {
  it('UT-3001-C1: la línea de tiempo suma el contacto al destino', () => {
    const pasos = buildTimeline({
      currentState: 'ESCALADO',
      createdAt: '2026-10-25T10:00:00Z',
      history: [
        H('RECIBIDO', '2026-10-25T10:00:00Z'),
        H('DERIVADO', '2026-10-25T11:00:00Z'),
        H('ESCALADO', '2026-10-27T10:00:00Z', { notes: 'Es una autopista', escalated_to: 'AUSA', escalated_contact: 'contacto@ausa.ar' }),
      ],
    });
    expect(pasos.find((p) => p.key === 'escalado').detail).toBe(
      'El organismo indicó que corresponde a: AUSA · Contacto: contacto@ausa.ar'
    );
  });

  it('UT-3001-C2: sin contacto queda como antes', () => {
    const pasos = buildTimeline({
      currentState: 'ESCALADO',
      createdAt: '2026-10-25T10:00:00Z',
      history: [H('ESCALADO', '2026-10-27T10:00:00Z', { escalated_to: 'AUSA' })],
    });
    expect(pasos.find((p) => p.key === 'escalado').detail).toBe('El organismo indicó que corresponde a: AUSA');
  });

  it('UT-3001-C3: el historial del vecino pide el contacto', async () => {
    const q = {};
    for (const m of ['select', 'eq', 'order']) q[m] = vi.fn(() => q);
    q.then = (ok) => Promise.resolve({ data: [], error: null }).then(ok);
    fromMock.mockReturnValueOnce(q);
    await getReportStateHistory('r1');
    expect(q.select.mock.calls[0][0]).toMatch(/escalated_contact/);
  });
});
