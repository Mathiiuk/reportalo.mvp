// ==============================================================================
// Componente UI: Botón Moderno, Accesible y Ergonómico (Button.jsx)
// ==============================================================================

// Importación de React
import React from 'react';
// Icono de spinner animado para estado de carga
import { Loader2 } from 'lucide-react';

export const Button = ({
  children,
  variant = 'primary', // 'primary' | 'accent' | 'outline' | 'ghost' | 'google' | 'secondary-light'
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
  // Clases estructurales base con touch-target mínimo de 48-54px
  const baseClasses =
    'relative inline-flex items-center justify-center font-bold tracking-tight transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98] select-none touch-target cursor-pointer';

  // Variantes visuales con paleta oficial de Reportalo V2
  const variantClasses = {
    // Azul institucional
    primary:
      'bg-primary hover:bg-primary-dark active:bg-primary-dark text-white shadow-sm hover:shadow-md focus:ring-primary/40 rounded-2xl border border-transparent disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed disabled:active:scale-100',
    // Naranja acento / CTA principal (Con estado deshabilitado neutral y limpio)
    accent:
      'bg-accent hover:bg-accent-hover active:bg-accent-hover text-white shadow-sm hover:shadow-md focus:ring-accent/40 rounded-2xl border border-transparent disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed disabled:active:scale-100',
    // Botón blanco con borde nítido
    outline:
      'border border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 active:bg-slate-100 bg-white text-slate-800 shadow-2xs focus:ring-primary/20 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed',
    // Botón transparente para acciones secundarias
    ghost:
      'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-900 focus:ring-slate-300 rounded-xl disabled:opacity-50',
    // Botón específico de Google OAuth
    google:
      'border border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 active:bg-slate-100 bg-white text-slate-700 shadow-2xs focus:ring-slate-300 rounded-2xl disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed disabled:active:scale-100',
    // Botón compacto para permisos dentro de cards
    'secondary-light':
      'bg-primary-light hover:bg-sky-100 active:bg-sky-200 text-primary-dark font-bold rounded-xl border border-primary/20 focus:ring-primary/30',
  };

  // Tamaños adaptados a ergonomía móvil
  const sizeClasses = {
    sm: 'h-9 px-3 text-xs font-semibold',
    md: 'h-11 px-4 text-sm font-bold',
    lg: 'h-13 px-5 text-base font-bold', // 52px estándar
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
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-current" aria-hidden="true" />
          <span>Procesando...</span>
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2.5 w-full">
          {icon && <span className="inline-flex items-center flex-shrink-0">{icon}</span>}
          <span>{children}</span>
        </span>
      )}
    </button>
  );
};
