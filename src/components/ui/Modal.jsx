// ==============================================================================
// Componente UI Reutilizable: Modal Accesible (Modal.jsx)
// ==============================================================================

import React, { useEffect } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { Button } from '../common/Button';

export const Modal = ({ isOpen, onClose, title, children }) => {
  // Bloquear el scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Contenedor del Modal */}
      <div className="relative w-full max-w-lg max-h-[85vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-100">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-surface-muted/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-primary-light text-primary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 id="modal-title" className="text-lg font-bold text-content-primary">
              {title || 'Términos y Condiciones'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-content-secondary hover:text-content-primary rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo con Scroll */}
        <div className="px-6 py-5 overflow-y-auto text-sm text-content-secondary space-y-4 leading-relaxed">
          {children}
        </div>

        {/* Pie con botón de confirmación */}
        <div className="px-6 py-4 border-t border-slate-100 bg-surface-muted/50 flex justify-end">
          <Button variant="primary" size="md" onClick={onClose} fullWidth={false}>
            Entendido y Aceptar
          </Button>
        </div>
      </div>
    </div>
  );
};
