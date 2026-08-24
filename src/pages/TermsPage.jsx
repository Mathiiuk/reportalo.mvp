// ==============================================================================
// Página de Términos y Privacidad (TermsPage.jsx)
// ==============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

  const handleAccept = () => {
    if (!accepted) return;
    navigate('/permisos', { replace: true });
  };

  const handleFullTerms = () => {
    navigate('/termino-condiciones');
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col safe-top safe-bottom" style={{ background: 'rgb(244, 247, 251)' }}>
      {/* Header */}
      <div className="flex-shrink-0" style={{ background: 'rgb(255, 255, 255)', padding: '8px 20px 16px', borderBottom: '1px solid rgb(238, 241, 245)' }}>
        <div style={{ fontFamily: '800 22px Manrope', color: 'rgb(36, 52, 71)', letterSpacing: '-0.3px', fontSize: '22px', fontWeight: 800 }}>
          Términos y privacidad
        </div>
        <div style={{ fontFamily: '600 13px Manrope', color: 'rgb(154, 167, 181)', marginTop: '4px', fontSize: '13px', fontWeight: 600 }}>
          Versión 1.2 · vigente desde 08/2026
        </div>
      </div>

      {/* Contenido scrollable */}
      <div className="flex-1 overflow-y-auto scroll-area" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {TERMS_ITEMS.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center text-center" style={{ gap: '10px', background: 'rgb(255, 255, 255)', border: '1px solid rgb(230, 236, 243)', borderRadius: '16px', padding: '22px 18px' }}>
            <span className="material-symbols-rounded filled" style={{ fontSize: '30px', color: 'rgb(30, 111, 203)' }}>{item.icon}</span>
            <div>
              <div style={{ fontFamily: '700 16px Manrope', color: 'rgb(38, 50, 73)', fontSize: '16px', fontWeight: 700 }}>{item.title}</div>
              <div style={{ fontFamily: '500 14px / 1.55 Manrope', color: 'rgb(122, 134, 150)', marginTop: '6px', fontSize: '14px', fontWeight: 500, lineHeight: 1.55 }}>{item.description}</div>
            </div>
          </div>
        ))}

        {/* Link texto completo */}
        <button type="button" onClick={handleFullTerms} className="flex items-center justify-center cursor-pointer" style={{ gap: '6px', fontFamily: '700 14px Manrope', color: 'rgb(30, 111, 203)', background: 'none', border: 'none', padding: '10px 0', fontSize: '14px', fontWeight: 700, width: '100%' }}>
          <span>Leer el texto completo</span>
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>open_in_new</span>
        </button>
      </div>

      {/* Footer fijo */}
      <div className="flex-shrink-0" style={{ background: 'rgb(255, 255, 255)', borderTop: '1px solid rgb(238, 241, 245)', padding: '16px 18px' }}>
        {/* Checkbox */}
        <button
          type="button"
          onClick={() => setAccepted(!accepted)}
          className="flex items-start cursor-pointer w-full text-left"
          style={{ gap: '12px', marginBottom: '14px', background: 'none', border: 'none', padding: 0 }}
        >
          <span
            className="flex-shrink-0 flex items-center justify-center"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              background: accepted ? 'rgb(30, 111, 203)' : 'transparent',
              border: accepted ? 'none' : '2px solid rgb(207, 216, 226)',
              transition: 'all 0.15s ease',
              marginTop: '1px',
            }}
          >
            {accepted && <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'rgb(255, 255, 255)' }}>check</span>}
          </span>
          <span style={{ fontFamily: '600 13px / 1.5 Manrope', color: 'rgb(70, 86, 107)', fontSize: '13px', fontWeight: 600, lineHeight: 1.5 }}>
            Acepto los términos y el tratamiento de mis imágenes descripto arriba.
          </span>
        </button>

        {/* Botón */}
        <button
          type="button"
          onClick={handleAccept}
          disabled={!accepted}
          className="w-full cursor-pointer transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: 'rgb(30, 111, 203)',
            borderRadius: '14px',
            padding: '16px',
            textAlign: 'center',
            border: 'none',
            boxShadow: 'rgba(30, 111, 203, 0.3) 0px 8px 18px',
          }}
        >
          <span style={{ fontFamily: '800 16px Manrope', color: 'rgb(255, 255, 255)', fontSize: '16px', fontWeight: 800 }}>
            Aceptar y continuar
          </span>
        </button>
      </div>
    </div>
  );
};
