import React, { useEffect, useRef, useState, useCallback, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Map, Marker, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import {
  SlidersHorizontal,
  Navigation,
  X,
  MapPin,
  MapPinOff,
  AlertCircle,
  RefreshCw,
  CarFront,
  Lightbulb,
  Trash2,
  TrafficCone,
  Trees,
  Store,
  HeartHandshake,
  Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCategoryTone } from '../report/categoryTone';
import { getStatusConfig, normalizeReportState } from '../report/reportStatus';
import { useIsDesktopLayout } from '../../hooks/useMediaQuery';

// Estados del §10 que pueden aparecer en el mapa. «borrador» no entra: el borrador vive
// en el dispositivo y nunca llega a la base.
const MAP_STATE_FILTERS = ['todos', 'enviado', 'en_revision', 'notificado', 'resuelto', 'descartado'];

// «Notificado al responsable» no entra en el panel de filtros, que es angosto.
const FILTER_SHORT_LABELS = { notificado: 'Notificado' };

const filterLabel = (filter) => {
  if (filter === 'todos') return 'Todos los reclamos';
  return FILTER_SHORT_LABELS[filter] || getStatusConfig(filter).label;
};

// Mapeo de iconos de categoría para los marcadores del mapa. Las claves las resuelve
// mapReportsService a partir del nombre de la categoría.
// Se renderizan a HTML estático porque el marcador de MapLibre es un nodo DOM
// plano (Marker({ element })), no un componente React.
const MARKER_ICON_MAP = {
  car_crash: CarFront,
  lightbulb: Lightbulb,
  delete: Trash2,
  traffic: TrafficCone,
  park: Trees,
  store: Store,
  assist: HeartHandshake,
};

const renderMarkerIcon = (categoryIcon) => {
  const IconComponent = MARKER_ICON_MAP[categoryIcon] || MapPin;
  return renderToStaticMarkup(
    createElement(IconComponent, { size: 20, color: '#ffffff', strokeWidth: 2.25 })
  );
};
import {
  getUserCoordinates,
  LOCATION_STATUS,
  DEFAULT_CITY_COORDINATES,
} from '../../services/locationService';
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

const DEFAULT_CENTER = DEFAULT_CITY_COORDINATES;
const DEFAULT_ZOOM = 12.8;
const MIN_ZOOM = 11.5;
const MAX_ZOOM = 19;

/**
 * Mapa colaborativo (UJ v3.3 · M08 en teléfono y D09 en escritorio — REP-3791 Bloque 5).
 *
 * Es presentacional: los reportes llegan por prop. Antes los leía de
 * `src/data/mockReports.js`, así que la pantalla principal mostraba reclamos inventados
 * y «Ver el reporte» abría un detalle inexistente (H-36). Quien los trae ahora es
 * `MapPage`, con `getPublicMapReports`.
 *
 * `onOpenReport(id)` es opcional para que el componente siga funcionando fuera de un
 * Router (así lo montan varios tests): sin esa prop no se ofrece «Ver el reporte».
 *
 * @param {Array} [reports] Reportes ya adaptados por mapReportsService
 * @param {boolean} [isLoadingReports] Mientras se resuelve la primera carga
 */
export const CitizenMap = ({
  onFilterClick,
  autoLocate = true,
  onOpenReport = null,
  reports = [],
  isLoadingReports = false,
}) => {
  const isDesktop = useIsDesktopLayout();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('todos');
  const [selectedReport, setSelectedReport] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState(LOCATION_STATUS.PENDING);
  const [showLocationBanner, setShowLocationBanner] = useState(false);

  // Filtrado reactivo por estado. Se compara contra el código normalizado del §10 y
  // no contra la etiqueta visible: los datos traen los códigos reales de la base
  // (RECIBIDO, EN_ANALISIS, DERIVADO, RESUELTO, DESESTIMADO) y la traducción vive en
  // un solo lugar.
  const filteredReports = reports.filter((report) => {
    if (activeFilter === 'todos') return true;
    return normalizeReportState(report.stateCode) === activeFilter;
  });

  // Renderizar o actualizar el marcador de posición del usuario (punto azul GPS con halo)
  const updateUserMarker = useCallback((coords) => {
    if (!mapInstanceRef.current || !coords) return;

    if (userMarkerRef.current && typeof userMarkerRef.current.remove === 'function') {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    try {
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.setAttribute('data-testid', 'user-location-marker');
      el.setAttribute('aria-label', 'Tu ubicación actual');
      el.style.cssText = `
        width: 24px;
        height: 24px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      `;

      el.innerHTML = `
        <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: rgba(30, 111, 203, 0.25); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; width: 20px; height: 20px; border-radius: 50%; background: rgba(30, 111, 203, 0.4); border: 2px solid #ffffff;"></div>
        <div style="position: relative; width: 12px; height: 12px; border-radius: 50%; background: #1E6FCB; border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
      `;

      if (typeof Marker === 'function') {
        const marker = new Marker({ element: el })
          .setLngLat(coords)
          .addTo(mapInstanceRef.current);
        userMarkerRef.current = marker;
      }
    } catch (err) {
      console.warn('[Error updating user marker]:', err);
    }
  }, []);

  // Función para solicitar y actualizar la ubicación del ciudadano
  const detectUserLocation = useCallback(async (isUserTriggered = false) => {
    setIsLocating(true);
    const result = await getUserCoordinates();
    setIsLocating(false);

    setLocationStatus(result.status);

    if (result.status === LOCATION_STATUS.GRANTED) {
      setUserLocation(result.coordinates);
      setShowLocationBanner(false);

      if (mapInstanceRef.current) {
        updateUserMarker(result.coordinates);
        if (typeof mapInstanceRef.current.flyTo === 'function') {
          mapInstanceRef.current.flyTo({
            center: result.coordinates,
            zoom: 15.5,
            essential: true,
          });
        }
      }
    } else {
      // Si el permiso fue denegado o hubo error, mostrar banner alternativo no bloqueante
      setShowLocationBanner(true);
      if (mapInstanceRef.current && isUserTriggered) {
        if (typeof mapInstanceRef.current.flyTo === 'function') {
          mapInstanceRef.current.flyTo({
            center: DEFAULT_CENTER,
            zoom: 13.5,
          });
        }
      }
    }
    return result;
  }, [updateUserMarker]);

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

  // Detectar ubicación al montar el mapa cuando esté listo
  useEffect(() => {
    if (mapLoaded && autoLocate) {
      detectUserLocation(false);
    }
  }, [mapLoaded, autoLocate, detectUserLocation]);

  // Actualización y renderizado reactivo de marcadores en el mapa
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;

    // Limpiar marcadores anteriores de reportes
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

        el.innerHTML = `<span style="display: flex; pointer-events: none;">${renderMarkerIcon(report.categoryIcon)}</span>`;

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

    // Re-dibujar marcador de usuario si existe
    if (userLocation) {
      updateUserMarker(userLocation);
    }
  }, [filteredReports, mapLoaded, selectedReport, userLocation, updateUserMarker]);

  // Resumen de lo que se ve en el mapa (M08 / D09), calculado sobre los reportes mostrados
  const categorySummary = Object.entries(
    filteredReports.reduce((acc, report) => {
      const key = report.category || 'Sin categoría';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  );

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 overflow-hidden bg-rep-surface-sunken">
      {/* Map Container */}
      <div className="relative h-full w-full flex-1">
        
        {/* Contenedor DOM para MapLibre con touch-action: none */}
        <div
          ref={mapContainerRef}
          data-testid="maplibre-container"
          className="w-full h-full absolute inset-0"
          style={{ touchAction: 'none' }}
        />

        {/* Overlay central en el mapa para Desktop si no hay resultados */}
        {/* Sin resultados (UJ v3.3 · M29 / D33 — REP-3791 Bloque 9).
            Son tres situaciones distintas y decirlas igual sería mentir: todavía
            cargando, no hay ningún reporte en la zona, o hay pero los filtros los
            dejaron afuera. Solo la última ofrece limpiar filtros. */}
        {filteredReports.length === 0 && (
          <div className="absolute inset-x-4 top-1/2 z-20 mx-auto max-w-[420px] -translate-y-1/2 rounded-2xl border border-rep-border bg-rep-surface p-5 text-center shadow-rep-float md:left-1/2 md:right-auto md:-translate-x-1/2">
            {isLoadingReports ? (
              <p className="m-0 text-rep-body text-rep-ink-muted">Cargando reportes…</p>
            ) : reports.length === 0 ? (
              <>
                <MapPinOff aria-hidden="true" className="mx-auto h-6 w-6 text-rep-ink-faint" strokeWidth={2.25} />
                <p className="m-0 mt-3 text-rep-section text-rep-ink">Todavía no hay reportes en la zona</p>
                <p className="m-0 mt-1.5 text-rep-body text-rep-ink-muted">
                  Cuando alguien reporte algo cerca tuyo, va a aparecer acá.
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {activeFilter !== 'todos' && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-rep-accent-soft px-2 py-1 text-rep-pill uppercase tracking-wide text-rep-accent">
                      {filterLabel(activeFilter)}
                      <button
                        type="button"
                        onClick={() => setActiveFilter('todos')}
                        aria-label={`Quitar el filtro ${filterLabel(activeFilter)}`}
                        className="rep-focus rounded"
                      >
                        <X className="h-3 w-3" strokeWidth={2.5} />
                      </button>
                    </span>
                  )}
                </div>
                <p className="m-0 mt-3 text-rep-section text-rep-ink">Ningún reporte con estos filtros</p>
                <p className="m-0 mt-1.5 text-rep-body text-rep-ink-muted">
                  Hay reportes en la zona, pero ninguno coincide con los filtros activos.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveFilter('todos')}
                  className="rep-focus mt-4 flex min-h-touch w-full items-center justify-center rounded-xl border-0 bg-rep-accent px-4 text-rep-label font-extrabold text-rep-on-accent transition-colors duration-120 hover:bg-rep-accent-strong"
                >
                  Limpiar filtros
                </button>
              </>
            )}
          </div>
        )}

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
            {userLocation && (
              <div data-testid="user-location-marker">Tu ubicación</div>
            )}
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

        {/* Banner Informativo No Bloqueante ante Permiso Denegado / Sin Ubicación */}
        <AnimatePresence>
          {showLocationBanner && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-18 z-20 max-w-[420px]"
            >
              <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-rep-border bg-rep-surface/95 p-3 shadow-rep-float backdrop-blur-md sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rep-warning" />
                  <div className="min-w-0 text-left">
                    <div className="truncate text-rep-label font-bold text-rep-ink">
                      Ubicación desactivada
                    </div>
                    <div className="truncate text-rep-label text-rep-ink-muted">
                      Mostrando CABA y Avellaneda por defecto
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => detectUserLocation(true)}
                    className="rep-focus flex min-h-touch items-center gap-1 rounded-lg border-0 bg-rep-accent-soft px-2.5 py-1 text-rep-label font-extrabold text-rep-accent transition-colors duration-120"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                    <span>Activar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLocationBanner(false)}
                    aria-label="Cerrar aviso de ubicación"
                    className="rep-focus flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-rep-ink-faint transition-colors duration-120 hover:text-rep-ink-label"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Resumen de lo que se ve en el mapa (M08 · D09) */}
        <div
          className={`absolute left-4 z-20 w-[150px] rounded-2xl border border-rep-border bg-rep-surface/95 px-3.5 py-3 shadow-rep-float backdrop-blur-md md:w-[220px] ${
            showLocationBanner ? 'top-[92px] md:top-[84px]' : 'top-4'
          }`}
        >
          <div className="text-[26px] font-extrabold leading-none text-rep-ink">{filteredReports.length}</div>
          <div className="mt-1 text-[10px] font-extrabold uppercase tracking-wider text-rep-ink-muted">Reportes visibles</div>
          {/* El desglose por categoría entra en la tarjeta, sin abrir otra pantalla (D09) */}
          {isDesktop && categorySummary.length > 0 && (
            <ul className="m-0 mt-2.5 flex list-none flex-col gap-1 border-t border-rep-divider p-0 pt-2.5">
              {categorySummary.map(([category, total]) => (
                <li key={category} className="flex items-center gap-2 text-rep-label">
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: getCategoryTone({ name: category }).base }} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-rep-ink-label">{category}</span>
                  <span className="font-extrabold text-rep-ink">{total}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Botón Flotante de Filtros (Top Right) */}
        <button
          type="button"
          aria-label="Filtros del mapa"
          onClick={() => {
            setShowFiltersModal((prev) => !prev);
            if (onFilterClick) onFilterClick();
          }}
          className="rep-focus absolute right-4 top-4 z-20 flex h-12 w-12 items-center justify-center rounded-2xl border border-rep-border bg-rep-surface text-rep-accent shadow-rep-float transition-[transform,filter] duration-120 hover:brightness-[.96] active:scale-[0.97] dark:hover:brightness-[1.06] md:right-[76px]"
        >
          <SlidersHorizontal className="h-5 w-5" strokeWidth={2.25} />
        </button>

        {/* Menú de Filtros emergente */}
        {showFiltersModal && (
          <div className="absolute right-4 top-[124px] z-30 flex w-52 flex-col gap-1 rounded-2xl border border-rep-border bg-rep-surface p-3 shadow-rep-float md:right-[76px] md:top-[68px]">
            <div className="mb-1 px-1 text-[11px] font-extrabold uppercase tracking-wider text-rep-ink-muted">
              Filtrar reclamos
            </div>
            {MAP_STATE_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => {
                  setActiveFilter(filter);
                  setShowFiltersModal(false);
                }}
                className={`rep-focus min-h-touch rounded-xl border-0 px-3 py-2 text-left text-rep-label font-bold transition-colors duration-120 ${
                  activeFilter === filter
                    ? 'bg-rep-accent-soft text-rep-accent'
                    : 'bg-transparent text-rep-ink-label hover:bg-rep-surface-sunken'
                }`}
              >
                {filterLabel(filter)}
              </button>
            ))}
          </div>
        )}

        {/* El banner de vacío de teléfono se retiró en el Bloque 9: había dos avisos
            distintos para lo mismo, uno acá y otro en escritorio. Ahora es una sola
            tarjeta, arriba. */}

        {/* Tarjeta Flotante de Reporte Seleccionado (Popup Bottom Card) */}
        <AnimatePresence>
          {selectedReport && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute inset-x-4 bottom-[104px] z-30 rounded-[22px] border border-rep-border bg-rep-surface p-4 shadow-rep-float md:inset-x-auto md:bottom-6 md:right-6 md:w-[380px] md:p-5"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="rounded-lg px-2.5 py-1 text-rep-pill uppercase tracking-wide"
                    style={{
                      color: getCategoryTone({ name: selectedReport.category }).ink,
                      backgroundColor: getCategoryTone({ name: selectedReport.category }).soft,
                    }}
                  >
                    {selectedReport.category}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-rep-label font-bold text-rep-accent">
                    <Eye aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
                    {selectedReport.status}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  aria-label="Cerrar detalle de reporte"
                  className="rep-focus flex h-8 w-8 items-center justify-center rounded-full border-0 bg-rep-surface-sunken text-rep-ink-label transition-colors duration-120"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <h3 className="m-0 mb-1 text-rep-section leading-snug text-rep-ink">{selectedReport.title}</h3>
              <p className="m-0 mb-3 line-clamp-2 text-rep-body text-rep-ink-muted">{selectedReport.description}</p>

              <div className="flex items-center justify-between gap-2 border-t border-rep-divider pt-2.5">
                <div className="flex min-w-0 items-center gap-1 text-rep-label text-rep-ink-muted">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-rep-accent" />
                  <span className="truncate font-semibold text-rep-ink-label">{selectedReport.address}</span>
                  <span className="shrink-0">· {selectedReport.date}</span>
                </div>
                {onOpenReport && (
                  <button
                    type="button"
                    onClick={() => onOpenReport(selectedReport.id)}
                    className="rep-focus min-h-touch shrink-0 rounded-lg px-1 text-rep-label font-bold text-rep-accent hover:underline"
                  >
                    Ver el reporte
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Leyenda Menos / Más (Bottom Left at 104px) */}
        <div className="absolute bottom-[104px] left-4 z-20 flex select-none items-center gap-2 rounded-full border border-rep-border bg-rep-surface/95 px-3.5 py-1.5 text-rep-label font-bold text-rep-ink-muted shadow-rep-float backdrop-blur-md md:bottom-6 md:left-1/2 md:-translate-x-1/2">
          <span>Menos</span>
          <div className="h-2 w-14 rounded-full bg-gradient-to-r from-rep-success via-rep-warning to-rep-danger" />
          <span>Más</span>
        </div>

        {/* Botón Flotante de Geolocalización (Bottom Right at 104px) */}
        <button
          type="button"
          aria-label="Centrar en mi ubicación"
          title="Centrar en mi ubicación"
          onClick={() => detectUserLocation(true)}
          className="rep-focus absolute right-4 top-[68px] z-20 flex h-12 w-12 items-center justify-center rounded-2xl border border-rep-border bg-rep-surface text-rep-accent shadow-rep-float transition-[transform,filter] duration-120 hover:brightness-[.96] active:scale-[0.97] dark:hover:brightness-[1.06] md:top-4"
        >
          <Navigation className={`h-5 w-5 ${isLocating ? 'motion-safe:animate-spin' : ''}`} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
};
