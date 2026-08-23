// ==============================================================================
// Página de Permisos y Privacidad Ciudadana Minimalista (PermisosPage.jsx)
// ==============================================================================

// Importación de React y hooks de estado
import React, { useState, useEffect } from 'react';
// Hook de navegación de React Router
import { useNavigate } from 'react-router-dom';
// Iconografía temática
import { Camera, MapPin, ArrowRight } from 'lucide-react';
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

  // Avanzar al mapa completando el onboarding
  const handleContinue = () => {
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

  return (
    <div className="min-h-[100dvh] w-full bg-white text-slate-900 flex flex-col items-center safe-top safe-bottom overflow-x-hidden">
      <div className="w-full max-w-md mx-auto min-h-[100dvh] flex flex-col justify-between px-6 pt-6 pb-6">
        {/* Contenido Superior */}
        <div className="flex flex-col gap-5">
          {/* Barra Superior con Logo */}
          <header className="flex items-center justify-between">
            <img src="/logo.png" alt="Reportalo" className="w-8 h-8 object-contain rounded-xl" />
            <span className="text-xs font-bold text-primary bg-sky-50 px-2.5 py-1 rounded-full">
              Paso 2 de 2
            </span>
          </header>

          {/* Título y Subtítulo */}
          <div className="text-left mt-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Activá los permisos
            </h1>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Reportalo solo utiliza tus permisos cuando son necesarios para capturar y georreferenciar tu reporte.
            </p>
          </div>

          {/* Bloque de Privacidad */}
          <PrivacyBlock />

          {/* Lista de Permisos Directa */}
          <div className="flex flex-col gap-2.5 mt-1">
            <PermisoCard
              icon={Camera}
              title="Cámara"
              description="Capturá la foto del reporte en la app."
              status={cameraStatus}
              onRequest={handleRequestCamera}
              isLoading={isRequestingCamera}
            />

            <PermisoCard
              icon={MapPin}
              title="Ubicación"
              description="Georreferenciá el lugar automáticamente."
              status={locationStatus}
              onRequest={handleRequestLocation}
              isLoading={isRequestingLocation}
            />
          </div>
        </div>

        {/* Botones de Acción Inferiores */}
        <div className="w-full flex flex-col gap-2.5 mt-8">
          <Button
            variant="primary"
            size="lg"
            onClick={handleContinue}
            icon={<ArrowRight className="w-5 h-5" />}
          >
            Continuar al mapa
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-slate-500 hover:text-slate-900 font-semibold text-xs py-2"
          >
            Ahora no, configurar luego
          </Button>
        </div>
      </div>
    </div>
  );
};
