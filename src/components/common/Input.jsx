// ==============================================================================
// Componente UI Reutilizable: Input (Input.jsx)
// ==============================================================================

import React, { useState, forwardRef } from 'react';
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
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || `input-${label ? label.toLowerCase().replace(/\s+/g, '-') : Math.random().toString(36).substring(2, 7)}`;
  const isPassword = type === 'password';
  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {/* Label del campo */}
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-content-primary">
          {label}
        </label>
      )}

      {/* Contenedor del Input */}
      <div className="relative w-full">
        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
          className={`w-full h-13 px-4 rounded-2xl border text-base transition-all duration-200 bg-white placeholder:text-content-tertiary focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:opacity-60 ${
            error
              ? 'border-red-500 text-red-900 focus:border-red-500 focus:ring-red-200'
              : 'border-slate-200 text-content-primary focus:border-primary focus:ring-primary/20 hover:border-slate-300'
          } ${isPassword ? 'pr-12' : ''} ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />

        {/* Toggle para mostrar/ocultar contraseña */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-content-secondary hover:text-content-primary focus:outline-none focus:text-primary transition-colors cursor-pointer"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Eye className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Mensaje de error de validación */}
      {error && (
        <div id={`${inputId}-error`} className="flex items-center gap-1.5 text-xs text-red-600 font-medium mt-0.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Texto de ayuda secundario */}
      {!error && helperText && (
        <p id={`${inputId}-helper`} className="text-xs text-content-secondary mt-0.5">
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
