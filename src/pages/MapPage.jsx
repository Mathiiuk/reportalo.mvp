import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AppLayout } from '../components/layout/AppLayout';
import { CitizenMap } from '../components/map/CitizenMap';
import { getPublicMapReports } from '../services/mapReportsService';

export const MapPage = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);

  // H-36: los reportes del mapa salen de citizen_reports, no de datos de prueba.
  useEffect(() => {
    let isMounted = true;

    getPublicMapReports().then((result) => {
      if (!isMounted) return;
      if (result.success) {
        setReports(result.reports);
      } else {
        // El mapa igual se dibuja: es la pantalla de inicio y no puede quedar en
        // blanco. Se avisa que los reclamos no cargaron, sin inventar ninguno.
        console.error('[MapPage] No se pudieron cargar los reportes del mapa:', result.error);
        toast.error('No pudimos cargar los reclamos del mapa', {
          description: 'Probá de nuevo en unos minutos.',
        });
      }
      setIsLoadingReports(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AppLayout activeTab="mapa">
      {/* UJ v3.3 · D09: al tocar un pin se abre la ficha y desde ahí el detalle del reporte */}
      <CitizenMap
        reports={reports}
        isLoadingReports={isLoadingReports}
        onOpenReport={(reportId) => navigate(`/reportes/${reportId}`)}
      />
    </AppLayout>
  );
};

export default MapPage;
