import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendLocalNotification,
} from '../services/notificationService';

/**
 * Pantalla de Activación de Permisos (PWA: Cámara, Ubicación y Notificaciones).
 * Se presenta por única vez inmediatamente después de completar u omitir el Onboarding.
 */
export const PermissionsPage = () => {
  const navigate = useNavigate();

  // Estados de permisos interactivos (switches estilo iOS)
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Al montar, verificamos si las notificaciones ya estaban previamente concedidas en el navegador
  useEffect(() => {
    if (isNotificationSupported() && getNotificationPermission() === 'granted') {
      setNotificationsEnabled(true);
    }
  }, []);

  // Alternar permiso de Cámara
  const handleToggleCamera = async () => {
    const nextState = !cameraEnabled;
    setCameraEnabled(nextState);

    if (nextState && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // Liberamos el stream inmediatamente tras confirmar el acceso
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        console.warn('[Permisos] Acceso a cámara cancelado o denegado:', err);
      }
    }
  };

  // Alternar permiso de Ubicación
  const handleToggleLocation = () => {
    const nextState = !locationEnabled;
    setLocationEnabled(nextState);

    if (nextState && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {},
        (err) => console.warn('[Permisos] Ubicación GPS rechazada:', err),
        { timeout: 5000 }
      );
    }
  };

  // Alternar permiso de Notificaciones (Web Push / Browser Notification API)
  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      // Intentamos solicitar permiso nativo al navegador
      const result = await requestNotificationPermission();

      if (result === 'granted') {
        setNotificationsEnabled(true);
        toast.success('Notificaciones activadas', {
          description: 'Te avisaremos cuando tu reporte sea revisado.',
        });

        // Disparamos notificación de prueba inmediata para validar la experiencia nativa PWA
        await sendLocalNotification({
          title: 'Reportalo — ¡Notificaciones activadas!',
          body: 'Te avisaremos en tiempo real cuando tu reporte sea recibido o cambie de estado.',
          url: '/reportes',
        });
      } else if (result === 'denied') {
        setNotificationsEnabled(false);
        toast.error('Permiso denegado', {
          description: 'Podés activarlas en cualquier momento desde la configuración de tu navegador.',
        });
      } else {
        setNotificationsEnabled(false);
      }
    } else {
      setNotificationsEnabled(false);
    }
  };

  // Guardar configuración y avanzar a la experiencia principal del mapa
  const handleContinue = () => {
    try {
      localStorage.setItem('reportalo_permissions_configured', 'true');
      localStorage.setItem('reportalo_perm_camera', cameraEnabled ? 'true' : 'false');
      localStorage.setItem('reportalo_perm_location', locationEnabled ? 'true' : 'false');
      localStorage.setItem('reportalo_perm_notifications', notificationsEnabled ? 'true' : 'false');
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    navigate('/mapa', { replace: true });
  };

  // Omitir configuración de permisos por ahora
  const handleSkip = () => {
    try {
      localStorage.setItem('reportalo_permissions_configured', 'true');
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    navigate('/mapa', { replace: true });
  };

  return (
    <div
      data-testid="permissions-page"
      className="min-h-[100dvh] w-full bg-[#F4F7FB] flex flex-col font-manrope select-none"
    >
      {/* Header Superior Desktop (>= md) */}
      <header className="hidden md:flex flex-shrink-0 border-b border-[#EEF1F5] px-8 lg:px-12 py-4 items-center gap-6 bg-white z-20">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo-icon.webp"
            alt="Reportalo"
            className="w-[20px] h-[26px] object-contain select-none"
          />
          <span className="font-extrabold text-[19px] text-[#263249] tracking-[-0.4px]">
            Reportalo
          </span>
          <span className="font-bold text-[9px] text-[#1E6FCB] bg-[#EEF5FC] px-2 py-1 rounded-[7px] ml-1 uppercase">
            CIUDADANOS
          </span>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <button
            onClick={handleSkip}
            type="button"
            className="font-bold text-[13px] text-[#9AA7B5] hover:text-[#1E6FCB] px-3 py-2 cursor-pointer bg-transparent border-0 transition-colors"
          >
            Ahora no
          </button>
        </div>
      </header>

      {/* Contenedor principal centrado */}
      <div className="flex-1 flex items-center justify-center p-3 sm:p-4 md:py-10">
        {/* Contenedor responsivo: 340px en móvil, 560px con estilo modal card en Desktop */}
        <div className="w-full max-w-[340px] md:max-w-[560px] bg-[#F4F7FB] md:bg-white rounded-[30px] md:rounded-[24px] overflow-hidden flex flex-col min-h-[580px] md:min-h-0 shadow-sm md:shadow-[0_12px_40px_rgba(20,40,80,0.07)] md:border md:border-[#E6ECF3] md:p-8">
          <div className="flex-1 min-h-0 flex flex-col px-5 pt-3 pb-3 md:p-0">
            
            {/* 1. Ícono de Escudo Azul de Verificación */}
            <div className="w-[44px] h-[44px] md:w-[48px] md:h-[48px] rounded-[13px] bg-[#E8F1FB] flex items-center justify-center mb-2.5 md:mb-3">
              <span
                className="material-symbols-rounded text-[24px] md:text-[26px] filled text-[#1E6FCB]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified_user
              </span>
            </div>

            {/* 2. Título Principal */}
            <h1 className="font-extrabold text-[21px] md:text-[26px] text-[#243447] tracking-[-0.4px] m-0 leading-tight">
              Activá los permisos
            </h1>

            {/* 3. Subtítulo Explicativo */}
            <p className="font-medium text-[12px] md:text-[13.5px] leading-[1.4] md:leading-[1.5] text-[#8593A2] mt-1 md:mt-2 mb-0">
              Cámara y ubicación se usan al reportar; las notificaciones, para seguir tu reporte. Podés cambiarlos cuando quieras.
            </p>

            {/* 4. Tarjeta 1: Cámara */}
            <div className="mt-3 md:mt-4 bg-white md:bg-[#F8FAFC] border border-[#E6ECF3] rounded-[14px] md:rounded-[16px] p-[11px] md:p-3.5 flex gap-[11px] md:gap-3 items-center shadow-2xs">
              <span
                className="w-[38px] h-[38px] md:w-[42px] md:h-[42px] flex-shrink-0 rounded-[11px] md:rounded-[12px] bg-[#E8F1FB] flex items-center justify-center material-symbols-rounded text-[21px] md:text-[23px] text-[#1E6FCB]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                photo_camera
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[13px] md:text-[14px] text-[#263249]">
                  Cámara
                </div>
                <div className="font-medium text-[11.5px] md:text-[12px] leading-[1.4] text-[#8593A2] mt-0.5">
                  Para capturar la foto que sirve de evidencia.
                </div>
              </div>
              {/* Switch iOS */}
              <button
                type="button"
                role="switch"
                aria-checked={cameraEnabled}
                aria-label="Permiso de cámara"
                onClick={handleToggleCamera}
                className={`w-[42px] md:w-[44px] h-[25px] md:h-[26px] rounded-[13px] flex-shrink-0 relative cursor-pointer border-0 transition-colors p-0 ${
                  cameraEnabled ? 'bg-[#1E6FCB]' : 'bg-[#CFD8E2]'
                }`}
              >
                <span
                  className={`absolute top-[2.5px] w-[20px] md:w-[21px] h-[20px] md:h-[21px] rounded-full bg-white transition-all shadow-xs ${
                    cameraEnabled ? 'right-[2.5px]' : 'left-[2.5px]'
                  }`}
                />
              </button>
            </div>

            {/* 5. Tarjeta 2: Ubicación */}
            <div className="mt-2 md:mt-2.5 bg-white md:bg-[#F8FAFC] border border-[#E6ECF3] rounded-[14px] md:rounded-[16px] p-[11px] md:p-3.5 flex gap-[11px] md:gap-3 items-center shadow-2xs">
              <span
                className="w-[38px] h-[38px] md:w-[42px] md:h-[42px] flex-shrink-0 rounded-[11px] md:rounded-[12px] bg-[#E8F1FB] flex items-center justify-center material-symbols-rounded text-[21px] md:text-[23px] text-[#1E6FCB]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                location_on
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[13px] md:text-[14px] text-[#263249]">
                  Ubicación
                </div>
                <div className="font-medium text-[11.5px] md:text-[12px] leading-[1.4] text-[#8593A2] mt-0.5">
                  Para georreferenciar el reporte en el mapa.
                </div>
              </div>
              {/* Switch iOS */}
              <button
                type="button"
                role="switch"
                aria-checked={locationEnabled}
                aria-label="Permiso de ubicación"
                onClick={handleToggleLocation}
                className={`w-[42px] md:w-[44px] h-[25px] md:h-[26px] rounded-[13px] flex-shrink-0 relative cursor-pointer border-0 transition-colors p-0 ${
                  locationEnabled ? 'bg-[#1E6FCB]' : 'bg-[#CFD8E2]'
                }`}
              >
                <span
                  className={`absolute top-[2.5px] w-[20px] md:w-[21px] h-[20px] md:h-[21px] rounded-full bg-white transition-all shadow-xs ${
                    locationEnabled ? 'right-[2.5px]' : 'left-[2.5px]'
                  }`}
                />
              </button>
            </div>

            {/* 6. Tarjeta 3: Notificaciones (Nueva Funcionalidad PWA) */}
            <div className="mt-2 md:mt-2.5 bg-white md:bg-[#F8FAFC] border border-[#E6ECF3] rounded-[14px] md:rounded-[16px] p-[11px] md:p-3.5 flex gap-[11px] md:gap-3 items-center shadow-2xs">
              <span
                className="w-[38px] h-[38px] md:w-[42px] md:h-[42px] flex-shrink-0 rounded-[11px] md:rounded-[12px] bg-[#E8F1FB] flex items-center justify-center material-symbols-rounded text-[21px] md:text-[23px] text-[#1E6FCB]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                notifications
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[13px] md:text-[14px] text-[#263249]">
                  Notificaciones
                </div>
                <div className="font-medium text-[11.5px] md:text-[12px] leading-[1.4] text-[#8593A2] mt-0.5">
                  Para avisarte cuando cambie el estado de tu reporte.
                </div>
              </div>
              {/* Switch iOS */}
              <button
                type="button"
                role="switch"
                aria-checked={notificationsEnabled}
                aria-label="Permiso de notificaciones"
                onClick={handleToggleNotifications}
                className={`w-[42px] md:w-[44px] h-[25px] md:h-[26px] rounded-[13px] flex-shrink-0 relative cursor-pointer border-0 transition-colors p-0 ${
                  notificationsEnabled ? 'bg-[#1E6FCB]' : 'bg-[#CFD8E2]'
                }`}
              >
                <span
                  className={`absolute top-[2.5px] w-[20px] md:w-[21px] h-[20px] md:h-[21px] rounded-full bg-white transition-all shadow-xs ${
                    notificationsEnabled ? 'right-[2.5px]' : 'left-[2.5px]'
                  }`}
                />
              </button>
            </div>

            {/* 7. Banner Verde Informativo de Privacidad */}
            <div className="flex items-start gap-[9px] md:gap-2.5 bg-[#E3F5EC] border border-[#D0EADB] rounded-[12px] md:rounded-[14px] p-[9px] md:p-3 mt-2.5 md:mt-3 text-left">
              <span
                className="material-symbols-rounded text-[17px] md:text-[19px] text-[#2E9E6B] flex-shrink-0 mt-0.5"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                shield
              </span>
              <span className="font-semibold text-[11px] md:text-[12px] leading-[1.5] text-[#2C7A55]">
                Tu foto se procesa de forma segura: los rostros y patentes se difuminan automáticamente antes de guardarse. La imagen original nunca se almacena.
              </span>
            </div>

            {/* 8. Zona Inferior de Acciones */}
            <div className="mt-auto pt-4 md:pt-6 pb-2 md:pb-0">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleContinue}
                className="w-full bg-[#1E6FCB] border-0 rounded-[13px] md:rounded-[14px] py-[13px] md:py-3.5 px-4 text-center shadow-[0px_8px_18px_rgba(30,111,203,0.3)] hover:bg-[#15539E] cursor-pointer transition-colors"
              >
                <span className="font-extrabold text-[15px] md:text-[16px] text-white">Continuar</span>
              </motion.button>

              <button
                type="button"
                onClick={handleSkip}
                className="w-full text-center py-[7px] md:py-2.5 font-bold text-[13px] text-[#8593A2] hover:text-[#263249] cursor-pointer bg-transparent border-0 transition-colors mt-1"
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionsPage;
