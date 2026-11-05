/**
 * @file ObsAjustesHernan.test.jsx
 * @description OBS · Devolución de Hernán (PO) del 05/11/2026 sobre lo que vio en staging:
 *   1. «¿Qué son las torres naranjas?»: el rayado de los meses recientes no se entendía → «en curso» escrito en el eje.
 *   2. «Para el ciudadano el gráfico es más fácil» (mockup): línea por mes, barras por categoría, mi zona vs. mi
 *      jurisdicción y una frase arriba.
 *   3. Comparar solo el mismo nivel (en ObsF4Comparar.test.jsx).
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

vi.mock('../lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: { rpc: vi.fn() } }));

const { fraseResumen } = await import('../pages/observatorio/MiBarrioPage');
const { LineaMes, BarrasCategorias, ZonaVsJurisdiccion, EjeMeses } = await import('../components/observatorio/ObsGraficos');

const HOY = new Date(2026, 10, 5);
const r = (o) => ({ reportes: 0, resueltos: 0, pctResueltos: null, medianaDias: null, abiertos: 0, ...o });

describe('OBS · frase de Mi barrio', () => {
  it('UT-OBS-H-1: con resueltos, «k de cada 10» y la mediana, como el mockup', () => {
    expect(fraseResumen('Piñeyro', r({ reportes: 56, resueltos: 31, pctResueltos: 55.4, medianaDias: 8 }))).toBe(
      'En Piñeyro, 6 de cada 10 reportes ya se resolvieron, en una mediana de 8 días.'
    );
    expect(fraseResumen('Wilde', r({ reportes: 60, resueltos: 3, pctResueltos: 5 }))).toBe('En Wilde, 1 de cada 10 reportes ya se resolvió.');
    expect(fraseResumen('Wilde', r({ reportes: 60, resueltos: 1, pctResueltos: 1.6 }))).toBe('En Wilde, menos de 1 de cada 10 reportes ya se resolvió.');
  });

  it('UT-OBS-H-2: con los datos de hoy (0 resueltos) lo dice; con menos de 5, no da proporciones; sin reportes, nada', () => {
    expect(fraseResumen('Piñeyro', r({ reportes: 71, pctResueltos: 0, abiertos: 71 }))).toBe(
      'En Piñeyro todavía no se resolvió ninguno de los 71 reportes del período: 71 siguen abiertos.'
    );
    expect(fraseResumen('Recoleta', r({ reportes: 3 }))).toBe('En Recoleta hay 3 reportes en el período. Todavía son pocos para decir qué parte se resolvió.');
    expect(fraseResumen('Villa Lugano', r({}))).toBeNull();
  });

  it('UT-OBS-H-3: no promete que el reporte «llega al organismo» (la entrega sigue en prueba)', () => {
    const textos = [
      fraseResumen('A', r({ reportes: 56, resueltos: 31, pctResueltos: 55.4, medianaDias: 8 })),
      fraseResumen('A', r({ reportes: 71, pctResueltos: 0, abiertos: 71 })),
      fraseResumen('A', r({ reportes: 3 })),
    ].join(' ');
    expect(textos).not.toMatch(/organismo|llega|cuenta/i);
  });
});

describe('OBS · meses en curso sin rayado', () => {
  it('UT-OBS-H-4: el eje dice «en curso» debajo de los meses recientes y solo de esos', () => {
    render(<EjeMeses meses={['2026-09-01', '2026-10-01', '2026-11-01']} hoy={HOY} />);
    expect(screen.getAllByText('en curso')).toHaveLength(2); // octubre y noviembre empezaron hace menos de 60 días
  });

  it('UT-OBS-H-5: ningún gráfico del observatorio usa el rayado de fondo', () => {
    const dir = resolve(__dirname, '../components/observatorio');
    readdirSync(dir).forEach((f) => expect(readFileSync(join(dir, f), 'utf8'), f).not.toMatch(/repeating-linear-gradient/));
  });

  it('UT-OBS-H-6: la línea por mes explica «en curso» y deja la tabla para lectores de pantalla', () => {
    const meses = ['2026-09-01', '2026-10-01', '2026-11-01'].map((mes, i) => ({ mes, reportes: [52, 8, 11][i], resueltos: 0, pctResueltos: null }));
    render(<LineaMes meses={meses} hoy={HOY} />);
    expect(screen.getByText(/son meses recientes/)).toBeInTheDocument();
    const tabla = screen.getByRole('table', { name: 'Reportes y resueltos por mes' });
    expect(within(tabla).getByRole('row', { name: /noviembre de 2026 \(en curso\)/ })).toHaveTextContent('11');
  });
});

describe('OBS · gráficos para el vecino', () => {
  it('UT-OBS-H-7: las barras por categoría filtran al tocarlas y muestran cantidad y proporción', () => {
    const onSeleccion = vi.fn();
    const filas = [
      { categoria: 'TRANSITO', reportes: 26 },
      { categoria: 'COMERCIO_IRREGULAR', reportes: 22 },
      { categoria: 'AMBIENTE', reportes: 13 },
      { categoria: 'INFRAESTRUCTURA', reportes: 10 },
    ];
    render(<BarrasCategorias filas={filas} onSeleccion={onSeleccion} />);
    const transito = screen.getByRole('button', { name: 'Tránsito: 26 reportes' });
    expect(transito).toHaveTextContent('37 %');
    fireEvent.click(transito);
    expect(onSeleccion).toHaveBeenCalledWith('TRANSITO');
  });

  it('UT-OBS-H-8: mi zona vs. mi jurisdicción solo con porcentajes, y «pocos casos» en vez de 0', () => {
    render(
      <ZonaVsJurisdiccion
        zona="Piñeyro"
        jurisdiccion="Avellaneda"
        filas={[
          { indicador: 'Reportes resueltos', zona: 0, jurisdiccion: 1.5 },
          { indicador: 'Resueltos dentro del plazo', zona: null, jurisdiccion: null },
        ]}
      />
    );
    expect(screen.getAllByText('pocos casos')).toHaveLength(2);
    expect(screen.getByRole('table', { name: 'Piñeyro comparado con Avellaneda' })).toHaveTextContent('1,5 %');
  });
});
