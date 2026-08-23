// ==============================================================================
// Componente UI: Input Moderno con Soporte Móvil y Validación (Input.jsx)
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
    <div className="w-full flex flex-col gap-1.5 text-left">
      {/* Label descriptivo superior */}
      {label && (
        <label htmlFor={inputId} className="text-xs font-bold text-content-primary uppercase tracking-wider pl-0.5">
          {label}
        </label>
      )}

      {/* Contenedor del campo con bordes redondeados y foco estilizado */}
      <div className="relative w-full">
        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
          className={`w-full h-12.5 px-4 rounded-2xl border text-sm md:text-base font-medium transition-all duration-200 placeholder:text-content-tertiary focus:outline-none focus:ring-4 disabled:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed ${
            error
              ? 'border-red-400 bg-red-50/30 text-red-950 focus:border-red-500 focus:ring-red-100'
              : 'border-slate-200/90 bg-slate-50/60 hover:bg-white hover:border-slate-300 focus:bg-white focus:border-primary focus:ring-primary/15 text-content-primary shadow-xs'
          } ${isPassword ? 'pr-12' : ''} ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />

        {/* Botón táctil para mostrar/ocultar contraseña */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 text-content-tertiary hover:text-content-primary focus:outline-none focus:text-primary transition-colors cursor-pointer rounded-xl"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="w-4.5 h-4.5" aria-hidden="true" />
            ) : (
              <Eye className="w-4.5 h-4.5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Mensaje de error accesible */}
      {error && (
        <div id={`${inputId}-error`} className="flex items-center gap-1.5 text-xs text-red-600 font-semibold mt-0.5 pl-0.5 animate-fadeIn" role="alert">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Texto de ayuda secundario */}
      {!error && helperText && (
        <p id={`${inputId}-helper`} className="text-[11px] text-content-secondary mt-0.5 pl-0.5">
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
