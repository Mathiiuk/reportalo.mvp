import React from 'react';
import { Link } from 'react-router-dom';

export const PlanPage = () => {
  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col font-manrope overflow-hidden text-[#243447]">
      {/* Header */}
      <div className="flex-none bg-white border-b border-[#EEF1F5] px-4 md:px-[30px] py-[13px] flex items-center justify-between z-10 shadow-xs">
        <Link to="/" className="flex items-center gap-2 no-underline text-inherit hover:opacity-80 transition-opacity">
          <img src="/logo-icon.webp" alt="Reportalo Logo" className="w-[19px] h-[25px] object-contain" />
          <span className="font-extrabold text-[18px] text-[#263249] tracking-[-0.4px]">
            Reportalo
          </span>
        </Link>
        
        <div className="flex items-center gap-[9px] overflow-x-auto pb-1 md:pb-0 scrollbar-hide shrink-0 ml-4">
          <div className="w-5 h-5 rounded-full bg-[#1E6FCB] text-white flex items-center justify-center">
            <span className="material-symbols-rounded text-[14px]">check</span>
          </div>
          <span className="font-bold text-[11.5px] text-[#1E6FCB]">Plan</span>
          <div className="w-[26px] h-[1.5px] bg-[#DDE4EC]"></div>
          
          <div className="w-5 h-5 rounded-full bg-[#DDE4EC] text-[#8A97A6] font-extrabold text-[10px] flex items-center justify-center">
            2
          </div>
          <span className="font-semibold text-[11.5px] text-[#9AA7B5]">Identidad</span>
          <div className="w-[26px] h-[1.5px] bg-[#DDE4EC]"></div>
          
          <div className="w-5 h-5 rounded-full bg-[#DDE4EC] text-[#8A97A6] font-extrabold text-[10px] flex items-center justify-center">
            3
          </div>
          <span className="font-semibold text-[11.5px] text-[#9AA7B5] truncate">Configuración</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-5 md:py-[22px] md:px-[30px] flex flex-col overflow-y-auto w-full max-w-7xl mx-auto">
        
        <div className="text-center md:text-left mt-2 md:mt-0">
          <h1 className="font-extrabold text-[21px] md:text-[21px] text-[#243447] tracking-[-0.4px] m-0">
            Elegí el alcance de tu municipio
          </h1>
          <p className="font-medium text-[12.5px] text-[#7A8696] mt-[5px] mb-0">
            Las licencias son por oficial. Podés sumar más en cualquier momento.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="flex flex-col md:flex-row gap-[14px] mt-[18px]">
          
          {/* Card 1: Localidad */}
          <div className="flex-1 bg-white border border-[#E6ECF3] rounded-[15px] p-[17px] hover:shadow-[0_8px_24px_rgba(20,40,80,0.06)] transition-shadow">
            <h2 className="font-extrabold text-[13px] text-[#263249] m-0">Localidad</h2>
            <div className="font-medium text-[10.5px] text-[#8593A2] mt-[3px]">Hasta 50.000 habitantes</div>
            <div className="flex items-baseline gap-[5px] my-[14px]">
              <span className="font-extrabold text-[24px] text-[#243447]">3</span>
              <span className="font-semibold text-[11px] text-[#8593A2]">licencias de oficial</span>
            </div>
            <div className="h-[1px] bg-[#F2F5F9] mb-[11px]"></div>
            <div className="flex flex-col gap-[7px]">
              <div className="flex gap-[7px] items-center">
                <span className="material-symbols-rounded text-[14px] text-[#2E9E6B]">check</span>
                <span className="font-semibold text-[11px] text-[#46566B]">1 jurisdicción</span>
              </div>
              <div className="flex gap-[7px] items-center">
                <span className="material-symbols-rounded text-[14px] text-[#2E9E6B]">check</span>
                <span className="font-semibold text-[11px] text-[#46566B]">Las 4 categorías</span>
              </div>
              <div className="flex gap-[7px] items-center">
                <span className="material-symbols-rounded text-[14px] text-[#C3CED9]">remove</span>
                <span className="font-semibold text-[11px] text-[#9AA7B5]">Sin exportación de datos</span>
              </div>
            </div>
          </div>

          {/* Card 2: Partido (Recomendado) */}
          <div className="flex-1 relative bg-white border-[2.5px] border-[#1E6FCB] rounded-[15px] p-[17px] shadow-[0_10px_26px_rgba(30,111,203,0.16)] hover:-translate-y-1 transition-transform">
            <span className="absolute -top-[10px] left-[17px] font-extrabold text-[9px] text-white bg-[#1E6FCB] px-[9px] py-1 rounded-[7px] tracking-wider">
              RECOMENDADO
            </span>
            <h2 className="font-extrabold text-[13px] text-[#263249] m-0 mt-1">Partido</h2>
            <div className="font-medium text-[10.5px] text-[#8593A2] mt-[3px]">Hasta 400.000 habitantes</div>
            <div className="flex items-baseline gap-[5px] my-[14px]">
              <span className="font-extrabold text-[24px] text-[#1E6FCB]">10</span>
              <span className="font-semibold text-[11px] text-[#8593A2]">licencias de oficial</span>
            </div>
            <div className="h-[1px] bg-[#F2F5F9] mb-[11px]"></div>
            <div className="flex flex-col gap-[7px]">
              <div className="flex gap-[7px] items-center">
                <span className="material-symbols-rounded text-[14px] text-[#2E9E6B]">check</span>
                <span className="font-semibold text-[11px] text-[#46566B]">Hasta 5 jurisdicciones</span>
              </div>
              <div className="flex gap-[7px] items-center">
                <span className="material-symbols-rounded text-[14px] text-[#2E9E6B]">check</span>
                <span className="font-semibold text-[11px] text-[#46566B]">Categorías configurables</span>
              </div>
              <div className="flex gap-[7px] items-center">
                <span className="material-symbols-rounded text-[14px] text-[#2E9E6B]">check</span>
                <span className="font-semibold text-[11px] text-[#46566B]">Exportación de datos</span>
              </div>
            </div>
          </div>

          {/* Card 3: Provincial */}
          <div className="flex-1 bg-white border border-[#E6ECF3] rounded-[15px] p-[17px] hover:shadow-[0_8px_24px_rgba(20,40,80,0.06)] transition-shadow">
            <h2 className="font-extrabold text-[13px] text-[#263249] m-0">Provincial</h2>
            <div className="font-medium text-[10.5px] text-[#8593A2] mt-[3px]">Sin límite de habitantes</div>
            <div className="flex items-baseline gap-[5px] my-[14px]">
              <span className="font-extrabold text-[24px] text-[#243447]">A medida</span>
            </div>
            <div className="h-[1px] bg-[#F2F5F9] mb-[11px]"></div>
            <div className="flex flex-col gap-[7px]">
              <div className="flex gap-[7px] items-center">
                <span className="material-symbols-rounded text-[14px] text-[#2E9E6B]">check</span>
                <span className="font-semibold text-[11px] text-[#46566B]">Jurisdicciones ilimitadas</span>
              </div>
              <div className="flex gap-[7px] items-center">
                <span className="material-symbols-rounded text-[14px] text-[#2E9E6B]">check</span>
                <span className="font-semibold text-[11px] text-[#46566B]">Integración con expedientes</span>
              </div>
              <div className="flex gap-[7px] items-center">
                <span className="material-symbols-rounded text-[14px] text-[#2E9E6B]">check</span>
                <span className="font-semibold text-[11px] text-[#46566B]">Soporte dedicado</span>
              </div>
            </div>
          </div>
          
        </div>

        {/* Footer (Info & Button) */}
        <div className="mt-8 md:mt-auto flex flex-col md:flex-row items-stretch md:items-center gap-[14px] pb-6 md:pb-0">
          <div className="flex-1 flex flex-col md:flex-row items-start md:items-center gap-3 bg-white border border-[#E6ECF3] rounded-[12px] p-3 md:px-[13px] md:py-[11px]">
            <span className="material-symbols-rounded text-[20px] md:text-[17px] text-[#8593A2] shrink-0 mt-0.5 md:mt-0">receipt_long</span>
            <span className="font-medium text-[12px] md:text-[11px] leading-[1.45] text-[#6A7888]">
              La facturación a organismos públicos se cierra por orden de compra. El precio no se muestra en pantalla: se emite presupuesto.
            </span>
          </div>
          
          <button className="bg-[#1E6FCB] text-white px-6 py-[14px] rounded-[12px] font-extrabold text-[13.5px] shadow-[0_8px_18px_rgba(30,111,203,0.28)] hover:bg-[#15539E] hover:-translate-y-0.5 active:translate-y-0 transition-all border-none cursor-pointer shrink-0 w-full md:w-auto">
            Continuar
          </button>
        </div>
        
      </div>
    </div>
  );
};
