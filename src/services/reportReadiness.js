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
 * @returns {{ ready: boolean, missing: Array<{ key: string, label: string }> }}
 */
export const getSubmissionReadiness = ({
  evidenceList = [],
  selectedCategory = null,
  description = '',
  hasConfirmedLocality = false,
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
  if (!hasConfirmedLocality) {
    missing.push({ key: 'location', label: 'Confirmá la ubicación del reporte.' });
  }

  return { ready: missing.length === 0, missing };
};
