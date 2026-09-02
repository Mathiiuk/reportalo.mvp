import React from 'react';
import { motion } from 'framer-motion';

/**
 * Pantalla / Spinner de Carga de Reportalo con Logo, anillo giratorio sutil y fondo limpio.
 */
export const AppLoadingScreen = ({ message = 'Cargando Reportalo...' }) => {
  return (
    <div
      data-testid="app-loading-screen"
      className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F4F7FB] font-manrope select-none p-4"
    >
      <div className="relative flex items-center justify-center">
        {/* Anillo exterior con efecto spin suave */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}
          className="w-20 h-20 rounded-full border-3 border-[#EEF2F6] border-t-[#1E6FCB] border-r-[#1E6FCB]/40 shadow-xs"
        />

        {/* Logo de Reportalo centrado con efecto sutil de respiración/pulso */}
        <motion.div
          animate={{ scale: [0.96, 1.04, 0.96] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <img
            src="/logo-icon.webp"
            alt="Logo Reportalo"
            className="w-10 h-10 object-contain drop-shadow-[0_4px_12px_rgba(30,111,203,0.2)] select-none"
          />
        </motion.div>
      </div>

      {/* Nombre de la app y mensaje */}
      <div className="flex flex-col items-center gap-1 mt-5 text-center">
        <span className="font-extrabold text-[17px] text-[#1B365D] tracking-tight">
          Reportalo
        </span>
        <span className="font-medium text-[12px] text-[#64748B]">
          {message}
        </span>
      </div>
    </div>
  );
};

export default AppLoadingScreen;
