import React from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';

export const NotFoundReportPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  // Use a default ID if none provided in params
  const displayId = id || 'RP-1907';

  return (
    <div className="w-full h-[100dvh] bg-[#F4F7FB] flex flex-col font-manrope overflow-hidden">
      {/* Header */}
      <div className="flex-none bg-white px-[14px] pt-[max(16px,env(safe-area-inset-top,16px))] pb-3 border-b border-[#EEF1F5] flex items-center gap-[9px]">
        <button 
          onClick={() => navigate(-1)}
          className="bg-transparent border-none p-0 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
        >
          <span className="material-symbols-rounded text-[22px] text-[#5B6A7A]">
            arrow_back
          </span>
        </button>
        <span className="font-extrabold text-[16px] text-[#263249]">
          Reporte
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-[30px] md:px-10 pb-10 bg-[#F4F7FB]">
        <div className="flex items-center justify-center">
          <svg className="w-[164px] md:w-[196px] h-[112px] md:h-[134px]" viewBox="0 0 164 112" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="58" width="156" height="48" rx="7" fill="#cfd8e2"></rect>
            <path d="M4 88h156" stroke="#e8edf3" strokeWidth="4" strokeDasharray="14 12"></path>
            <path d="M60 66c11-5 29-6 38 0s11 17 0 21-33 4-42-3 -7-13 4-18Z" fill="#5c6a7a"></path>
            <path d="M65 70c9-4 22-5 29 0s8 13 0 16-25 3-32-2 -6-10 3-14Z" fill="#3b4756"></path>
            <rect x="112" y="10" width="48" height="32" rx="5" fill="#fff" stroke="#c0392b" strokeWidth="3"></rect>
            <rect x="133" y="42" width="6" height="30" rx="2" fill="#b8c3cf"></rect>
            <text x="136" y="26" fontFamily="Manrope,sans-serif" fontSize="9" fontWeight="800" fill="#c0392b" textAnchor="middle">CERRADO</text>
            <text x="136" y="37" fontFamily="Manrope,sans-serif" fontSize="7.5" fontWeight="700" fill="#9aa7b5" textAnchor="middle">404</text>
            <path d="M18 84l9-32h8l9 32H18Z" fill="#F78E35"></path>
            <rect x="12" y="82" width="39" height="8" rx="3" fill="#e07c1a"></rect>
            <rect x="22" y="62" width="17" height="6" fill="#fff" opacity=".85"></rect>
          </svg>
        </div>
        
        <div className="font-extrabold text-[17px] md:text-[22px] text-[#243447] mt-3 md:mt-4 tracking-[-0.2px] md:tracking-[-0.3px]">
          Este reporte ya no está
        </div>
        
        <div className="font-medium text-[12px] md:text-[13px] leading-[1.6] text-[#7A8696] mt-[7px] md:mt-2 text-pretty md:max-w-[430px]">
          El enlace que abriste apunta a un reporte que se dio de baja o que nunca existió.
        </div>
        
        <div className="w-full md:w-auto mt-4 md:mt-3.5 bg-white border border-[#E6ECF3] rounded-[12px] md:rounded-[11px] px-3 md:px-3.5 py-2.5 md:py-2.5 flex items-center justify-center md:justify-start gap-2 text-left">
          <span className="material-symbols-rounded text-[16px] text-[#9AA7B5] flex-none">
            link_off
          </span>
          <span className="font-semibold text-[9.5px] md:text-[11px] leading-[1.35] font-mono text-[#8593A2] truncate">
            reportalo.ar/r/{displayId}
          </span>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-3 md:gap-3.5 mt-5 md:mt-[18px]">
          <Link 
            to="/mapa"
            className="bg-[#1E6FCB] hover:bg-[#195CA8] active:scale-95 transition-all rounded-[13px] md:rounded-[11px] px-[22px] md:px-5 py-[12px] md:py-[11px] flex items-center justify-center gap-[7px] shadow-[0_8px_18px_rgba(30,111,203,0.28)] md:shadow-none no-underline"
          >
            <span className="material-symbols-rounded text-[18px] md:text-[17px] text-white">
              map
            </span>
            <span className="font-extrabold text-[13px] md:text-[12.5px] text-white">
              Ver el mapa de la zona
            </span>
          </Link>
          
          <Link 
            to="/reportes"
            className="font-bold text-[12px] text-[#8593A2] hover:text-[#5B6A7A] transition-colors bg-transparent border-none cursor-pointer no-underline"
          >
            Ir a mis reportes
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundReportPage;
