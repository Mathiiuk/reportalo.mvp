// ==============================================================================
// Componente de Marca: Logo Oficial (Logo.jsx)
// ==============================================================================

// Importación de React y estado para fallback
import React, { useState } from 'react';
// Icono vectorial de respaldo
import { MapPin } from 'lucide-react';

export const Logo = ({ size = 'md', showText = true, className = '' }) => {
  const [imageError, setImageError] = useState(false);

  const sizeDimensions = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
  };

  const textSizes = {
    sm: 'text-sm font-extrabold',
    md: 'text-lg font-extrabold',
    lg: 'text-2xl font-extrabold',
    xl: 'text-3xl font-extrabold',
  };

  const roundedClasses = {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-2xl',
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Contenedor del Isotipo / Imagen Oficial */}
      {!imageError ? (
        <img
          src="/logo.png"
          alt="Reportalo Logo"
          className={`${sizeDimensions[size]} ${roundedClasses[size]} object-contain flex-shrink-0`}
          onError={() => setImageError(true)}
        />
      ) : (
        // Fallback vectorial en caso de que la imagen no cargue
        <div className={`${sizeDimensions[size]} ${roundedClasses[size]} bg-primary text-white flex items-center justify-center shadow-xs flex-shrink-0`}>
          <MapPin className="w-2/3 h-2/3" />
        </div>
      )}

      {/* Nombre de la marca */}
      {showText && (
        <span className={`${textSizes[size]} tracking-tight text-slate-900 leading-none select-none`}>
          Reportalo
        </span>
      )}
    </div>
  );
};
