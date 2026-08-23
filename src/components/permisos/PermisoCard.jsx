// ==============================================================================
// Tarjeta de Permiso Individual (PermisoCard.jsx)
// ==============================================================================

import React from 'react';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
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
    <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-card flex flex-col gap-3 transition-all">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Icono del Permiso */}
          <div className="w-11 h-11 rounded-2xl bg-primary-light text-primary flex items-center justify-center flex-shrink-0">
            {Icon && <Icon className="w-6 h-6" />}
          </div>

          <div className="text-left">
            <h3 className="text-sm font-bold text-content-primary leading-tight">
              {title}
            </h3>
            <p className="text-xs text-content-secondary mt-0.5 leading-snug">
              {description}
            </p>
          </div>
        </div>

        {/* Indicador de Estado */}
        <div className="flex-shrink-0 ml-2">
          {status === 'granted' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Activado
            </span>
          )}

          {status === 'denied' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
              <XCircle className="w-3.5 h-3.5" />
              Rechazado
            </span>
          )}

          {status === 'prompt' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-content-tertiary bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
              <AlertCircle className="w-3.5 h-3.5" />
              Pendiente
            </span>
          )}
        </div>
      </div>

      {/* Botón de activación si el permiso aún no está concedido */}
      {status !== 'granted' && (
        <Button
          variant={status === 'denied' ? 'outline' : 'primary'}
          size="sm"
          onClick={onRequest}
          isLoading={isLoading}
          className="mt-0.5"
        >
          {status === 'denied' ? `Reintentar ${title.toLowerCase()}` : `Permitir ${title.toLowerCase()}`}
        </Button>
      )}
    </div>
  );
};
