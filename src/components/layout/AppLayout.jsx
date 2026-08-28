import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Bell, Map as MapIcon, FileText, Camera, User } from 'lucide-react';

export const AppLayout = ({ children, activeTab = 'mapa', onCameraClick }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determinar pestaña activa según la ruta
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
      toast.info('Creación de reportes disponible en Sprint 11', {
        description: 'La captura guiada de fotos y emisión de reclamos se habilitará en el próximo sprint.',
      });
    }
  };

  return (
    <div className="relative w-full h-[100dvh] bg-[#F4F7FB] overflow-hidden flex flex-col font-manrope select-none">
      
      {/* Header Superior (Topbar idéntico al modelo) */}
      <header className="z-30 bg-white border-b border-slate-100 shadow-xs pt-[max(16px,env(safe-area-inset-top,16px))]">
        <div className="px-5 pt-2 pb-2 flex items-center justify-between">
          <Link to="/mapa" className="flex items-center gap-2.5 text-inherit no-underline">
            <img
              src="/logo-icon.webp"
              alt="Logo Reportalo"
              className="w-6 h-7 object-contain select-none"
            />
            <span className="text-[21px] font-extrabold text-[#1B365D] tracking-tight">
              Reportalo
            </span>
          </Link>

          <button
            type="button"
            onClick={() => navigate('/alertas')}
            className="relative w-10 h-10 rounded-full flex items-center justify-center text-[#475569] hover:bg-slate-100 active:scale-95 transition-all cursor-pointer border-0 bg-transparent"
            aria-label="Ver alertas y notificaciones"
          >
            <Bell className="w-5 h-5 text-[#334155]" />
            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#DC2626] text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white shadow-xs">
              2
            </span>
          </button>
        </div>
      </header>

      {/* Contenedor del contenido principal */}
      <main className="relative w-full h-full min-h-0 flex-1 overflow-hidden flex flex-col">
        {children}
      </main>

      {/* Barra de Navegación Inferior Flotante (Exacta al modelo) */}
      <div className="fixed bottom-[max(12px,env(safe-area-inset-bottom,12px))] left-0 right-0 z-30 px-4 flex justify-center pointer-events-none">
        <nav
          aria-label="Navegación principal"
          className="bg-white rounded-[28px] shadow-[0px_10px_35px_rgba(15,30,60,0.15)] border border-[#E8EEF5] px-3.5 py-1.5 flex items-center justify-between w-full max-w-[390px] pointer-events-auto"
        >
          
          {/* 1. Mapa */}
          <button
            type="button"
            onClick={() => navigate('/mapa')}
            className={`flex flex-col items-center gap-0.5 cursor-pointer bg-transparent border-0 py-1 px-3 transition-all rounded-[14px] ${
              currentTab === 'mapa'
                ? 'bg-[#E6F6FD] text-[#0284C7]'
                : 'text-[#94A3B8] hover:text-[#475569]'
            }`}
          >
            <MapIcon className="w-5 h-5" />
            <span className="text-[9.5px] font-bold">
              Mapa
            </span>
          </button>

          {/* 2. Reportes */}
          <button
            type="button"
            onClick={() => navigate('/reportes')}
            className={`flex flex-col items-center gap-0.5 cursor-pointer bg-transparent border-0 py-1 px-3 transition-all rounded-[14px] ${
              currentTab === 'reportes'
                ? 'bg-[#E6F6FD] text-[#0284C7]'
                : 'text-[#94A3B8] hover:text-[#475569]'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[9.5px] font-bold">
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
              className="w-[54px] h-[54px] -mt-6 rounded-full bg-gradient-to-tr from-[#EA580C] to-[#FB923C] text-white flex items-center justify-center shadow-[0px_8px_20px_rgba(234,88,12,0.45)] border-[3.5px] border-white cursor-pointer transition-all"
            >
              <Camera className="w-6 h-6" />
            </motion.button>
          </div>

          {/* 4. Alertas */}
          <button
            type="button"
            onClick={() => navigate('/alertas')}
            className={`flex flex-col items-center gap-0.5 cursor-pointer bg-transparent border-0 py-1 px-3 transition-all rounded-[14px] ${
              currentTab === 'alertas'
                ? 'bg-[#E6F6FD] text-[#0284C7]'
                : 'text-[#94A3B8] hover:text-[#475569]'
            }`}
          >
            <Bell className="w-5 h-5" />
            <span className="text-[9.5px] font-bold">
              Alertas
            </span>
          </button>

          {/* 5. Perfil */}
          <button
            type="button"
            onClick={() => navigate('/perfil')}
            className={`flex flex-col items-center gap-0.5 cursor-pointer bg-transparent border-0 py-1 px-3 transition-all rounded-[14px] ${
              currentTab === 'perfil'
                ? 'bg-[#E6F6FD] text-[#0284C7]'
                : 'text-[#94A3B8] hover:text-[#475569]'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[9.5px] font-bold">
              Perfil
            </span>
          </button>

        </nav>
      </div>

    </div>
  );
};
