import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { CitizenMap } from '../components/map/CitizenMap';

export const MapPage = () => {
  const navigate = useNavigate();

  return (
    <AppLayout activeTab="mapa">
      {/* UJ v3.3 · D09: al tocar un pin se abre la ficha y desde ahí el detalle del reporte */}
      <CitizenMap onOpenReport={(reportId) => navigate(`/reportes/${reportId}`)} />
    </AppLayout>
  );
};

export default MapPage;
