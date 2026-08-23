// ==============================================================================
// Página de Permisos y Privacidad Ciudadana (PermisosPage.jsx)
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, MapPin, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useOnboarding } from '../hooks/useOnboarding';
import {
  requestCameraPermission,
  requestLocationPermission,
} from '../utils/permissions';
import { PermisoCard } from '../components/permisos/PermisoCard';
import { PrivacyBlock } from '../components/permisos/PrivacyBlock';
import { Button } from '../components/common/Button';

export const PermisosPage = () => {
  const { setCompleted } = useOnboarding();
  const navigate = useNavigate();

  // Estados de los permisos ('prompt' | 'granted' | 'denied')
  const [cameraStatus, setCameraStatus] = useState('prompt');
  const [locationStatus, setLocationStatus] = useState('prompt');
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  // Solicitar cámara secuencialmente
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
    <div className="min-h-screen w-full bg-surface-muted flex flex-col justify-between items-center px-5 pt-8 pb-6 safe-top safe-bottom">
      <div className="w-full max-w-md mx-auto flex flex-col gap-5">
        {/* Encabezado */}
        <div className="text-left">
          <h1 className="text-2xl font-bold tracking-tight text-content-primary">
            Activá los permisos
          </h1>
          <p className="text-xs text-content-secondary mt-1 leading-relaxed">
            Reportalo solo usa tus permisos cuando son necesarios para capturar y georreferenciar un reporte.
          </p>
        </div>

        {/* Bloque Destacado de Privacidad */}
        <PrivacyBlock />

        {/* Tarjetas de Permisos */}
        <div className="flex flex-col gap-3.5">
          <PermisoCard
            icon={Camera}
            title="Cámara"
            description="Capturá la evidencia directamente desde Reportalo."
            status={cameraStatus}
            onRequest={handleRequestCamera}
            isLoading={isRequestingCamera}
          />

          <PermisoCard
            icon={MapPin}
            title="Ubicación"
            description="Usamos tu ubicación para georreferenciar el reporte en el mapa."
            status={locationStatus}
            onRequest={handleRequestLocation}
            isLoading={isRequestingLocation}
          />
        </div>
      </div>

      {/* Botones de Acción Inferiores */}
      <div className="w-full max-w-md mx-auto flex flex-col gap-2.5 mt-8">
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
          size="md"
          onClick={handleSkip}
          className="text-content-secondary font-normal"
        >
          Ahora no
        </Button>
      </div>
    </div>
  );
};
