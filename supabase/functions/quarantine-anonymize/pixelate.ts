/**
 * @file pixelate.ts
 * @description Lógica pura del pixelado de zonas sensibles (REP-3793).
 * Trabaja sobre el mapa de píxeles RGBA ya decodificado, sin Deno ni red, para poder
 * probarla con Vitest y reusarla en el spike de CPU (scripts/rep3793/spike-cpu).
 */

/** Zona sensible en píxeles reales de la imagen (esquina superior izquierda, ancho y alto). */
export interface Zone {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'face' | 'license_plate';
}

/** Margen que se agrega a cada zona (12 %) para que no queden bordes del rostro o la patente a la vista. */
export const ZONE_PADDING_RATIO = 0.12;

/** Tamaño mínimo del bloque, en píxeles: por debajo de esto una patente cercana sigue siendo legible. */
export const MIN_BLOCK_SIZE = 10;

/** Cantidad máxima de bloques sobre el lado mayor de la zona: menos bloques, menos información recuperable. */
export const MAX_BLOCKS_PER_SIDE = 8;

/**
 * Agranda la zona un porcentaje de su tamaño en cada lado y la recorta a los bordes de la imagen.
 * Devuelve null si la zona queda vacía (por ejemplo, si estaba entera fuera de la imagen).
 */
export const expandZone = (
  zone: Zone,
  imageWidth: number,
  imageHeight: number,
  paddingRatio = ZONE_PADDING_RATIO
): Zone | null => {
  // Margen horizontal y vertical proporcional al tamaño de la zona
  const padX = zone.width * paddingRatio;
  const padY = zone.height * paddingRatio;
  // Se redondea hacia afuera para no perder ni un píxel del borde
  const x1 = Math.max(0, Math.floor(zone.x - padX));
  const y1 = Math.max(0, Math.floor(zone.y - padY));
  const x2 = Math.min(imageWidth, Math.ceil(zone.x + zone.width + padX));
  const y2 = Math.min(imageHeight, Math.ceil(zone.y + zone.height + padY));
  // Una zona sin área no se puede pixelar
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1, type: zone.type };
};

/**
 * Tamaño del bloque según la zona: como máximo MAX_BLOCKS_PER_SIDE bloques sobre el lado mayor,
 * y nunca menos de MIN_BLOCK_SIZE píxeles. Así un rostro grande y una patente chica quedan
 * igual de ilegibles.
 */
export const blockSizeFor = (zone: Pick<Zone, 'width' | 'height'>): number =>
  Math.max(MIN_BLOCK_SIZE, Math.ceil(Math.max(zone.width, zone.height) / MAX_BLOCKS_PER_SIDE));

/**
 * Pixela una zona en el lugar: cada bloque se reemplaza por el color promedio de sus píxeles.
 * El promedio descarta el detalle de forma irreversible (a diferencia de un blur leve, que se
 * puede revertir en parte). La zona tiene que venir ya recortada a la imagen (expandZone).
 * @param bitmap Píxeles RGBA, 4 bytes por píxel, fila por fila
 */
export const pixelateZone = (
  bitmap: Uint8Array | Uint8ClampedArray,
  imageWidth: number,
  zone: Zone,
  blockSize = blockSizeFor(zone)
): void => {
  const endX = zone.x + zone.width;
  const endY = zone.y + zone.height;

  // Se recorre la zona de a bloques
  for (let by = zone.y; by < endY; by += blockSize) {
    const blockEndY = Math.min(by + blockSize, endY);
    for (let bx = zone.x; bx < endX; bx += blockSize) {
      const blockEndX = Math.min(bx + blockSize, endX);

      // 1. Promedio de cada canal dentro del bloque
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let y = by; y < blockEndY; y++) {
        let i = (y * imageWidth + bx) * 4;
        for (let x = bx; x < blockEndX; x++, i += 4) {
          r += bitmap[i];
          g += bitmap[i + 1];
          b += bitmap[i + 2];
          a += bitmap[i + 3];
          count++;
        }
      }
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      a = Math.round(a / count);

      // 2. Todo el bloque pasa a tener ese único color
      for (let y = by; y < blockEndY; y++) {
        let i = (y * imageWidth + bx) * 4;
        for (let x = bx; x < blockEndX; x++, i += 4) {
          bitmap[i] = r;
          bitmap[i + 1] = g;
          bitmap[i + 2] = b;
          bitmap[i + 3] = a;
        }
      }
    }
  }
};

/**
 * Agranda y pixela todas las zonas sobre el mapa de píxeles.
 * @returns Las zonas efectivamente pixeladas, ya agrandadas y recortadas (para auditoría y QA)
 */
export const pixelateZones = (
  bitmap: Uint8Array | Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  zones: Zone[]
): Zone[] => {
  const applied: Zone[] = [];
  for (const zone of zones) {
    // Margen de seguridad y recorte a la imagen
    const expanded = expandZone(zone, imageWidth, imageHeight);
    if (!expanded) continue;
    pixelateZone(bitmap, imageWidth, expanded);
    applied.push(expanded);
  }
  return applied;
};
