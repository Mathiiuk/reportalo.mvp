// ==============================================================================
// Página Principal del Mapa Interactivo (MapaPage.jsx)
// Implementación con MapLibre GL JS, Heatmap, Marcadores y Selectores de Zona
// ==============================================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { toast } from 'sonner';
import { ReporteDetailModal } from '../components/reportes/ReporteDetailModal';

// ==============================================================================
// Configuración de Zonas Geográficas
// ==============================================================================
const ZONES = [
  { id: 'avellaneda-centro', name: 'Avellaneda · Centro', center: [-58.3653, -34.6622], zoom: 15 },
  { id: 'avellaneda-pineyro', name: 'Avellaneda · Piñeyro', center: [-58.3845, -34.6601], zoom: 15 },
  { id: 'avellaneda-sarandi', name: 'Avellaneda · Sarandí', center: [-58.3490, -34.6780], zoom: 14.8 },
  { id: 'caba-centro', name: 'CABA · Obelisco / Microcentro', center: [-58.3816, -34.6037], zoom: 14.5 },
];

// Estilo Raster de CARTO Voyager (Alta Confiabilidad y Rendimiento)
const MAP_STYLE = {
  version: 8,
  sources: {
    'carto-voyager': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
  },
  layers: [
    {
      id: 'carto-voyager-layer',
      type: 'raster',
      source: 'carto-voyager',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

// Puntos de incidentes de demostración con georreferencia en Avellaneda
const DEMO_INCIDENTS = [
  {
    id: '#RP-2048',
    title: 'Tránsito congestionado por semáforo',
    category: 'Tránsito',
    location: 'Av. Mitre 1240',
    date: 'hoy 14:32',
    status: 'reviewing',
    color: '#F97316', // Naranja
    lngLat: [-58.3685, -34.6610],
    description: 'Semáforo intermitente provocando demoras en cruce principal.',
  },
  {
    id: '#RP-2012',
    title: 'Contenedor desbordado',
    category: 'Higiene',
    location: 'French y Marconi',
    date: 'hoy 11:20',
    status: 'pending',
    color: '#EF4444', // Rojo
    lngLat: [-58.3615, -34.6590],
    description: 'Residuos acumulados fuera del contenedor en ochava.',
  },
  {
    id: '#RP-1994',
    title: 'Bache en calzada',
    category: 'Vial',
    location: 'Belgrano y Alsina',
    date: '09/08',
    status: 'notified',
    color: '#3B82F6', // Azul
    lngLat: [-58.3653, -34.6655],
    description: 'Hundimiento del asfalto en carril central.',
  },
  {
    id: '#RP-1871',
    title: 'Mantenimiento de arbolado',
    category: 'Ambiente',
    location: 'Parque Domínico',
    date: '28/07',
    status: 'resolved',
    color: '#10B981', // Verde
    lngLat: [-58.3580, -34.6705],
    description: 'Poda preventiva y despeje de luminarias completado.',
  },
  // Puntos adicionales de calor difuso
  { id: 'h-1', color: '#F97316', lngLat: [-58.3670, -34.6625] },
  { id: 'h-2', color: '#EF4444', lngLat: [-58.3625, -34.6580] },
  { id: 'h-3', color: '#3B82F6', lngLat: [-58.3640, -34.6640] },
  { id: 'h-4', color: '#10B981', lngLat: [-58.3595, -34.6690] },
];

export const MapaPage = () => {
  const navigate = useNavigate();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const markersRef = useRef([]);

  // Estados de la interfaz
  const [selectedZone, setSelectedZone] = useState(ZONES[0]);
  const [isZoneMenuOpen, setIsZoneMenuOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  // ============================================================================
  // Inicialización del Mapa con MapLibre GL JS
  // ============================================================================
  useEffect(() => {
    if (mapInstanceRef.current || !mapContainerRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: MAP_STYLE,
        center: selectedZone.center,
        zoom: selectedZone.zoom,
        minZoom: 10,
        maxZoom: 18,
        dragRotate: false,
        touchPitch: false,
        attributionControl: false,
      });

      mapInstanceRef.current = map;

      map.on('load', () => {
        // 1. Agregar Fuente GeoJSON de calor
        const heatmapGeojson = {
          type: 'FeatureCollection',
          features: DEMO_INCIDENTS.map((inc) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: inc.lngLat,
            },
            properties: {
              intensity: inc.color === '#EF4444' ? 1.0 : inc.color === '#F97316' ? 0.7 : 0.4,
            },
          })),
        };

        map.addSource('incidents-heat-source', {
          type: 'geojson',
          data: heatmapGeojson,
        });

        // 2. Capa de Heatmap
        map.addLayer({
          id: 'incidents-heat-layer',
          type: 'heatmap',
          source: 'incidents-heat-source',
          maxzoom: 17,
          paint: {
            // Peso de cada punto
            'heatmap-weight': ['get', 'intensity'],
            // Intensidad global según nivel de zoom
            'heatmap-intensity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10, 0.6,
              15, 1.4,
            ],
            // Gradiente cromático de calor
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(0, 0, 0, 0)',
              0.2, 'rgba(34, 197, 94, 0.25)', // Verde
              0.5, 'rgba(249, 115, 22, 0.45)', // Naranja
              0.8, 'rgba(239, 68, 68, 0.65)',  // Rojo
              1.0, 'rgba(220, 38, 38, 0.85)',  // Rojo intenso
            ],
            // Radio de influencia de cada punto
            'heatmap-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              11, 20,
              15, 45,
            ],
            'heatmap-opacity': 0.75,
          },
        });

        // 3. Crear Marcadores Interactivos para incidentes principales
        DEMO_INCIDENTS.filter((inc) => inc.title).forEach((incident) => {
          const el = document.createElement('div');
          el.className = 'w-6 h-6 rounded-full border-[2.5px] border-white shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-125 duration-150';
          el.style.backgroundColor = incident.color;
          el.setAttribute('role', 'button');
          el.setAttribute('aria-label', incident.title);

          const innerDot = document.createElement('div');
          innerDot.className = 'w-1.5 h-1.5 rounded-full bg-white/90';
          el.appendChild(innerDot);

          el.addEventListener('click', (e) => {
            e.stopPropagation();
            setSelectedReport(incident);
          });

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(incident.lngLat)
            .addTo(map);

          markersRef.current.push(marker);
        });
      });
    } catch (err) {
      console.warn('[MapLibre] Error al inicializar:', err);
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (userMarkerRef.current) userMarkerRef.current.remove();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Alternar visibilidad de la capa de calor
  useEffect(() => {
    if (!mapInstanceRef.current || !mapInstanceRef.current.isStyleLoaded()) return;
    try {
      if (mapInstanceRef.current.getLayer('incidents-heat-layer')) {
        mapInstanceRef.current.setLayoutProperty(
          'incidents-heat-layer',
          'visibility',
          showHeatmap ? 'visible' : 'none'
        );
      }
    } catch (e) {
      // ignore
    }
  }, [showHeatmap]);

  // Cambiar de zona geográfica
  const handleSelectZone = (zone) => {
    setSelectedZone(zone);
    setIsZoneMenuOpen(false);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({
        center: zone.center,
        zoom: zone.zoom,
        duration: 1000,
        essential: true,
      });
    }
  };

  // Geolocalización del usuario
  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) {
      toast.info('Tu dispositivo no soporta geolocalización.');
      return;
    }
    if (!mapInstanceRef.current) return;

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        mapInstanceRef.current.flyTo({
          center: [longitude, latitude],
          zoom: 15.5,
          duration: 1200,
          essential: true,
        });

        if (userMarkerRef.current) userMarkerRef.current.remove();

        userMarkerRef.current = new maplibregl.Marker({ color: '#1E6FCB' })
          .setLngLat([longitude, latitude])
          .addTo(mapInstanceRef.current);

        setIsLocating(false);
        toast.success('Ubicación centrada.');
      },
      () => {
        setIsLocating(false);
        toast.info('No pudimos acceder a tu ubicación actual.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  return (
    <div className="relative w-full h-[100dvh] bg-[#F4F7FB] overflow-hidden flex flex-col">
      {/* ================================================================== */}
      {/* 1. Cabecera Superior Fija                                          */}
      {/* ================================================================== */}
      <header className="z-30 bg-white border-b border-slate-100 shadow-xs safe-top">
        {/* Barra de Logo + Alertas */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo-icon.webp"
              alt="Logo Reportalo"
              className="w-6 h-7 object-contain select-none"
            />
            <span className="text-[22px] font-extrabold text-[#1B365D] tracking-tight">
              Reportalo
            </span>
          </div>

          {/* Botón de Campana con Badge */}
          <button
            type="button"
            onClick={() => navigate('/alerts')}
            className="relative w-10 h-10 rounded-full flex items-center justify-center text-[#475569] hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
            aria-label="Ver alertas y notificaciones"
          >
            <span className="material-symbols-rounded filled text-[24px]">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#DC2626] text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white shadow-xs">
              2
            </span>
          </button>
        </div>

        {/* Píldora de Selección de Zona */}
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => setIsZoneMenuOpen((prev) => !prev)}
            className="w-full bg-[#F0F4F9] hover:bg-[#E6ECF4] active:scale-[0.99] rounded-2xl px-4 py-2.5 flex items-center justify-between transition-all cursor-pointer border border-slate-200/40"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-rounded filled text-[20px] text-[#1E6FCB]">
                location_on
              </span>
              <span className="text-sm font-bold text-[#1E293B]">
                {selectedZone.name}
              </span>
            </div>
            <span className="material-symbols-rounded text-[22px] text-[#64748B]">
              {isZoneMenuOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {/* Desplegable de Zonas */}
          {isZoneMenuOpen && (
            <div className="mt-2 bg-white rounded-2xl p-1.5 shadow-xl border border-slate-200/80 divide-y divide-slate-100">
              {ZONES.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => handleSelectZone(zone)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                    selectedZone.id === zone.id
                      ? 'text-[#1E6FCB] bg-[#EFF6FF]'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{zone.name}</span>
                  {selectedZone.id === zone.id && (
                    <span className="material-symbols-rounded text-sm text-[#1E6FCB]">check</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ================================================================== */}
      {/* 2. Contenedor del Mapa MapLibre                                    */}
      {/* ================================================================== */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <div
          ref={mapContainerRef}
          className="w-full h-full"
          style={{ touchAction: 'none' }}
        />

        {/* Métrica Flotante Superior Izquierda */}
        <div className="absolute top-4 left-4 z-20 bg-white rounded-2xl px-4 py-3 shadow-md border border-slate-100/90 pointer-events-auto">
          <div className="text-[26px] font-extrabold text-[#1B365D] leading-none tracking-tight">
            128
          </div>
          <div className="text-[9.5px] font-extrabold text-[#7A8A9E] tracking-wider uppercase mt-1">
            Reportes · 7 días
          </div>
        </div>

        {/* Botón Flotante de Filtros Superior Derecho */}
        <button
          type="button"
          onClick={() => setIsFilterOpen((prev) => !prev)}
          className="absolute top-4 right-4 z-20 w-12 h-12 rounded-2xl bg-white shadow-md border border-slate-100/90 flex items-center justify-center text-[#1E6FCB] hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
          aria-label="Filtros del mapa"
        >
          <span className="material-symbols-rounded text-[22px]">tune</span>
        </button>

        {/* Menú Flotante de Filtros */}
        {isFilterOpen && (
          <div className="absolute top-[72px] right-4 z-20 bg-white rounded-2xl p-4 shadow-xl border border-slate-200/80 w-56 space-y-3">
            <h4 className="text-xs font-extrabold text-[#1B365D] uppercase tracking-wider">
              Capas del Mapa
            </h4>
            <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
              <span>Mapa de calor</span>
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
                className="w-4 h-4 rounded text-[#1E6FCB] accent-[#1E6FCB]"
              />
            </label>
          </div>
        )}

        {/* Leyenda Inferior Izquierda de Intensidad */}
        <div className="absolute bottom-[104px] left-4 z-20 bg-white/95 backdrop-blur-md rounded-full px-3.5 py-1.5 flex items-center gap-2 shadow-md border border-slate-100 text-[11px] font-bold text-[#64748B]">
          <span>Menos</span>
          <div className="w-14 h-2 rounded-full bg-gradient-to-r from-[#22C55E] via-[#F97316] to-[#EF4444]" />
          <span>Más</span>
        </div>

        {/* FAB de Geolocalización Inferior Derecho */}
        <button
          type="button"
          onClick={handleGeolocate}
          disabled={isLocating}
          className="absolute bottom-[104px] right-4 z-20 w-12 h-12 rounded-full bg-white shadow-lg border border-slate-100 flex items-center justify-center text-[#1E6FCB] hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
          aria-label="Centrar en mi ubicación"
          title="Centrar en mi ubicación"
        >
          <span className={`material-symbols-rounded text-[24px] ${isLocating ? 'animate-spin' : ''}`}>
            {isLocating ? 'progress_activity' : 'near_me'}
          </span>
        </button>
      </div>

      {/* Modal de Detalle de Incidente al tocar un marcador */}
      <ReporteDetailModal
        report={selectedReport}
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
      />
    </div>
  );
};
