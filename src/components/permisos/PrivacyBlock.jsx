// ==============================================================================
// Bloque Destacado de Privacidad y Difuminado Facial (PrivacyBlock.jsx)
// ==============================================================================

// Importación de React
import React from 'react';
// Iconos de protección y candado
import { ShieldCheck, Lock } from 'lucide-react';

export const PrivacyBlock = () => {
  return (
    <div className="p-4.5 rounded-3xl bg-gradient-to-br from-sky-50 to-blue-50/60 border border-primary/20 shadow-xs text-left">
      <div className="flex items-start gap-3.5">
        {/* Icono de Escudo de Seguridad */}
        <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm shadow-primary/20">
          <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
        </div>

        {/* Contenido descriptivo */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Tu evidencia permanece protegida
            </h3>
            <Lock className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Los rostros y las patentes se difuminan automáticamente antes de enviar la evidencia al organismo correspondiente. Tu identidad nunca queda expuesta.
          </p>
        </div>
      </div>
    </div>
  );
};
