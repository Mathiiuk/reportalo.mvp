import React from 'react';
import { UnderConstruction } from '../components/common/UnderConstruction';
import { FileText } from 'lucide-react';

export const ReportesPage = () => {
  return (
    <UnderConstruction
      title="Mis Reportes"
      description="Acá vas a poder ver el historial y estado de todos tus reportes realizados."
      icon={FileText}
    />
  );
};
