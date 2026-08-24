// ==============================================================================
// Página de Permisos: Cámara y Ubicación (PermissionsPage.jsx)
// ==============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '../hooks/useOnboarding';

export const PermissionsPage = () => {
  const { setCompleted } = useOnboarding();
  const navigate = useNavigate();

  const [cameraOn, setCameraOn] = useState(true);
  const [locationOn, setLocationOn] = useState(true);

  const handleContinue = () => {
    setCompleted();
    navigate('/map', { replace: true });
  };

  const handleSkip = () => {
    setCompleted();
    navigate('/map', { replace: true });
  };

  return (
    <div className="min-h-[100dvh] w-full bg-white flex flex-col safe-top safe-bottom">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col" style={{ padding: '18px 22px 0px' }}>
        {/* Icono verified_user */}
        <div style={{ width: '60px', height: '60px', borderRadius: '18px', background: 'rgb(232, 241, 251)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
          <span className="material-symbols-rounded filled" style={{ fontSize: '34px', color: 'rgb(30, 111, 203)' }}>verified_user</span>
        </div>

        {/* Título */}
        <div style={{ fontFamily: '800 26px Manrope', color: 'rgb(36, 52, 71)', letterSpacing: '-0.4px', fontSize: '26px', fontWeight: 800, lineHeight: 1.15 }}>
          Activá los permisos
        </div>

        {/* Subtítulo */}
        <div style={{ fontFamily: '500 14px / 1.5 Manrope', color: 'rgb(133, 147, 162)', marginTop: '6px', fontSize: '14px', fontWeight: 500, lineHeight: 1.5 }}>
          Reportalo solo los usa al momento de reportar. Podés cambiarlos cuando quieras.
        </div>

        {/* Card Cámara */}
        <div className="flex items-start" style={{ marginTop: '22px', background: 'rgb(255, 255, 255)', border: '1px solid rgb(230, 236, 243)', borderRadius: '16px', padding: '16px', gap: '14px' }}>
          <span className="material-symbols-rounded filled flex-shrink-0 flex items-center justify-center" style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgb(232, 241, 251)', fontSize: '24px', color: 'rgb(30, 111, 203)' }}>photo_camera</span>
          <div className="flex-1">
            <div style={{ fontFamily: '700 15px Manrope', color: 'rgb(38, 50, 73)', fontSize: '15px', fontWeight: 700 }}>Cámara</div>
            <div style={{ fontFamily: '500 13px / 1.45 Manrope', color: 'rgb(133, 147, 162)', marginTop: '3px', fontSize: '13px', fontWeight: 500, lineHeight: 1.45 }}>Para capturar la foto que sirve de evidencia.</div>
          </div>
          {/* Toggle */}
          <button
            type="button"
            onClick={() => setCameraOn(!cameraOn)}
            className="flex-shrink-0 cursor-pointer"
            style={{
              width: '48px',
              height: '28px',
              borderRadius: '14px',
              background: cameraOn ? 'rgb(30, 111, 203)' : 'rgb(207, 216, 226)',
              position: 'relative',
              border: 'none',
              transition: 'background 0.2s ease',
            }}
          >
            <div style={{
              position: 'absolute',
              top: '3px',
              left: cameraOn ? '23px' : '3px',
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: 'rgb(255, 255, 255)',
              transition: 'left 0.2s ease',
            }} />
          </button>
        </div>

        {/* Card Ubicación */}
        <div className="flex items-start" style={{ marginTop: '12px', background: 'rgb(255, 255, 255)', border: '1px solid rgb(230, 236, 243)', borderRadius: '16px', padding: '16px', gap: '14px' }}>
          <span className="material-symbols-rounded filled flex-shrink-0 flex items-center justify-center" style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgb(232, 241, 251)', fontSize: '24px', color: 'rgb(30, 111, 203)' }}>location_on</span>
          <div className="flex-1">
            <div style={{ fontFamily: '700 15px Manrope', color: 'rgb(38, 50, 73)', fontSize: '15px', fontWeight: 700 }}>Ubicación</div>
            <div style={{ fontFamily: '500 13px / 1.45 Manrope', color: 'rgb(133, 147, 162)', marginTop: '3px', fontSize: '13px', fontWeight: 500, lineHeight: 1.45 }}>Para georreferenciar el reporte en el mapa.</div>
          </div>
          {/* Toggle */}
          <button
            type="button"
            onClick={() => setLocationOn(!locationOn)}
            className="flex-shrink-0 cursor-pointer"
            style={{
              width: '48px',
              height: '28px',
              borderRadius: '14px',
              background: locationOn ? 'rgb(30, 111, 203)' : 'rgb(207, 216, 226)',
              position: 'relative',
              border: 'none',
              transition: 'background 0.2s ease',
            }}
          >
            <div style={{
              position: 'absolute',
              top: '3px',
              left: locationOn ? '23px' : '3px',
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: 'rgb(255, 255, 255)',
              transition: 'left 0.2s ease',
            }} />
          </button>
        </div>

        {/* Bloque de privacidad verde */}
        <div className="flex items-start" style={{ gap: '10px', background: 'rgb(227, 245, 236)', borderRadius: '14px', padding: '14px', marginTop: '16px' }}>
          <span className="material-symbols-rounded filled flex-shrink-0" style={{ fontSize: '20px', color: 'rgb(46, 158, 107)' }}>shield</span>
          <span style={{ fontFamily: '600 13px / 1.55 Manrope', color: 'rgb(44, 122, 85)', fontSize: '13px', fontWeight: 600, lineHeight: 1.55 }}>
            Tu foto se procesa de forma segura: los rostros y patentes se difuminan automáticamente antes de guardarse. La imagen original nunca se almacena.
          </span>
        </div>

        {/* Bottom: Botón + Ahora no */}
        <div className="mt-auto" style={{ paddingBottom: '18px' }}>
          <button
            type="button"
            onClick={handleContinue}
            className="w-full cursor-pointer transition-all duration-150 active:scale-[0.98]"
            style={{
              background: 'rgb(30, 111, 203)',
              borderRadius: '16px',
              padding: '18px',
              textAlign: 'center',
              border: 'none',
              boxShadow: 'rgba(30, 111, 203, 0.3) 0px 8px 18px',
            }}
          >
            <span style={{ fontFamily: '800 17px Manrope', color: 'rgb(255, 255, 255)', fontSize: '17px', fontWeight: 800 }}>Continuar</span>
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="w-full cursor-pointer"
            style={{
              textAlign: 'center',
              padding: '12px',
              fontFamily: '700 14px Manrope',
              color: 'rgb(133, 147, 162)',
              background: 'none',
              border: 'none',
              fontSize: '14px',
              fontWeight: 700,
            }}
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
};
