import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export const AppLayout = ({ children, activeTab = 'mapa', onCameraClick }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determinar pestaña activa
  const getActiveTab = () => {
    if (location.pathname.startsWith('/mapa')) return 'mapa';
    if (location.pathname.startsWith('/reportes')) return 'reportes';
    if (location.pathname.startsWith('/alertas') || location.pathname.startsWith('/novedades')) return 'alertas';
    if (location.pathname.startsWith('/perfil')) return 'perfil';
    return activeTab;
  };

  const currentTab = getActiveTab();

  const handleCameraAction = () => {
    if (onCameraClick) {
      onCameraClick();
    } else {
      navigate('/mapa?action=capture');
    }
  };

  return (
    <div className="h-[100dvh] w-full font-manrope select-none flex flex-col bg-[#F8FAFC] overflow-hidden">
      
      {/* Header Superior (Topbar) */}
      <header className="flex-shrink-0 bg-white border-b border-[#EEF1F5] px-4 py-2.5 sm:px-6 md:px-8 z-20 flex items-center justify-between shadow-2xs">
        <Link to="/mapa" className="flex items-center gap-2 text-inherit no-underline">
          <img
            src="/logo-icon.webp"
            alt="Reportalo"
            className="w-[20px] h-[26px] object-contain"
          />
          <span className="font-extrabold text-[19px] text-[#263249] tracking-[-0.4px]">
            Reportalo
          </span>
        </Link>

        {/* Campana de Notificaciones con Badge */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Alertas y notificaciones (2 nuevas)"
            onClick={() => navigate('/alertas')}
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#7B8A9A] hover:text-[#1E6FCB] hover:bg-[#EEF5FC] transition-colors cursor-pointer border-0 bg-transparent"
          >
            <span className="material-symbols-rounded filled text-[22px]">
              notifications
            </span>
            <span className="absolute top-1 right-1 w-[15px] h-[15px] rounded-full bg-[#E74C3C] border-2 border-white flex items-center justify-center font-extrabold text-[8px] text-white">
              2
            </span>
          </button>
        </div>
      </header>

      {/* Contenedor del contenido principal */}
      <main className="flex-1 relative w-full h-full min-h-0 overflow-hidden flex flex-col">
        {children}
      </main>

      {/* Barra de Navegación Inferior Flotante (5 Botones / Píldora moderna) */}
      <div className="flex-shrink-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-1 flex justify-center w-full pointer-events-none">
        <nav
          aria-label="Navegación principal"
          className="bg-white rounded-[26px] shadow-[0px_10px_30px_rgba(0,0,0,0.08)] border border-[#EBEFF5] px-3 py-1.5 flex items-center justify-between w-full max-w-[380px] pointer-events-auto"
        >
          
          {/* 1. Mapa */}
          <button
            type="button"
            onClick={() => navigate('/mapa')}
            className={`flex flex-col items-center gap-0.5 cursor-pointer bg-transparent border-0 py-1 px-2.5 transition-all rounded-[14px] ${
              currentTab === 'mapa'
                ? 'bg-[#E6F6FD] text-[#0284C7]'
                : 'text-[#94A3B8] hover:text-[#475569]'
            }`}
          >
            <span className="material-symbols-rounded text-[20px]">
              map
            </span>
            <span className="text-[9px] font-bold">
              Mapa
            </span>
          </button>

          {/* 2. Reportes */}
          <button
            type="button"
            onClick={() => navigate('/reportes')}
            className={`flex flex-col items-center gap-0.5 cursor-pointer bg-transparent border-0 py-1 px-2.5 transition-all rounded-[14px] ${
              currentTab === 'reportes'
                ? 'bg-[#E6F6FD] text-[#0284C7]'
                : 'text-[#94A3B8] hover:text-[#475569]'
            }`}
          >
            <span className="material-symbols-rounded text-[20px]">
              description
            </span>
            <span className="text-[9px] font-bold">
              Reportes
            </span>
          </button>

          {/* 3. Botón Central: Cámara (Naranja flotante) */}
          <div className="relative flex justify-center px-1">
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              type="button"
              aria-label="Tomar foto y reportar"
              onClick={handleCameraAction}
              className="w-[52px] h-[52px] -mt-5 rounded-full bg-gradient-to-tr from-[#EA580C] to-[#FB923C] text-white flex items-center justify-center shadow-[0px_6px_18px_rgba(234,88,12,0.4)] border-[3px] border-white cursor-pointer transition-all"
            >
              <span className="material-symbols-rounded text-[24px]">
                photo_camera
              </span>
            </motion.button>
          </div>

          {/* 4. Alertas */}
          <button
            type="button"
            onClick={() => navigate('/alertas')}
            className={`flex flex-col items-center gap-0.5 cursor-pointer bg-transparent border-0 py-1 px-2.5 transition-all rounded-[14px] ${
              currentTab === 'alertas'
                ? 'bg-[#E6F6FD] text-[#0284C7]'
                : 'text-[#94A3B8] hover:text-[#475569]'
            }`}
          >
            <span className="material-symbols-rounded text-[20px]">
              notifications_none
            </span>
            <span className="text-[9px] font-bold">
              Alertas
            </span>
          </button>

          {/* 5. Perfil */}
          <button
            type="button"
            onClick={() => navigate('/perfil')}
            className={`flex flex-col items-center gap-0.5 cursor-pointer bg-transparent border-0 py-1 px-2.5 transition-all rounded-[14px] ${
              currentTab === 'perfil'
                ? 'bg-[#E6F6FD] text-[#0284C7]'
                : 'text-[#94A3B8] hover:text-[#475569]'
            }`}
          >
            <span className="material-symbols-rounded text-[20px]">
              person_outline
            </span>
            <span className="text-[9px] font-bold">
              Perfil
            </span>
          </button>

        </nav>
      </div>

    </div>
  );
};
