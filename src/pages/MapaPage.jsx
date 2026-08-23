// ==============================================================================
// Página Principal del Mapa: MapLibre GL JS + OSM (MapaPage.jsx)
// Restricción geográfica a CABA + Avellaneda con gestos táctiles optimizados
// ==============================================================================

// Importación de React y hooks necesarios
import React, { useEffect, useRef, useState, useCallback } from 'react';
// Hook de navegación de React Router
import { useNavigate } from 'react-router-dom';
// Motor de mapas vectorial/raster MapLibre GL JS
import maplibregl from 'maplibre-gl';
// Iconografía vectorial de Lucide
import { LogOut, MapPin, Navigation, Loader2 } from 'lucide-react';
// Navegación flotante inferior
import { BottomNav } from '../components/navigation/BottomNav';
import { CameraReportButton } from '../components/navigation/CameraReportButton';
// Notificaciones Toast de Sonner
import { toast } from 'sonner';
// Hooks de autenticación y onboarding
import { useAuth } from '../hooks/useAuth';
import { useOnboarding } from '../hooks/useOnboarding';

// ==============================================================================
// Constantes geográficas del área de cobertura
// ==============================================================================

// Bounding box que restringe la navegación a CABA completa + Avellaneda
const BOUNDS = {
  sw: [-58.56, -34.72], // Sudoeste: Avellaneda sur + margen oeste (más allá de Av. Gral. Paz)
  ne: [-58.28, -34.52], // Noreste: CABA norte + margen este (Costanera / Río de la Plata)
};

// Centro geográfico de CABA (punto de inicio del mapa)
const DEFAULT_CENTER = [-58.3816, -34.6037];

// Niveles de zoom permitidos
const MIN_ZOOM = 11; // Vista panorámica máxima de la zona
const MAX_ZOOM = 16; // Nivel de detalle máximo calle por calle
const DEFAULT_ZOOM = 12; // Zoom inicial que muestra CABA + Avellaneda completo
const GEOLOCATE_ZOOM = 14; // Zoom al centrar en la ubicación del usuario

// Estilo de mapa con tiles raster de OpenStreetMap (gratuitos, sin API key)
const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

// ==============================================================================
// Componente principal del mapa
// ==============================================================================

export const MapaPage = () => {
  // Referencias mutables para el contenedor DOM y la instancia del mapa
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Estado para el botón de geolocalización
  const [isLocating, setIsLocating] = useState(false);
  const [userLocated, setUserLocated] = useState(false);

  // Hooks de contexto de autenticación y onboarding
  const { user, signOut } = useAuth();
  const { resetOnboarding } = useOnboarding();
  const navigate = useNavigate();

  // ============================================================================
  // Inicialización del mapa MapLibre GL JS
  // ============================================================================
  useEffect(() => {
    // Evitar doble inicialización (React StrictMode o HMR)
    if (mapInstanceRef.current || !mapContainerRef.current) return;

    try {
      // Crear instancia del mapa con configuración optimizada para móviles
      mapInstanceRef.current = new maplibregl.Map({
        container: mapContainerRef.current,
        style: OSM_STYLE, // Tiles raster de OpenStreetMap
        center: DEFAULT_CENTER, // Centro de CABA
        zoom: DEFAULT_ZOOM, // Zoom inicial panorámico
        maxBounds: [BOUNDS.sw, BOUNDS.ne], // Restricción geográfica
        maxZoom: MAX_ZOOM, // Zoom máximo permitido
        minZoom: MIN_ZOOM, // Zoom mínimo permitido
        renderWorldCopies: false, // No mostrar copias del mundo fuera del área
        dragRotate: false, // Desactivar rotación con arrastre (innecesaria)
        touchPitch: false, // Desactivar inclinación 3D con dos dedos
        attributionControl: false, // Atribución personalizada abajo
      });



      // Control de atribución colapsable en esquina inferior izquierda
      mapInstanceRef.current.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        'bottom-left'
      );

      // Intentar centrar en la ubicación del usuario automáticamente al cargar
      handleGeolocate(true);
    } catch (err) {
      // Fallback silencioso si WebGL no está disponible o hay error de red
      console.warn('MapLibre GL JS: Error al inicializar el mapa:', err);
    }

    // Limpieza al desmontar el componente (previene memory leaks)
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ============================================================================
  // Geolocalización del usuario
  // ============================================================================
  const handleGeolocate = useCallback((silent = false) => {
    // Verificar soporte de geolocalización en el navegador
    if (!navigator.geolocation) {
      if (!silent) toast.info('Tu navegador no soporta geolocalización.');
      return;
    }

    // Verificar que el mapa esté inicializado
    if (!mapInstanceRef.current) return;

    // Activar indicador de carga
    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        // Verificar que la posición esté dentro del bounding box CABA+Avellaneda
        const isInBounds =
          longitude >= BOUNDS.sw[0] &&
          longitude <= BOUNDS.ne[0] &&
          latitude >= BOUNDS.sw[1] &&
          latitude <= BOUNDS.ne[1];

        if (isInBounds && mapInstanceRef.current) {
          // Animar el mapa suavemente hasta la posición del usuario
          mapInstanceRef.current.flyTo({
            center: [longitude, latitude],
            zoom: GEOLOCATE_ZOOM,
            essential: true, // Animación accesible (no se omite por prefers-reduced-motion)
            duration: 1200, // Duración de la animación en milisegundos
          });

          // Colocar un marcador visual en la posición del usuario
          new maplibregl.Marker({
            color: '#0ea5e9', // Color primario de la app (sky-500)
          })
            .setLngLat([longitude, latitude])
            .setPopup(
              new maplibregl.Popup({ offset: 25 }).setHTML(
                '<p style="font-weight:700;font-size:13px;margin:0">📍 Estás acá</p>'
              )
            )
            .addTo(mapInstanceRef.current);

          setUserLocated(true);
          if (!silent) toast.success('Ubicación encontrada.');
        } else {
          // Posición fuera del área de cobertura
          if (!silent) {
            toast.info('Tu ubicación está fuera del área de cobertura (CABA · Avellaneda).');
          }
        }

        setIsLocating(false);
      },
      (error) => {
        // Error de geolocalización (permiso denegado, timeout, etc.)
        setIsLocating(false);
        if (!silent) {
          if (error.code === error.PERMISSION_DENIED) {
            toast.info('Permiso de ubicación denegado. Podés activarlo en la configuración.');
          } else {
            toast.info('No se pudo obtener tu ubicación.');
          }
        }
      },
      {
        enableHighAccuracy: true, // GPS de alta precisión (mejor para móviles)
        timeout: 8000, // Máximo 8 segundos de espera
        maximumAge: 60000, // Usar posición cacheada si tiene menos de 1 minuto
      }
    );
  }, []);

  // ============================================================================
  // Cierre de sesión
  // ============================================================================
  const handleLogout = async () => {
    try {
      await signOut();
      resetOnboarding();
      toast.success('Sesión cerrada correctamente.');
      navigate('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      toast.error('No se pudo cerrar la sesión.');
    }
  };

  // ============================================================================
  // Render del componente
  // ============================================================================
  return (
    <div className="relative h-[100dvh] w-full bg-slate-100 overflow-hidden flex flex-col">

      {/* ================================================================== */}
      {/* 1. Header Flotante con Glassmorphism                               */}
      {/* ================================================================== */}
      <header className="absolute top-0 left-0 right-0 z-20 bg-white/90 backdrop-blur-lg px-4 py-2.5 border-b border-slate-200/60 flex items-center justify-between shadow-sm safe-top">
        {/* Logo + Nombre + Email del usuario */}
        <div className="flex items-center gap-2.5">
          <img
            src="/logo-icon.webp"
            alt="Reportalo"
            className="w-7 h-8 object-contain select-none"
          />
          <div className="flex flex-col text-left">
            <span className="text-sm font-extrabold text-slate-900 leading-tight">
              Reportalo
            </span>
            <span className="text-[11px] font-medium text-slate-500 truncate max-w-[140px] sm:max-w-xs">
              {user?.name || 'Ciudadano'}
            </span>
          </div>
        </div>

        {/* Badge de jurisdicción + Botón de salida */}
        <div className="flex items-center gap-2">
          {/* Badge visible solo en pantallas ≥ 360px */}
          <div className="hidden xs:flex items-center gap-1 text-[11px] font-bold text-primary bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100">
            <MapPin className="w-3 h-3" />
            <span>CABA · Avellaneda</span>
          </div>

          {/* Botón de cierre de sesión compacto */}
          <button
            type="button"
            onClick={handleLogout}
            className="px-2.5 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200/70 hover:border-red-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold active:scale-95"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* ================================================================== */}
      {/* 2. Contenedor del Mapa MapLibre GL JS                              */}
      {/* ================================================================== */}
      <div
        ref={mapContainerRef}
        className="w-full h-full flex-1 z-10"
        style={{ touchAction: 'none' }} // Evitar conflictos con gestos del navegador
      />

      {/* ================================================================== */}
      {/* 3. FAB de Geolocalización (esquina inferior derecha)               */}
      {/* ================================================================== */}
      <button
        type="button"
        onClick={() => handleGeolocate(false)}
        disabled={isLocating}
        className={`absolute bottom-[132px] right-4 z-20 w-12 h-12 rounded-full shadow-lg border flex items-center justify-center transition-all active:scale-90 cursor-pointer ${userLocated
          ? 'bg-primary text-white border-primary/30 shadow-primary/20'
          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        aria-label="Centrar en mi ubicación"
        title="Centrar en mi ubicación"
      >
        {isLocating ? (
          // Spinner mientras se obtiene la posición GPS
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          // Icono de navegación/brújula
          <Navigation className="w-5 h-5" />
        )}
      </button>

      {/* ================================================================== */}
      {/* 4. Botón Flotante de Reporte con Cámara                            */}
      {/* ================================================================== */}
      <CameraReportButton />

      {/* ================================================================== */}
      {/* 5. Navegación Inferior Flotante (BottomNav)                        */}
      {/* ================================================================== */}
      <BottomNav />
    </div>
  );
};
