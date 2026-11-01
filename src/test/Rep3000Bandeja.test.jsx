/**
 * @file Rep3000Bandeja.test.jsx
 * @description REP-3000: bandeja del panel con el diseño de Iván (LEEME §5.1). Lo que entra lo decide la base
 * (get_panel_inbox); la pantalla agrupa en Por tomar, En curso y Cerrados, y nunca inventa datos.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const rpcMock = vi.fn();
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...args) => rpcMock(...args),
    storage: {
      from: () => ({
        createSignedUrls: async (paths) => ({ data: paths.map((path) => ({ path, signedUrl: `https://firmada/${path}` })), error: null }),
      }),
    },
  },
}));
vi.mock('../components/panel/OperatorRoute', () => ({
  useOperator: () => ({ role: 'organismo', agency: { id: 'a1', name: 'Reportalo CABA (organismo de prueba)', is_test: true } }),
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { email: 'operador@prueba.ar' }, signOut: vi.fn() }) }));

import { PanelPage } from '../pages/panel/PanelPage';

// Mediodía en Argentina: «Hace N h» no cruza la medianoche
const AHORA = new Date('2026-10-29T15:00:00Z').getTime();

const fila = (n, extra = {}) => ({
  report_id: `00000000-0000-4000-8000-00000000000${n}`,
  report_code: `#RP-0000000${n}`,
  case_number: n,
  category: 'Tránsito',
  created_at: new Date(AHORA - n * 3600e3).toISOString(),
  zone: 'Caballito',
  state_code: 'DERIVADO',
  state_label: 'Derivado',
  address_street: 'Avenida Rivadavia',
  address_number: '5000',
  taken: false,
  closed_at: null,
  image_count: 0,
  first_image_url: null,
  ...extra,
});

const BANDEJA = [
  fila(1, { image_count: 3, first_image_url: 'https://x/storage/v1/object/public/report-evidences/c1/a.webp' }),
  fila(2),
  fila(3, { taken: true }),
  fila(4, { state_code: 'ESCALADO', state_label: 'Escalado' }),
  fila(5, { state_code: 'RESUELTO', state_label: 'Resuelto', closed_at: new Date(AHORA).toISOString() }),
];

const montar = (entrada = '/panel') =>
  render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route path="/panel" element={<PanelPage />} />
        <Route path="/panel/reportes/:id" element={<PanelPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('REP-3000 · bandeja', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AHORA);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('UT-3000-B1: tres filtros con recuentos que suman el total; arranca en «Por tomar»', async () => {
    rpcMock.mockResolvedValue({ data: BANDEJA, error: null });
    montar();
    const porTomar = await screen.findByRole('button', { name: 'Por tomar · 2' });
    expect(porTomar).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'En curso · 2' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Cerrados · 1' })).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith('get_panel_inbox');
    expect(screen.getAllByRole('link', { name: /caso n°/i })).toHaveLength(2);
  });

  it('UT-3000-B9: sin calle, la fila muestra solo el barrio', async () => {
    rpcMock.mockResolvedValue({ data: [{ ...BANDEJA[0], address_street: null, address_number: null }], error: null });
    montar();
    const fila = await screen.findByRole('link', { name: /caso n° 000001/i });
    expect(within(fila).getByText('Caballito')).toBeInTheDocument();
    expect(within(fila).queryByText(/Dirección no disponible/)).not.toBeInTheDocument();
  });

  it('UT-3000-B2: cada fila muestra caso, código, antigüedad, categoría, dirección y barrio, estado, miniatura firmada y fotos', async () => {
    rpcMock.mockResolvedValue({ data: BANDEJA, error: null });
    montar();
    const fila1 = await screen.findByRole('link', { name: /caso n° 000001/i });
    expect(fila1).toHaveAttribute('href', `/panel/reportes/${BANDEJA[0].report_id}?f=por-tomar`);
    expect(within(fila1).getByText('#RP-00000001')).toBeInTheDocument();
    expect(within(fila1).getByText('Hace 1 h')).toBeInTheDocument();
    // Como en D41: «Pasco 1150, Gerli»
    expect(within(fila1).getByText('Avenida Rivadavia 5000, Caballito')).toBeInTheDocument();
    expect(within(fila1).getByText('Derivado')).toBeInTheDocument();
    expect(within(fila1).getByLabelText('3 fotos')).toBeInTheDocument();
    expect(fila1.querySelector('.thumb').getAttribute('style')).toContain('https://firmada/c1/a.webp');
  });

  it('UT-3000-B3: «En curso» tiene los tomados (con la marca Tomado) y los escalados; «Cerrados» los finales', async () => {
    rpcMock.mockResolvedValue({ data: BANDEJA, error: null });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'En curso · 2' }));
    const tomado = screen.getByRole('link', { name: /caso n° 000003/i });
    expect(within(tomado).getByText('Tomado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /caso n° 000004/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrados · 1' }));
    expect(screen.getByRole('link', { name: /caso n° 000005/i })).toBeInTheDocument();
  });

  it('UT-3000-B4: orden por fecha, más recientes primero; un clic lo invierte', async () => {
    rpcMock.mockResolvedValue({ data: BANDEJA, error: null });
    montar();
    await screen.findByRole('button', { name: 'Por tomar · 2' });
    const casos = () => screen.getAllByRole('link', { name: /caso n°/i }).map((a) => a.textContent.match(/Caso N° (\d+)/)[1]);
    expect(casos()).toEqual(['000001', '000002']);
    fireEvent.click(screen.getByRole('button', { name: /más recientes primero/i }));
    expect(casos()).toEqual(['000002', '000001']);
  });

  it('UT-3000-B5: vacío por filtro con explicación y salida al otro filtro; los recuentos siguen visibles', async () => {
    rpcMock.mockResolvedValue({ data: [fila(3, { taken: true })], error: null });
    montar();
    expect(await screen.findByRole('heading', { name: 'No hay reportes por tomar' })).toBeInTheDocument();
    expect(screen.getByText(/vulnerabilidad social/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver los casos en curso · 1' }));
    expect(screen.getByRole('link', { name: /caso n° 000003/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Por tomar · 0' })).toBeInTheDocument();
  });

  it('UT-3000-B6: error de carga sin lista ni recuentos viejos, con código, hora y «Reintentar»', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch', code: '' } });
    montar();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No pudimos cargar la bandeja');
    expect(alerta).toHaveTextContent(/Error de red · \d{2}\/\d{2} · \d{2}:\d{2}/);
    expect(screen.queryByRole('button', { name: /por tomar/i })).not.toBeInTheDocument();
    rpcMock.mockResolvedValueOnce({ data: BANDEJA, error: null });
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByRole('button', { name: 'Por tomar · 2' })).toBeInTheDocument();
  });

  it('UT-3000-B7: cabecera con el organismo de prueba, la marca PRUEBA y la franja de staging', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    montar();
    expect(await screen.findByRole('heading', { level: 1, name: 'Bandeja' })).toBeInTheDocument();
    expect(screen.getAllByText('Reportalo CABA (organismo de prueba)').length).toBeGreaterThan(0);
    expect(screen.getByText('PRUEBA')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/organismo de prueba en staging/i);
    // Sin caso elegido, el lado derecho invita a abrir uno
    expect(screen.getByRole('heading', { name: 'Elegí un caso' })).toBeInTheDocument();
  });
});
