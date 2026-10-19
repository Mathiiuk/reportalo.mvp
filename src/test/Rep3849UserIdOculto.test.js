/**
 * @file Rep3849UserIdOculto.test.js
 * @description REP-3849 (O-03 de la QA REP-3832, caso C-16): un ciudadano puede ver el resumen de un reporte ajeno,
 * pero la API no debe entregarle el user_id del autor. El resumen ajeno sale de la vista public_citizen_reports
 * (sin user_id ni client_side_id) y citizen_reports queda solo para el dueño o quien atiende el reporte.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fromMock = vi.fn();
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { from: (...args) => fromMock(...args), storage: { from: vi.fn() } },
}));

import { getReportDetail, getReportStateSnapshot, PUBLIC_REPORTS_VIEW } from '../services/reportDetailService';
import { getPublicMapReports } from '../services/mapReportsService';

const OWN_ROW = { id: 'r1', client_side_id: 'csid-1', user_id: 'dueño', description: 'Bache', current_state_code: 'RECIBIDO' };
const PUBLIC_ROW = { id: 'r1', description: 'Bache', current_state_code: 'RECIBIDO' };

/**
 * Simula PostgREST con la RLS de la migración: citizen_reports solo devuelve la fila al dueño; la vista pública la
 * devuelve a cualquiera con sesión. Registra qué columnas se pidieron a cada tabla.
 */
const selects = {};
const armarSupabase = ({ sessionUser }) => {
  fromMock.mockImplementation((table) => {
    const chain = (rows) => {
      const q = {
        select: (cols) => {
          selects[table] = cols;
          return q;
        },
        eq: () => q,
        gte: () => q,
        lte: () => q,
        not: () => q,
        order: () => q,
        limit: async () => ({ data: rows, error: null }),
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      };
      return q;
    };
    if (table === 'citizen_reports') return chain(sessionUser === 'dueño' ? [OWN_ROW] : []);
    if (table === PUBLIC_REPORTS_VIEW) return chain([PUBLIC_ROW]);
    if (table === 'report_images') return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
    throw new Error(`tabla inesperada: ${table}`);
  });
};

describe('REP-3849 · el user_id del autor no sale hacia terceros', () => {
  beforeEach(() => {
    fromMock.mockReset();
    Object.keys(selects).forEach((k) => delete selects[k]);
  });

  it('UT-3849-01: el dueño lee su fila de citizen_reports y sigue viendo sus fotos', async () => {
    armarSupabase({ sessionUser: 'dueño' });
    const result = await getReportDetail('r1', 'dueño');
    expect(result.success).toBe(true);
    expect(result.data.user_id).toBe('dueño');
    expect(fromMock).toHaveBeenCalledWith('report_images');
    expect(fromMock).not.toHaveBeenCalledWith(PUBLIC_REPORTS_VIEW);
  });

  it('UT-3849-02: para otra cuenta el detalle sale de la vista pública, sin user_id ni client_side_id', async () => {
    armarSupabase({ sessionUser: 'otra-cuenta' });
    const result = await getReportDetail('r1', 'otra-cuenta');
    expect(result.success).toBe(true);
    expect(result.data.description).toBe('Bache');
    expect(result.data).not.toHaveProperty('user_id');
    expect(result.data).not.toHaveProperty('client_side_id');
    expect(result.data.report_images).toEqual([]);
    expect(selects[PUBLIC_REPORTS_VIEW]).not.toMatch(/user_id|client_side_id/);
    expect(fromMock).not.toHaveBeenCalledWith('report_images');
  });

  it('UT-3849-03: sin sesión ni siquiera se consulta citizen_reports', async () => {
    armarSupabase({ sessionUser: null });
    const result = await getReportDetail('r1', undefined);
    expect(result.success).toBe(true);
    expect(fromMock).not.toHaveBeenCalledWith('citizen_reports');
  });

  it('UT-3849-04: si tampoco está en la vista pública, el detalle responde NOT_FOUND', async () => {
    armarSupabase({ sessionUser: 'otra-cuenta' });
    fromMock.mockImplementation((table) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      table,
    }));
    const result = await getReportDetail('r-inexistente', 'otra-cuenta');
    expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
  });

  it('UT-3849-05: el mapa y el sondeo de estado leen la vista pública, no citizen_reports', async () => {
    armarSupabase({ sessionUser: 'otra-cuenta' });
    await getPublicMapReports();
    await getReportStateSnapshot('r1');
    expect(fromMock).not.toHaveBeenCalledWith('citizen_reports');
    expect(fromMock).toHaveBeenCalledWith(PUBLIC_REPORTS_VIEW);
    expect(selects[PUBLIC_REPORTS_VIEW]).not.toMatch(/user_id/);
  });
});

describe('REP-3849 · migración', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20261019122131_rep3849_vista_publica_sin_user_id.sql'),
    'utf8'
  );
  // Solo el código, sin los comentarios que explican la decisión
  const code = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  const viewBody = code.slice(code.indexOf('create or replace view'), code.indexOf('from public.citizen_reports r'));

  it('UT-3849-06: la vista pública no proyecta user_id ni client_side_id', () => {
    expect(viewBody).toContain('public.public_citizen_reports');
    expect(viewBody).not.toMatch(/user_id|client_side_id|\*/);
  });

  it('UT-3849-07: la vista es solo para usuarios con sesión', () => {
    expect(code).toMatch(/revoke all on public\.public_citizen_reports from public, anon, authenticated;/);
    expect(code).toMatch(/grant select on public\.public_citizen_reports to authenticated;/);
    expect(code).not.toMatch(/grant select on public\.public_citizen_reports to [^;]*anon/);
  });

  it('UT-3849-08: citizen_reports deja de ser de lectura pública y queda para el dueño o quien atiende', () => {
    expect(code).toMatch(/drop policy if exists "lectura_publica" on public\.citizen_reports;/);
    expect(code).toMatch(/user_id = \(select auth\.uid\(\)\)/);
    expect(code).toMatch(/public\.profile_attends_report\(\(select auth\.uid\(\)\), id\)/);
    expect(code).not.toMatch(/using \(\s*true\s*\)/);
  });
});
