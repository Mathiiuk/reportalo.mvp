// ==============================================================================
// Página Principal de la App: Mapa con MapLibre GL JS (MapaPage.jsx)
// ==============================================================================

import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { LogOut, MapPin, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useOnboarding } from '../hooks/useOnboarding';
import { Logo } from '../components/common/Logo';

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
        center: [-58.3648, -34.6625], // Coordenadas aproximadas de Avellaneda / CABA
        zoom: 12,
        attributionControl: false,
      });

      // Controles de navegación del mapa
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
    <div className="relative h-screen w-full bg-slate-900 overflow-hidden flex flex-col">
      {/* 1. Barra Superior Flotante */}
      <header className="absolute top-0 left-0 right-0 z-20 bg-white/90 backdrop-blur-md px-4 py-3 border-b border-slate-200/80 flex items-center justify-between shadow-sm safe-top">
        <div className="flex items-center gap-2">
          <Logo size="sm" showText={false} />
          <div className="flex flex-col text-left">
            <span className="text-sm font-bold text-content-primary leading-tight">
              Reportalo V2
            </span>
            <span className="text-[11px] font-medium text-content-secondary truncate max-w-[180px]">
              {user?.email || 'Ciudadano'}
            </span>
          </div>
        </div>

        {/* Indicador de Jurisdicción y Botón de Salida */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 text-xs font-semibold bg-primary-light text-primary-dark px-2.5 py-1 rounded-full">
            <MapPin className="w-3.5 h-3.5" />
            <span>Avellaneda / CABA</span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="p-2 text-content-secondary hover:text-red-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden xs:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* 2. Contenedor del Mapa MapLibre */}
      <div
        id="map"
        ref={mapContainerRef}
        className="w-full h-full flex-1 bg-slate-100 z-10"
      />

      {/* 3. Badge Informativo Inferior */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-card border border-slate-200 text-xs font-semibold text-content-secondary flex items-center gap-2 safe-bottom">
        <Layers className="w-4 h-4 text-primary" />
        <span>Mapa de Reportes Ciudadanos · Sprint V2</span>
      </div>
    </div>
  );
};
