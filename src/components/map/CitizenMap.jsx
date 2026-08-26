import React, { useEffect, useRef, useState } from 'react';
import { Map, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { SlidersHorizontal, Navigation } from 'lucide-react';
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
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('todos');

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

  // Centrar en la ubicación actual del usuario dentro de los límites
  const handleGeolocate = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { longitude, latitude } = pos.coords;
        mapInstanceRef.current.flyTo({
          center: [longitude, latitude],
          zoom: 15.5,
          essential: true,
        });
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setIsLocating(false);
        mapInstanceRef.current.flyTo({
          center: DEFAULT_CENTER,
          zoom: 13.5,
        });
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
