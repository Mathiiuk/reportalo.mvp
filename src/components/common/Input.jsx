// ==============================================================================
// Componente UI: Input Estilizado, Accesible y Ergonómico (Input.jsx)
// ==============================================================================

// Importación de React y forwardRef
import React, { useState, forwardRef } from 'react';
// Iconos de visibilidad y alerta
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

export const Input = forwardRef(({
  label,
  error,
  helperText,
  type = 'text',
  id,
  className = '',
  ...props
}, ref) => {
  // Estado local para alternar visibilidad de contraseña
  const [showPassword, setShowPassword] = useState(false);
  // Identificador único accesible
  const inputId = id || `input-${label ? label.toLowerCase().replace(/\s+/g, '-') : Math.random().toString(36).substring(2, 7)}`;
  // Detección de campo de contraseña
  const isPassword = type === 'password';
  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="w-full flex flex-col gap-1 text-left">
      {/* Label descriptivo con tipografía legible y natural */}
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 tracking-tight pl-0.5">
          {label}
        </label>
      )}

      {/* Contenedor del campo con bordes sutiles y foco nítido */}
      <div className="relative w-full">
        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
          className={`w-full h-12 px-3.5 rounded-xl border text-sm font-normal transition-all duration-150 placeholder:text-slate-400 focus:outline-none focus:ring-3 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
            error
              ? 'border-red-400 bg-red-50/20 text-red-950 focus:border-red-500 focus:ring-red-100'
              : 'border-slate-200 bg-white hover:border-slate-300 focus:border-primary focus:ring-primary/10 text-slate-900 shadow-2xs'
          } ${isPassword ? 'pr-11' : ''} ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />

        {/* Botón táctil para mostrar/ocultar contraseña */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-700 focus:outline-none focus:text-primary transition-colors cursor-pointer rounded-lg"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Eye className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Mensaje de error accesible */}
      {error && (
        <div id={`${inputId}-error`} className="flex items-center gap-1.5 text-xs text-red-600 font-medium mt-0.5 pl-0.5 animate-fadeIn" role="alert">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Texto de ayuda secundario */}
      {!error && helperText && (
        <p id={`${inputId}-helper`} className="text-[11px] text-slate-500 mt-0.5 pl-0.5">
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
