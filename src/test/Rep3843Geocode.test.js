/**
 * @file Rep3843Geocode.test.js
 * @description REP-3843: lógica pura del proxy geocodificar-direccion. Convierte la respuesta de Nominatim en
 * { street, number, roadType } sin inventar datos. Las respuestas de ejemplo son las reales del 25/10/2026.
 */
import { describe, it, expect } from 'vitest';
import {
  parseNominatimReverse,
  classifyRoadType,
  isValidCoordinate,
  buildReverseUrl,
} from '../../supabase/functions/geocodificar-direccion/geocode';

// Balvanera (CABA): calle sin altura · Crucecita (Avellaneda): avenida con altura
const BALVANERA = { category: 'highway', type: 'residential', address: { road: 'Jean Jaures', suburb: 'Balvanera' } };
const CRUCECITA = { category: 'place', type: 'house', address: { road: 'Avenida Bartolomé Mitre', house_number: '745' } };

describe('REP-3843 · geocode (proxy)', () => {
  it('UT-3843-G1: calle sin altura → la altura queda vacía, no se inventa', () => {
    expect(parseNominatimReverse(BALVANERA)).toEqual({ street: 'Jean Jaures', number: null, roadType: 'secundaria' });
  });

  it('UT-3843-G2: avenida con altura → calle, altura y tipo avenida', () => {
    expect(parseNominatimReverse(CRUCECITA)).toEqual({ street: 'Avenida Bartolomé Mitre', number: '745', roadType: 'avenida' });
  });

  it('UT-3843-G3: sin calle, con error o vacío → null', () => {
    expect(parseNominatimReverse({ address: { suburb: 'Sarandí' } })).toBeNull();
    expect(parseNominatimReverse({ error: 'Unable to geocode' })).toBeNull();
    expect(parseNominatimReverse(null)).toBeNull();
  });

  it('UT-3843-G4: altura que no es un número de puerta (rango, texto) → se descarta', () => {
    expect(parseNominatimReverse({ address: { road: 'Mitre', house_number: '700-800' } }).number).toBeNull();
    expect(parseNominatimReverse({ address: { road: 'Mitre', house_number: 's/n' } }).number).toBeNull();
  });

  it('UT-3843-G5: tipo de vía por el nombre (vocabulario de route_report)', () => {
    expect(classifyRoadType('Avenida Rivadavia')).toBe('avenida');
    expect(classifyRoadType('Av. Corrientes')).toBe('avenida');
    expect(classifyRoadType('av Belgrano')).toBe('avenida');
    expect(classifyRoadType('Avellaneda')).toBe('secundaria');
    expect(classifyRoadType('Jean Jaures')).toBe('secundaria');
    expect(classifyRoadType('')).toBeNull();
  });

  it('UT-3843-G6: solo coordenadas dentro de Argentina', () => {
    expect(isValidCoordinate(-34.6083, -58.4106)).toBe(true);
    expect(isValidCoordinate(40.4, -3.7)).toBe(false);
    expect(isValidCoordinate('x', -58)).toBe(false);
  });

  it('UT-3843-G7: la consulta a Nominatim es reverse jsonv2 con detalle de dirección y en español', () => {
    const url = new URL(buildReverseUrl(-34.6083, -58.4106));
    expect(url.origin + url.pathname).toBe('https://nominatim.openstreetmap.org/reverse');
    expect(url.searchParams.get('format')).toBe('jsonv2');
    expect(url.searchParams.get('addressdetails')).toBe('1');
    expect(url.searchParams.get('accept-language')).toBe('es');
    expect(url.searchParams.get('lat')).toBe('-34.6083');
  });
});
