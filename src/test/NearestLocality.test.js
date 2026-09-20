/**
 * @file NearestLocality.test.js
 * @description Pruebas de la sugerencia de localidad por cercanía
 * (REP-2500-PRESEL). Es una función pura: no necesita red ni base.
 */

import { describe, it, expect } from 'vitest';
import {
  findNearestLocality,
  NEAREST_LOCALITY_MAX_METERS,
  getLocalityCentroid,
} from '../services/localityCentroids';

// Labels con el formato real que devuelve getSelectableLocalities.
const LOCALITIES = [
  { id: 'loc-caballito', label: 'Caballito — Comuna 6, Ciudad Autónoma de Buenos Aires' },
  { id: 'loc-almagro', label: 'Almagro — Comuna 5, Ciudad Autónoma de Buenos Aires' },
  { id: 'loc-belgrano', label: 'Belgrano — Comuna 13, Ciudad Autónoma de Buenos Aires' },
  { id: 'loc-inexistente', label: 'Barrio Que No Existe — Comuna X' },
];

const CABALLITO = [-58.4436, -34.6187];
const BELGRANO = [-58.4562, -34.5629];

describe('REP-2500-PRESEL: findNearestLocality', () => {
  it('UT-PRESEL-01: sugiere la localidad cuyo centroide está más cerca', () => {
    const result = findNearestLocality(CABALLITO, LOCALITIES);
    expect(result?.locality.id).toBe('loc-caballito');
    expect(result.distanceMeters).toBeLessThan(500);
  });

  it('UT-PRESEL-02: distingue barrios distintos según la ubicación', () => {
    expect(findNearestLocality(BELGRANO, LOCALITIES)?.locality.id).toBe('loc-belgrano');
  });

  it('UT-PRESEL-03: ignora localidades sin centroide conocido, sin romperse', () => {
    expect(getLocalityCentroid('Barrio Que No Existe — Comuna X')).toBeNull();
    // Aun con una entrada sin centroide en la lista, devuelve la más cercana real.
    expect(findNearestLocality(CABALLITO, LOCALITIES)?.locality.id).toBe('loc-caballito');
  });

  it('UT-PRESEL-04: no sugiere nada si el ciudadano está fuera del área habilitada', () => {
    // Córdoba capital: lejos de cualquier centroide de CABA/Avellaneda.
    const cordoba = [-64.1888, -31.4201];
    expect(findNearestLocality(cordoba, LOCALITIES)).toBeNull();
  });

  it('UT-PRESEL-05: respeta el umbral máximo de distancia', () => {
    const result = findNearestLocality(CABALLITO, LOCALITIES);
    expect(result.distanceMeters).toBeLessThanOrEqual(NEAREST_LOCALITY_MAX_METERS);
  });

  it('UT-PRESEL-06: devuelve null ante entradas inválidas', () => {
    expect(findNearestLocality(null, LOCALITIES)).toBeNull();
    expect(findNearestLocality(CABALLITO, [])).toBeNull();
    expect(findNearestLocality(CABALLITO, null)).toBeNull();
    expect(findNearestLocality([-58.4], LOCALITIES)).toBeNull();
  });
});
