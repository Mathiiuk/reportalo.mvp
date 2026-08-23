import React from 'react';
import { UnderConstruction } from '../components/common/UnderConstruction';
import { Bell } from 'lucide-react';

export const AlertasPage = () => {
  return (
    <UnderConstruction
      title="Alertas"
      description="Recibí notificaciones sobre el estado de tus reportes y alertas de tu zona."
      icon={Bell}
    />
  );
};
