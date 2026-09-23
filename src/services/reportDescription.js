/**
 * REP-2203: reglas de la descripción breve del reporte ciudadano.
 * Fuente única de verdad: las usan el formulario (paso 2) y el servicio de envío.
 * El mismo rango se refuerza en la base con un CHECK (migración REP-2203).
 */

export const DESCRIPTION_MIN_LENGTH = 10;
export const DESCRIPTION_MAX_LENGTH = 280;

/**
 * Valida la descripción. Se mide el texto recortado (sin espacios en los bordes).
 * @param {string | null | undefined} value
 * @returns {{ valid: boolean, error: string | null }}
 */
export const validateDescription = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';

  if (text.length === 0) {
    return { valid: false, error: 'Escribí una descripción para continuar.' };
  }
  if (text.length < DESCRIPTION_MIN_LENGTH) {
    return {
      valid: false,
      error: `La descripción necesita al menos ${DESCRIPTION_MIN_LENGTH} caracteres.`,
    };
  }
  if (text.length > DESCRIPTION_MAX_LENGTH) {
    return {
      valid: false,
      error: `La descripción no puede superar los ${DESCRIPTION_MAX_LENGTH} caracteres.`,
    };
  }
  return { valid: true, error: null };
};
