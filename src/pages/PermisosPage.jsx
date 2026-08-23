// ==============================================================================
// Página de Permisos y Privacidad Ciudadana Pulida (PermisosPage.jsx)
// ==============================================================================

// Importación de React y hooks de estado
import React, { useState, useEffect } from 'react';
// Hook de navegación de React Router
import { useNavigate } from 'react-router-dom';
// Iconografía temática
import { Camera, MapPin, ArrowRight, ArrowLeft } from 'lucide-react';
// Notificaciones Toast
import { toast } from 'sonner';
// Hook de contexto de onboarding
import { useOnboarding } from '../hooks/useOnboarding';
// Handlers nativos de permisos
import {
  requestCameraPermission,
  requestLocationPermission,
} from '../utils/permissions';
// Componentes de la interfaz
import { PermisoCard } from '../components/permisos/PermisoCard';
import { PrivacyBlock } from '../components/permisos/PrivacyBlock';
import { Button } from '../components/common/Button';

export const PermisosPage = () => {
  const { setCompleted, setRegistered, onboardingStatus } = useOnboarding();
  const navigate = useNavigate();

  // Detectar si hubo error en el callback de OAuth y redirigir a Home con notificación
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorMsg = params.get('error_description') || params.get('error');
    const errorCode = params.get('error_code');

    if (errorMsg || errorCode) {
      if (errorCode === 'signup_disabled') {
        toast.error('Los registros están deshabilitados en el panel de Supabase (Activar "Allow new users to sign up").');
      } else {
        toast.error(`Error de autenticación: ${errorMsg || errorCode}`);
      }
      navigate('/', { replace: true });
      return;
    }

    if (onboardingStatus === 'new') {
      setRegistered();
    }
  }, [onboardingStatus, setRegistered, navigate]);

  // Estados de los permisos ('prompt' | 'granted' | 'denied')
  const [cameraStatus, setCameraStatus] = useState('prompt');
  const [locationStatus, setLocationStatus] = useState('prompt');
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  // Solicitar cámara
  const handleRequestCamera = async () => {
    setIsRequestingCamera(true);
    const result = await requestCameraPermission();
    if (result.granted) {
      setCameraStatus('granted');
      toast.success('Permiso de cámara concedido.');
    } else {
      setCameraStatus('denied');
      toast.info('Permiso de cámara denegado. Podés activarlo luego.');
    }
    setIsRequestingCamera(false);
  };

  // Solicitar ubicación
  const handleRequestLocation = async () => {
    setIsRequestingLocation(true);
    const result = await requestLocationPermission();
    if (result.granted) {
      setLocationStatus('granted');
      toast.success('Permiso de ubicación concedido.');
    } else {
      setLocationStatus('denied');
      toast.info('Permiso de ubicación denegado. Podés activarlo luego.');
    }
    setIsRequestingLocation(false);
  };

  // Solicitar todos los permisos pendientes en secuencia
  const handleContinue = async () => {
    if (cameraStatus === 'prompt') {
      await handleRequestCamera();
    }
    if (locationStatus === 'prompt') {
      await handleRequestLocation();
    }

    setCompleted();
    toast.success('¡Todo listo! Bienvenido al mapa de Reportalo.');
    navigate('/map');
  };

  // Omitir permisos por el momento
  const handleSkip = () => {
    setCompleted();
    toast.info('Podrás conceder los permisos cuando realices tu primer reporte.');
    navigate('/map');
  };

  const allGranted = cameraStatus === 'granted' && locationStatus === 'granted';

  return (
    <div className="min-h-[100dvh] w-full bg-white text-slate-900 flex flex-col items-center safe-top safe-bottom overflow-x-hidden">
      <div className="w-full max-w-md mx-auto min-h-[100dvh] flex flex-col justify-between px-6 pt-5 pb-6">
        {/* Sección Superior */}
        <div className="flex flex-col">
          {/* Barra Superior con botón Volver y Paso */}
          <header className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center text-slate-700 transition-all cursor-pointer"
              aria-label="Volver al inicio"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Indicador de progreso minimalista */}
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-200" />
              <span className="w-6 h-2 rounded-full bg-primary" />
            </div>
          </header>

          {/* Hero Visual Centrado con Logo Transparente */}
          <div className="flex flex-col items-center text-center mt-2 mb-6">
            <img
              src="/logo-icon.png"
              alt="Reportalo"
              className="w-16 h-18 object-contain mb-3 select-none drop-shadow-xs"
            />
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Activá los permisos
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-xs leading-relaxed">
              Para capturar la evidencia y posicionar tus reportes en el mapa.
            </p>
          </div>

          {/* Filas de Permisos Interactivos con Switch */}
          <div className="flex flex-col gap-2.5">
            <PermisoCard
              icon={Camera}
              iconBg="bg-sky-50 text-primary"
              title="Cámara"
              description="Captura de fotos para la evidencia."
              status={cameraStatus}
              onRequest={handleRequestCamera}
              isLoading={isRequestingCamera}
            />

            <PermisoCard
              icon={MapPin}
              iconBg="bg-amber-50 text-amber-600"
              title="Ubicación GPS"
              description="Georreferenciación del incidente."
              status={locationStatus}
              onRequest={handleRequestLocation}
              isLoading={isRequestingLocation}
            />
          </div>

          {/* Bloque Compacto de Confianza y Privacidad */}
          <div className="mt-4">
            <PrivacyBlock />
          </div>
        </div>

        {/* Botones de Acción Inferiores */}
        <div className="w-full flex flex-col gap-2.5 mt-6">
          <Button
            variant="primary"
            size="lg"
            onClick={handleContinue}
            icon={<ArrowRight className="w-5 h-5" />}
          >
            {allGranted ? 'Continuar al mapa' : 'Permitir y continuar'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-slate-400 hover:text-slate-700 font-semibold text-xs py-2 h-auto"
          >
            Ahora no, configurar luego
          </Button>
        </div>
      </div>
    </div>
  );
};
