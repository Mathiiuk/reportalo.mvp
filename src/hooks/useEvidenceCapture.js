import { useState, useCallback, useEffect } from 'react';
import {
  createEvidenceItem,
  ALLOWED_EVIDENCE_MIME_TYPES,
  MAX_EVIDENCE_SIZE_BYTES,
} from '../types/evidence';

const MAX_PHOTOS = 4;

/**
 * Hook para gestionar la captura de evidencia multifoto (1 a 4 fotos) desacoplada de backend/privacidad.
 * @param {object} [options]
 * @param {Array} [options.initialEvidenceList] Lista inicial de fotos (opcional, para inicialización o tests)
 * @param {object} [options.geolocation] Coordenadas de ubicacion actuales para etiquetar las fotos
 * @param {Function} [options.onEvidenceCaptured] Callback al capturar evidencia exitosa
 */
export const useEvidenceCapture = ({ initialEvidenceList = [], geolocation = null, onEvidenceCaptured } = {}) => {
  // Estado local que almacena la lista de evidencias capturadas
  const [evidenceList, setEvidenceList] = useState(initialEvidenceList);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Revocar URLs de objetos al desmontar para prevenir memory leaks
  useEffect(() => {
    return () => {
      evidenceList.forEach((item) => {
        if (item?.previewUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, [evidenceList]);

  const captureFile = useCallback(
    async (file) => {
      setError(null);
      setIsProcessing(true);

      if (!file) {
        setIsProcessing(false);
        return { success: false, error: 'No se seleccionó ninguna imagen.' };
      }

      if (evidenceList.length >= MAX_PHOTOS) {
        const errorMsg = `Podés adjuntar un máximo de ${MAX_PHOTOS} fotografías.`;
        setError(errorMsg);
        setIsProcessing(false);
        return { success: false, error: errorMsg };
      }

      // 1. Validar tipo MIME
      const isValidType = ALLOWED_EVIDENCE_MIME_TYPES.includes(file.type);
      if (!isValidType) {
        const errorMsg = 'Formato de imagen no admitido. Usá JPG, PNG o WebP.';
        setError(errorMsg);
        setIsProcessing(false);
        return { success: false, error: errorMsg };
      }

      // 2. Validar tamaño maximo (10MB por foto)
      if (file.size > MAX_EVIDENCE_SIZE_BYTES) {
        const errorMsg = 'La imagen supera el tamaño máximo permitido de 10 MB.';
        setError(errorMsg);
        setIsProcessing(false);
        return { success: false, error: errorMsg };
      }

      try {
        // 3. Crear EvidenceItem desacoplado con estado CAPTURED_LOCAL
        const newEvidence = createEvidenceItem(file, geolocation);
        const updatedList = [...evidenceList, newEvidence];
        setEvidenceList(updatedList);
        setIsProcessing(false);

        if (onEvidenceCaptured) {
          onEvidenceCaptured(updatedList);
        }

        return { success: true, evidence: newEvidence, evidenceList: updatedList };
      } catch (err) {
        const errorMsg = err.message || 'Error al procesar la imagen seleccionada.';
        setError(errorMsg);
        setIsProcessing(false);
        return { success: false, error: errorMsg };
      }
    },
    [evidenceList, geolocation, onEvidenceCaptured]
  );

  const removePhoto = useCallback((id) => {
    setEvidenceList((prev) => {
      const itemToRemove = prev.find((item) => item.id === id);
      if (itemToRemove?.previewUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(itemToRemove.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
    setError(null);
  }, []);

  const clearEvidence = useCallback(() => {
    evidenceList.forEach((item) => {
      if (item?.previewUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setEvidenceList([]);
    setError(null);
  }, [evidenceList]);

  // Función para restaurar evidencias desde un borrador guardado en IndexedDB (REP-2703)
  const restoreEvidenceList = useCallback((newList) => {
    // Si la lista es válida, la establecemos directamente en el estado
    if (Array.isArray(newList)) {
      setEvidenceList(newList);
      setError(null);
    }
  }, []);

  return {
    evidenceList,
    // Compatibilidad con referencia singular
    evidence: evidenceList[0] || null,
    error,
    isProcessing,
    hasEvidence: evidenceList.length > 0,
    photoCount: evidenceList.length,
    maxPhotos: MAX_PHOTOS,
    canAddMore: evidenceList.length < MAX_PHOTOS,
    captureFile,
    removePhoto,
    clearEvidence,
    restoreEvidenceList,
  };
};

