/**
 * @file Rep3749Detalle.test.jsx
 * @description REP-3749: detalle del caso con el diseño de Iván (LEEME §5.2). Conserva los requisitos de la pantalla
 * anterior: lo que se muestra lo decide la base (get_panel_report_detail), con los textos del PO (sanciones, ajeno).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
import { buildPanelTimeline, shortReference } from '../components/panel/panelFormat';

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

describe('REP-3749 · detalle del caso', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    congelar();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('UT-3749-D1: encabezado con caso y estado, categoría, código y fecha; ubicación completa y botón del mapa', async () => {
    responder();
    montar();
    expect(await screen.findByRole('heading', { level: 1, name: 'Caso N° 000042' })).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith('get_panel_report_detail', { p_report_id: ID });
    // La categoría es el título: no se repite debajo (diseño D41)
    expect(screen.getByText('#RP-9B182245 · Reportado el 25/10 · 10:00')).toBeInTheDocument();
    expect(screen.getAllByText('Tránsito')).toHaveLength(1);
    expect(screen.getByText('Avenida Rivadavia 5000 · Caballito')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver en el mapa' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(/no se muestran la identidad ni los datos de contacto/i)).toBeInTheDocument();
  });

  it('UT-3749-D9: «Ver en el mapa» abre, dentro del panel, un mapa con solo este caso; se vuelve a ocultar', async () => {
    mapas.length = 0;
    responder();
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver en el mapa' }));
    expect(await screen.findByRole('img', { name: /mapa con la ubicación del caso: avenida rivadavia 5000 · caballito/i })).toBeInTheDocument();
    await waitFor(() => expect(mapas).toHaveLength(1));
    expect(mapas[0].opciones.center).toEqual([-58.4395, -34.6043]);
    expect(mapas[0].pines).toEqual([[-58.4395, -34.6043]]);
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar el mapa' }));
    expect(screen.queryByRole('img', { name: /mapa con la ubicación/i })).not.toBeInTheDocument();
  });

  it('UT-3749-D2: sin dirección dice «Dirección no disponible»', async () => {
    responder({ detalle: { ...BASE, address_street: null, address_number: null } });
    montar();
    expect(await screen.findByText(/^Dirección no disponible/)).toBeInTheDocument();
  });

  it('UT-3749-D3: la descripción marca los contactos ocultos y lo aclara', async () => {
    responder();
    montar();
    expect(await screen.findByText('teléfono oculto')).toHaveClass('mask');
    expect(screen.getByText('Se ocultaron datos de contacto escritos por el vecino.')).toBeInTheDocument();
  });

  it('UT-3749-D4: fundamento en una línea por norma (D41); el texto, la fuente y las sanciones con la leyenda del PO, al desplegar', async () => {
    responder();
    const { unmount } = montar();
    expect(await screen.findByText('Ley 451 (CABA), art. 6.1.54')).toHaveAttribute('title', 'Ley 451 (CABA) — Art. 6.1.54');
    expect(screen.queryByText(/estacione sobre las aceras/)).not.toBeInTheDocument();
    const ver = screen.getByRole('button', { name: 'Ver el texto de las normas' });
    expect(ver).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(ver);
    expect(ver).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/«estacione sobre las aceras»/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fuente oficial' })).toHaveAttribute('href', 'https://bo/x');
    expect(screen.getByText('Sanción prevista por la norma; Reportalo no aplica sanciones.')).toBeInTheDocument();
    expect(screen.getByText(/«Multa de 100 a 500 unidades fijas»/)).toBeInTheDocument();
    unmount();
    responder({ detalle: { ...BASE, foundation: { status: 'fundamento_preliminar', citations: [CITA_NORMA] } } });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver el texto de las normas' }));
    expect(screen.getByText('La norma no registra sanción.')).toBeInTheDocument();
  });

  it('UT-3749-D10: la referencia de la norma se acorta a ley, artículo e inciso', () => {
    expect(shortReference('Ley 2148 (CABA) — Código de Tránsito y Transporte > Título VII > Artículo 7.1.9 (prohibiciones generales) > inciso h)')).toBe(
      'Ley 2148 (CABA), art. 7.1.9, inc. h)'
    );
    expect(shortReference('Ley 451 (CABA) — Régimen de Faltas > Artículo 6.1.52 (estacionamiento o detención prohibida)')).toBe('Ley 451 (CABA), art. 6.1.52');
    // Sin artículo reconocible queda como vino
    expect(shortReference('Ordenanza 7180 — Capítulo II')).toBe('Ordenanza 7180 — Capítulo II');
    expect(shortReference(null)).toBe('');
  });

  it('UT-3749-D5: una foto se amplía en el visor; varias se ven en fila y el visor las recorre con el teclado', async () => {
    responder({ detalle: { ...BASE, images: [img(1), img(2), img(3), img(4)] } });
    montar();
    expect(await screen.findByText('Fotos · 4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir foto 1 de 4' }));
    const visor = screen.getByRole('dialog', { name: 'Foto 1 de 4' });
    expect(within(visor).getByRole('img')).toHaveAttribute('src', 'https://firmada/csid/f1.webp');
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: 'Foto 2 de 4' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('UT-3749-D6: historial con fecha, estado, organismo solo en acciones del organismo, motivo y destino', async () => {
    responder({
      detalle: {
        ...BASE,
        state_code: 'ESCALADO',
        state_label: 'Escalado',
        actions: ['DESESTIMADO', 'RESUELTO'],
        taken: { taken_at: '2026-10-26T12:00:00Z', agency: AGENCIA },
        history: [
          ...BASE.history,
          { state_code: 'ESCALADO', changed_at: '2026-10-27T12:00:00Z', notes: 'Es una autopista', actor_type: 'organismo', agency: AGENCIA, escalated_to: 'AUSA' },
        ],
      },
    });
    montar();
    const historial = await screen.findByRole('list', { name: /historial/i });
    const items = within(historial).getAllByRole('listitem');
    // El alta del reporte abre el historial aunque la base no guarde esa fila (D44)
    expect(items.map((li) => li.querySelector('strong').textContent)).toEqual([
      'Reporte creado',
      'Análisis automático',
      `Entró a la bandeja de ${AGENCIA}`,
      `Tomado por ${AGENCIA}`,
      'Escalado',
    ]);
    const escalado = items[4];
    expect(within(escalado).getByText(AGENCIA)).toBeInTheDocument();
    expect(within(escalado).getByText('AUSA')).toBeInTheDocument();
    expect(within(escalado).getByText(/«Es una autopista»/)).toBeInTheDocument();
    // Las entradas del sistema no llevan organismo
    expect(within(items[1]).queryByText(AGENCIA)).not.toBeInTheDocument();
    // Los registros automáticos van sin motivo: son textos internos, no una decisión (D44)
    expect(within(historial).queryByText(/Análisis automático en curso/)).not.toBeInTheDocument();
    expect(within(historial).queryByText(/Entrega interna/)).not.toBeInTheDocument();
    expect(within(items[0]).getByText('25/10')).toBeInTheDocument();
  });

  it('UT-3749-D11: si la base ya guarda «Recibido», no se duplica el alta', () => {
    const items = buildPanelTimeline({
      createdAt: '2026-10-25T13:00:00Z',
      history: [
        { state_code: 'RECIBIDO', changed_at: '2026-10-25T13:00:01Z', notes: 'Alta', actor_type: 'sistema' },
        { state_code: 'EN_ANALISIS', changed_at: '2026-10-25T13:01:00Z', notes: 'x', actor_type: 'sistema' },
      ],
    });
    expect(items.map((i) => i.label)).toEqual(['Reporte creado', 'Análisis automático']);
    expect(items.every((i) => i.reason === null)).toBe(true);
  });

  it('UT-3749-D7: ajeno o inexistente → «Este reporte no está disponible para tu organismo» (caso 5 PO)', async () => {
    responder({ detalle: null });
    montar();
    expect(await screen.findByText('Este reporte no está disponible para tu organismo.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a la bandeja' })).toHaveAttribute('href', '/panel?f=por-tomar');
  });

  it('UT-3749-D8: error de carga del caso con reintento', async () => {
    rpcMock.mockImplementation(async (n) => (n === 'get_panel_inbox' ? { data: [], error: null } : { data: null, error: { message: 'x' } }));
    montar();
    expect(await screen.findByText(/no pudimos cargar el caso/i)).toBeInTheDocument();
    responder();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Caso N° 000042' })).toBeInTheDocument();
  });
});
