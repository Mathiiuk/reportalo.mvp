import React from 'react';
import { useAuth } from '../hooks/useAuth';

export const BlankAppPage = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-[100dvh] sm:min-h-screen w-full flex items-center justify-center bg-white sm:bg-slate-100 sm:py-10 sm:px-4 select-none font-manrope">
      {/* Contenedor adaptativo: full screen en móvil, tarjeta elegante en desktop */}
      <div className="w-full sm:max-w-[420px] bg-white sm:rounded-[28px] sm:border sm:border-slate-200/90 sm:shadow-xl p-6 sm:p-8 min-h-[100dvh] sm:min-h-0 flex flex-col justify-between relative">
        
        {/* Cabecera con branding */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <img
              src="/logo-icon.webp"
              alt="Reportalo Icon"
              className="w-5 h-6 object-contain"
            />
            <span className="font-extrabold text-[16px] text-[#263249]">
              Reportalo
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-200">
            Conectado
          </span>
        </div>

        {/* Zona central: Página en blanco según requerimiento */}
        <div className="flex-1 flex flex-col items-center justify-center text-center my-8">
          <div className="w-14 h-14 rounded-full bg-[#EEF5FC] flex items-center justify-center text-[#1E6FCB] mb-3.5 shadow-sm">
            <span className="material-symbols-rounded filled text-3xl">
              verified_user
            </span>
          </div>
          <h3 className="font-extrabold text-xl text-slate-800">
            Sesión Iniciada
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-[260px] leading-relaxed">
            Bienvenido a Reportalo. Esta es la pantalla principal post-autenticación.
          </p>

          {user?.email && (
            <div className="mt-4 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 truncate max-w-full">
              {user.email}
            </div>
          )}
        </div>

        {/* Botón para cerrar sesión */}
        <div>
          <button
            onClick={signOut}
            type="button"
            className="w-full py-3.5 px-4 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-50 active:scale-98 transition-all cursor-pointer bg-white"
          >
            Cerrar sesión
          </button>
        </div>

      </div>
    </div>
  );
};
