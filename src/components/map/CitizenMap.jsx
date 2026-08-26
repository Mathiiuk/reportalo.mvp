import React, { useEffect, useRef, useState } from 'react';
import { Map, GeolocateControl, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Estilo OpenFreeMap Bright oficial (vectorial, libre y sin API key)
const OPENFREEMAP_BRIGHT_STYLE = 'https://tiles.openfreemap.org/styles/bright';

// Coordenadas por defecto (Buenos Aires, Argentina)
const DEFAULT_CENTER = [-58.3816, -34.6037];
const DEFAULT_ZOOM = 13.5;

export const CitizenMap = ({ onFilterClick, onReportClick }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeFilter, setActiveFilter] = useState('todos');
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Prevención para entornos sin WebGL (Vitest / JSDOM / SSR)
    if (typeof window === 'undefined' || typeof Map !== 'function') {
      setMapLoaded(true);
      return;
    }

    try {
      const map = new Map({
        container: mapContainerRef.current,
        style: OPENFREEMAP_BRIGHT_STYLE,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });

      // Deshabilitar gestos de rotación y pitch en PWA móvil
      if (map.touchZoomRotate) {
        map.touchZoomRotate.disableRotation();
      }
      if (map.touchPitch) {
        map.touchPitch.disable();
      }
      if (map.dragRotate) {
        map.dragRotate.disable();
      }

      // Control de geolocalización de usuario
      if (typeof GeolocateControl === 'function') {
        const geolocate = new GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true,
          },
          trackUserLocation: true,
        });
        map.addControl(geolocate, 'top-left');
      }

      map.on('load', () => {
        setMapLoaded(true);
        map.resize();

        // Marcadores de reportes de ejemplo
        const sampleReports = [
          { lng: -58.3816, lat: -34.6037, title: 'Bache en calzada', status: 'En revisión' },
          { lng: -58.3850, lat: -34.6080, title: 'Luminaria apagada', status: 'Enviado' },
          { lng: -58.3780, lat: -34.5990, title: 'Basura acumulada', status: 'Resuelto' },
        ];

        sampleReports.forEach((report) => {
          const el = document.createElement('div');
          el.className =
            'w-7 h-7 rounded-full bg-[#1E6FCB] border-2 border-white shadow-lg flex items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95';
          el.innerHTML =
            '<span class="material-symbols-rounded text-[15px] text-white filled" style="display:flex;align-items:center;justify-content:center;">pin_drop</span>';

          el.addEventListener('click', () => {
            if (onReportClick) onReportClick(report);
          });

          if (typeof Marker === 'function') {
            new Marker({ element: el })
              .setLngLat([report.lng, report.lat])
              .addTo(map);
          }
        });
      });

      // Listener de redimensionamiento
      const handleResize = () => {
        if (map) map.resize();
      };
      window.addEventListener('resize', handleResize);

      mapInstanceRef.current = map;

      return () => {
        window.removeEventListener('resize', handleResize);
        if (mapInstanceRef.current && typeof mapInstanceRef.current.remove === 'function') {
          mapInstanceRef.current.remove();
        }
      };
    } catch (e) {
      console.warn('[OpenFreeMap Init Warning]:', e);
      setMapLoaded(true);
    }
  }, [onReportClick]);

  return (
    <div className="w-full h-full min-h-0 flex-1 relative overflow-hidden bg-[#E8EEF5]">
      
      {/* Contenedor Canvas para OpenFreeMap */}
      <div
        ref={mapContainerRef}
        data-testid="maplibre-container"
        className="w-full h-full absolute inset-0"
      />

      {/* Spinner de carga inicial */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-[#E8EEF5] flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2 text-[#7B8A9A]">
            <div className="w-8 h-8 border-3 border-[#1E6FCB] border-t-transparent rounded-full animate-spin" />
            <span className="font-bold text-xs">Cargando OpenFreeMap...</span>
          </div>
        </div>
      )}

      {/* Botón Flotante de Filtros */}
      <button
        type="button"
        aria-label="Abrir filtros de mapa"
        onClick={() => {
          setShowFiltersModal((prev) => !prev);
          if (onFilterClick) onFilterClick();
        }}
        className="absolute right-3.5 top-3.5 w-[38px] h-[38px] rounded-[12px] bg-white flex items-center justify-center shadow-[0px_5px_16px_rgba(20,40,80,0.14)] text-[#1E6FCB] hover:bg-[#F4F7FB] active:scale-95 transition-all cursor-pointer border-0 z-10"
      >
        <span className="material-symbols-rounded text-[20px]">
          tune
        </span>
      </button>

      {/* Menú flotante de Filtros */}
      {showFiltersModal && (
        <div className="absolute right-3.5 top-14 bg-white rounded-[15px] p-3 shadow-[0px_8px_24px_rgba(20,40,80,0.18)] border border-[#E6ECF3] z-20 w-[180px] flex flex-col gap-1.5 animate-in fade-in zoom-in-95">
          <div className="font-extrabold text-[11px] text-[#8593A2] uppercase tracking-wider mb-1 px-1">
            Filtrar por estado
          </div>
          {['todos', 'Enviado', 'En revisión', 'Resuelto'].map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => {
                setActiveFilter(filter);
                setShowFiltersModal(false);
              }}
              className={`text-left px-2.5 py-1.5 rounded-[8px] font-bold text-[12px] cursor-pointer border-0 transition-colors capitalize ${
                activeFilter === filter
                  ? 'bg-[#EEF5FC] text-[#1E6FCB]'
                  : 'text-[#56657A] hover:bg-slate-50'
              }`}
            >
              {filter === 'todos' ? 'Todos los reclamos' : filter}
            </button>
          ))}
        </div>
      )}

      {/* Leyenda de Intensidad / Calor */}
      <div className="absolute left-3.5 bottom-20 md:bottom-24 bg-white/95 backdrop-blur-xs rounded-[10px] py-[7px] px-[10px] flex items-center gap-[7px] shadow-[0px_4px_12px_rgba(20,40,80,0.12)] border border-white/60 z-10 select-none">
        <span className="font-bold text-[9px] text-[#8A97A6]">
          Menos
        </span>
        <span className="w-[44px] h-[6px] rounded-[4px] bg-[linear-gradient(90deg,rgb(46,158,107),rgb(247,142,53),rgb(231,76,60))]" />
        <span className="font-bold text-[9px] text-[#8A97A6]">
          Más
        </span>
      </div>

    </div>
  );
};
