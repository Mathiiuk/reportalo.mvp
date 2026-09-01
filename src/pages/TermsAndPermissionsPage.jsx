import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Pantalla informativa de Términos y Privacidad en Solo Lectura (User Journey v2).
 * Puede usarse como ruta `/terminos` o como modal superpuesto con `onBackOverride`.
 */
export const TermsAndPermissionsPage = ({ onBackOverride }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBackOverride) {
      onBackOverride();
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/mapa', { replace: true });
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Términos y Privacidad — Reportalo',
          url: window.location.href,
        });
      } catch {
        // Cancelado por el usuario
      }
    }
  };

  return (
    <div
      data-testid="terms-page-readonly"
      className="relative w-full h-[100dvh] bg-white overflow-hidden flex flex-col font-manrope select-none"
    >
      {/* 1. Header con botón volver, versión y compartir */}
      <header className="flex-0 bg-white px-4 pt-3 pb-3 border-b border-[#EEF1F5] flex items-center gap-2.5 shadow-2xs">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Volver"
          className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-[#5B6A7A] transition-colors cursor-pointer border-0 bg-transparent p-0"
        >
          <span className="material-symbols-rounded text-[22px]">arrow_back</span>
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="font-extrabold text-[16px] text-[#263249] tracking-tight m-0 leading-tight">
            Términos y privacidad
          </h1>
          <div className="font-semibold text-[9.5px] text-[#9AA7B5] mt-0.5">
            Versión 1.2 · vigente desde 08/2026
          </div>
        </div>

        <button
          type="button"
          onClick={handleShare}
          aria-label="Compartir términos"
          className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-[#8593A2] transition-colors cursor-pointer border-0 bg-transparent p-0"
        >
          <span className="material-symbols-rounded text-[20px]">ios_share</span>
        </button>
      </header>

      {/* 2. Articulado Legal Completo (Solo Lectura) */}
      <main className="flex-1 overflow-y-auto px-4 py-3.5 flex flex-col gap-3 max-w-lg mx-auto w-full">
        {/* Artículo 1 */}
        <div>
          <h2 className="font-extrabold text-[12px] text-[#243447] m-0">
            1. Qué es Reportalo
          </h2>
          <p className="font-medium text-[10.5px] leading-relaxed text-[#56657A] mt-1 m-0">
            Reportalo es un canal vecinal para informar incumplimientos en la vía pública al organismo competente. El uso del mapa y la consulta de reportes publicados no requieren aceptar estos términos.
          </p>
        </div>

        {/* Artículo 2 */}
        <div>
          <h2 className="font-extrabold text-[12px] text-[#243447] m-0">
            2. Cuándo se pide tu consentimiento
          </h2>
          <p className="font-medium text-[10.5px] leading-relaxed text-[#56657A] mt-1 m-0">
            Se solicita al momento de enviar un reporte, porque es ahí donde se tratan las fotografías y la ubicación que aportás.
          </p>
        </div>

        {/* Artículo 3 */}
        <div>
          <h2 className="font-extrabold text-[12px] text-[#243447] m-0">
            3. Tratamiento de imágenes
          </h2>
          <p className="font-medium text-[10.5px] leading-relaxed text-[#56657A] mt-1 m-0">
            Las fotos se procesan en nuestros servidores y en los de un proveedor de análisis con la única finalidad de difuminar rostros y patentes y clasificar el reporte. Se conserva la versión anonimizada; el original se descarta al terminar el procesamiento.
          </p>
        </div>

        {/* Artículo 4 */}
        <div>
          <h2 className="font-extrabold text-[12px] text-[#243447] m-0">
            4. Tus derechos
          </h2>
          <p className="font-medium text-[10.5px] leading-relaxed text-[#56657A] mt-1 m-0">
            Podés solicitar acceso, rectificación y supresión de tus datos conforme a la Ley 25.326. Tu identidad no se comparte con el organismo receptor.
          </p>
        </div>

        {/* Artículo 5 */}
        <div className="opacity-40">
          <h2 className="font-extrabold text-[12px] text-[#243447] m-0">
            5. Conservación
          </h2>
          <p className="font-medium text-[10.5px] leading-relaxed text-[#56657A] mt-1 m-0">
            Los reportes se conservan mientras el expediente siga abierto y por el plazo legal correspondiente...
          </p>
        </div>
      </main>

      {/* 3. Footer Informativo */}
      <footer className="flex-0 bg-[#F7F9FC] border-t border-[#EEF1F5] px-4 py-3 flex items-start gap-2 max-w-lg mx-auto w-full">
        <span className="material-symbols-rounded text-[15px] text-[#8593A2] flex-shrink-0 mt-0.5">
          info
        </span>
        <span className="font-medium text-[10.5px] leading-snug text-[#7A8696]">
          Leer esta página no implica aceptación. Se te va a pedir al enviar.
        </span>
      </footer>
    </div>
  );
};

export default TermsAndPermissionsPage;
