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
      <div className="flex-1 flex flex-col items-center justify-center text-center px-[30px] pb-10">
        <div className="flex items-center justify-center">
          <svg width="164" height="112" viewBox="0 0 164 112" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        
        <div className="font-extrabold text-[17px] text-[#243447] mt-3 tracking-[-0.2px]">
          Este reporte ya no está
        </div>
        
        <div className="font-medium text-[12px] leading-[1.6] text-[#7A8696] mt-[7px] text-pretty">
          El enlace que abriste apunta a un reporte que se dio de baja o que nunca existió.
        </div>
        
        <div className="w-full mt-4 bg-white border border-[#E6ECF3] rounded-[12px] px-3 py-2.5 flex items-center gap-2 text-left">
          <span className="material-symbols-rounded text-[16px] text-[#9AA7B5] flex-none">
            link_off
          </span>
          <span className="font-semibold text-[9.5px] leading-[1.35] font-mono text-[#8593A2] flex-1 truncate">
            reportalo.ar/r/{displayId}
          </span>
        </div>
        
        <Link 
          to="/mapa"
          className="mt-5 bg-[#1E6FCB] hover:bg-[#195CA8] active:scale-95 transition-all rounded-[13px] px-[22px] py-[12px] flex items-center gap-[7px] shadow-[0_8px_18px_rgba(30,111,203,0.28)] no-underline"
        >
          <span className="material-symbols-rounded text-[18px] text-white">
            map
          </span>
          <span className="font-extrabold text-[13px] text-white">
            Ver el mapa de la zona
          </span>
        </Link>
        
        <Link 
          to="/reportes"
          className="mt-3 font-bold text-[12px] text-[#8593A2] hover:text-[#5B6A7A] transition-colors bg-transparent border-none cursor-pointer no-underline"
        >
          Ir a mis reportes
        </Link>
      </div>
    </div>
  );
};

export default NotFoundReportPage;
