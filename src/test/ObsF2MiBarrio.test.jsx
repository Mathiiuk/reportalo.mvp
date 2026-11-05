/**
 * @file ObsF2MiBarrio.test.jsx
 * @description OBS · F2 · Mi barrio: selector de zona, indicadores contra la comuna o partido, gráficos y filtros.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

const rpc = vi.fn();
vi.mock('../lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: { rpc: (...a) => rpc(...a) } }));

const { MiBarrioPage, armarTerritorio } = await import('../pages/observatorio/MiBarrioPage');
const { mesesDelPeriodo, mesTodaviaAbierto, CATEGORIAS } = await import('../components/observatorio/obsFormat');

// Territorio mínimo: CABA › Comuna 3 › Balvanera y San Cristóbal; Comuna 10 › Floresta; Avellaneda (Santa Fe)
const ZONAS = [
  { zona_id: 'caba', nivel: 'provincia', nombre: 'Ciudad Autónoma de Buenos Aires', padre_id: null },
  { zona_id: 'sf', nivel: 'provincia', nombre: 'Santa Fe', padre_id: null },
  { zona_id: 'c10', nivel: 'subdivision', nombre: 'Comuna 10', padre_id: 'caba', padre_nombre: 'Ciudad Autónoma de Buenos Aires' },
  { zona_id: 'c3', nivel: 'subdivision', nombre: 'Comuna 3', padre_id: 'caba', padre_nombre: 'Ciudad Autónoma de Buenos Aires' },
  { zona_id: 'ave-sf', nivel: 'subdivision', nombre: 'Avellaneda', padre_id: 'sf', padre_nombre: 'Santa Fe' },
  { zona_id: 'sc', nivel: 'localidad', nombre: 'San Cristóbal', padre_id: 'c3' },
  { zona_id: 'balv', nivel: 'localidad', nombre: 'Balvanera', padre_id: 'c3' },
  { zona_id: 'flo', nivel: 'localidad', nombre: 'Floresta', padre_id: 'c10' },
  { zona_id: 'ave-sf-l', nivel: 'localidad', nombre: 'Avellaneda', padre_id: 'ave-sf' },
];

const resumen = (o) => ({ reportes: 0, resueltos: 0, pct_resueltos: null, mediana_dias: null, p90_dias: null, elegibles_plazo: 0, en_plazo: 0, pct_en_plazo: null, abiertos: 0, ...o });

// Respuestas de la base según la función y la zona
const responder = ({ vacio = false } = {}) =>
  rpc.mockImplementation((fn, p) => {
    if (fn === 'obs_zonas') return Promise.resolve({ data: ZONAS, error: null });
    if (fn === 'obs_resumen') {
      if (vacio) return Promise.resolve({ data: [resumen()], error: null });
      return Promise.resolve({
        data: [p.p_nivel === 'localidad' ? resumen({ reportes: 60, resueltos: 6, pct_resueltos: '10.0', mediana_dias: '4.5', p90_dias: '9', elegibles_plazo: 3 }) : resumen({ reportes: 60, pct_resueltos: '8.2', pct_en_plazo: null })],
        error: null,
      });
    }
    if (fn === 'obs_por_mes') return Promise.resolve({ data: vacio ? [] : [{ mes: '2026-09-01', service_code: null, reportes: 48, resueltos: 6, pct_resueltos: '12.5' }], error: null });
    if (fn === 'obs_por_categoria')
      return Promise.resolve({
        data: CATEGORIAS.map((c, i) => ({ service_code: c.code, service_name: c.nombre, reportes: vacio ? 0 : [25, 16, 16, 3][i], resueltos: 0, pct_resueltos: null, mediana_dias: null, plazo_dias: [90, 7, 7, 30][i] })),
        error: null,
      });
    return Promise.resolve({ data: [], error: null });
  });

// Muestra la dirección actual para poder comprobar los filtros
const Direccion = () => {
  const l = useLocation();
  return <output data-testid="dir">{l.search}</output>;
};

const abrir = (ruta = '/observatorio/mi-barrio') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/observatorio/mi-barrio" element={<><MiBarrioPage /><Direccion /></>} />
      </Routes>
    </MemoryRouter>
  );

describe('OBS-F2 · formato de meses', () => {
  it('UT-OBS-F2-1: el período lista todos sus meses y marca los que todavía están abiertos', () => {
    const hoy = new Date(2026, 10, 5);
    expect(mesesDelPeriodo('3', hoy)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01']);
    expect(mesTodaviaAbierto('2026-11-01', hoy)).toBe(true);
    expect(mesTodaviaAbierto('2026-10-01', hoy)).toBe(true); // empezó hace 35 días
    expect(mesTodaviaAbierto('2026-09-01', hoy)).toBe(false); // 65 días
  });

  it('UT-OBS-F2-2: el orden de categorías es fijo y no pone juntos a Infraestructura y Tránsito', () => {
    expect(CATEGORIAS.map((c) => c.code)).toEqual(['INFRAESTRUCTURA', 'AMBIENTE', 'TRANSITO', 'COMERCIO_IRREGULAR']);
  });
});

describe('OBS-F2 · territorio', () => {
  it('UT-OBS-F2-3: agrupa por comuna o partido, en orden numérico, y no confunde las dos Avellaneda', () => {
    const t = armarTerritorio(ZONAS);
    expect(t.grupos.map((g) => `${g.nombre} · ${g.provincia}`)).toEqual([
      'Comuna 3 · Ciudad Autónoma de Buenos Aires',
      'Comuna 10 · Ciudad Autónoma de Buenos Aires',
      'Avellaneda · Santa Fe',
    ]);
    expect(t.grupos[0].localidades.map((l) => l.nombre)).toEqual(['Balvanera', 'San Cristóbal']);
    expect(t.porId.get('ave-sf-l').padre.provincia).toBe('Santa Fe');
  });
});

describe('OBS-F2 · pantalla', () => {
  beforeEach(() => {
    rpc.mockReset();
    localStorage.clear();
  });

  it('UT-OBS-F2-4: sin zona pide elegirla y no consulta cifras', async () => {
    responder();
    abrir();
    expect(await screen.findByRole('combobox', { name: 'Mi barrio o localidad' })).toBeInTheDocument();
    expect(screen.getByText(/Elegí tu barrio o localidad para ver/)).toBeInTheDocument();
    expect(rpc.mock.calls.map(([fn]) => fn)).toEqual(['obs_zonas']);
  });

  it('UT-OBS-F2-5: al elegir, cada cifra se compara con su comuna y la zona queda en la dirección', async () => {
    responder();
    abrir();
    fireEvent.change(await screen.findByRole('combobox', { name: 'Mi barrio o localidad' }), { target: { value: 'balv' } });
    expect(await screen.findByText('Mi barrio: Balvanera')).toBeInTheDocument();
    expect(screen.getByTestId('dir')).toHaveTextContent('zona=balv');
    expect(screen.getByTestId('obs-kpi-resueltos')).toHaveTextContent('10 %');
    expect(screen.getByTestId('obs-kpi-resueltos')).toHaveTextContent('Comuna 3: 8,2 %');
    expect(screen.getByTestId('obs-kpi-dias')).toHaveTextContent('4,5 días');
    // Plazo con menos de 5 elegibles: «—», no 0
    expect(screen.getByTestId('obs-kpi-plazo')).toHaveTextContent('—');
    expect(rpc).toHaveBeenCalledWith('obs_resumen', expect.objectContaining({ p_nivel: 'subdivision', p_zona: 'c3' }));
    // Recordada para la próxima vez, solo en este navegador
    expect(localStorage.getItem('reportalo_obs_mi_barrio')).toBe('balv');
  });

  it('UT-OBS-F2-6: tocar una categoría de la dona filtra, y tocarla otra vez saca el filtro', async () => {
    responder();
    abrir('/observatorio/mi-barrio?zona=balv');
    const leyenda = await screen.findByRole('button', { name: /Tránsito/ });
    fireEvent.click(leyenda);
    expect(screen.getByTestId('dir')).toHaveTextContent('c=TRANSITO');
    expect(rpc).toHaveBeenCalledWith('obs_resumen', expect.objectContaining({ p_zona: 'balv', p_categoria: 'TRANSITO' }));
    // La torta no se filtra: siempre muestra las cuatro
    expect(rpc).not.toHaveBeenCalledWith('obs_por_categoria', expect.objectContaining({ p_categoria: expect.anything() }));
    fireEvent.click(await screen.findByRole('button', { name: /Tránsito/, pressed: true }));
    expect(screen.getByTestId('dir')).not.toHaveTextContent('c=');
  });

  it('UT-OBS-F2-7: el período cambia el «desde» de todas las consultas', async () => {
    responder();
    abrir('/observatorio/mi-barrio?zona=balv');
    fireEvent.click(await screen.findByRole('button', { name: 'Mes' }));
    expect(screen.getByTestId('dir')).toHaveTextContent('p=1');
    const desdes = rpc.mock.calls.filter(([fn]) => fn === 'obs_resumen').map(([, p]) => p.p_desde);
    expect(new Set(desdes).size).toBe(2); // 6 meses y después el mes en curso
  });

  it('UT-OBS-F2-8: una zona sin reportes muestra el estado vacío, no gráficos en cero', async () => {
    responder({ vacio: true });
    abrir('/observatorio/mi-barrio?zona=flo');
    expect(await screen.findByText('Todavía no hay reportes en Floresta')).toBeInTheDocument();
    expect(screen.queryByText('Reportes por mes')).not.toBeInTheDocument();
  });

  it('UT-OBS-F2-9: retoma la zona guardada y descarta una que ya no existe', async () => {
    responder();
    localStorage.setItem('reportalo_obs_mi_barrio', 'balv');
    abrir();
    expect(await screen.findByText('Mi barrio: Balvanera')).toBeInTheDocument();

    localStorage.setItem('reportalo_obs_mi_barrio', 'no-existe');
    const { container } = abrir();
    await within(container).findByRole('combobox', { name: 'Mi barrio o localidad' });
    expect(within(container).getByTestId('dir')).toHaveTextContent('');
  });

  it('UT-OBS-F2-10: las barras traen los meses sin reportes en 0 y la tabla para lectores de pantalla', async () => {
    responder();
    abrir('/observatorio/mi-barrio?zona=balv');
    const tabla = await screen.findByRole('table', { name: 'Reportes y resueltos por mes' });
    expect(within(tabla).getAllByRole('row')).toHaveLength(1 + 6);
  });
});
