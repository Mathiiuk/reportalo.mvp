import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';

export const WelcomePage = () => {
  const navigate = useNavigate();
  const { authError, clearError } = useAuth();

  // Transición a la pantalla de acceso
  const handleStart = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-[100dvh] w-full font-manrope select-none flex flex-col bg-white">
      
      {/* Navbar visible únicamente en desktop */}
      <header className="hidden md:flex flex-shrink-0 border-b border-[#EEF1F5] px-8 lg:px-12 py-4 items-center gap-6 bg-white">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo-icon.webp"
            alt="Reportalo"
            className="w-[20px] h-[26px] object-contain"
          />
          <span className="font-extrabold text-[19px] text-[#263249] tracking-[-0.4px]">
            Reportalo
          </span>
          <span className="font-bold text-[9px] text-[#1E6FCB] bg-[#EEF5FC] px-2 py-1 rounded-[7px] ml-1">
            CIUDADANOS
          </span>
        </div>

        <nav className="flex items-center gap-6 ml-4">
          <span className="font-semibold text-[13px] text-[#7A8696] hover:text-[#1E6FCB] cursor-pointer transition-colors">
            Cómo funciona
          </span>
          <span className="font-semibold text-[13px] text-[#7A8696] hover:text-[#1E6FCB] cursor-pointer transition-colors">
            Privacidad y Seguridad
          </span>
          <button
            onClick={() => navigate('/municipios')}
            type="button"
            className="font-semibold text-[13px] text-[#1E6FCB] hover:text-[#15539E] cursor-pointer bg-transparent border-0 transition-colors p-0"
          >
            Para Municipios →
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={handleStart}
            type="button"
            className="font-bold text-[13px] text-[#1E6FCB] hover:text-[#15539E] px-3 py-2 cursor-pointer bg-transparent border-0"
          >
            Ingresar
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStart}
            type="button"
            className="bg-[#1E6FCB] text-white px-4 py-2.5 rounded-[10px] font-bold text-[13px] hover:bg-[#15539E] cursor-pointer border-0 shadow-sm"
          >
            Comenzar
          </motion.button>
        </div>
      </header>

      {/* Contenedor principal responsive */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[100dvh] md:min-h-0">
        
        {/* Columna / Cuerpo principal:
            - En móvil (< md): gradiente azul de Reportalo, centrado vertical.
            - En desktop (>= md): fondo blanco limpio, hero y métricas al pie. */}
        <main
          className="flex-1 flex flex-col justify-between px-6 md:px-12 lg:px-16 pt-[max(env(safe-area-inset-top),24px)] md:pt-10 pb-[max(env(safe-area-inset-bottom),28px)] md:pb-8 text-white md:text-slate-800"
          style={{
            background:
              typeof window !== 'undefined' && window.innerWidth >= 768
                ? 'transparent'
                : 'linear-gradient(165deg, rgb(42, 123, 214), rgb(21, 83, 158))',
          }}
        >
          {/* Zona superior / Hero con animación Framer Motion */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex-1 flex flex-col justify-center items-center md:items-start text-center md:text-left py-4 md:py-0 max-w-[560px]"
          >
            
            {/* Contenedor icono pin_drop */}
            <div className="w-[66px] h-[66px] md:w-[72px] md:h-[72px] rounded-[20px] bg-white/15 md:bg-[#EEF5FC] backdrop-blur-sm flex items-center justify-center mb-5 shadow-sm">
              <span className="material-symbols-rounded filled text-[36px] text-white md:text-[#1E6FCB]">
                pin_drop
              </span>
            </div>

            {/* Título principal */}
            <h1 className="font-extrabold text-[32px] md:text-[38px] lg:text-[42px] leading-tight md:leading-[1.18] text-white md:text-[#1F2C3D] tracking-[-0.6px] md:tracking-[-1px]">
              Reportalo
            </h1>

            {/* Bajada explicativa */}
            <p className="font-medium text-[14px] md:text-[15.5px] leading-[1.55] md:leading-[1.6] text-white/90 md:text-[#6A7888] mt-[11px] md:mt-3 max-w-[280px] md:max-w-[480px]">
              Reportá lo que ves en tu ciudad, con evidencia verificada y tu identidad protegida.
            </p>

            {/* Mensaje de error si la autenticación con OAuth falla */}
            {authError && (
              <div
                role="alert"
                className="mt-4 p-3 rounded-xl bg-red-500/20 md:bg-red-50 border border-white/30 md:border-red-200 text-white md:text-red-700 text-xs font-medium flex items-center gap-2 max-w-[480px] w-full"
              >
                <span className="material-symbols-rounded filled text-base text-white md:text-red-600 flex-shrink-0">
                  error
                </span>
                <span className="flex-1">{authError}</span>
                <button
                  onClick={clearError}
                  type="button"
                  className="text-white md:text-red-500 hover:opacity-80 font-bold ml-1 bg-transparent border-0 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Lista de beneficios diferenciales */}
            <div className="flex flex-col gap-[12px] md:gap-[14px] mt-[26px] md:mt-7 w-full max-w-[300px] md:max-w-none">
              <div className="flex items-center gap-[10px]">
                <span className="material-symbols-rounded filled text-[19px] text-[#9FD0FF] md:text-[#1E6FCB] flex-shrink-0">
                  shield
                </span>
                <span className="font-semibold text-[12.5px] md:text-[13.5px] text-white/95 md:text-[#3A4658] text-left leading-snug">
                  Anónimo ante el organismo receptor
                </span>
              </div>

              <div className="flex items-center gap-[10px]">
                <span className="material-symbols-rounded filled text-[19px] text-[#9FD0FF] md:text-[#1E6FCB] flex-shrink-0">
                  auto_awesome
                </span>
                <span className="font-semibold text-[12.5px] md:text-[13.5px] text-white/95 md:text-[#3A4658] text-left leading-snug">
                  La IA encuentra a quién corresponde
                </span>
              </div>

              <div className="flex items-center gap-[10px]">
                <span className="material-symbols-rounded filled text-[19px] text-[#9FD0FF] md:text-[#1E6FCB] flex-shrink-0">
                  map
                </span>
                <span className="font-semibold text-[12.5px] md:text-[13.5px] text-white/95 md:text-[#3A4658] text-left leading-snug">
                  Seguimiento hasta resolverse
                </span>
              </div>
            </div>

          </motion.div>

          {/* Zona inferior de acción */}
          <div className="flex flex-col gap-[10px] pt-4 md:pt-6 max-w-[320px] md:max-w-[440px] w-full mx-auto md:mx-0">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStart}
              type="button"
              className="w-full bg-white md:bg-[#1E6FCB] text-[#1E6FCB] md:text-white rounded-[14px] py-[16px] px-6 text-center font-extrabold text-[15px] md:text-[15.5px] shadow-[0px_8px_18px_rgba(0,0,0,0.14)] md:shadow-[0px_8px_18px_rgba(30,111,203,0.28)] hover:opacity-95 cursor-pointer border-0"
            >
              Comenzar
            </motion.button>
            <p className="text-center md:text-left font-medium text-[11px] leading-[1.4] text-white/75 md:text-[#8593A2] px-[10px] md:px-1 m-0">
              Entrás con tu correo, sin crear contraseña.
            </p>
          </div>

          {/* Fila de Métricas / Garantías exclusiva de Desktop */}
          <div className="hidden md:flex items-center gap-8 lg:gap-12 pt-8 border-t border-slate-100 mt-8">
            <div>
              <div className="font-extrabold text-[24px] leading-none text-[#1E6FCB]">
                100%
              </div>
              <div className="font-bold text-[10.5px] tracking-wider text-[#8593A2] mt-1.5 uppercase">
                Identidad Protegida
              </div>
            </div>

            <div>
              <div className="font-extrabold text-[24px] leading-none text-[#1E6FCB]">
                IA Inteligente
              </div>
              <div className="font-bold text-[10.5px] tracking-wider text-[#8593A2] mt-1.5 uppercase">
                Encuadre de Organismo
              </div>
            </div>

            <div>
              <div className="font-extrabold text-[24px] leading-none text-[#1E6FCB]">
                Tiempo Real
              </div>
              <div className="font-bold text-[10.5px] tracking-wider text-[#8593A2] mt-1.5 uppercase">
                Seguimiento de Estado
              </div>
            </div>
          </div>
        </main>

        {/* Sidebar exclusiva de Desktop (>= md) basada en el diseño de municipios */}
        <aside className="hidden md:flex w-[380px] lg:w-[420px] flex-shrink-0 bg-[#F4F7FB] border-l border-[#EEF1F5] p-8 flex-col justify-between gap-4">
          <div>
            <div className="font-extrabold text-[11px] text-[#8593A2] tracking-[0.5px] mb-4 uppercase">
              Cómo Funciona
            </div>

            <div className="flex flex-col gap-3">
              <motion.div
                whileHover={{ y: -2 }}
                className="bg-white border border-[#E6ECF3] rounded-[13px] p-3.5 flex gap-3 shadow-sm"
              >
                <span className="w-[28px] h-[28px] rounded-[8px] bg-[#EEF5FC] text-[#1E6FCB] font-extrabold text-[12px] flex items-center justify-center flex-shrink-0">
                  1
                </span>
                <div>
                  <div className="font-bold text-[13px] text-[#263249]">
                    Reportás lo que ves
                  </div>
                  <div className="font-medium text-[11px] leading-[1.45] text-[#7A8696] mt-0.5">
                    Subís foto y ubicación exacta con total resguardo de tu anonimato.
                  </div>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="bg-white border border-[#E6ECF3] rounded-[13px] p-3.5 flex gap-3 shadow-sm"
              >
                <span className="w-[28px] h-[28px] rounded-[8px] bg-[#EEF5FC] text-[#1E6FCB] font-extrabold text-[12px] flex items-center justify-center flex-shrink-0">
                  2
                </span>
                <div>
                  <div className="font-bold text-[13px] text-[#263249]">
                    La IA encuentra a quién corresponde
                  </div>
                  <div className="font-medium text-[11px] leading-[1.45] text-[#7A8696] mt-0.5">
                    Determina el organismo competente y la categoría del caso.
                  </div>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="bg-white border border-[#E6ECF3] rounded-[13px] p-3.5 flex gap-3 shadow-sm"
              >
                <span className="w-[28px] h-[28px] rounded-[8px] bg-[#EEF5FC] text-[#1E6FCB] font-extrabold text-[12px] flex items-center justify-center flex-shrink-0">
                  3
                </span>
                <div>
                  <div className="font-bold text-[13px] text-[#263249]">
                    Seguimiento hasta resolverse
                  </div>
                  <div className="font-medium text-[11px] leading-[1.45] text-[#7A8696] mt-0.5">
                    Recibís notificaciones y ves los avances de resolución de tu caso.
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          <div className="flex items-start gap-2 pt-3 border-t border-[#EEF1F5]">
            <span className="material-symbols-rounded filled text-[17px] text-[#1E6FCB] flex-shrink-0 mt-0.5">
              verified_user
            </span>
            <span className="font-semibold text-[11px] leading-[1.5] text-[#56657A]">
              Tu cuenta sirve para seguir tus reportes; tu identidad nunca se comparte con el organismo.
            </span>
          </div>
        </aside>

      </div>

    </div>
  );
};
