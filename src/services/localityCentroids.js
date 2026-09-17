/**
 * @file localityCentroids.js
 * @description Coordenadas aproximadas (centroide) de los barrios de CABA y las
 * localidades del partido de Avellaneda habilitados en REP-2500. Son datos públicos
 * y aproximados (no polígonos oficiales) — se usan solo para una advertencia suave de
 * "el pin parece lejos del barrio elegido", nunca para bloquear ni para inferir el barrio
 * automáticamente (esa sigue siendo una decisión manual del ciudadano, ver locationService.js).
 *
 * Formato: [lng, lat], igual que las coordenadas que usa MapLibre en el resto del módulo.
 */
import { normalizeForSearch } from './localitiesService';

const RAW_CENTROIDS = {
  // Barrios de la Ciudad Autónoma de Buenos Aires
  'Agronomía': [-58.4869, -34.5919],
  'Almagro': [-58.4204, -34.6082],
  'Balvanera': [-58.4030, -34.6098],
  'Barracas': [-58.3839, -34.6455],
  'Belgrano': [-58.4562, -34.5629],
  'Boedo': [-58.4183, -34.6293],
  'Caballito': [-58.4436, -34.6187],
  'Chacarita': [-58.4527, -34.5870],
  'Coghlan': [-58.4750, -34.5615],
  'Colegiales': [-58.4497, -34.5745],
  'Constitución': [-58.3810, -34.6265],
  'Flores': [-58.4636, -34.6280],
  'Floresta': [-58.4841, -34.6296],
  'La Boca': [-58.3631, -34.6345],
  'La Paternal': [-58.4694, -34.5947],
  'Liniers': [-58.5222, -34.6428],
  'Mataderos': [-58.5083, -34.6598],
  'Monte Castro': [-58.5027, -34.6180],
  'Monserrat': [-58.3809, -34.6106],
  'Nueva Pompeya': [-58.4180, -34.6486],
  'Núñez': [-58.4636, -34.5453],
  'Palermo': [-58.4205, -34.5875],
  'Parque Avellaneda': [-58.4732, -34.6408],
  'Parque Chacabuco': [-58.4381, -34.6357],
  'Parque Chas': [-58.4750, -34.5850],
  'Parque Patricios': [-58.4053, -34.6357],
  'Puerto Madero': [-58.3650, -34.6100],
  'Recoleta': [-58.3927, -34.5895],
  'Retiro': [-58.3746, -34.5924],
  'Saavedra': [-58.4864, -34.5555],
  'San Cristóbal': [-58.4022, -34.6217],
  'San Nicolás': [-58.3816, -34.6037],
  'San Telmo': [-58.3731, -34.6212],
  'Vélez Sarsfield': [-58.4908, -34.6301],
  'Versalles': [-58.5218, -34.6280],
  'Villa Crespo': [-58.4390, -34.5990],
  'Villa del Parque': [-58.4899, -34.6011],
  'Villa Devoto': [-58.5175, -34.5993],
  'Villa General Mitre': [-58.4823, -34.6117],
  'Villa Lugano': [-58.4711, -34.6779],
  'Villa Luro': [-58.5001, -34.6389],
  'Villa Ortúzar': [-58.4680, -34.5800],
  'Villa Pueyrredón': [-58.5010, -34.5810],
  'Villa Real': [-58.5240, -34.6157],
  'Villa Riachuelo': [-58.4529, -34.6853],
  'Villa Santa Rita': [-58.4762, -34.6172],
  'Villa Soldati': [-58.4386, -34.6668],
  'Villa Urquiza': [-58.4919, -34.5715],
  // Localidades del partido de Avellaneda (Buenos Aires)
  'Avellaneda': [-58.3650, -34.6626],
  'Crucecita': [-58.3550, -34.6600],
  'Dock Sud': [-58.3467, -34.6467],
  'Gerli': [-58.3833, -34.6767],
  'Piñeyro': [-58.3667, -34.6700],
  'Sarandí': [-58.3500, -34.6833],
  'Villa Domínico': [-58.3467, -34.6967],
  'Wilde': [-58.3400, -34.7047],
};

// Índice normalizado (sin tildes/mayúsculas) para hacer match robusto con el nombre
// que llega desde `LocalitySelector` (que a su vez usa `normalizeForSearch`, ver R-5).
const CENTROIDS_BY_NORMALIZED_NAME = Object.fromEntries(
  Object.entries(RAW_CENTROIDS).map(([name, coords]) => [normalizeForSearch(name), coords])
);

/**
 * Busca el centroide aproximado de una localidad a partir de su label completo
 * ("Almagro — Comuna 5, Ciudad Autónoma de Buenos Aires") o de su nombre solo.
 * @param {string} localityLabel
 * @returns {[number, number]|null} [lng, lat] o null si no se encontró
 */
export const getLocalityCentroid = (localityLabel) => {
  if (!localityLabel) return null;
  const namePart = localityLabel.split('—')[0].trim();
  return CENTROIDS_BY_NORMALIZED_NAME[normalizeForSearch(namePart)] ?? null;
};

/**
 * Distancia aproximada en metros entre dos puntos [lng, lat] (fórmula de Haversine).
 * @param {[number, number]} a
 * @param {[number, number]} b
 * @returns {number} distancia en metros
 */
export const distanceInMeters = ([lngA, latA], [lngB, latB]) => {
  const EARTH_RADIUS_METERS = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * sinDLng * sinDLng;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
};

// Umbral a partir del cual avisamos que el pin parece lejos del barrio elegido. Los
// barrios de CABA suelen medir 1-2km de punta a punta, así que 2.5km tolera estar cerca
// de un límite sin generar falsos positivos constantes, pero sí detecta casos como
// "pin en Retiro, barrio Almagro" (~5km).
export const LOCALITY_MISMATCH_THRESHOLD_METERS = 2500;

/**
 * Indica si el pin está sospechosamente lejos del centroide del barrio elegido.
 * Es una advertencia aproximada, no una validación exacta (no hay polígonos oficiales).
 * @param {[number, number]} pinCoords [lng, lat]
 * @param {string} localityLabel
 * @returns {{ isFar: boolean, distanceMeters: number|null }}
 */
export const checkLocalityPinMismatch = (pinCoords, localityLabel) => {
  const centroid = getLocalityCentroid(localityLabel);
  if (!centroid || !Array.isArray(pinCoords)) {
    return { isFar: false, distanceMeters: null };
  }
  const distanceMeters = distanceInMeters(pinCoords, centroid);
  return { isFar: distanceMeters > LOCALITY_MISMATCH_THRESHOLD_METERS, distanceMeters };
};
