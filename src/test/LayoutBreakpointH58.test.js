/**
 * @file LayoutBreakpointH58.test.js
 * @description REP-3798 / H-58: la navegación (cabecera de teléfono, barra de escritorio, pestañas
 * y botón flotante) cambia de teléfono a escritorio en un solo corte, `desktop:` (1025 px, §10 del UJ v3.3).
 * Con `md:` (768 px) una tablet mostraba la barra de escritorio sobre pantallas con layout de teléfono.
 * jsdom no aplica media queries, así que se verifica el código fuente.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const leer = (ruta) => readFileSync(resolve(process.cwd(), 'src', ruta), 'utf8');

describe('H-58 · un solo corte de escritorio para la navegación', () => {
  it('UT-H58-01: AppLayout no usa md: para alternar cabecera, pestañas o botón flotante', () => {
    expect(leer('components/layout/AppLayout.jsx')).not.toMatch(/\bmd:/);
  });

  it('UT-H58-02: el mapa posiciona sus tarjetas con desktop:, igual que la navegación', () => {
    expect(leer('components/map/CitizenMap.jsx')).not.toMatch(/\bmd:/);
  });

  it('UT-H58-03: el relleno que reserva lugar para la barra de pestañas se quita recién en desktop:', () => {
    ['pages/ReportsPage.jsx', 'pages/NotificationsPage.jsx', 'pages/NewsPage.jsx', 'pages/NewsDetailPage.jsx']
      .forEach((ruta) => expect(leer(ruta)).not.toMatch(/\bmd:pb-10/));
  });
});
