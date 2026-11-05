/**
 * @file ObsF4Comparar.test.jsx
 * @description OBS · F4 · Comparar zonas: elección en la dirección, cada zona contra su jurisdicción, colores validados.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rpc = vi.fn();
vi.mock('../lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: { rpc: (...a) => rpc(...a) } }));

const { CompararPage, leerZonas, MAX_ZONAS } = await import('../pages/observatorio/CompararPage');
const { indexarTerritorio, nombreCorto } = await import('../components/observatorio/obsTerritorio');

const ZONAS = [
  { zona_id: 'caba', nivel: 'provincia', nombre: 'Ciudad Autónoma de Buenos Aires', padre_id: null, provincia_id: 'caba' },
  { zona_id: 'ba', nivel: 'provincia', nombre: 'Buenos Aires', padre_id: null, provincia_id: 'ba' },
  { zona_id: 'c1', nivel: 'subdivision', nombre: 'Comuna 1', padre_id: 'caba', provincia_id: 'caba' },
  { zona_id: 'c3', nivel: 'subdivision', nombre: 'Comuna 3', padre_id: 'caba', provincia_id: 'caba' },
  { zona_id: 'ave', nivel: 'subdivision', nombre: 'Avellaneda', padre_id: 'ba', provincia_id: 'ba' },
  { zona_id: 'balv', nivel: 'localidad', nombre: 'Balvanera', padre_id: 'c3', provincia_id: 'caba' },
  { zona_id: 'wilde', nivel: 'localidad', nombre: 'Wilde', padre_id: 'ave', provincia_id: 'ba' },
];

// Cifras por zona: cada una distinta para poder ver de dónde sale cada número
const RESUMEN = {
  balv: { reportes: 60, pct_resueltos: '0.0', abiertos: 59 },
  c3: { reportes: 60, pct_resueltos: '3.3' },
  c1: { reportes: 67, pct_resueltos: '1.5', abiertos: 65 },
  caba: { reportes: 305, pct_resueltos: '1.6' },
  ave: { reportes: 213, pct_resueltos: '0.0', abiertos: 213 },
  wilde: { reportes: 30, pct_resueltos: '0.0', abiertos: 30 },
  ba: { reportes: 213, pct_resueltos: '0.0' },
  pais: { reportes: 518, pct_resueltos: '1.0' },
};

const responder = () =>
  rpc.mockImplementation((fn, p) => {
    if (fn === 'obs_zonas') return Promise.resolve({ data: ZONAS, error: null });
    if (fn === 'obs_resumen') return Promise.resolve({ data: [RESUMEN[p.p_zona ?? 'pais']], error: null });
    if (fn === 'obs_por_mes') return Promise.resolve({ data: [{ mes: '2026-09-01', service_code: null, reportes: 10, resueltos: 0 }], error: null });
    if (fn === 'obs_por_categoria')
      return Promise.resolve({
        data: [
          { service_code: 'INFRAESTRUCTURA', service_name: 'Infraestructura', reportes: 25, resueltos: 0, mediana_dias: null, plazo_dias: 90 },
          { service_code: 'TRANSITO', service_name: 'Tránsito', reportes: 75, resueltos: 0, mediana_dias: null, plazo_dias: 7 },
        ],
        error: null,
      });
    return Promise.resolve({ data: [], error: null });
  });

const Direccion = () => <output data-testid="dir">{decodeURIComponent(useLocation().search)}</output>;
const abrir = (ruta) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/observatorio/comparar" element={<><CompararPage /><Direccion /></>} />
      </Routes>
    </MemoryRouter>
  );

describe('OBS-F4 · reglas', () => {
  it('UT-OBS-F4-1: la dirección se limpia: sin repetidas, sin inexistentes, solo el nivel de la primera, máximo 3', () => {
    const indice = indexarTerritorio(ZONAS);
    // Hernán (05/11): no se compara un barrio con una comuna. Gana el nivel de la primera zona
    expect(leerZonas('c1,balv,c1,no-existe,ave,wilde', indice)).toEqual(['c1', 'ave']);
    expect(leerZonas('balv,c1,wilde', indice)).toEqual(['balv', 'wilde']);
    expect(leerZonas('c1,ave,c3,caba', indice)).toEqual(['c1', 'ave', 'c3']);
    expect(leerZonas('', indice)).toEqual([]);
    expect(MAX_ZONAS).toBe(3);
  });

  it('UT-OBS-F4-2: los colores de zona son los validados, en claro y en oscuro (no los del POC)', () => {
    const css = readFileSync(resolve(__dirname, '../styles/tokens.css'), 'utf8');
    expect(css).toMatch(/--rep-obs-zona-1: 30 111 203;/);
    expect(css).toMatch(/--rep-obs-zona-2: 235 104 52;/);
    expect(css).toMatch(/--rep-obs-zona-3: 27 175 122;/);
    expect(css).toMatch(/\.dark \{[\s\S]*--rep-obs-zona-2: 217 89 38;/);
  });

  it('UT-OBS-F4-3: «CABA» solo en textos cortos', () => {
    expect(nombreCorto('Ciudad Autónoma de Buenos Aires')).toBe('CABA');
    expect(nombreCorto('Buenos Aires')).toBe('Buenos Aires');
  });
});

describe('OBS-F4 · pantalla', () => {
  beforeEach(() => {
    rpc.mockReset();
    responder();
  });

  it('UT-OBS-F4-4: sin zonas invita a elegir y no pide cifras', async () => {
    abrir('/observatorio/comparar');
    expect(await screen.findByText('Elegí una zona para empezar')).toBeInTheDocument();
    expect(rpc.mock.calls.map(([fn]) => fn)).toEqual(['obs_zonas']);
  });

  it('UT-OBS-F4-5: barrios contra su comuna o partido', async () => {
    abrir('/observatorio/comparar?zonas=balv,wilde');
    const tabla = await screen.findByTestId('obs-comparar-respuesta');
    expect(tabla).toHaveTextContent('Comuna 3: 3,3 %');
    expect(tabla).toHaveTextContent('Avellaneda: 0 %');
    expect(rpc).toHaveBeenCalledWith('obs_resumen', expect.objectContaining({ p_nivel: 'subdivision', p_zona: 'c3' }));
    expect(rpc).toHaveBeenCalledWith('obs_resumen', expect.objectContaining({ p_nivel: 'subdivision', p_zona: 'ave' }));
    // Sin población oficial: «s/d», nunca un número inventado
    expect(within(tabla).getAllByText('s/d')).toHaveLength(2);
    expect(screen.getByText(/Comparando barrios o localidades/)).toBeInTheDocument();
  });

  it('UT-OBS-F4-5b: comunas o partidos contra su provincia', async () => {
    abrir('/observatorio/comparar?zonas=c1,ave');
    const tabla = await screen.findByTestId('obs-comparar-respuesta');
    expect(tabla).toHaveTextContent('CABA: 1,6 %');
    expect(tabla).toHaveTextContent('Buenos Aires: 0 %');
  });

  it('UT-OBS-F4-6: una provincia se compara con el país', async () => {
    abrir('/observatorio/comparar?zonas=caba');
    expect(await screen.findByTestId('obs-comparar-respuesta')).toHaveTextContent('Argentina: 1 %');
    expect(rpc).toHaveBeenCalledWith('obs_resumen', expect.objectContaining({ p_nivel: 'pais', p_zona: null }));
  });

  it('UT-OBS-F4-7: «Agregar» solo ofrece el mismo nivel; con 3 ya no se ofrece; se quitan desde el chip', async () => {
    abrir('/observatorio/comparar?zonas=c1');
    const agregar = await screen.findByRole('combobox', { name: 'Agregar zona' });
    const ofrecidas = within(agregar).getAllByRole('option').map((o) => o.value).filter(Boolean);
    expect(ofrecidas.sort()).toEqual(['ave', 'c1', 'c3']); // solo comunas o partidos: ni barrios ni provincias
    fireEvent.change(agregar, { target: { value: 'ave' } });
    expect(screen.getByTestId('dir')).toHaveTextContent('zonas=c1,ave');
    fireEvent.change(screen.getByRole('combobox', { name: 'Agregar zona' }), { target: { value: 'c3' } });
    expect(screen.getByTestId('dir')).toHaveTextContent('zonas=c1,ave,c3');
    expect(screen.queryByRole('combobox', { name: 'Agregar zona' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Quitar Comuna 1/ }));
    expect(screen.getByTestId('dir')).toHaveTextContent('zonas=ave,c3');
  });

  it('UT-OBS-F4-7b: sin zonas se elige primero qué comparar, y eso cambia lo que se ofrece', async () => {
    abrir('/observatorio/comparar');
    const valores = () => within(screen.getByRole('combobox', { name: 'Agregar zona' })).getAllByRole('option').map((o) => o.value).filter(Boolean).sort();
    await screen.findByRole('group', { name: 'Qué querés comparar' });
    expect(valores()).toEqual(['balv', 'wilde']);
    fireEvent.click(screen.getByRole('button', { name: 'Provincias' }));
    expect(valores()).toEqual(['ba', 'caba']);
  });

  it('UT-OBS-F4-8: sin días resueltos lo explica, y «Qué se reporta» va en proporción con la cantidad al lado', async () => {
    abrir('/observatorio/comparar?zonas=balv,c1');
    expect(await screen.findByText(/Todavía ninguna categoría de estas zonas tiene 5 reportes resueltos/)).toBeInTheDocument();
    const proporcion = screen.getByRole('table', { name: 'Proporción de reportes por categoría en cada zona' });
    expect(within(proporcion).getByRole('row', { name: /Tránsito/ })).toHaveTextContent('75 % (75)');
  });

  it('UT-OBS-F4-9: el aviso «Comparar no es rankear» acompaña siempre la comparación', async () => {
    abrir('/observatorio/comparar?zonas=balv,c1');
    expect(await screen.findByText(/Comparar no es rankear/)).toBeInTheDocument();
  });
});
