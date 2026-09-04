import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Map, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { motion } from 'framer-motion';
import { resolveAddressDetails, DEFAULT_CITY_COORDINATES } from '../../services/locationService';
import 'maplibre-gl/dist/maplibre-gl.css';

// Configurar URL del Web Worker de MapLibre para Vite
if (typeof setWorkerUrl === 'function' && workerUrl) {
  try {
    setWorkerUrl(workerUrl);
  } catch (e) {
    console.warn('[MapLibre Worker Init in AdjustLocation]:', e);
  }
}

const OPENFREEMAP_BRIGHT_STYLE = 'https://tiles.openfreemap.org/styles/bright';

/**
 * Componente modal/pantalla "¿Dónde ocurrió?" para corregir y ajustar el punto exacto de ubicación.
 * Diseño exacto User Journey v3.1 / Sprint 10.
 */
export const AdjustLocationModal = ({
  initialCoordinates,
  onConfirm,
  onClose,
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Coordenadas activas actuales [lng, lat]
  const [currentCoords, setCurrentCoords] = useState(() => {
    if (Array.isArray(initialCoordinates)) return initialCoordinates;
    if (initialCoordinates?.lng && initialCoordinates?.lat) {
      return [initialCoordinates.lng, initialCoordinates.lat];
    }
    return DEFAULT_CITY_COORDINATES;
  });

  const addressDetails = resolveAddressDetails(currentCoords);

  // Inicializar mapa de ajuste
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let map;
    try {
      map = new Map({
        container: mapContainerRef.current,
        style: OPENFREEMAP_BRIGHT_STYLE,
        center: currentCoords,
        zoom: 15.5,
        attributionControl: false,
      });

      map.on('move', () => {
        const center = map.getCenter();
        setCurrentCoords([center.lng, center.lat]);
      });

      mapInstanceRef.current = map;
    } catch (err) {
      console.warn('[AdjustLocationModal Map init warning]:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          if (typeof mapInstanceRef.current.remove === 'function') {
            mapInstanceRef.current.remove();
          }
        } catch (e) {
          console.warn('[AdjustLocationModal cleanup warning]:', e);
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Recentrar al punto inicial o GPS
  const handleRecenter = useCallback(() => {
    const target = Array.isArray(initialCoordinates)
      ? initialCoordinates
      : initialCoordinates?.lng && initialCoordinates?.lat
      ? [initialCoordinates.lng, initialCoordinates.lat]
      : DEFAULT_CITY_COORDINATES;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({ center: target, zoom: 16 });
    }
    setCurrentCoords(target);
  }, [initialCoordinates]);

  // Confirmar ubicación
  const handleConfirmLocation = () => {
    if (onConfirm) {
      onConfirm({
        coordinates: { lng: currentCoords[0], lat: currentCoords[1] },
        street: addressDetails.street,
        locality: addressDetails.locality,
        fullAddress: `${addressDetails.street}, ${addressDetails.locality.split(',')[0]}`,
        accuracy: addressDetails.accuracy,
      });
    }
  };

  return (
    <div
      data-testid="adjust-location-modal"
      className="relative w-full h-[100dvh] bg-white overflow-hidden flex flex-col font-manrope select-none"
    >
      {/* 1. Header con botón volver y título */}
      <header className="flex-0 bg-white px-3.5 pt-2 pb-3 border-b border-[#EEF1F5] flex items-center gap-2.5 shadow-2xs z-20">
        <button
          type="button"
          onClick={onClose}
          aria-label="Volver a la revisión"
          className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-[#5B6A7A] transition-colors cursor-pointer border-0 bg-transparent p-0"
        >
          <span className="material-symbols-rounded text-[22px]">arrow_back</span>
        </button>
        <span className="font-extrabold text-[16px] text-[#263249]">
          ¿Dónde ocurrió?
        </span>
      </header>

      {/* 2. Área central del Mapa Interactivo */}
      <div className="flex-1 relative overflow-hidden bg-[#E5E9EE]">
        {/* Contenedor MapLibre */}
        <div
          ref={mapContainerRef}
          data-testid="adjust-map-container"
          className="w-full h-full"
        />

        {/* Banner flotante superior */}
        <div className="absolute left-3 right-3 top-3 z-10 bg-white rounded-xl py-2.5 px-3 flex items-center gap-2 shadow-[0_5px_16px_rgba(20,40,80,0.14)] pointer-events-none">
          <span className="material-symbols-rounded text-[18px] text-[#8593A2]">
            drag_pan
          </span>
          <span className="font-semibold text-[11px] leading-tight text-[#46566B]">
            Arrastrá el mapa para corregir el punto exacto.
          </span>
        </div>

        {/* Pin central de fijación en el mapa */}
        <div className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-full flex flex-col items-center pointer-events-none z-10">
          <span
            className="material-symbols-rounded text-[44px] text-[#1E6FCB] drop-shadow-[0_4px_8px_rgba(20,40,80,0.3)]"
            style={{ fontVariationSettings: '"FILL" 1' }}
          >
            location_on
          </span>
        </div>

        {/* Círculo indicador de radio de precisión */}
        <div className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-[#1E6FCB]/14 border border-[#1E6FCB]/30 pointer-events-none z-5" />

        {/* Botón flotante para recentrar GPS */}
        <button
          type="button"
          onClick={handleRecenter}
          aria-label="Mi ubicación actual"
          className="absolute right-3 bottom-3 z-10 w-9.5 h-9.5 rounded-xl bg-white flex items-center justify-center shadow-[0_5px_16px_rgba(20,40,80,0.14)] text-[#1E6FCB] cursor-pointer border-0 hover:bg-slate-50 transition-colors"
        >
          <span className="material-symbols-rounded text-[20px]">my_location</span>
        </button>
      </div>

      {/* 3. Panel inferior de confirmación */}
      <footer className="flex-0 bg-white border-t border-[#EEF1F5] p-3.5 sm:px-4 z-20">
        <div className="flex gap-2.5 items-start mb-3">
          <span className="material-symbols-rounded text-[19px] text-[#1E6FCB] flex-shrink-0 mt-0.5">
            pin_drop
          </span>
          <div>
            <div
              data-testid="adjust-street-address"
              className="font-bold text-[13px] text-[#263249]"
            >
              {addressDetails.street}
            </div>
            <div
              data-testid="adjust-locality-address"
              className="font-medium text-[11px] text-[#8593A2] mt-0.5"
            >
              {addressDetails.locality} · precisión ±{addressDetails.accuracy} m
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleConfirmLocation}
          aria-label="Confirmar ubicación"
          className="w-full bg-[#1E6FCB] rounded-[13px] py-3.5 px-4 text-center shadow-[0_8px_18px_rgba(30,111,203,0.3)] border-0 cursor-pointer text-white font-extrabold text-[14px] hover:brightness-105 active:scale-98 transition-all"
        >
          Confirmar ubicación
        </button>
      </footer>
    </div>
  );
};

export default AdjustLocationModal;
