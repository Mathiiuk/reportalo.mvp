/**
 * @file Rep3001LecturaVecino.test.js
 * @description REP-3001: lo que ve el vecino en «Mis reportes» después de una acción del operador (reglas del PO §6):
 * la misma etiqueta que el panel, todos los estados por los que pasó, el motivo, a quién se escaló, y «tomado» sin
 * presentarlo nunca como Resuelto.
 */
import { describe, it, expect, vi } from 'vitest';

const fromMock = vi.fn();
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { from: (...args) => fromMock(...args) },
}));

import { buildTimeline, getStatusConfig } from '../components/report/reportStatus';
import { getReportTakenEvent, getReportStateHistory } from '../services/reportDetailService';

const H = (state_code, changed_at, extra = {}) => ({ id: `${state_code}-${changed_at}`, state_code, changed_at, notes: null, ...extra });
const HISTORIAL = [H('RECIBIDO', '2026-10-25T10:00:00Z'), H('EN_ANALISIS', '2026-10-25T10:01:00Z'), H('DERIVADO', '2026-10-25T11:00:00Z')];
const TOMADO = { taken_at: '2026-10-26T09:00:00Z', agency: 'Reportalo CABA (organismo de prueba)' };

// Cadena de consulta mínima de supabase-js
const consulta = (resultado) => {
  const q = {};
  for (const m of ['select', 'eq', 'order', 'limit']) q[m] = vi.fn(() => q);
  q.maybeSingle = vi.fn(async () => resultado);
  q.then = (ok) => Promise.resolve(resultado).then(ok);
  return q;
};

describe('REP-3001 · lectura del vecino', () => {
  it('UT-3001-V1: misma etiqueta que el panel (Derivado, Escalado, En discrepancia, Resuelto, Desestimado)', () => {
    expect(getStatusConfig('DERIVADO').label).toBe('Derivado');
    expect(getStatusConfig('ESCALADO').label).toBe('Escalado');
    expect(getStatusConfig('EN_DISCREPANCIA').label).toBe('En discrepancia');
    expect(getStatusConfig('RESUELTO').label).toBe('Resuelto');
    expect(getStatusConfig('DESESTIMADO').label).toBe('Desestimado');
  });

  it('UT-3001-V2: «tomado» aparece después de Derivado, con el organismo, y el reporte NO figura Resuelto', () => {
    const pasos = buildTimeline({ currentState: 'DERIVADO', createdAt: '2026-10-25T10:00:00Z', history: HISTORIAL, taken: TOMADO });
    const claves = pasos.map((p) => p.key);
    expect(claves.indexOf('tomado')).toBe(claves.indexOf('notificado') + 1);
    const tomado = pasos.find((p) => p.key === 'tomado');
    expect(tomado.label).toBe('El organismo tomó tu reporte');
    expect(tomado.detail).toBe('Reportalo CABA (organismo de prueba)');
    expect(tomado.date).toBeTruthy();
    expect(pasos.find((p) => p.key === 'resuelto').done).toBe(false);
    expect(pasos.find((p) => p.key === 'notificado').current).toBe(true);
  });

  it('UT-3001-V3: Escalado muestra motivo y a quién, sin afirmar un envío real', () => {
    const pasos = buildTimeline({
      currentState: 'ESCALADO',
      createdAt: '2026-10-25T10:00:00Z',
      history: [...HISTORIAL, H('ESCALADO', '2026-10-27T10:00:00Z', { notes: 'Es una autopista', escalated_to: 'Concesionaria AUSA' })],
    });
    const escalado = pasos.find((p) => p.key === 'escalado');
    expect(escalado.current).toBe(true);
    expect(escalado.note).toBe('Es una autopista');
    expect(escalado.detail).toBe('El organismo indicó que corresponde a: Concesionaria AUSA');
    // El paso extra queda antes de Resuelto, que sigue pendiente
    const claves = pasos.map((p) => p.key);
    expect(claves.indexOf('escalado')).toBeLessThan(claves.indexOf('resuelto'));
  });

  it('UT-3001-V4: todos los estados por los que pasó: Derivado → Escalado → Resuelto con su motivo', () => {
    const pasos = buildTimeline({
      currentState: 'RESUELTO',
      createdAt: '2026-10-25T10:00:00Z',
      history: [
        ...HISTORIAL,
        H('ESCALADO', '2026-10-27T10:00:00Z', { notes: 'Es una autopista', escalated_to: 'AUSA' }),
        H('RESUELTO', '2026-10-28T10:00:00Z', { notes: 'Se reparó el 28/10' }),
      ],
      taken: TOMADO,
    });
    expect(pasos.map((p) => p.key)).toEqual(['enviado', 'en_revision', 'notificado', 'tomado', 'escalado', 'resuelto']);
    expect(pasos.every((p) => p.done)).toBe(true);
    expect(pasos.find((p) => p.key === 'escalado').current).toBe(false);
    expect(pasos.find((p) => p.key === 'resuelto')).toMatchObject({ current: true, note: 'Se reparó el 28/10' });
  });

  it('UT-3001-V5: Desestimado y En discrepancia muestran el motivo', () => {
    const desestimado = buildTimeline({
      currentState: 'DESESTIMADO',
      createdAt: '2026-10-25T10:00:00Z',
      history: [...HISTORIAL, H('DESESTIMADO', '2026-10-27T10:00:00Z', { notes: 'No hay un problema en la vía pública' })],
    });
    expect(desestimado.at(-1)).toMatchObject({ key: 'descartado', label: 'Desestimado', note: 'No hay un problema en la vía pública' });
    const discrepancia = buildTimeline({
      currentState: 'EN_DISCREPANCIA',
      createdAt: '2026-10-25T10:00:00Z',
      history: [...HISTORIAL, H('EN_DISCREPANCIA', '2026-10-27T10:00:00Z', { notes: 'No hay bache en esa altura' })],
    });
    expect(discrepancia.find((p) => p.key === 'en_discrepancia')).toMatchObject({ current: true, note: 'No hay bache en esa altura' });
  });

  it('UT-3001-V6: el vecino lee el «tomado» de report_events con el nombre del organismo y el destino del historial', async () => {
    const q = consulta({ data: { occurred_at: TOMADO.taken_at, agencies: { name: TOMADO.agency } }, error: null });
    fromMock.mockReturnValueOnce(q);
    expect(await getReportTakenEvent('r1')).toEqual(TOMADO);
    expect(fromMock).toHaveBeenCalledWith('report_events');
    expect(q.eq).toHaveBeenCalledWith('event_type_code', 'TOMADO_POR_ORGANISMO');
    expect(q.select.mock.calls[0][0]).not.toMatch(/actor_profile_id/);

    const h = consulta({ data: [], error: null });
    fromMock.mockReturnValueOnce(h);
    await getReportStateHistory('r1');
    expect(h.select.mock.calls[0][0]).toMatch(/escalated_to/);
  });
});
