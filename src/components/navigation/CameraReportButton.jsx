import React from 'react';
import { Camera } from 'lucide-react';

export const CameraReportButton = () => {
  const handlePress = () => {
    // TODO: Abrir flujo de reporte con cámara
  };

  return (
    <button
      type="button"
      onClick={handlePress}
      className="absolute bottom-[76px] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-accent hover:bg-accent-hover active:scale-95 text-white font-bold text-sm min-h-[48px] px-5 py-3 rounded-full shadow-lg shadow-accent/30 border border-accent-hover/30 transition-all cursor-pointer"
      aria-label="Reportar con foto"
    >
      <Camera className="w-5 h-5" strokeWidth={2.2} aria-hidden="true" />
      <span>Reportar</span>
    </button>
  );
};
