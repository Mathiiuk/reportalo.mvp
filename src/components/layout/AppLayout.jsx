import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Bell, Map as MapIcon, FileText, Camera, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getUserInitials } from '../../utils/userUtils';

export const AppLayout = ({ children, activeTab = 'mapa', onCameraClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Obtener iniciales dinámicas del usuario autenticado
  const userInitials = getUserInitials(user);

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
      // Redirigir al flujo de inicio de nuevo reporte (REP-2600 / REP-2200)
      navigate('/nuevo-reporte');
    }
  };

  return (
    <div className="relative w-full h-[100dvh] bg-[#F4F7FB] overflow-hidden flex flex-col font-manrope select-none">
      
      {/* Header Superior (Mobile) */}
      <header className="md:hidden z-30 bg-white border-b border-slate-100 shadow-xs pt-[max(16px,env(safe-area-inset-top,16px))]">
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

      {/* Header Superior (Desktop) */}
      <header className="hidden md:flex flex-none border-b border-[#EEF1F5] px-[26px] py-[12px] bg-white items-center gap-5 z-30 shadow-xs">
        <Link to="/mapa" className="flex items-center gap-2 no-underline text-inherit hover:opacity-90 transition-opacity">
          <img src="/logo-icon.webp" alt="Reportalo" className="w-[19px] h-[25px] object-contain" />
          <span className="font-extrabold text-[18px] text-[#263249] tracking-[-0.4px]">
            Reportalo
          </span>
        </Link>
        
        <div className="flex gap-6 ml-4">
          <Link 
            to="/mapa" 
            className={`no-underline text-[13px] transition-colors py-1 ${currentTab === 'mapa' ? 'font-bold text-[#1E6FCB] border-b-2 border-[#1E6FCB]' : 'font-semibold text-[#7A8696] hover:text-[#5B6A7A]'}`}
          >
            Mapa
          </Link>
          <Link 
            to="/reportes" 
            className={`no-underline text-[13px] transition-colors py-1 ${currentTab === 'reportes' ? 'font-bold text-[#1E6FCB] border-b-2 border-[#1E6FCB]' : 'font-semibold text-[#7A8696] hover:text-[#5B6A7A]'}`}
          >
            Mis reportes
          </Link>
          <Link 
            to="/alertas" 
            className={`no-underline text-[13px] transition-colors py-1 ${currentTab === 'alertas' ? 'font-bold text-[#1E6FCB] border-b-2 border-[#1E6FCB]' : 'font-semibold text-[#7A8696] hover:text-[#5B6A7A]'}`}
          >
            Novedades
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button 
            onClick={handleCameraAction}
            className="flex items-center gap-[7px] bg-[#1E6FCB] text-white px-[16px] py-[9px] rounded-[10px] cursor-pointer hover:bg-[#15539E] transition-colors border-none shadow-xs font-bold text-[12.5px]"
          >
            <span className="material-symbols-rounded text-[17px]">add_a_photo</span>
            <span>Reportar</span>
          </button>
          
          <Link 
            to="/perfil" 
            title="Ver mi perfil"
            className="w-[32px] h-[32px] rounded-full bg-[#E8F1FB] border border-[#D4E6F8] flex items-center justify-center font-extrabold text-[12px] text-[#1E6FCB] cursor-pointer no-underline hover:bg-[#D9EAFB] transition-colors"
          >
            {userInitials}
          </Link>
        </div>
      </header>

      {/* Contenedor del contenido principal (Ocupa todo el ancho en desktop) */}
      <main className="relative w-full h-full min-h-0 flex-1 overflow-hidden flex flex-col bg-[#F4F7FB]">
        {children}
      </main>

      {/* Barra de Navegación Inferior Flotante (Mobile) */}
      <div className="md:hidden fixed bottom-[max(12px,env(safe-area-inset-bottom,12px))] left-0 right-0 z-30 px-4 flex justify-center pointer-events-none">
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
