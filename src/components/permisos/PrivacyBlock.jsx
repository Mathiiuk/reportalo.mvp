// ==============================================================================
// Bloque de Confianza y Privacidad Ciudadana (PrivacyBlock.jsx)
// ==============================================================================

// Importación de React
import React from 'react';
// Iconos de protección y candado
import { ShieldCheck, Lock } from 'lucide-react';

export const PrivacyBlock = () => {
  return (
    <div className="w-full flex items-center gap-3 py-3 px-3.5 rounded-2xl bg-sky-50/70 border border-sky-100 text-left">
      {/* Icono de Seguridad */}
      <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
        <ShieldCheck className="w-4.5 h-4.5 stroke-[2.4]" />
      </div>

      {/* Texto de Garantía de Privacidad */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-900 leading-tight">
            Tu evidencia permanece protegida
          </span>
          <Lock className="w-3 h-3 text-primary flex-shrink-0" />
        </div>
        <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
          Rostros y patentes se difuminan automáticamente antes del envío.
        </p>
      </div>
    </div>
  );
};
