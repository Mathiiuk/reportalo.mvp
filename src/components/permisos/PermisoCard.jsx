// ==============================================================================
// Fila de Permiso Interactiva y Accesible (PermisoCard.jsx)
// ==============================================================================

// Importación de React
import React from 'react';
// Iconos de estado
import { Check, Loader2, RefreshCw } from 'lucide-react';

export const PermisoCard = ({
  icon: Icon,
  iconBg = 'bg-sky-50 text-primary',
  title,
  description,
  status = 'prompt', // 'prompt' | 'granted' | 'denied'
  onRequest,
  isLoading = false,
}) => {
  const isGranted = status === 'granted';
  const isDenied = status === 'denied';
  const isDisabled = isGranted || isLoading;

  return (
    <button
      type="button"
      onClick={!isDisabled ? onRequest : undefined}
      className={`w-full py-3.5 px-4 rounded-2xl transition-all duration-200 flex items-center justify-between gap-3 select-none border text-left ${
        isGranted
          ? 'bg-emerald-50/60 border-emerald-100 cursor-default'
          : isDenied
          ? 'bg-red-50/50 border-red-100 cursor-pointer hover:bg-red-50/80'
          : 'bg-slate-50 hover:bg-slate-100/90 border-slate-100 cursor-pointer active:scale-[0.99]'
      }`}
      aria-label={`Permiso de ${title}: ${isGranted ? 'Concedido' : isDenied ? 'Denegado' : 'Pendiente'}`}
      disabled={isDisabled}
    >
      {/* Icono y Textos Descriptivos */}
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Contenedor del Icono Vectorial */}
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
            isGranted
              ? 'bg-emerald-100 text-emerald-700'
              : isDenied
              ? 'bg-red-100 text-red-600'
              : iconBg
          }`}
        >
          {Icon && <Icon className="w-5 h-5 stroke-[2.2]" />}
        </div>

        {/* Título y Subtítulo */}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-slate-900 leading-tight">
            {title}
          </span>
          <span className="text-xs text-slate-500 leading-tight mt-0.5">
            {description}
          </span>
        </div>
      </div>

      {/* Switch / Control de Estado */}
      <div className="shrink-0">
        {isLoading ? (
          <div className="w-8 h-8 flex items-center justify-center text-primary">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : isGranted ? (
          // Toggle Switch Activado (Estilo iOS verde con check)
          <div className="w-12 h-7 bg-emerald-500 rounded-full flex items-center justify-end px-1 shadow-xs transition-colors">
            <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-xs">
              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
            </div>
          </div>
        ) : isDenied ? (
          // Botón de reintento
          <span className="text-xs font-bold text-red-600 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors">
            <RefreshCw className="w-3 h-3" />
            <span>Reintentar</span>
          </span>
        ) : (
          // Toggle Switch Desactivado (Estilo iOS interactivo)
          <div className="w-12 h-7 bg-slate-200 hover:bg-slate-300 rounded-full flex items-center justify-start px-1 transition-colors">
            <div className="w-5 h-5 bg-white rounded-full shadow-xs" />
          </div>
        )}
      </div>
    </button>
  );
};
