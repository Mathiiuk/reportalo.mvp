// ==============================================================================
// Componente de Marca Oficial: Logo Transparente sin Fondos (Logo.jsx)
// ==============================================================================

// Importación de React y estado
import React, { useState } from 'react';
// Icono vectorial de respaldo
import { MapPin } from 'lucide-react';

export const Logo = ({ size = 'md', showText = false, className = '' }) => {
  const [imageError, setImageError] = useState(false);

  // Dimensiones fluidas y proporcionadas del isotipo
  const sizeDimensions = {
    sm: 'w-7 h-8',
    md: 'w-10 h-11',
    lg: 'w-24 h-28',
    xl: 'w-32 h-36',
  };

  const textSizes = {
    sm: 'text-base font-extrabold',
    md: 'text-xl font-extrabold',
    lg: 'text-2xl font-extrabold',
    xl: 'text-3xl font-extrabold',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Isotipo PNG Transparente y Recortado */}
      {!imageError ? (
        <img
          src="/logo-icon.png"
          alt="Reportalo Logo"
          className={`${sizeDimensions[size]} object-contain flex-shrink-0 select-none`}
          onError={() => setImageError(true)}
        />
      ) : (
        // Fallback vectorial en caso de error
        <div className={`${sizeDimensions[size]} text-primary flex items-center justify-center flex-shrink-0`}>
          <MapPin className="w-full h-full stroke-[2.2]" />
        </div>
      )}

      {/* Nombre de marca opcional */}
      {showText && (
        <span className={`${textSizes[size]} tracking-tight text-slate-900 leading-none select-none`}>
          Reportalo
        </span>
      )}
    </div>
  );
};
