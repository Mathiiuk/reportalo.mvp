import { useState, useCallback, useEffect } from 'react';
import {
  createEvidenceItem,
  ALLOWED_EVIDENCE_MIME_TYPES,
  MAX_EVIDENCE_SIZE_BYTES,
} from '../types/evidence';

/**
 * Hook para gestionar la captura de evidencia fotografica desacoplada de backend/privacidad.
 * @param {object} [options]
 * @param {object} [options.geolocation] Coordenadas de ubicacion actuales para etiquetar la foto
 * @param {Function} [options.onEvidenceCaptured] Callback al capturar evidencia exitosa
 */
export const useEvidenceCapture = ({ geolocation = null, onEvidenceCaptured } = {}) => {
  const [evidence, setEvidence] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Revocar URL de objeto al desmontar o reemplazar para prevenir memory leaks
  useEffect(() => {
    return () => {
      if (evidence?.previewUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(evidence.previewUrl);
      }
    };
  }, [evidence]);

  const captureFile = useCallback(
    async (file) => {
      setError(null);
      setIsProcessing(true);

      if (!file) {
        setIsProcessing(false);
        return { success: false, error: 'No se seleccionó ninguna imagen.' };
      }

      // 1. Validar tipo MIME
      const isValidType = ALLOWED_EVIDENCE_MIME_TYPES.includes(file.type);
      if (!isValidType) {
        const errorMsg = 'Formato de imagen no admitido. Usá JPG, PNG o WebP.';
        setError(errorMsg);
        setIsProcessing(false);
        return { success: false, error: errorMsg };
      }

      // 2. Validar tamaño maximo (10MB)
      if (file.size > MAX_EVIDENCE_SIZE_BYTES) {
        const errorMsg = 'La imagen supera el tamaño máximo permitido de 10 MB.';
        setError(errorMsg);
        setIsProcessing(false);
        return { success: false, error: errorMsg };
      }

      try {
        // 3. Crear EvidenceItem desacoplado con estado CAPTURED_LOCAL
        const newEvidence = createEvidenceItem(file, geolocation);
        setEvidence(newEvidence);
        setIsProcessing(false);

        if (onEvidenceCaptured) {
          onEvidenceCaptured(newEvidence);
        }

        return { success: true, evidence: newEvidence };
      } catch (err) {
        const errorMsg = err.message || 'Error al procesar la imagen seleccionada.';
        setError(errorMsg);
        setIsProcessing(false);
        return { success: false, error: errorMsg };
      }
    },
    [geolocation, onEvidenceCaptured]
  );

  const clearEvidence = useCallback(() => {
    if (evidence?.previewUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(evidence.previewUrl);
    }
    setEvidence(null);
    setError(null);
  }, [evidence]);

  return {
    evidence,
    error,
    isProcessing,
    hasEvidence: Boolean(evidence),
    captureFile,
    clearEvidence,
  };
};
