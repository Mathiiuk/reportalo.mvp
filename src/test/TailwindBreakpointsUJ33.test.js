/**
 * @file TailwindBreakpointsUJ33.test.js
 * @description Guarda de los breakpoints del UJ v3.3 §10 (REP-3791 · Bloque 11-A).
 *
 * Por qué existe: el Bloque 0 quedó aplicado sin `theme.extend.screens`, así que Tailwind
 * no generaba ninguna clase `desktop:`. Las 341 clases de los bloques 1-D a 4 no hacían
 * nada y las pantallas del reporte se veían con el layout de teléfono en una PC (D10 a D17).
 * Ningún test lo detectó porque jsdom no aplica media queries: estos tests fallan si alguien
 * vuelve a quitar los breakpoints o los desalinea del hook que decide el layout por JS.
 */
import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import config from '../../tailwind.config.js';
import { DESKTOP_MEDIA_QUERY } from '../hooks/useMediaQuery';

describe('UJ v3.3 §10 · breakpoints de Tailwind', () => {
  it('UT-BP-01: define tablet, desktop y wide con los cortes del §10', () => {
    expect(config.theme.extend.screens).toEqual({
      tablet: '641px',
      desktop: '1025px',
      wide: '1441px',
    });
  });

  it('UT-BP-02: el corte desktop: coincide con el de useIsDesktopLayout', () => {
    // Lo que cambia por CSS (clases desktop:) y lo que cambia por JS (useIsDesktopLayout)
    // tiene que activarse en el mismo ancho, o en ese píxel se mezclan los dos layouts.
    const [, px] = DESKTOP_MEDIA_QUERY.match(/min-width:\s*(\d+)px/) ?? [];
    expect(px).toBeDefined();
    expect(config.theme.extend.screens.desktop).toBe(`${px}px`);
  });

  it('UT-BP-03: Tailwind genera de verdad las clases desktop: con su media query', async () => {
    const { css } = await postcss([
      tailwindcss({
        ...config,
        content: [{ raw: '<div class="flex-col desktop:flex-row desktop:max-w-[600px]"></div>' }],
      }),
    ]).process('@tailwind utilities;', { from: undefined });

    expect(css).toMatch(/@media \(min-width: 1025px\)/);
    expect(css).toContain('.desktop\\:flex-row');
    expect(css).toContain('.desktop\\:max-w-\\[600px\\]');
  });
});
