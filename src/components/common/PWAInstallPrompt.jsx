import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div
      role="dialog"
      aria-label="Instalar aplicación"
      className="fixed bottom-20 left-3 right-3 z-40 bg-white border border-[#E6ECF3] rounded-2xl shadow-lg p-4 flex items-center gap-3"
    >
      <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0">
        <Download className="w-5 h-5 text-primary" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#243447]">Instalar Reportalo</p>
        <p className="text-xs text-[#8593A2] mt-0.5">
          Accedé rápido desde tu pantalla de inicio
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          type="button"
          onClick={handleInstall}
          className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold active:bg-primary-dark transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          Instalar
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[#8593A2] active:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
