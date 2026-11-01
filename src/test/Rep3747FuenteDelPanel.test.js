/**
 * @file Rep3747FuenteDelPanel.test.js
 * @description REP-3747 · El panel usa la misma fuente que la app del vecino. El CSS de Iván pedía «Manrope», que su
 * prototipo bajaba de Google Fonts; la app empaqueta la fuente local como «Manrope Variable» (@fontsource-variable,
 * sin red). Con «Manrope» a secas el navegador caía a la fuente del sistema (Segoe UI en Windows) y /panel se veía
 * distinto a la app (visto en staging el 30/10).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, '../styles/panelOrganismos.css'), 'utf8');
const tailwind = readFileSync(resolve(__dirname, '../../tailwind.config.js'), 'utf8');
const main = readFileSync(resolve(__dirname, '../main.jsx'), 'utf8');

describe('REP-3747 · fuente del panel', () => {
  it('UT-3747-F1: el panel pide primero la fuente que carga la app («Manrope Variable»)', () => {
    expect(main).toMatch(/import '@fontsource-variable\/manrope'/);
    expect(tailwind).toMatch(/manrope: \['Manrope Variable'/);
    expect(css).toMatch(/--rep-font: 'Manrope Variable', Manrope, system-ui, sans-serif;/);
  });

  it('UT-3747-F2: ninguna regla del panel nombra «Manrope» sin «Manrope Variable» delante', () => {
    css
      .split('\n')
      .filter((linea) => /Manrope/.test(linea) && !/^\s*\/\*/.test(linea))
      .forEach((linea) => expect(linea).toMatch(/'Manrope Variable', Manrope/));
  });
});
