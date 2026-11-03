import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TermsAndPermissionsPage } from '../pages/TermsAndPermissionsPage';
import { CURRENT_TERMS_VERSION, TERMS_EFFECTIVE_DATE } from '../services/termsService';

// REP-3868 · sección «Fotos» de las Condiciones de uso, versión 1.5. El texto es el de Hernán en REP-3867
// (comentario del 02/11/2026) y se compara palabra por palabra: cambiarlo es una decisión del PO, no del código.
const FOTOS = [
  'Subí solo fotos del problema que reportás, sacadas por vos en la vía pública. Pueden aparecer la calle, comercios, carteles, vehículos con su patente y personas de paso. Los rostros se difuminan al procesar la foto; las patentes no, porque el organismo las necesita para actuar.',
  'No se pueden subir: desnudez o contenido sexual; violencia gráfica sobre personas; contenido que pueda ser delito; amenazas, acoso o fotos para señalar a una persona; interiores o espacios privados; fotos que no muestran el problema o que no sacaste vos, como imágenes bajadas de internet o editadas.',
  'Al enviar un reporte declarás que es real, que las fotos las sacaste vos en la vía pública y que muestran el problema que describís. Sos responsable de su contenido. Cada reporte queda registrado con tu cuenta; el organismo que lo recibe no ve quién sos. Si un reporte no cumple estas condiciones, Reportalo puede desestimarlo y suspender o bloquear tu cuenta. Si el contenido pudiera constituir un delito según la ley argentina, Reportalo lo denunciará ante la autoridad competente y pondrá a su disposición los datos de la cuenta que la ley le exija entregar.',
];

const renderCondiciones = () =>
  render(
    <MemoryRouter initialEntries={['/terminos']}>
      <TermsAndPermissionsPage />
    </MemoryRouter>
  );

describe('REP-3868 · Condiciones de uso 1.5: sección «Fotos»', () => {
  it('UT-CF-01: la versión vigente es la 1.5, desde 11/2026', () => {
    expect(CURRENT_TERMS_VERSION).toBe('1.5');
    expect(TERMS_EFFECTIVE_DATE).toBe('11/2026');
  });

  it('UT-CF-02: el encabezado muestra la misma versión que se acepta, no una escrita a mano', () => {
    renderCondiciones();
    expect(screen.getByText(`Versión ${CURRENT_TERMS_VERSION} · vigente desde ${TERMS_EFFECTIVE_DATE}`)).toBeInTheDocument();
  });

  it('UT-CF-03: la sección «Fotos» tiene los tres párrafos de Hernán, sin cambios', () => {
    renderCondiciones();
    const seccion = screen.getByTestId('terminos-fotos');
    expect(within(seccion).getByRole('heading', { level: 2 }).textContent).toBe('4. Fotos');
    const parrafos = Array.from(seccion.querySelectorAll('p')).map((p) => p.textContent.replace(/\s+/g, ' ').trim());
    expect(parrafos).toEqual(FOTOS);
  });

  it('UT-CF-04: dice que se difuminan los rostros y que las patentes no (REP-3798: no prometer patentes)', () => {
    renderCondiciones();
    const texto = screen.getByTestId('terminos-fotos').textContent;
    expect(texto).toMatch(/Los rostros se difuminan/);
    expect(texto).toMatch(/las patentes no/);
    expect(texto).not.toMatch(/patentes se difuminan|se difuminan las patentes/i);
  });
});

// Las Condiciones 1.5 dicen que las patentes no se difuminan, y es lo que hace el servidor: quarantine-anonymize tiene
// PIXELATE_LICENSE_PLATES = false. Ninguna pantalla (tampoco el panel del organismo) puede decir lo contrario.
describe('REP-3868 · ningún texto promete que se difuminan las patentes', () => {
  const raiz = resolve(__dirname, '../..');
  const archivos = (dir) =>
    readdirSync(dir).flatMap((nombre) => {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) return nombre === 'test' ? [] : archivos(ruta);
      return /\.(jsx?|tsx?)$/.test(nombre) ? [ruta] : [];
    });

  it('UT-CF-05: el servidor no pixela patentes', () => {
    const vision = readFileSync(join(raiz, 'supabase/functions/quarantine-anonymize/vision.ts'), 'utf8');
    expect(vision).toMatch(/export const PIXELATE_LICENSE_PLATES = false;/);
  });

  it('UT-CF-06: ninguna pantalla dice que las patentes se difuminan', () => {
    const promesa = /patentes? (?:se )?difuminad|patentes se difuminan|y (?:las )?patentes (?:se )?difumin/i;
    const conPromesa = archivos(join(raiz, 'src')).filter((ruta) => promesa.test(readFileSync(ruta, 'utf8')));
    expect(conPromesa).toEqual([]);
  });
});
