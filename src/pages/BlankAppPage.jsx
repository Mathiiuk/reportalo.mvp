import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import {
  hasAcceptedCurrentTerms,
  getTermsRecord,
  CURRENT_TERMS_VERSION,
} from '../services/termsService';

export const BlankAppPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsData, setTermsData] = useState(null);

  useEffect(() => {
    const isAccepted = hasAcceptedCurrentTerms(user?.id);
    setTermsAccepted(isAccepted);
    setTermsData(getTermsRecord(user?.id));
  }, [user]);

  // Manejador para crear nuevo reporte (AC-02 & AC-07)
  const handleCreateReport = () => {
    if (!hasAcceptedCurrentTerms(user?.id)) {
      toast.warning(
        'Antes de enviar tu primer reporte, es necesario aceptar los Términos y Privacidad (v1.2).'
      );
      navigate('/terminos');
      return;
    }

    toast.success('¡Permisos y términos verificados! Listo para iniciar el reporte.');
  };

  return (
    <div className="min-h-[100dvh] sm:min-h-screen w-full flex items-center justify-center bg-white sm:bg-slate-100 sm:py-10 sm:px-4 select-none font-manrope">
      {/* Contenedor adaptativo: full screen en móvil, tarjeta elegante en desktop */}
      <div className="w-full sm:max-w-[440px] bg-white sm:rounded-[28px] sm:border sm:border-slate-200/90 sm:shadow-xl p-6 sm:p-8 min-h-[100dvh] sm:min-h-0 flex flex-col justify-between relative">
        
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

        {/* Zona central: Dashboard ciudadano y acción de reporte */}
        <div className="flex-1 flex flex-col items-center justify-center text-center my-6">
          <div className="w-14 h-14 rounded-full bg-[#EEF5FC] flex items-center justify-center text-[#1E6FCB] mb-3.5 shadow-sm">
            <span className="material-symbols-rounded filled text-3xl">
              verified_user
            </span>
          </div>
          <h2 className="font-extrabold text-xl text-slate-800 m-0">
            Panel Ciudadano
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 max-w-[280px] leading-relaxed">
            Explorá tus reclamos o iniciá un nuevo reporte con evidencia fotográfica.
          </p>

          {user?.email && (
            <div className="mt-3 px-3.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 truncate max-w-full">
              {user.email}
            </div>
          )}

          {/* Badge del estado de Términos */}
          <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 border border-slate-200">
            <span
              className={`w-2 h-2 rounded-full ${
                termsAccepted ? 'bg-green-500' : 'bg-amber-500'
              }`}
            />
            <span className="text-slate-600">
              {termsAccepted
                ? `Términos v${CURRENT_TERMS_VERSION} aceptados`
                : `Términos v${CURRENT_TERMS_VERSION} pendientes`}
            </span>
          </div>

          {/* Botón principal: Crear nuevo reporte */}
          <button
            onClick={handleCreateReport}
            type="button"
            className="mt-5 w-full py-3.5 px-4 bg-[#1E6FCB] text-white rounded-xl font-extrabold text-sm shadow-[0px_8px_18px_rgba(30,111,203,0.3)] hover:bg-[#15539E] cursor-pointer border-0 transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-rounded text-lg">add_a_photo</span>
            Crear nuevo reporte
          </button>

          {!termsAccepted && (
            <Link
              to="/terminos"
              className="mt-2 text-xs font-bold text-[#1E6FCB] hover:underline no-underline"
            >
              Revisar y aceptar términos ahora
            </Link>
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
