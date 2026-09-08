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
      className="min-h-[100dvh] w-full bg-[#F4F7FB] flex items-center justify-center p-3 sm:p-4 font-manrope select-none"
    >
      {/* Contenedor mobile-first con dimensiones fieles a la maqueta (298px x 626px proporcionales) */}
      <div className="w-full max-w-[340px] bg-[#F4F7FB] rounded-[30px] overflow-hidden flex flex-col min-h-[580px] shadow-sm">
        <div className="flex-1 min-h-0 flex flex-col px-5 pt-3 pb-3">
          {/* 1. Ícono de Escudo Azul de Verificación */}
          <div className="w-[44px] h-[44px] rounded-[13px] bg-[#E8F1FB] flex items-center justify-center mb-2.5">
            <span
              className="material-symbols-rounded text-[24px] filled text-[#1E6FCB]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              verified_user
            </span>
          </div>

          {/* 2. Título Principal */}
          <h1 className="font-extrabold text-[21px] text-[#243447] tracking-[-0.4px] m-0 leading-tight">
            Activá los permisos
          </h1>

          {/* 3. Subtítulo Explicativo */}
          <p className="font-medium text-[12px] leading-[1.4] text-[#8593A2] mt-1 mb-0">
            Cámara y ubicación se usan al reportar; las notificaciones, para seguir tu reporte. Podés cambiarlos cuando quieras.
          </p>

          {/* 4. Tarjeta 1: Cámara */}
          <div className="mt-3 bg-white border border-[#E6ECF3] rounded-[14px] p-[11px] flex gap-[11px] items-start shadow-2xs">
            <span
              className="w-[38px] h-[38px] flex-0 rounded-[11px] bg-[#E8F1FB] flex items-center justify-center material-symbols-rounded text-[21px] text-[#1E6FCB]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              photo_camera
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[13px] text-[#263249]">Cámara</div>
              <div className="font-medium text-[11.5px] leading-[1.4] text-[#8593A2] mt-0.5">
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
              className={`w-[42px] h-[25px] rounded-[13px] flex-0 relative cursor-pointer border-0 transition-colors p-0 ${
                cameraEnabled ? 'bg-[#1E6FCB]' : 'bg-[#CFD8E2]'
              }`}
            >
              <span
                className={`absolute top-[2.5px] w-[20px] h-[20px] rounded-full bg-white transition-all shadow-xs ${
                  cameraEnabled ? 'right-[2.5px]' : 'left-[2.5px]'
                }`}
              />
            </button>
          </div>

          {/* 5. Tarjeta 2: Ubicación */}
          <div className="mt-2 bg-white border border-[#E6ECF3] rounded-[14px] p-[11px] flex gap-[11px] items-start shadow-2xs">
            <span
              className="w-[38px] h-[38px] flex-0 rounded-[11px] bg-[#E8F1FB] flex items-center justify-center material-symbols-rounded text-[21px] text-[#1E6FCB]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              location_on
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[13px] text-[#263249]">Ubicación</div>
              <div className="font-medium text-[11.5px] leading-[1.4] text-[#8593A2] mt-0.5">
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
              className={`w-[42px] h-[25px] rounded-[13px] flex-0 relative cursor-pointer border-0 transition-colors p-0 ${
                locationEnabled ? 'bg-[#1E6FCB]' : 'bg-[#CFD8E2]'
              }`}
            >
              <span
                className={`absolute top-[2.5px] w-[20px] h-[20px] rounded-full bg-white transition-all shadow-xs ${
                  locationEnabled ? 'right-[2.5px]' : 'left-[2.5px]'
                }`}
              />
            </button>
          </div>

          {/* 6. Tarjeta 3: Notificaciones (Nueva Funcionalidad PWA) */}
          <div className="mt-2 bg-white border border-[#E6ECF3] rounded-[14px] p-[11px] flex gap-[11px] items-start shadow-2xs">
            <span
              className="w-[38px] h-[38px] flex-0 rounded-[11px] bg-[#E8F1FB] flex items-center justify-center material-symbols-rounded text-[21px] text-[#1E6FCB]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              notifications
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[13px] text-[#263249]">Notificaciones</div>
              <div className="font-medium text-[11.5px] leading-[1.4] text-[#8593A2] mt-0.5">
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
              className={`w-[42px] h-[25px] rounded-[13px] flex-0 relative cursor-pointer border-0 transition-colors p-0 ${
                notificationsEnabled ? 'bg-[#1E6FCB]' : 'bg-[#CFD8E2]'
              }`}
            >
              <span
                className={`absolute top-[2.5px] w-[20px] h-[20px] rounded-full bg-white transition-all shadow-xs ${
                  notificationsEnabled ? 'right-[2.5px]' : 'left-[2.5px]'
                }`}
              />
            </button>
          </div>

          {/* 7. Banner Verde Informativo de Privacidad */}
          <div className="flex items-start gap-[9px] bg-[#E3F5EC] border border-[#D0EADB] rounded-[12px] p-[9px] mt-2.5 text-left">
            <span
              className="material-symbols-rounded text-[17px] text-[#2E9E6B] flex-0 mt-0.5"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              shield
            </span>
            <span className="font-semibold text-[11px] leading-[1.5] text-[#2C7A55]">
              Tu foto se procesa de forma segura: los rostros y patentes se difuminan automáticamente antes de guardarse. La imagen original nunca se almacena.
            </span>
          </div>

          {/* 8. Zona Inferior de Acciones */}
          <div className="mt-auto pt-4 pb-2">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleContinue}
              className="w-full bg-[#1E6FCB] border-0 rounded-[13px] py-[13px] px-4 text-center shadow-[0px_8px_18px_rgba(30,111,203,0.3)] hover:bg-[#15539E] cursor-pointer transition-colors"
            >
              <span className="font-extrabold text-[15px] text-white">Continuar</span>
            </motion.button>

            <button
              type="button"
              onClick={handleSkip}
              className="w-full text-center py-[7px] font-bold text-[13px] text-[#8593A2] hover:text-[#263249] cursor-pointer bg-transparent border-0 transition-colors mt-1"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionsPage;
