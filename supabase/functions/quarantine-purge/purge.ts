/**
 * @file purge.ts
 * @description Lógica pura de la purga de cuarentena (REP-2501). Separada de index.ts para
 * poder probarla con Vitest.
 */

/** Cuánto puede vivir una foto original en cuarentena antes de que se la elimine. */
export const QUARANTINE_MAX_AGE_MS = 60 * 60 * 1000;

export interface StoredObject {
  name: string;
  created_at?: string | null;
}

/**
 * Elige las rutas que superaron la ventana. Las carpetas y los objetos sin fecha
 * válida se ignoran: sin fecha no se puede afirmar que vencieron.
 */
export const selectExpiredPaths = (
  objects: StoredObject[],
  now: number,
  maxAgeMs: number = QUARANTINE_MAX_AGE_MS
): string[] =>
  objects
    .filter((object) => {
      if (!object.created_at) return false;
      const createdAt = Date.parse(object.created_at);
      return Number.isFinite(createdAt) && now - createdAt >= maxAgeMs;
    })
    .map((object) => object.name);
