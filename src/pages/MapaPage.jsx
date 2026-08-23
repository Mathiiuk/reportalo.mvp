// ==============================================================================
// Página Principal de la App: Mapa con MapLibre GL JS Pulido (MapaPage.jsx)
// ==============================================================================

// Importación de React y referencias del DOM
import React, { useEffect, useRef } from 'react';
// Hook de navegación de React Router
import { useNavigate } from 'react-router-dom';
// Motor de mapas MapLibre GL JS
import maplibregl from 'maplibre-gl';
// Iconografía temática
import { LogOut, MapPin, Layers } from 'lucide-react';
// Notificaciones Toast de Sonner
import { toast } from 'sonner';
// Hooks de autenticación y onboarding
import { useAuth } from '../hooks/useAuth';
import { useOnboarding } from '../hooks/useOnboarding';

export const MapaPage = () => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const { user, signOut } = useAuth();
  const { resetOnboarding } = useOnboarding();
  const navigate = useNavigate();

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Inicialización de MapLibre GL JS con tiles de demostración gratuitos
    try {
      mapInstanceRef.current = new maplibregl.Map({
        container: mapContainerRef.current,
        style: 'https://demotiles.maplibre.org/style.json', // Estilo demo gratuito
        center: [-58.3648, -34.6625], // Coordenadas de Avellaneda / CABA
        zoom: 12,
        attributionControl: false,
      });

      // Controles de navegación y brújula
      mapInstanceRef.current.addControl(
        new maplibregl.NavigationControl({ showCompass: true, showZoom: true }),
        'top-right'
      );
    } catch (err) {
      console.warn('MapLibre GL JS init fallback:', err);
    }

    // Limpieza al desmontar
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Manejo de Cierre de Sesión
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

  return (
    <div className="relative h-[100dvh] w-full bg-slate-900 overflow-hidden flex flex-col">
      {/* 1. Barra Superior Flotante con Glassmorphism */}
      <header className="absolute top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-md px-4 py-2.5 border-b border-slate-200/80 flex items-center justify-between shadow-xs safe-top">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo-icon.png"
            alt="Reportalo"
            className="w-7 h-8 object-contain select-none"
          />
          <div className="flex flex-col text-left">
            <span className="text-sm font-extrabold text-slate-900 leading-tight">
              Reportalo
            </span>
            <span className="text-[11px] font-medium text-slate-500 truncate max-w-[160px] sm:max-w-xs">
              {user?.email || 'Ciudadano'}
            </span>
          </div>
        </div>

        {/* Indicador de Jurisdicción y Botón de Salida */}
        <div className="flex items-center gap-2">
          <div className="hidden xs:flex items-center gap-1 text-xs font-bold bg-primary-light text-primary-dark px-3 py-1 rounded-full border border-primary/20">
            <MapPin className="w-3.5 h-3.5" />
            <span>Avellaneda / CABA</span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50/70 border border-slate-200/70 hover:border-red-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold active:scale-95 shadow-2xs"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* 2. Contenedor del Mapa MapLibre */}
      <div
        id="map"
        ref={mapContainerRef}
        className="w-full h-full flex-1 bg-slate-100 z-10"
      />

      {/* 3. Badge Informativo Inferior Flotante */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-md border border-slate-200/80 text-xs font-bold text-slate-700 flex items-center gap-2 safe-bottom">
        <Layers className="w-4 h-4 text-primary" />
        <span>Mapa de Reportes · Sprint V2</span>
      </div>
    </div>
  );
};
