// ==============================================================================
// Tarjeta de Permiso Individual Pulida y Ergonómica (PermisoCard.jsx)
// ==============================================================================

// Importación de React
import React from 'react';
// Iconos de estado y feedback
import { Check, AlertCircle, RefreshCw } from 'lucide-react';
// Importación del botón común
import { Button } from '../common/Button';

export const PermisoCard = ({
  icon: Icon,
  title,
  description,
  status = 'prompt', // 'prompt' | 'granted' | 'denied'
  onRequest,
  isLoading = false,
}) => {
  return (
    <div
      className={`p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 shadow-xs ${
        status === 'granted'
          ? 'bg-emerald-50/40 border-emerald-200/80'
          : status === 'denied'
          ? 'bg-red-50/40 border-red-200/80'
          : 'bg-white border-slate-200/80 hover:border-slate-300'
      }`}
    >
      {/* Contenedor izquierdo: Icono y Textos */}
      <div className="flex items-center gap-3.5 min-w-0 text-left">
        {/* Icono temático del permiso */}
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${
            status === 'granted'
              ? 'bg-emerald-100 text-emerald-700'
              : status === 'denied'
              ? 'bg-red-100 text-red-700'
              : 'bg-primary-light text-primary'
          }`}
        >
          {Icon && <Icon className="w-5 h-5" />}
        </div>

        {/* Textos descriptivos */}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-content-primary leading-snug truncate">
            {title}
          </span>
          <span className="text-xs text-content-secondary leading-snug mt-0.5 line-clamp-2">
            {description}
          </span>
        </div>
      </div>

      {/* Contenedor derecho: Acción o Badge de Estado */}
      <div className="flex-shrink-0">
        {status === 'granted' ? (
          // Estado Concedido (Insignia verde con check)
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100/90 text-emerald-800 text-xs font-bold shadow-2xs">
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Listo</span>
          </div>
        ) : status === 'denied' ? (
          // Estado Denegado (Botón de reintento)
          <Button
            variant="outline"
            size="sm"
            fullWidth={false}
            onClick={onRequest}
            isLoading={isLoading}
            className="border-red-200 text-red-700 hover:bg-red-50 text-xs h-9 px-3 rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Reintentar
          </Button>
        ) : (
          // Estado Pendiente (Botón de activación suave)
          <Button
            variant="secondary-light"
            size="sm"
            fullWidth={false}
            onClick={onRequest}
            isLoading={isLoading}
            className="text-xs h-9 px-3.5 rounded-xl shadow-2xs"
          >
            Permitir
          </Button>
        )}
      </div>
    </div>
  );
};
