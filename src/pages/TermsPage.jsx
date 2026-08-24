// ==============================================================================
// Página de Términos y Privacidad (TermsPage.jsx)
// ==============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const TERMS_ITEMS = [
  {
    icon: 'photo_camera',
    title: 'Tratamiento de imágenes',
    description: 'Tus fotos se procesan con el único fin de difuminar rostros y patentes y clasificar el reporte.',
  },
  {
    icon: 'visibility_off',
    title: 'Qué se guarda',
    description: 'Solo la versión anonimizada. La imagen original se descarta al terminar el procesamiento.',
  },
  {
    icon: 'gavel',
    title: 'Tus derechos',
    description: 'Podés acceder, rectificar y suprimir tus datos (Ley 25.326). Tu identidad nunca se comparte.',
  },
];

export const TermsPage = () => {
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAccept = async () => {
    if (!accepted || isLoading) return;
    setIsLoading(true);
    navigate('/permisos', { replace: true });
  };

  const handleFullTerms = () => {
    navigate('/termino-condiciones');
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col safe-top safe-bottom bg-[#F4F7FB]">
      {/* Header */}
      <div className="shrink-0 bg-white px-5 pt-2 pb-4 border-b border-[#EEF1F5]">
        <h1 className="text-[22px] font-extrabold text-[#243447] tracking-[-0.3px]">
          Términos y privacidad
        </h1>
        <p className="text-[13px] font-semibold text-[#9AA7B5] mt-1">
          Versión 1.2 · vigente desde 08/2026
        </p>
      </div>

      {/* Contenido scrollable */}
      <div className="flex-1 overflow-y-auto scroll-area p-4 flex flex-col gap-3.5">
        {TERMS_ITEMS.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center text-center gap-2.5 bg-white border border-[#E6ECF3] rounded-2xl p-5">
            <span className="material-symbols-rounded filled text-[30px] text-[#1E6FCB]">{item.icon}</span>
            <div>
              <h3 className="text-base font-bold text-[#263249]">{item.title}</h3>
              <p className="text-sm font-medium text-[#7A8696] mt-1.5 leading-relaxed">{item.description}</p>
            </div>
          </div>
        ))}

        {/* Link texto completo */}
        <button
          type="button"
          onClick={handleFullTerms}
          className="flex items-center justify-center cursor-pointer gap-1.5 font-bold text-sm text-[#1E6FCB] bg-transparent border-none py-2.5 w-full"
        >
          <span>Leer el texto completo</span>
          <span className="material-symbols-rounded text-lg">open_in_new</span>
        </button>
      </div>

      {/* Footer fijo */}
      <div className="shrink-0 bg-white border-t border-[#EEF1F5] p-4">
        {/* Checkbox */}
        <button
          type="button"
          onClick={() => setAccepted(!accepted)}
          className="flex items-start cursor-pointer w-full text-left gap-3 mb-3.5 bg-transparent border-none p-0"
          role="checkbox"
          aria-checked={accepted}
          aria-label="Acepto los términos y el tratamiento de mis imágenes"
        >
          <span
            className={`shrink-0 flex items-center justify-center w-[26px] h-[26px] rounded-[7px] mt-px transition-all duration-150 ${
              accepted ? 'bg-[#1E6FCB]' : 'border-2 border-[#CFD8E2] bg-transparent'
            }`}
          >
            {accepted && <span className="material-symbols-rounded text-sm text-white">check</span>}
          </span>
          <span className="text-[13px] font-semibold text-[#46566B] leading-relaxed">
            Acepto los términos y el tratamiento de mis imágenes descripto arriba.
          </span>
        </button>

        {/* Botón */}
        <button
          type="button"
          onClick={handleAccept}
          disabled={!accepted || isLoading}
          className="w-full cursor-pointer transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-[#1E6FCB] rounded-[14px] py-4 text-center border-none shadow-[0_8px_18px_rgba(30,111,203,0.3)]"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2 font-extrabold text-base text-white">
              <Loader2 className="w-5 h-5 animate-spin" />
              Ingresando...
            </span>
          ) : (
            <span className="font-extrabold text-base text-white">
              Aceptar y continuar
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
