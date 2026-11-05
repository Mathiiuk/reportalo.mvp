/**
 * @file ObsF3Mapa.test.jsx
 * @description OBS · F3 · Mapa de calor: territorio, centros, escala, bajada de nivel, migas y selección para comparar.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

const rpc = vi.fn();
vi.mock('../lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: { rpc: (...a) => rpc(...a) } }));

// MapLibre no corre en JSDOM: un mapa falso que guarda los marcadores agregados
const marcadores = [];
vi.mock('../lib/maplibreLoader', () => ({
  loadMapLibre: () =>
    Promise.resolve({
      Map: vi.fn(function () {
        this.on = (ev, cb) => ev === 'load' && setTimeout(cb, 0);
        this.remove = vi.fn();
        this.easeTo = vi.fn();
        this.fitBounds = vi.fn();
      }),
      Marker: vi.fn(function ({ element }) {
        this.element = element;
        this.setLngLat = () => this;
        this.addTo = () => {
          marcadores.push(this);
          document.body.appendChild(element);
          return this;
        };
        this.remove = () => {
          element.remove();
          marcadores.splice(marcadores.indexOf(this), 1);
        };
      }),
      LngLatBounds: vi.fn(function () {
        this.extend = () => this;
      }),
    }),
}));

const { MapaPage } = await import('../pages/observatorio/MapaPage');
const { indexarTerritorio, centroZona, camino, hijosDe } = await import('../components/observatorio/obsTerritorio');
const { pasoDeEscala, diametro, ESCALA } = await import('../components/observatorio/ObsMapa');

const ZONAS = [
  { zona_id: 'caba', nivel: 'provincia', nombre: 'Ciudad Autónoma de Buenos Aires', padre_id: null, provincia_id: 'caba' },
  { zona_id: 'sf', nivel: 'provincia', nombre: 'Santa Fe', padre_id: null, provincia_id: 'sf' },
  { zona_id: 'c10', nivel: 'subdivision', nombre: 'Comuna 10', padre_id: 'caba', provincia_id: 'caba' },
  { zona_id: 'c3', nivel: 'subdivision', nombre: 'Comuna 3', padre_id: 'caba', provincia_id: 'caba' },
  { zona_id: 'ave-sf', nivel: 'subdivision', nombre: 'Avellaneda', padre_id: 'sf', provincia_id: 'sf' },
  { zona_id: 'balv', nivel: 'localidad', nombre: 'Balvanera', padre_id: 'c3', provincia_id: 'caba' },
  { zona_id: 'sc', nivel: 'localidad', nombre: 'San Cristóbal', padre_id: 'c3', provincia_id: 'caba' },
  { zona_id: 'flo', nivel: 'localidad', nombre: 'Floresta', padre_id: 'c10', provincia_id: 'caba' },
  { zona_id: 'ave-sf-l', nivel: 'localidad', nombre: 'Avellaneda', padre_id: 'ave-sf', provincia_id: 'sf' },
];

const HIJOS = {
  pais: [
    { zona_id: 'caba', nivel: 'provincia', nombre: 'Ciudad Autónoma de Buenos Aires', reportes: 305, resueltos: 5, pct_resueltos: '1.6', mediana_dias: '7.8', abiertos: 298 },
    { zona_id: 'sf', nivel: 'provincia', nombre: 'Santa Fe', reportes: 0, resueltos: 0, pct_resueltos: null, mediana_dias: null, abiertos: 0 },
  ],
  provincia: [
    { zona_id: 'c10', nivel: 'subdivision', nombre: 'Comuna 10', reportes: 1, resueltos: 0, pct_resueltos: null, mediana_dias: null, abiertos: 1 },
    { zona_id: 'c3', nivel: 'subdivision', nombre: 'Comuna 3', reportes: 60, resueltos: 0, pct_resueltos: '0.0', mediana_dias: null, abiertos: 59 },
  ],
  subdivision: [
    { zona_id: 'balv', nivel: 'localidad', nombre: 'Balvanera', reportes: 60, resueltos: 0, pct_resueltos: '0.0', mediana_dias: null, abiertos: 59 },
    { zona_id: 'sc', nivel: 'localidad', nombre: 'San Cristóbal', reportes: 0, resueltos: 0, pct_resueltos: null, mediana_dias: null, abiertos: 0 },
  ],
};

const responder = () =>
  rpc.mockImplementation((fn, p) => {
    if (fn === 'obs_zonas') return Promise.resolve({ data: ZONAS, error: null });
    if (fn === 'obs_resumen') return Promise.resolve({ data: [{ reportes: p.p_nivel === 'pais' ? 518 : 60, resueltos: 0, pct_resueltos: '0.0', abiertos: 59 }], error: null });
    if (fn === 'obs_hijos') return Promise.resolve({ data: HIJOS[p.p_nivel] ?? [], error: null });
    if (fn === 'obs_por_mes') return Promise.resolve({ data: [{ mes: '2026-09-01', service_code: 'TRANSITO', reportes: 9, resueltos: 0, pct_resueltos: null }], error: null });
    if (fn === 'obs_por_categoria') return Promise.resolve({ data: [{ service_code: 'TRANSITO', service_name: 'Tránsito', reportes: 9, resueltos: 0 }], error: null });
    return Promise.resolve({ data: [], error: null });
  });

const Direccion = () => <output data-testid="dir">{useLocation().search}</output>;
const Comparar = () => <output data-testid="comparar">{useLocation().search}</output>;

const abrir = (ruta = '/observatorio/mapa') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/observatorio/mapa" element={<><MapaPage /><Direccion /></>} />
        <Route path="/observatorio/comparar" element={<Comparar />} />
        <Route path="/observatorio/mi-barrio" element={<output data-testid="mi-barrio">{'Mi barrio'}</output>} />
      </Routes>
    </MemoryRouter>
  );

describe('OBS-F3 · territorio y escala', () => {
  const indice = indexarTerritorio(ZONAS);

  it('UT-OBS-F3-1: migas desde el país y hijos en orden natural («Comuna 3» antes que «Comuna 10»)', () => {
    expect(camino(indice, 'localidad', 'balv').map((p) => p.nombre)).toEqual(['Argentina', 'Ciudad Autónoma de Buenos Aires', 'Comuna 3', 'Balvanera']);
    expect(hijosDe(indice, 'provincia', 'caba').map((z) => z.nombre)).toEqual(['Comuna 3', 'Comuna 10']);
    expect(hijosDe(indice, 'localidad', 'balv')).toEqual([]);
  });

  it('UT-OBS-F3-2: el centro de una comuna es el promedio de sus barrios; Avellaneda de Santa Fe no toma el de Buenos Aires', () => {
    const balv = centroZona(indice, indice.get('balv'));
    const sc = centroZona(indice, indice.get('sc'));
    expect(balv).toEqual([-58.403, -34.6098]);
    expect(centroZona(indice, indice.get('c3'))).toEqual([(balv[0] + sc[0]) / 2, (balv[1] + sc[1]) / 2]);
    expect(centroZona(indice, indice.get('ave-sf-l'))).toBeNull();
    expect(centroZona(indice, indice.get('sf'))).toBeNull();
  });

  it('UT-OBS-F3-3: un solo azul de claro a oscuro, gris con menos de 5, y el área crece con la cantidad', () => {
    expect(pasoDeEscala(4, 100)).toBeNull();
    expect(pasoDeEscala(5, 100)).toBe(0);
    expect(pasoDeEscala(100, 100)).toBe(ESCALA.length - 1);
    expect(diametro(100, 100)).toBeGreaterThan(diametro(25, 100));
    expect(diametro(100, 100, true)).toBeLessThan(diametro(100, 100));
  });
});

describe('OBS-F3 · pantalla', () => {
  beforeEach(() => {
    rpc.mockReset();
    marcadores.splice(0).forEach((m) => m.element.remove());
    responder();
  });

  it('UT-OBS-F3-4: el país muestra un círculo por provincia con centro, y Santa Fe solo en la tabla', async () => {
    abrir();
    expect(await screen.findByText('Mapa · Argentina')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /Ciudad Autónoma de Buenos Aires: 305 reportes/ })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Santa Fe: 0 reportes/ })).not.toBeInTheDocument();
    expect(screen.getByText('Santa Fe')).toBeInTheDocument();
  });

  it('UT-OBS-F3-5: tocar un círculo baja un nivel y la migas suben', async () => {
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: /Ciudad Autónoma de Buenos Aires: 305 reportes/ }));
    expect(await screen.findByText('Mapa · Ciudad Autónoma de Buenos Aires')).toBeInTheDocument();
    expect(screen.getByTestId('dir')).toHaveTextContent('nivel=provincia&zona=caba');
    expect(rpc).toHaveBeenCalledWith('obs_hijos', expect.objectContaining({ p_nivel: 'provincia', p_zona: 'caba' }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Ubicación' })).getByRole('button', { name: 'Argentina' }));
    expect(await screen.findByText('Mapa · Argentina')).toBeInTheDocument();
    expect(screen.getByTestId('dir')).toBeEmptyDOMElement();
  });

  it('UT-OBS-F3-6: la tabla baja de nivel y llega al último, que ofrece ver el barrio en Mi barrio', async () => {
    abrir('/observatorio/mapa?nivel=provincia&zona=caba');
    fireEvent.click(await screen.findByRole('button', { name: 'Comuna 3' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Balvanera' }));
    expect(await screen.findByText('Mapa · Balvanera')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver Balvanera en Mi barrio' }));
    expect(await screen.findByTestId('mi-barrio')).toBeInTheDocument();
  });

  it('UT-OBS-F3-7: se eligen hasta 3 zonas con reportes y «Comparar» las lleva en la dirección', async () => {
    abrir('/observatorio/mapa?nivel=provincia&zona=caba');
    const boton = await screen.findByRole('button', { name: /Elegí 2 o 3 zonas para comparar/ });
    expect(boton).toBeDisabled();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Elegir Comuna 3 para comparar' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Elegir Comuna 10 para comparar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Comparar 2 zonas' }));
    expect(await screen.findByTestId('comparar')).toHaveTextContent('zonas=c3,c10');
  });

  it('UT-OBS-F3-8: una zona sin reportes no se puede elegir ni abrir', async () => {
    abrir('/observatorio/mapa?nivel=subdivision&zona=c3');
    expect(await screen.findByRole('checkbox', { name: 'Elegir San Cristóbal para comparar' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'San Cristóbal' })).not.toBeInTheDocument();
  });

  it('UT-OBS-F3-9: una dirección con una zona que no existe vuelve al país', async () => {
    abrir('/observatorio/mapa?nivel=provincia&zona=no-existe');
    expect(await screen.findByText('Mapa · Argentina')).toBeInTheDocument();
    expect(screen.getByTestId('dir')).toBeEmptyDOMElement();
  });
});
