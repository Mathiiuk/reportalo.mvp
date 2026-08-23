// ==============================================================================
// Tarjeta de Permiso Individual Minimalista (PermisoCard.jsx)
// ==============================================================================

// Importación de React
import React from 'react';
// Iconos de estado y feedback
import { Check, RefreshCw } from 'lucide-react';
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
      className={`py-3.5 px-3 rounded-2xl transition-all duration-150 flex items-center justify-between gap-3 ${
        status === 'granted'
          ? 'bg-emerald-50/50'
          : status === 'denied'
          ? 'bg-red-50/50'
          : 'bg-slate-50/80 hover:bg-slate-100/80'
      }`}
    >
      {/* Contenedor izquierdo: Icono y Textos */}
      <div className="flex items-center gap-3.5 min-w-0 text-left">
        {/* Icono temático del permiso */}
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
            status === 'granted'
              ? 'bg-emerald-100 text-emerald-700'
              : status === 'denied'
              ? 'bg-red-100 text-red-700'
              : 'bg-sky-100 text-primary'
          }`}
        >
          {Icon && <Icon className="w-5 h-5 stroke-[2.2]" />}
        </div>

        {/* Textos descriptivos */}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-slate-900 leading-tight">
            {title}
          </span>
          <span className="text-xs text-slate-500 leading-snug mt-0.5">
            {description}
          </span>
        </div>
      </div>

      {/* Contenedor derecho: Acción o Badge de Estado */}
      <div className="flex-shrink-0">
        {status === 'granted' ? (
          // Estado Concedido
          <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold">
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Listo</span>
          </div>
        ) : status === 'denied' ? (
          // Estado Denegado
          <Button
            variant="outline"
            size="sm"
            fullWidth={false}
            onClick={onRequest}
            isLoading={isLoading}
            className="text-xs h-8 px-2.5 rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Reintentar
          </Button>
        ) : (
          // Estado Pendiente
          <Button
            variant="secondary-light"
            size="sm"
            fullWidth={false}
            onClick={onRequest}
            isLoading={isLoading}
            className="text-xs h-8.5 px-3 rounded-xl font-bold"
          >
            Permitir
          </Button>
        )}
      </div>
    </div>
  );
};
