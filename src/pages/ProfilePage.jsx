import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../hooks/useAuth';
import {
  CURRENT_TERMS_VERSION,
  TERMS_EFFECTIVE_DATE,
  getTermsRecord,
  formatAcceptedDate,
} from '../services/termsService';
import { motion } from 'framer-motion';

export const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  // Lee el registro de consentimiento real para mostrar versión y fecha aceptada
  const termsRecord = getTermsRecord(user?.id);
  const acceptedVersion = termsRecord?.terms_version || CURRENT_TERMS_VERSION;
  const acceptedDate = formatAcceptedDate(termsRecord?.accepted_at);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <AppLayout activeTab="perfil">
      <div className="flex-1 overflow-y-auto bg-[#F4F7FB] px-4 sm:px-6 md:px-12 py-5">
        <div className="max-w-[620px] mx-auto flex flex-col gap-4">
          
          {/* Título de Sección */}
          <div>
            <h1 className="font-extrabold text-[22px] sm:text-[24px] text-[#243447] tracking-[-0.4px] m-0">
              Mi Perfil
            </h1>
            <p className="font-medium text-[12px] sm:text-[13px] text-[#8593A2] mt-0.5 mb-0">
              Gestión de cuenta, privacidad y consentimientos
            </p>
          </div>

          {/* Tarjeta de Usuario */}
          <div className="bg-white border border-[#E6ECF3] rounded-[18px] p-4 sm:p-5 flex items-center gap-4 shadow-xs">
            <div className="w-12 h-12 rounded-[15px] bg-[#EEF5FC] flex items-center justify-center text-[#1E6FCB] font-extrabold text-[18px] flex-shrink-0">
              <span className="material-symbols-rounded text-[26px] filled">
                person
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[15px] text-[#263249] truncate">
                  {user?.email || 'Ciudadano autenticado'}
                </span>
              </div>
              <span className="font-extrabold text-[10px] text-[#2E9E6B] bg-[#E3F5EC] px-2 py-0.5 rounded-[6px] uppercase tracking-wider inline-block mt-1">
                Cuenta Verificada
              </span>
            </div>
          </div>

          {/* Bloque: Privacidad y Términos */}
          <div className="bg-white border border-[#E6ECF3] rounded-[18px] p-4 sm:p-5 flex flex-col gap-3 shadow-xs">
            <div className="font-extrabold text-[13px] text-[#263249] flex items-center gap-2">
              <span className="material-symbols-rounded text-[18px] text-[#1E6FCB] filled">
                verified_user
              </span>
              <span>Términos y Privacidad</span>
            </div>

            <div className="flex items-center justify-between text-[12px] text-[#56657A] pt-2 border-t border-[#EEF1F5]">
              <span>Versión aceptada</span>
              {/* Muestra la versión y fecha reales del consentimiento registrado */}
              <span className="font-bold text-[#263249]">
                v{acceptedVersion} ({acceptedDate})
              </span>
            </div>

            <div className="flex items-center justify-between text-[12px] text-[#56657A]">
              <span>Tratamiento de imágenes</span>
              <span className="font-bold text-[#2E9E6B]">
                Anonimización activa
              </span>
            </div>

            <div className="flex items-center justify-between text-[12px] text-[#56657A]">
              <span>Protección legal</span>
              <span className="font-bold text-[#263249]">
                Ley Nacional 25.326
              </span>
            </div>

            {/* Navega con state consultaDesde para activar el modo lectura en /terminos */}
            <button
              onClick={() => navigate('/terminos', { state: { consultaDesde: 'perfil' } })}
              type="button"
              className="text-left font-bold text-[12px] text-[#1E6FCB] hover:text-[#15539E] cursor-pointer bg-transparent border-0 p-0 mt-1"
            >
              Revisar términos y permisos →
            </button>
          </div>

          {/* Bloque: Seguridad y Cerrar Sesión */}
          <div className="bg-white border border-[#E6ECF3] rounded-[18px] p-4 sm:p-5 flex flex-col gap-3 shadow-xs">
            <div className="font-extrabold text-[13px] text-[#263249] flex items-center gap-2">
              <span className="material-symbols-rounded text-[18px] text-[#1E6FCB] filled">
                security
              </span>
              <span>Seguridad de Sesión</span>
            </div>

            <p className="font-medium text-[11.5px] leading-[1.45] text-[#7A8696] m-0">
              Tu identidad se mantiene disociada de los reportes enviados al municipio en todo momento.
            </p>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogout}
              type="button"
              className="w-full bg-[#FFF1F0] hover:bg-[#FEE4E2] text-[#E74C3C] border border-[#FECDCA] rounded-[12px] py-3 px-4 text-center font-extrabold text-[13px] cursor-pointer transition-colors mt-2"
            >
              Cerrar sesión
            </motion.button>
          </div>

        </div>
      </div>
    </AppLayout>
  );
};
