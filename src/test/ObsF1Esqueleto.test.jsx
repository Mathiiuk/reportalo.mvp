/**
 * @file ObsF1Esqueleto.test.jsx
 * @description OBS · F1 · Marco del observatorio, Metodología, estados y formato.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rpc = vi.fn();
const order = vi.fn();
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...a) => rpc(...a),
    from: () => ({ select: () => ({ order: (...a) => order(...a) }) }),
  },
}));

const { ObservatorioPage } = await import('../pages/observatorio/ObservatorioPage');
const { fmtPct, fmtDias, fmtNum, desdeDePeriodo, textoPeriodo } = await import('../components/observatorio/obsFormat');

const abrir = (ruta) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/observatorio/*" element={<ObservatorioPage />} />
      </Routes>
    </MemoryRouter>
  );

const leer = (ruta) => readFileSync(resolve(__dirname, '..', ruta), 'utf8');

describe('OBS-F1 · formato', () => {
  it('UT-OBS-F1-1: null se muestra «—», nunca 0', () => {
    expect(fmtPct(null)).toBe('—');
    expect(fmtDias(null)).toBe('—');
    expect(fmtNum(undefined)).toBe('—');
    expect(fmtPct(0)).toBe('0 %');
  });

  it('UT-OBS-F1-2: números, porcentajes y días en castellano', () => {
    expect(fmtNum(1234)).toBe('1.234');
    expect(fmtPct(12.5)).toBe('12,5 %');
    expect(fmtDias(1)).toBe('1 día');
    expect(fmtDias(7.8)).toBe('7,8 días');
  });

  it('UT-OBS-F1-3: el período empieza el 1 del mes y se lee en palabras', () => {
    const hoy = new Date(2026, 10, 5); // 5 de noviembre de 2026
    expect(desdeDePeriodo('1', hoy)).toBe('2026-11-01');
    expect(desdeDePeriodo('3', hoy)).toBe('2026-09-01');
    expect(desdeDePeriodo('6', hoy)).toBe('2026-06-01');
    expect(textoPeriodo('6', hoy)).toBe('junio a noviembre de 2026');
    expect(textoPeriodo('1', hoy)).toBe('noviembre de 2026');
    expect(textoPeriodo('6', new Date(2027, 1, 10))).toBe('septiembre de 2026 a febrero de 2027');
  });
});

describe('OBS-F1 · marco y Metodología', () => {
  beforeEach(() => {
    rpc.mockReset();
    order.mockReset();
    rpc.mockResolvedValue({
      data: [{ reportes: 518, resueltos: 5, pct_resueltos: '1.0', mediana_dias: '7.8', p90_dias: '12.3', elegibles_plazo: 300, en_plazo: 2, pct_en_plazo: '0.7', abiertos: 511 }],
      error: null,
    });
    order.mockResolvedValue({
      data: [
        { service_code: 'AMBIENTE', plazo_dias: 7, fuente: 'PO, 03/11/2026' },
        { service_code: 'INFRAESTRUCTURA', plazo_dias: 90, fuente: 'PO, 03/11/2026' },
      ],
      error: null,
    });
  });

  it('UT-OBS-F1-4: /observatorio lleva a Mi barrio y las cuatro secciones están en las dos navegaciones', () => {
    abrir('/observatorio');
    expect(screen.getByText('Mi barrio: en construcción')).toBeInTheDocument();
    ['Mi barrio', 'Mapa', 'Comparar', 'Metodología'].forEach((s) => expect(screen.getAllByRole('link', { name: new RegExp(s) })).toHaveLength(2));
    expect(screen.getAllByRole('link', { name: /Volver a Reportalo/ })).toHaveLength(2);
  });

  it('UT-OBS-F1-5: Metodología muestra las cifras reales del país y los plazos de la base', async () => {
    abrir('/observatorio/metodologia');
    expect(await screen.findByTestId('obs-met-reportes')).toHaveTextContent('518');
    expect(rpc).toHaveBeenCalledWith('obs_resumen', expect.objectContaining({ p_nivel: 'pais', p_zona: null }));
    expect(await screen.findByText('90 días')).toBeInTheDocument();
    expect(screen.getByText('7,8 días')).toBeInTheDocument();
    expect(screen.getByText('Qué no se puede concluir')).toBeInTheDocument();
  });

  it('UT-OBS-F1-6: si la base falla, se ofrece reintentar y vuelve a consultar', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'fallo' } });
    abrir('/observatorio/metodologia');
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByTestId('obs-met-reportes')).toHaveTextContent('518'));
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});

describe('OBS-F1 · acceso', () => {
  it('UT-OBS-F1-7: la ruta va con sesión, y se entra desde Perfil y desde la barra de escritorio', () => {
    const app = leer('App.jsx');
    expect(app).toMatch(/path="\/observatorio\/\*"\s*element=\{\s*<ProtectedRoute>\s*<ObservatorioPage \/>/);
    expect(leer('pages/ProfilePage.jsx')).toMatch(/navigate\('\/observatorio'\)/);
    expect(leer('components/layout/AppLayout.jsx')).toMatch(/to="\/observatorio"/);
  });

  it('UT-OBS-F1-8: el observatorio no usa Material Symbols (la app usa Lucide)', () => {
    ['components/observatorio/ObsLayout.jsx', 'components/observatorio/ObsUi.jsx', 'pages/observatorio/MetodologiaPage.jsx'].forEach((f) =>
      expect(leer(f), f).not.toMatch(/Material Symbols|class="ms"/)
    );
  });
});
