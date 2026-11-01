/**
 * @file Rep3749ModoTelefono.test.jsx
 * @description REP-3749: detalle del caso en el teléfono, como en el diseño v2 de Iván (M34b a M38). El caso se abre
 * encima de la lista con «volver», fotos en carrusel con contador, historial plegable (abierto si el caso está cerrado)
 * y las acciones fijas abajo. En escritorio no cambia nada. Las piezas de teléfono solo se dibujan en teléfono, para
 * que los lectores de pantalla no encuentren cada botón dos veces.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const rpcMock = vi.fn();
// MapLibre no corre en jsdom: se registra qué mapa y qué pin se pidieron
const mapas = [];
vi.mock('../lib/maplibreLoader', () => ({
  loadMapLibre: async () => ({
    Map: class {
      constructor(opciones) {
        mapas.push({ opciones, pines: [] });
      }
      remove() {}
    },
    Marker: class {
      setLngLat(lngLat) {
        mapas.at(-1).pines.push(lngLat);
        return this;
      }
      addTo() {
        return this;
      }
    },
  }),
}));
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

const ID = '9b182245-aaaa-bbbb-cccc-000000000000';
const AGENCIA = 'Reportalo CABA (organismo de prueba)';
const CITA_NORMA = { reference: 'Ley 451 (CABA) — Art. 6.1.54', quoted_text: 'estacione sobre las aceras', source_url: 'https://bo/x', foundation_type: 'conducta_prohibida' };
const CITA_SANCION = { reference: 'Ley 451 — Art. 6.1.55', quoted_text: 'Multa de 100 a 500 unidades fijas', foundation_type: 'sancion' };
const img = (n) => ({ id: `img-${n}`, image_url: `https://x/storage/v1/object/public/report-evidences/csid/f${n}.webp` });

const BASE = {
  report_id: ID,
  report_code: '#RP-9B182245',
  case_number: 42,
  created_at: '2026-10-25T13:00:00Z',
  category: 'Tránsito',
  state_code: 'DERIVADO',
  state_label: 'Derivado',
  description: 'Auto sobre la vereda, llamar al [teléfono oculto]',
  locality: 'Caballito',
  subdivision: 'Comuna 6',
  latitud: -34.6043,
  longitud: -58.4395,
  address_street: 'Avenida Rivadavia',
  address_number: '5000',
  address_road_type: 'avenida',
  images: [img(1)],
  foundation: { status: 'fundamento_preliminar', citations: [CITA_NORMA, CITA_SANCION], disclaimer: 'Fundamento preliminar...' },
  actions: ['DESESTIMADO', 'EN_DISCREPANCIA', 'ESCALADO', 'RESUELTO'],
  taken: null,
  history: [
    { state_code: 'EN_ANALISIS', changed_at: '2026-10-25T13:01:00Z', notes: 'Análisis automático en curso', actor_type: 'sistema', agency: null },
    { state_code: 'DERIVADO', changed_at: '2026-10-25T14:00:00Z', notes: 'Entrega interna al operador de prueba', actor_type: 'sistema', agency: null },
  ],
};

// La RPC del detalle devuelve `detalle` hasta que una acción sale bien; después, `despues`
const responder = ({ detalle = BASE, despues = detalle, accion = { ok: true }, bandeja = [] } = {}) => {
  let hecho = false;
  rpcMock.mockImplementation(async (nombre) => {
    if (nombre === 'get_panel_inbox') return { data: bandeja, error: null };
    if (nombre === 'get_panel_report_detail') return { data: hecho ? despues : detalle, error: null };
    if (accion?.ok) hecho = true;
    return { data: accion, error: null };
  });
};

const montar = () =>
  render(
    <MemoryRouter initialEntries={[`/panel/reportes/${ID}`]}>
      <Routes>
        <Route path="/panel" element={<PanelPage />} />
        <Route path="/panel/reportes/:id" element={<PanelPage />} />
      </Routes>
    </MemoryRouter>
  );

const dialogo = () => screen.getByRole('dialog');

// Una semana después de los hechos: las fechas salen como «el dd/mm», no «hoy» ni «ayer»
const congelar = () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-05T15:00:00Z'));
};


const telefono = (activo) => {
  window.matchMedia = vi.fn((query) => ({
    matches: activo && query === '(max-width: 767px)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
};

describe('REP-3749 · detalle en el teléfono', () => {
  const original = window.matchMedia;
  beforeEach(() => {
    rpcMock.mockReset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T15:00:00Z'));
    telefono(true);
  });
  afterEach(() => {
    vi.useRealTimers();
    window.matchMedia = original;
  });

  it('UT-3749-T1: el caso se abre encima con «volver», caso N°, estado y la franja corta de prueba (M35)', async () => {
    responder();
    montar();
    const barra = await screen.findByRole('navigation', { name: 'Caso abierto' });
    expect(within(barra).getByRole('link', { name: 'Volver a la bandeja' })).toHaveAttribute('href', '/panel?f=por-tomar');
    expect(within(barra).getByText('Caso N° 000042')).toBeInTheDocument();
    expect(within(barra).getByText('Derivado')).toBeInTheDocument();
    expect(document.querySelector('.op-panel').className).toContain('is-case');
    expect(document.querySelector('.detail .banner.mbanner')).not.toBeNull();
  });

  it('UT-3749-T2: varias fotos en carrusel con «1 / 4» y puntos; tocar una la abre en el visor (M34b)', async () => {
    responder({ detalle: { ...BASE, images: [img(1), img(2), img(3), img(4)] } });
    montar();
    const carrusel = await screen.findByRole('group', { name: /fotos del reporte/i });
    expect(within(carrusel).getByText('1 / 4')).toBeInTheDocument();
    expect(within(carrusel).getByText('4 / 4')).toBeInTheDocument();
    const puntos = screen.getByRole('group', { name: 'Elegir foto' });
    expect(within(puntos).getAllByRole('button')).toHaveLength(4);
    expect(within(puntos).getByRole('button', { name: 'Ir a la foto 1' })).toHaveAttribute('aria-current', 'true');
    // La galería de escritorio no se dibuja
    expect(screen.queryByRole('button', { name: 'Abrir foto 1 de 4' })).not.toBeInTheDocument();
    fireEvent.click(within(carrusel).getByRole('button', { name: 'Ver la foto 2 de 4' }));
    expect(screen.getByRole('dialog', { name: 'Foto 2 de 4' })).toBeInTheDocument();
  });

  it('UT-3749-T3: el historial empieza plegado; con el caso cerrado, abierto y sin plegar', async () => {
    responder();
    const { unmount } = montar();
    const mostrar = await screen.findByRole('button', { name: 'Mostrar historial' });
    expect(mostrar).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list', { name: /historial/i })).not.toBeInTheDocument();
    fireEvent.click(mostrar);
    expect(screen.getByRole('button', { name: 'Ocultar historial' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('list', { name: /historial/i })).toBeInTheDocument();
    unmount();
    responder({ detalle: { ...BASE, state_code: 'RESUELTO', state_label: 'Resuelto', actions: [] } });
    montar();
    expect(await screen.findByRole('list', { name: /historial/i })).toBeInTheDocument();
    // Cerrado no se pliega: no hay botón que no haga nada
    expect(screen.queryByRole('button', { name: /historial/i })).not.toBeInTheDocument();
  });

  it('UT-3749-T4: las acciones van fijas abajo, una sola vez; tomado dice «Tomado»; cerrado no tiene barra (M36)', async () => {
    responder();
    const { unmount } = montar();
    const barra = await screen.findByRole('group', { name: 'Acciones del caso' });
    expect(within(barra).getAllByRole('button').map((b) => b.textContent)).toEqual(['blockRechazar', 'task_altMarcar resuelto', 'front_handTomar el caso']);
    expect(screen.getAllByRole('button', { name: /rechazar/i })).toHaveLength(1);
    fireEvent.click(within(barra).getByRole('button', { name: /rechazar/i }));
    expect(screen.getByRole('dialog', { name: 'Rechazar el reporte' })).toBeInTheDocument();
    unmount();
    responder({ detalle: { ...BASE, taken: { taken_at: '2026-10-26T12:00:00Z', agency: AGENCIA } } });
    const segundo = montar();
    expect(within(await screen.findByRole('group', { name: 'Acciones del caso' })).getByRole('button', { name: /tomado/i })).toBeDisabled();
    segundo.unmount();
    responder({ detalle: { ...BASE, state_code: 'RESUELTO', state_label: 'Resuelto', actions: [] } });
    montar();
    await screen.findByRole('list', { name: /historial/i });
    expect(screen.queryByRole('group', { name: 'Acciones del caso' })).not.toBeInTheDocument();
  });

  it('UT-3749-T5: en escritorio no hay barra de teléfono, ni carrusel, ni historial plegable', async () => {
    telefono(false);
    responder({ detalle: { ...BASE, images: [img(1), img(2)] } });
    montar();
    expect(await screen.findByRole('button', { name: 'Abrir foto 1 de 2' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Caso abierto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /fotos del reporte/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Acciones del caso' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mostrar historial' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: /historial/i })).toBeInTheDocument();
  });
});
