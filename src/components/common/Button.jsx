// ==============================================================================
// Componente UI Reutilizable: Button (Button.jsx)
// ==============================================================================

import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({
  children,
  variant = 'primary', // 'primary' | 'accent' | 'outline' | 'ghost' | 'google'
  size = 'lg',         // 'sm' | 'md' | 'lg'
  fullWidth = true,
  isLoading = false,
  disabled = false,
  icon = null,
  type = 'button',
  onClick,
  className = '',
  ...props
}) => {
  // Clases base asegurando tamaño táctil de 48-56px
  const baseClasses =
    'inline-flex items-center justify-center font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 touch-target cursor-pointer select-none';

  // Variantes visuales con la paleta V2
  const variantClasses = {
    primary:
      'bg-primary hover:bg-primary-dark text-white shadow-sm hover:shadow-md focus:ring-primary/50 rounded-2xl',
    accent:
      'bg-accent hover:bg-accent-hover text-white shadow-md hover:shadow-lg focus:ring-accent/50 rounded-2xl',
    outline:
      'border-2 border-slate-200 hover:border-primary bg-white text-content-primary hover:bg-slate-50 focus:ring-primary/30 rounded-2xl',
    ghost:
      'bg-transparent hover:bg-slate-100 text-content-secondary hover:text-content-primary focus:ring-slate-300 rounded-xl',
    google:
      'border border-slate-200 hover:border-slate-300 bg-white text-content-primary hover:bg-slate-50 shadow-sm focus:ring-slate-300 rounded-2xl',
  };

  // Tamaños estandarizados
  const sizeClasses = {
    sm: 'h-10 px-4 text-sm',
    md: 'h-12 px-5 text-base',
    lg: 'h-13.5 md:h-14 px-6 text-base font-semibold', // 54-56px
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
      disabled={disabled || isLoading}
      onClick={onClick}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 mr-2 animate-spin text-current" aria-hidden="true" />
          <span>Procesando...</span>
        </>
      ) : (
        <>
          {icon && <span className="mr-2.5 inline-flex items-center">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};
