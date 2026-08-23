// ==============================================================================
// Componente de Marca: Logo (Logo.jsx)
// ==============================================================================

import React, { useState } from 'react';
import { MapPin } from 'lucide-react';

export const Logo = ({ size = 'md', showText = true, className = '' }) => {
  const [imageError, setImageError] = useState(false);

  const sizeDimensions = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
  };

  const textSizes = {
    sm: 'text-base font-bold',
    md: 'text-xl font-bold',
    lg: 'text-2xl font-extrabold',
    xl: 'text-3xl font-extrabold',
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Contenedor del Isotipo / Imagen */}
      {!imageError ? (
        <img
          src="/logo.png"
          alt="Reportalo Logo"
          className={`${sizeDimensions[size]} object-contain rounded-2xl drop-shadow-sm`}
          onError={() => setImageError(true)}
        />
      ) : (
        // Fallback vectorial en caso de que la imagen no cargue
        <div className={`${sizeDimensions[size]} rounded-2xl bg-primary text-white flex items-center justify-center shadow-md`}>
          <MapPin className="w-2/3 h-2/3" />
        </div>
      )}

      {/* Nombre de la marca */}
      {showText && (
        <span className={`${textSizes[size]} tracking-tight text-content-primary`}>
          Reportalo
        </span>
      )}
    </div>
  );
};
