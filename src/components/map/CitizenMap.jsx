import React, { useEffect, useRef, useState } from 'react';
import { Map, Marker, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { SlidersHorizontal, Navigation, X, MapPin, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MOCK_REPORTS } from '../../data/mockReports';
import 'maplibre-gl/dist/maplibre-gl.css';

// Configurar URL del Web Worker de MapLibre para Vite
if (typeof setWorkerUrl === 'function' && workerUrl) {
  try {
    setWorkerUrl(workerUrl);
  } catch (e) {
    console.warn('[MapLibre Worker Init]:', e);
  }
}

// Estilo OpenFreeMap Bright oficial (sin API key y libre)
const OPENFREEMAP_BRIGHT_STYLE = 'https://tiles.openfreemap.org/styles/bright';

// Bounding Box para limitar el movimiento a CABA y Avellaneda
// [Sudoeste (SW), Noreste (NE)] -> [[lngMin, latMin], [lngMax, latMax]]
const CABA_AVELLANEDA_BOUNDS = [
  [-58.5500, -34.7300], // Sudoeste: límite Gral. Paz / Liniers y Sur de Avellaneda / Wilde
  [-58.3100, -34.5200], // Noreste: Río de la Plata, Nuñez y Costanera Avellaneda
];

// Coordenadas centrales entre CABA y Avellaneda
const DEFAULT_CENTER = [-58.4200, -34.6200];
const DEFAULT_ZOOM = 12.8;
const MIN_ZOOM = 11.5;
const MAX_ZOOM = 19;

export const CitizenMap = ({ onFilterClick }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('todos');
  const [selectedReport, setSelectedReport] = useState(null);

  // Filtrado reactivo de reportes
  const filteredReports = MOCK_REPORTS.filter((report) => {
    if (activeFilter === 'todos') return true;
    return report.status.toLowerCase() === activeFilter.toLowerCase();
  });

  // Inicialización del Mapa
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
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        maxBounds: CABA_AVELLANEDA_BOUNDS,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });

      // Deshabilitar gestos de rotación y pitch para PWA móvil
      if (map.touchZoomRotate) {
        map.touchZoomRotate.disableRotation();
      }
      if (map.touchPitch) {
        map.touchPitch.disable();
      }
      if (map.dragRotate) {
        map.dragRotate.disable();
      }

      const markReady = () => {
        setMapLoaded(true);
        if (map && typeof map.resize === 'function') {
          map.resize();
        }
      };

      map.on('style.load', markReady);
      map.on('load', markReady);

      map.on('click', () => {
        setSelectedReport(null);
      });

      map.on('error', (err) => {
        console.warn('[OpenFreeMap Warning]:', err);
        markReady();
      });

      // Timeout de seguridad y resize diferido
      const initialResizeTimer = setTimeout(markReady, 200);
      const safetyTimer = setTimeout(markReady, 800);

      const handleResize = () => {
        if (map && typeof map.resize === 'function') {
          map.resize();
        }
      };
      window.addEventListener('resize', handleResize);

      mapInstanceRef.current = map;

      return () => {
        clearTimeout(initialResizeTimer);
        clearTimeout(safetyTimer);
        window.removeEventListener('resize', handleResize);
        if (mapInstanceRef.current && typeof mapInstanceRef.current.remove === 'function') {
          mapInstanceRef.current.remove();
        }
      };
    } catch (e) {
      console.warn('[OpenFreeMap Init Warning]:', e);
      setMapLoaded(true);
    }
  }, []);

  // Actualización y renderizado reactivo de marcadores en el mapa
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;

    // Limpiar marcadores anteriores
    markersRef.current.forEach((m) => {
      if (m && typeof m.remove === 'function') m.remove();
    });
    markersRef.current = [];

    // Si el reporte seleccionado ya no coincide con el filtro, cerrarlo
    if (selectedReport && !filteredReports.some((r) => r.id === selectedReport.id)) {
      setSelectedReport(null);
    }

    // Agregar marcadores para los reportes filtrados
    filteredReports.forEach((report) => {
      try {
        const el = document.createElement('button');
        el.className = 'report-map-marker group';
        el.setAttribute('type', 'button');
        el.setAttribute('aria-label', `Reporte: ${report.title}`);
        el.setAttribute('data-testid', `marker-${report.id}`);
        el.style.cssText = `
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background-color: ${report.pinColor};
          border: 3px solid #ffffff;
          box-shadow: 0 4px 14px rgba(10, 25, 50, 0.28);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          padding: 0;
          outline: none;
        `;

        el.innerHTML = `
          <span class="material-symbols-rounded" style="font-size: 20px; line-height: 1; pointer-events: none;">
            ${report.categoryIcon || 'location_on'}
          </span>
        `;

        el.onclick = (e) => {
          e.stopPropagation();
          setSelectedReport(report);
          if (mapInstanceRef.current && typeof mapInstanceRef.current.flyTo === 'function') {
            mapInstanceRef.current.flyTo({
              center: report.coordinates,
              zoom: 14.8,
              offset: [0, -70],
              essential: true,
            });
          }
        };

        if (typeof Marker === 'function') {
          const marker = new Marker({ element: el })
            .setLngLat(report.coordinates)
            .addTo(mapInstanceRef.current);
          markersRef.current.push(marker);
        }
      } catch (err) {
        console.warn('[Error adding marker]:', err);
      }
    });
  }, [filteredReports, mapLoaded, selectedReport]);

  // Centrar en la ubicación actual del usuario dentro de los límites
  const handleGeolocate = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { longitude, latitude } = pos.coords;
        if (typeof mapInstanceRef.current.flyTo === 'function') {
          mapInstanceRef.current.flyTo({
            center: [longitude, latitude],
            zoom: 15.5,
            essential: true,
          });
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setIsLocating(false);
        if (typeof mapInstanceRef.current.flyTo === 'function') {
          mapInstanceRef.current.flyTo({
            center: DEFAULT_CENTER,
            zoom: 13.5,
          });
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="relative w-full h-full min-h-0 flex-1 overflow-hidden bg-[#e5e9ec]">
      
      {/* Contenedor DOM para MapLibre con touch-action: none */}
      <div
        ref={mapContainerRef}
        data-testid="maplibre-container"
        className="w-full h-full absolute inset-0"
        style={{ touchAction: 'none' }}
      />

      {/* Renderizado de marcadores fallback para entornos de testing / SSR */}
      {typeof window !== 'undefined' && typeof Map !== 'function' && (
        <div data-testid="fallback-markers-container" className="hidden">
          {filteredReports.map((report) => (
            <button
              key={report.id}
              data-testid={`marker-${report.id}`}
              onClick={() => setSelectedReport(report)}
            >
              {report.title}
            </button>
          ))}
        </div>
      )}

      {/* Spinner de carga inicial que se desvanece de inmediato */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-[#e5e9ec] flex items-center justify-center z-10 pointer-events-none transition-opacity duration-300">
          <div className="flex flex-col items-center gap-2 text-[#7B8A9A]">
            <div className="w-8 h-8 border-3 border-[#1E6FCB] border-t-transparent rounded-full animate-spin" />
            <span className="font-bold text-xs">Cargando mapa...</span>
          </div>
        </div>
      )}

      {/* Botón Flotante de Filtros (Top Right) */}
      <button
        type="button"
        aria-label="Filtros del mapa"
        onClick={() => {
          setShowFiltersModal((prev) => !prev);
          if (onFilterClick) onFilterClick();
        }}
        className="absolute top-4 right-4 z-20 w-12 h-12 rounded-2xl bg-white shadow-md border border-slate-100 flex items-center justify-center text-[#1E6FCB] hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
      >
        <SlidersHorizontal className="w-5 h-5 text-[#1E6FCB]" />
      </button>

      {/* Menú de Filtros emergente */}
      {showFiltersModal && (
        <div className="absolute right-4 top-18 bg-white rounded-2xl p-3 shadow-xl border border-slate-100 z-30 w-48 flex flex-col gap-1 animate-in fade-in zoom-in-95">
          <div className="font-extrabold text-[11px] text-[#8593A2] uppercase tracking-wider mb-1 px-1">
            Filtrar reclamos
          </div>
          {['todos', 'Enviado', 'En curso', 'Resuelto'].map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => {
                setActiveFilter(filter);
                setShowFiltersModal(false);
              }}
              className={`text-left px-3 py-2 rounded-xl font-bold text-xs cursor-pointer border-0 transition-colors capitalize ${
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

      {/* Banner de Estado Vacío si el filtro no tiene resultados */}
      {filteredReports.length === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-md rounded-full px-4 py-2 shadow-lg border border-slate-200 text-xs font-bold text-[#56657A] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#E08A00]" />
          <span>No hay reportes con estado "{activeFilter}"</span>
        </div>
      )}

      {/* Tarjeta Flotante de Reporte Seleccionado (Popup Bottom Card) */}
      <AnimatePresence>
        {selectedReport && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute bottom-[92px] sm:bottom-[102px] left-4 right-4 sm:left-auto sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-30 sm:w-[420px] bg-white rounded-[24px] p-4 sm:p-5 shadow-[0px_14px_40px_rgba(15,30,60,0.22)] border border-[#E4ECF4]"
          >
            {/* Cabecera del reporte */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-[#EEF5FC] text-[#1E6FCB]">
                  {selectedReport.category}
                </span>
                <span className={`font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${selectedReport.statusColor}`}>
                  {selectedReport.status}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                aria-label="Cerrar detalle de reporte"
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer border-0 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Título y descripción */}
            <h3 className="font-extrabold text-[15px] sm:text-[16px] text-[#1B365D] tracking-tight m-0 mb-1 leading-snug">
              {selectedReport.title}
            </h3>
            <p className="font-medium text-[12px] text-[#64748B] m-0 mb-3 line-clamp-2 leading-relaxed">
              {selectedReport.description}
            </p>

            {/* Footer con Dirección y Fecha */}
            <div className="flex items-center justify-between text-[11px] text-[#8593A2] pt-2.5 border-t border-slate-100">
              <div className="flex items-center gap-1 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-[#1E6FCB] flex-shrink-0" />
                <span className="truncate font-semibold text-[#475569]">
                  {selectedReport.address}
                </span>
              </div>
              <span className="font-semibold flex-shrink-0 ml-2">
                {selectedReport.date}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leyenda Menos / Más (Bottom Left at 104px) */}
      <div className="absolute bottom-[104px] left-4 z-20 bg-white/95 backdrop-blur-md rounded-full px-3.5 py-1.5 flex items-center gap-2 shadow-md border border-slate-100 text-[11px] font-bold text-[#64748B] select-none">
        <span>Menos</span>
        <div className="w-14 h-2 rounded-full bg-gradient-to-r from-[#22C55E] via-[#F97316] to-[#EF4444]" />
        <span>Más</span>
      </div>

      {/* Botón Flotante de Geolocalización (Bottom Right at 104px) */}
      <button
        type="button"
        aria-label="Centrar en mi ubicación"
        title="Centrar en mi ubicación"
        onClick={handleGeolocate}
        className="absolute bottom-[104px] right-4 z-20 w-12 h-12 rounded-full bg-white shadow-lg border border-slate-100 flex items-center justify-center text-[#1E6FCB] hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
      >
        <Navigation className={`w-5 h-5 text-[#1E6FCB] ${isLocating ? 'animate-spin' : ''}`} />
      </button>

    </div>
  );
};
