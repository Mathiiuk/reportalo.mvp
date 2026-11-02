/**
 * @file Rep3878ObservacionesValidador.test.js
 * @description REP-3878 (re-auditoría de Iván sobre `88e3c65`): O-01 y O-06 del validador de citas con elisión.
 * - O-01 (V-63): con la fuente en NFD, una cita correcta en NFC se rechazaba porque la búsqueda de tramos comparaba
 *   bytes distintos. Ahora la cita y el fragmento pasan a NFC antes de buscar.
 * - O-06: lo que la batería de QA cubría y la suite del repo no: tramos que no se solapan, el mínimo exacto 14/15 y la
 *   marca `[…]`.
 * Se prueban el espejo del frontend y la réplica de los runners; que la función de analizar-reporte tenga el mismo código
 * lo controla Rep3857CitasConElision.test.js.
 */
import { describe, it, expect } from 'vitest';
import { quoteMatchesFragment } from '../services/validateLlmAnalysis';
import { quoteMatchesFragment as replicaRunners } from '../../scripts/rag-local-dev/rep-diag-generacion/lib.mjs';

const COPIAS = [
  ['espejo del frontend', quoteMatchesFragment],
  ['réplica de los runners', replicaRunners],
];

const nfd = (texto) => texto.normalize('NFD');

describe.each(COPIAS)('REP-3878 O-01 · NFC y NFD (%s)', (_, validar) => {
  const fragmento = 'Constituyen obras públicas municipales: a) Las concernientes a los establecimientos. d) Las de infraestructura urbana, en especial las de pavimentación.';
  const cita = 'Constituyen obras públicas municipales: ... d) Las de infraestructura urbana, en especial las de pavimentación.';

  it('los textos de prueba de verdad están en formas distintas', () => {
    expect(nfd(fragmento)).not.toBe(fragmento);
    expect(nfd(fragmento).normalize('NFC')).toBe(fragmento);
  });

  it('V-63: cita en NFC contra fuente en NFD, con elisión, se acepta', () => {
    expect(validar(cita, nfd(fragmento))).toBe(true);
  });

  it('al revés: cita en NFD contra fuente en NFC, con elisión, se acepta', () => {
    expect(validar(nfd(cita), fragmento)).toBe(true);
  });

  it('sin marca, la cita literal también se acepta con la fuente en NFD', () => {
    expect(validar('Las de infraestructura urbana, en especial las de pavimentación.', nfd(fragmento))).toBe(true);
  });

  it('NFC no deja pasar texto inventado', () => {
    expect(validar('Constituyen obras públicas municipales: ... d) Las de infraestructura rural.', nfd(fragmento))).toBe(false);
  });

  it('una salvedad con tilde en NFD («ningún», «únicamente») sigue bloqueando la elisión', () => {
    for (const salvedad of ['En ningún caso', 'Únicamente']) {
      const conSalvedad = nfd(`El titular debe mantener la vereda. ${salvedad} la autoridad de aplicación del municipio controla.`);
      expect(validar('El titular debe mantener la vereda. ... la autoridad de aplicación del municipio controla.', conSalvedad)).toBe(false);
    }
  });
});

describe.each(COPIAS)('REP-3878 O-06 · reglas que la suite no cubría (%s)', (_, validar) => {
  const fragmento = 'El titular debe mantener la vereda en buen estado y la autoridad de aplicación del municipio controla.';

  it('los tramos no se pueden solapar en el fragmento', () => {
    const corto = 'Se permite estacionar sobre la vereda del frente.';
    // El segundo tramo existe, pero empieza adentro del primero: no hay texto omitido entre los dos.
    expect(validar('Se permite estacionar sobre la ... estacionar sobre la vereda del frente.', corto)).toBe(false);
  });

  it('tramo de 15 caracteres: se acepta', () => {
    expect('El titular debe'.length).toBe(15);
    expect(validar('El titular debe ... la autoridad de aplicación del municipio controla.', fragmento)).toBe(true);
  });

  it('tramo de 14 caracteres: se rechaza aunque sea literal', () => {
    expect('El titular deb'.length).toBe(14);
    expect(validar('El titular deb ... la autoridad de aplicación del municipio controla.', fragmento)).toBe(false);
  });

  it('la marca «[…]» funciona como las demás', () => {
    expect(validar('El titular debe mantener la vereda […] la autoridad de aplicación del municipio controla.', fragmento)).toBe(true);
    expect(validar('El titular debe mantener la vereda [ … ] la autoridad de aplicación del municipio controla.', fragmento)).toBe(true);
  });

  it('con «[…]», una salvedad en lo omitido rechaza', () => {
    const conSalvedad = 'El titular debe mantener la vereda salvo que la autoridad de aplicación del municipio controla.';
    expect(validar('El titular debe mantener la vereda […] la autoridad de aplicación del municipio controla.', conSalvedad)).toBe(false);
  });
});
