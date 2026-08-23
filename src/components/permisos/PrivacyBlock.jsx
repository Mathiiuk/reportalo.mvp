// ==============================================================================
// Bloque Destacado de Privacidad Ciudadana (PrivacyBlock.jsx)
// ==============================================================================

import React from 'react';
import { ShieldCheck, Lock } from 'lucide-react';

export const PrivacyBlock = () => {
  return (
    <div className="p-4.5 rounded-2xl bg-primary-light border border-primary/20 text-content-primary shadow-sm text-left">
      <div className="flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-primary text-white flex-shrink-0 mt-0.5 shadow-sm">
          <ShieldCheck className="w-5 h-5" />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-primary-dark">
              Tu evidencia permanece protegida
            </h3>
            <Lock className="w-3.5 h-3.5 text-primary" />
          </div>

          <p className="text-xs text-content-secondary leading-relaxed">
            Los rostros y las patentes se difuminan automáticamente antes de enviar la evidencia al organismo receptor. Tu identidad nunca queda expuesta.
          </p>
        </div>
      </div>
    </div>
  );
};
