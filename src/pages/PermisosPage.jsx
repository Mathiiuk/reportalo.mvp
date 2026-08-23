// ==============================================================================
// Página de Permisos y Privacidad Ciudadana Pulida (PermisosPage.jsx)
// ==============================================================================

// Importación de React y hooks de estado
import React, { useState, useEffect } from 'react';
// Hook de navegación de React Router
import { useNavigate } from 'react-router-dom';
// Iconografía temática
import { Camera, MapPin, ArrowRight } from 'lucide-react';
// Notificaciones emergentes
import { toast } from 'sonner';
// Hook de contexto de onboarding
import { useOnboarding } from '../hooks/useOnboarding';
// Handlers nativos de permisos del navegador
import {
  requestCameraPermission,
  requestLocationPermission,
} from '../utils/permissions';
// Componentes visuales
import { Logo } from '../components/common/Logo';
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
    <div className="min-h-[100dvh] w-full bg-surface-muted flex flex-col justify-between items-center px-4.5 sm:px-6 pt-6 pb-6 safe-top safe-bottom overflow-x-hidden">
      {/* Contenido Principal */}
      <div className="w-full max-w-md mx-auto flex flex-col gap-4.5">
        {/* Cabecera con Logo */}
        <div className="flex items-center justify-between">
          <Logo size="sm" showText={true} />
          <span className="text-[11px] font-bold text-primary bg-primary-light px-2.5 py-1 rounded-full">
            Paso 2 de 2
          </span>
        </div>

        {/* Título de la pantalla */}
        <div className="text-left mt-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-content-primary">
            Activá los permisos
          </h1>
          <p className="text-xs text-content-secondary mt-1 leading-relaxed font-medium">
            Reportalo solo utiliza tus permisos cuando son necesarios para capturar y georreferenciar tu reporte.
          </p>
        </div>

        {/* Bloque Destacado de Privacidad */}
        <PrivacyBlock />

        {/* Tarjetas de Permisos con diseño horizontal y botones compactos */}
        <div className="flex flex-col gap-3">
          <PermisoCard
            icon={Camera}
            title="Cámara"
            description="Capturá la evidencia fotográfica directamente en la app."
            status={cameraStatus}
            onRequest={handleRequestCamera}
            isLoading={isRequestingCamera}
          />

          <PermisoCard
            icon={MapPin}
            title="Ubicación"
            description="Georreferenciá automáticamente el lugar del incidente."
            status={locationStatus}
            onRequest={handleRequestLocation}
            isLoading={isRequestingLocation}
          />
        </div>
      </div>

      {/* Botones de Acción Inferiores */}
      <div className="w-full max-w-md mx-auto flex flex-col gap-2 mt-6">
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
          className="text-content-secondary font-semibold text-xs py-2 h-auto"
        >
          Ahora no, configurar luego
        </Button>
      </div>
    </div>
  );
};
