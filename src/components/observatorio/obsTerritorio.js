import { getLocalityCentroid } from '../../services/localityCentroids';
import { NIVEL_HIJO } from '../../services/observatorioService';

/**
 * OBS · F3 · Territorio del observatorio: índice de zonas, migas y centro aproximado de cada zona en el mapa.
 *
 * La base no tiene polígonos: el centro de un barrio o localidad sale de localityCentroids.js (aproximado), el de una
 * comuna o partido es el promedio de sus barrios, y el de una provincia el promedio de sus comunas o partidos. Una zona
 * sin centro conocido no se dibuja en el mapa, pero sigue en la tabla.
 */

// localityCentroids.js solo tiene barrios de CABA y localidades del partido de Avellaneda (Buenos Aires).
// Se busca por nombre, así que fuera de esas dos provincias NO se usa: «Avellaneda» de Santa Fe caería en la de Buenos Aires.
const PROVINCIAS_CON_CENTROS = ['Ciudad Autónoma de Buenos Aires', 'Buenos Aires'];

export const NOMBRE_PAIS = 'Argentina';

/** Nombre corto para textos chicos (notas, columnas angostas): «Ciudad Autónoma de Buenos Aires» → «CABA». */
export const nombreCorto = (nombre) => (nombre === 'Ciudad Autónoma de Buenos Aires' ? 'CABA' : nombre);

/**
 * Índice de zonas por id, a partir de obs_zonas.
 * @returns {Map<string, { id, nivel, nombre, padreId, provinciaId, provincia }>}
 */
export const indexarTerritorio = (zonas) => {
  const porId = new Map();
  zonas.forEach((z) =>
    porId.set(z.zona_id, { id: z.zona_id, nivel: z.nivel, nombre: z.nombre, padreId: z.padre_id ?? null, provinciaId: z.provincia_id ?? null })
  );
  porId.forEach((z) => {
    z.provincia = porId.get(z.provinciaId ?? z.id)?.nombre ?? null;
  });
  return porId;
};

/** Hijos de una zona (o las provincias, para el país), en orden alfabético con números naturales. */
export const hijosDe = (indice, nivel, zonaId) => {
  const nivelHijo = NIVEL_HIJO[nivel];
  if (!nivelHijo) return [];
  return [...indice.values()]
    .filter((z) => z.nivel === nivelHijo && (nivel === 'pais' || z.padreId === zonaId))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
};

/**
 * Los pasos desde el país hasta la zona: [{ nivel: 'pais' }, { nivel: 'provincia', id, nombre }, …].
 */
export const camino = (indice, nivel, zonaId) => {
  const pasos = [];
  let z = nivel === 'pais' ? null : indice.get(zonaId);
  while (z) {
    pasos.unshift({ nivel: z.nivel, id: z.id, nombre: z.nombre });
    z = z.padreId ? indice.get(z.padreId) : null;
  }
  return [{ nivel: 'pais', id: null, nombre: NOMBRE_PAIS }, ...pasos];
};

const promedio = (puntos) => {
  const validos = puntos.filter(Boolean);
  if (!validos.length) return null;
  return [validos.reduce((s, p) => s + p[0], 0) / validos.length, validos.reduce((s, p) => s + p[1], 0) / validos.length];
};

/**
 * Centro aproximado [lng, lat] de una zona, o null si no se conoce.
 */
export const centroZona = (indice, zona) => {
  if (!zona) return null;
  if (zona.nivel === 'localidad') {
    return PROVINCIAS_CON_CENTROS.includes(zona.provincia) ? getLocalityCentroid(zona.nombre) : null;
  }
  return promedio(hijosDe(indice, zona.nivel, zona.id).map((h) => centroZona(indice, h)));
};
