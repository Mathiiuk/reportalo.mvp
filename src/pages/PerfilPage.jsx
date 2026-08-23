import React from 'react';
import { UnderConstruction } from '../components/common/UnderConstruction';
import { User } from 'lucide-react';

export const PerfilPage = () => {
  return (
    <UnderConstruction
      title="Mi Perfil"
      description="Gestioná tus datos personales, configuración de notificaciones y preferencias."
      icon={User}
    />
  );
};
