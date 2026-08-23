// ==============================================================================
// Componente UI Reutilizable: Spinner (Spinner.jsx)
// ==============================================================================

import React from 'react';
import { Loader2 } from 'lucide-react';

export const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return (
    <div className={`flex items-center justify-center p-2 ${className}`}>
      <Loader2 className={`${sizes[size]} animate-spin text-primary`} aria-hidden="true" />
      <span className="sr-only">Cargando...</span>
    </div>
  );
};
