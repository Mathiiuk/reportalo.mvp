import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Info } from 'lucide-react';
import { CURRENT_TERMS_VERSION, TERMS_EFFECTIVE_DATE } from '../services/termsService';

/**
 * Pantalla informativa de las Condiciones de uso en Solo Lectura (User Journey v2).
 * Puede usarse como ruta `/terminos` o como modal superpuesto con `onBackOverride`.
 * REP-3868: se llama «Condiciones de uso», igual que el enlace del aviso antes de enviar, y la versión sale de
 * termsService para que el encabezado no vuelva a quedar desfasado de la versión que se acepta.
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
          title: 'Condiciones de uso — Reportalo',
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
          <ArrowLeft className="w-[22px] h-[22px]" strokeWidth={2.25} />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="font-extrabold text-[16px] text-[#263249] tracking-tight m-0 leading-tight">
            Condiciones de uso
          </h1>
          <div className="font-semibold text-[9.5px] text-[#9AA7B5] mt-0.5">
            Versión {CURRENT_TERMS_VERSION} · vigente desde {TERMS_EFFECTIVE_DATE}
          </div>
        </div>

        <button
          type="button"
          onClick={handleShare}
          aria-label="Compartir términos"
          className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-[#8593A2] transition-colors cursor-pointer border-0 bg-transparent p-0"
        >
          <Share2 className="w-[20px] h-[20px]" strokeWidth={2.25} />
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
            Las fotos se procesan en nuestros servidores y en los de un proveedor de análisis con la única finalidad de difuminar rostros y clasificar el reporte. Se conserva la versión anonimizada; el original se descarta al terminar el procesamiento.
          </p>
        </div>

        {/* Artículo 4 · Fotos (REP-3868, versión 1.5): texto de Hernán en REP-3867 (02/11/2026), sin cambios. */}
        <div data-testid="terminos-fotos">
          <h2 className="font-extrabold text-[12px] text-[#243447] m-0">
            4. Fotos
          </h2>
          <p className="font-medium text-[10.5px] leading-relaxed text-[#56657A] mt-1 m-0">
            Subí solo fotos del problema que reportás, sacadas por vos en la vía pública. Pueden aparecer la calle, comercios, carteles, vehículos con su patente y personas de paso. Los rostros se difuminan al procesar la foto; las patentes no, porque el organismo las necesita para actuar.
          </p>
          <p className="font-medium text-[10.5px] leading-relaxed text-[#56657A] mt-1.5 m-0">
            No se pueden subir: desnudez o contenido sexual; violencia gráfica sobre personas; contenido que pueda ser delito; amenazas, acoso o fotos para señalar a una persona; interiores o espacios privados; fotos que no muestran el problema o que no sacaste vos, como imágenes bajadas de internet o editadas.
          </p>
          <p className="font-medium text-[10.5px] leading-relaxed text-[#56657A] mt-1.5 m-0">
            Al enviar un reporte declarás que es real, que las fotos las sacaste vos en la vía pública y que muestran el problema que describís. Sos responsable de su contenido. Cada reporte queda registrado con tu cuenta; el organismo que lo recibe no ve quién sos. Si un reporte no cumple estas condiciones, Reportalo puede desestimarlo y suspender o bloquear tu cuenta. Si el contenido pudiera constituir un delito según la ley argentina, Reportalo lo denunciará ante la autoridad competente y pondrá a su disposición los datos de la cuenta que la ley le exija entregar.
          </p>
        </div>

        {/* Artículo 5 */}
        <div>
          <h2 className="font-extrabold text-[12px] text-[#243447] m-0">
            5. Tus derechos
          </h2>
          <p className="font-medium text-[10.5px] leading-relaxed text-[#56657A] mt-1 m-0">
            Podés solicitar acceso, rectificación y supresión de tus datos conforme a la Ley 25.326. Tu identidad no se comparte con el organismo receptor.
          </p>
        </div>

        {/* Artículo 6 */}
        <div className="opacity-40">
          <h2 className="font-extrabold text-[12px] text-[#243447] m-0">
            6. Conservación
          </h2>
          <p className="font-medium text-[10.5px] leading-relaxed text-[#56657A] mt-1 m-0">
            Los reportes se conservan mientras el expediente siga abierto y por el plazo legal correspondiente...
          </p>
        </div>
      </main>

      {/* 3. Footer Informativo */}
      <footer className="flex-0 bg-[#F7F9FC] border-t border-[#EEF1F5] px-4 py-3 flex items-start gap-2 max-w-lg mx-auto w-full">
        <Info className="w-[15px] h-[15px] text-[#8593A2] flex-shrink-0 mt-0.5" strokeWidth={2.25} />
        <span className="font-medium text-[10.5px] leading-snug text-[#7A8696]">
          Leer esta página no implica aceptación. Se te va a pedir al enviar.
        </span>
      </footer>
    </div>
  );
};

export default TermsAndPermissionsPage;
