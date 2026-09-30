/**
 * REP-2204: datos mínimos para poder enviar un reporte.
 * Fuente única para el botón de envío y para el mensaje de qué falta.
 */

import { validateDescription } from './reportDescription';

/**
 * @param {object} params
 * @param {Array} [params.evidenceList] Fotos adjuntas
 * @param {object|null} [params.selectedCategory] Categoría elegida
 * @param {string} [params.description] Descripción escrita
 * @param {boolean} [params.hasConfirmedLocality] Si el ciudadano confirmó la localidad
 * @param {boolean} [params.requireLocation] false sin conexión (REP-3801): el borrador se puede guardar sin
 *   localidad, porque el selector no siempre puede cargarse sin red. La ubicación se completa desde Pendientes
 *   y el envío definitivo sigue exigiéndola (getDraftProblems).
 * @returns {{ ready: boolean, missing: Array<{ key: string, label: string }> }}
 */
export const getSubmissionReadiness = ({
  evidenceList = [],
  selectedCategory = null,
  description = '',
  hasConfirmedLocality = false,
  requireLocation = true,
} = {}) => {
  const missing = [];

  if (!evidenceList || evidenceList.length === 0) {
    missing.push({ key: 'evidence', label: 'Agregá al menos una foto.' });
  }
  if (!selectedCategory) {
    missing.push({ key: 'category', label: 'Elegí una categoría.' });
  }
  const descriptionCheck = validateDescription(description);
  if (!descriptionCheck.valid) {
    missing.push({ key: 'description', label: descriptionCheck.error });
  }
  if (requireLocation && !hasConfirmedLocality) {
    missing.push({ key: 'location', label: 'Confirmá la ubicación del reporte.' });
  }

  return { ready: missing.length === 0, missing };
};
