import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AppLayout } from '../components/layout/AppLayout';
import { CitizenMap } from '../components/map/CitizenMap';
import { useViewportReports } from '../hooks/useViewportReports';

// REP-3805: la carga por zona visible se puede apagar sin tocar código poniendo VITE_MAP_VIEWPORT_LOADING=false en el
// entorno (vuelve la consulta global única anterior). Por defecto está activa.
const VIEWPORT_LOADING_ENABLED = import.meta.env?.VITE_MAP_VIEWPORT_LOADING !== 'false';

export const MapPage = () => {
  const navigate = useNavigate();

  // H-36: los reportes del mapa salen de citizen_reports, no de datos de prueba.
  // REP-3805: se piden por zona visible (el mapa avisa cuándo terminó de moverse) en vez de «los últimos 200» globales.
  const { reports, truncated, isLoading, error, onViewportChange } = useViewportReports({ enabled: VIEWPORT_LOADING_ENABLED });

  // Un solo aviso por falla: si el error persiste mientras se mueve el mapa no se repite el toast
  const hasError = Boolean(error);
  useEffect(() => {
    if (!hasError) return;
    // El mapa igual se dibuja: es la pantalla de inicio y no puede quedar en blanco. Se avisa que los reclamos no
    // cargaron, sin inventar ninguno.
    console.error('[MapPage] No se pudieron cargar los reportes del mapa:', error);
    toast.error('No pudimos cargar los reclamos del mapa', {
      description: 'Probá de nuevo en unos minutos.',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasError]);

  return (
    <AppLayout activeTab="mapa">
      {/* UJ v3.3 · D09: al tocar un pin se abre la ficha y desde ahí el detalle del reporte */}
      <CitizenMap
        reports={reports}
        isLoadingReports={isLoading}
        truncated={truncated}
        onViewportChange={onViewportChange}
        onOpenReport={(reportId) => navigate(`/reportes/${reportId}`)}
      />
    </AppLayout>
  );
};

export default MapPage;
