import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Map, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { motion } from 'framer-motion';
import { ArrowLeft, Move, MapPin, LocateFixed, LocateOff, RotateCw, TriangleAlert } from 'lucide-react';
import {
  resolveAddressDetails,
  DEFAULT_CITY_COORDINATES,
  CABA_AVELLANEDA_BOUNDS,
  getMinZoomToContainBounds,
  isCoordinatesInBounds,
} from '../../services/locationService';
import { checkLocalityPinMismatch } from '../../services/localityCentroids';
import { suggestAddress, classifyRoadType, OSM_ATTRIBUTION } from '../../services/geocodingService';
import { LocalitySelector } from './LocalitySelector';
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
const MIN_ZOOM = 11.5;
const MAX_ZOOM = 19;

/**
 * Componente modal/pantalla "¿Dónde ocurrió?" para corregir y ajustar el punto exacto de ubicación.
 * Limitado estrictamente a las zonas operativas de CABA y Avellaneda.
 * UJ v3.3 · M12 «Ajustar ubicación» (teléfono) y D13 (escritorio): solo cambia la capa visual.
 * REP-3791 Bloques 1 y 1-D.
 */
export const AdjustLocationModal = ({
  initialCoordinates,
  initialLocalityId,
  // REP-3843: dirección ya confirmada antes (al reabrir el modal no se pierde lo que el vecino corrigió)
  initialAddress = null,
  onConfirm,
  onClose,
  // UJ v3.3 · M22 (REP-3791 Bloque 4): el GPS no respondió o el permiso está bloqueado
  isGpsUnavailable = false,
  isGpsDenied = false,
  onRetryGps = null,
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // R-1 a R-5: localidad real elegida por el ciudadano (no inferida por GPS)
  const [localityId, setLocalityId] = useState(initialLocalityId ?? null);
  const [localityLabel, setLocalityLabel] = useState(null);

  const handleLocalityChange = (id, label) => {
    setLocalityId(id);
    setLocalityLabel(label);
  };

  // Coordenadas activas actuales [lng, lat] (verificando que estén en el bounding box de CABA/Avellaneda)
  const [currentCoords, setCurrentCoords] = useState(() => {
    let parsedCoords = DEFAULT_CITY_COORDINATES;
    if (Array.isArray(initialCoordinates)) {
      parsedCoords = initialCoordinates;
    } else if (initialCoordinates?.lng && initialCoordinates?.lat) {
      parsedCoords = [initialCoordinates.lng, initialCoordinates.lat];
    }
    return isCoordinatesInBounds(parsedCoords) ? parsedCoords : DEFAULT_CITY_COORDINATES;
  });

  // No hay geocodificación inversa ni polígonos de barrio: el pin y la localidad son dos
  // estados independientes. Para evitar que queden desincronizados (ej. pin en Palermo con
  // "Balvanera" seleccionado), si el usuario mueve el pin de forma significativa después de
  // haber elegido una localidad, limpiamos esa selección para forzar que la reconfirme.
  // Se ignora ruido de reposicionamiento inicial del mapa comparando contra la última
  // posición "asentada" con un umbral (~10-15m), no contra cada evento 'move' en bruto.
  const lastSettledCoordsRef = useRef(currentCoords);
  useEffect(() => {
    const [prevLng, prevLat] = lastSettledCoordsRef.current;
    const [lng, lat] = currentCoords;
    const MOVE_THRESHOLD_DEGREES = 0.00015; // ~15m en latitudes de CABA
    const movedSignificantly =
      Math.abs(lng - prevLng) > MOVE_THRESHOLD_DEGREES ||
      Math.abs(lat - prevLat) > MOVE_THRESHOLD_DEGREES;

    if (movedSignificantly && localityId) {
      setLocalityId(null);
      setLocalityLabel(null);
    }
    lastSettledCoordsRef.current = currentCoords;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCoords]);

  const addressDetails = resolveAddressDetails(currentCoords);

  // REP-3843: dirección aproximada sugerida por el proxy (Nominatim) y corregible por el vecino. Es opcional: sin
  // sugerencia se confirma igual. Se pide cuando el punto deja de moverse (y una vez por posición: 1 consulta/seg).
  const [street, setStreet] = useState(initialAddress?.street ?? '');
  const [streetNumber, setStreetNumber] = useState(initialAddress?.number ?? '');
  const [addressSource, setAddressSource] = useState(initialAddress?.street ? initialAddress.source ?? 'sugerida' : null);
  const editedAddressRef = useRef(initialAddress?.source === 'corregida');
  useEffect(() => {
    let vigente = true;
    const [lng, lat] = currentCoords;
    const espera = setTimeout(async () => {
      const sugerida = await suggestAddress({ lat, lng });
      // Lo que el vecino escribió a mano no se pisa con una sugerencia nueva
      if (!vigente || editedAddressRef.current) return;
      setStreet(sugerida?.street ?? '');
      setStreetNumber(sugerida?.number ?? '');
      setAddressSource(sugerida ? 'sugerida' : null);
    }, 600);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [currentCoords]);

  const handleStreetChange = (value) => {
    editedAddressRef.current = true;
    setStreet(value);
    setAddressSource('corregida');
  };
  const handleNumberChange = (value) => {
    editedAddressRef.current = true;
    setStreetNumber(value.replace(/[^0-9A-Za-z]/g, '').slice(0, 6));
    setAddressSource('corregida');
  };
  const confirmedAddress = street.trim()
    ? {
        street: street.trim(),
        number: streetNumber.trim() || null,
        roadType: classifyRoadType(street),
        source: addressSource === 'corregida' ? 'corregida' : 'sugerida',
      }
    : null;

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Aviso (NO bloqueo) cuando el barrio elegido queda geográficamente lejos del pin actual —
  // ej. pin en Retiro con "Almagro" seleccionado en el desplegable. Los centroides son
  // aproximados (no polígonos oficiales): REP-3814 — un punto desplazado bloqueaba a quien
  // marcaba bien su barrio, así que el aviso solo advierte y el ciudadano decide (R-1 a R-5).
  // IMPORTANTE: Si está offline, el mapa no carga las calles (azulejos), por lo que el 
  // usuario no puede ajustar el pin. En ese caso, desactivamos la restricción de distancia.
  const { isFar: localityLooksFar } = localityId && isOnline
    ? checkLocalityPinMismatch(currentCoords, localityLabel)
    : { isFar: false };

  // Inicializar mapa de ajuste con límites territoriales
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // REP-3812: el zoom mínimo depende del tamaño del contenedor (ver getMinZoomToContainBounds)
    const computeMinZoom = () =>
      getMinZoomToContainBounds({
        bounds: CABA_AVELLANEDA_BOUNDS,
        width: mapContainerRef.current?.clientWidth,
        height: mapContainerRef.current?.clientHeight,
        baseMinZoom: MIN_ZOOM,
      });

    let map;
    try {
      map = new Map({
        container: mapContainerRef.current,
        style: OPENFREEMAP_BRIGHT_STYLE,
        center: currentCoords,
        zoom: 15.5,
        minZoom: computeMinZoom(),
        maxZoom: MAX_ZOOM,
        maxBounds: CABA_AVELLANEDA_BOUNDS,
        attributionControl: false,
      });

      // Si cambia el tamaño del mapa (ventana, rotación, panel lateral) se recalcula el zoom mínimo
      map.on('resize', () => {
        map.setMinZoom(computeMinZoom());
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

  // M22: reintento de GPS; si vuelve, se recentra el mapa en la nueva posición
  const [isRetryingGps, setIsRetryingGps] = useState(false);
  const gpsRetryRequestedRef = useRef(false);
  const handleRetryGps = async () => {
    if (!onRetryGps) return;
    gpsRetryRequestedRef.current = true;
    setIsRetryingGps(true);
    try {
      await onRetryGps();
    } finally {
      setIsRetryingGps(false);
    }
  };
  useEffect(() => {
    if (gpsRetryRequestedRef.current && !isGpsUnavailable) {
      gpsRetryRequestedRef.current = false;
      handleRecenter();
    }
  }, [isGpsUnavailable, initialCoordinates, handleRecenter]);

  // Confirmar ubicación — R-1/R-2: requiere localidad elegida del selector. La distancia al
  // centroide solo advierte (REP-3814), no impide confirmar.
  const handleConfirmLocation = () => {
    if (!localityId || !onConfirm) return;
    onConfirm({
      coordinates: { lng: currentCoords[0], lat: currentCoords[1] },
      localityId,
      localityLabel,
      street: addressDetails.street,
      accuracy: addressDetails.accuracy,
      address: confirmedAddress,
    });
  };

  return (
    <div
      data-testid="adjust-location-modal"
      className="relative flex h-[100dvh] w-full select-none flex-col overflow-hidden bg-rep-surface font-manrope"
    >
      {/* 1. Cabecera */}
      <header className="z-20 flex shrink-0 items-center gap-1 border-b border-rep-divider bg-rep-surface px-2 pb-2.5 pt-[max(8px,env(safe-area-inset-top,8px))] desktop:px-6 desktop:py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Volver a la revisión"
          className="rep-focus flex min-h-touch min-w-touch items-center justify-center rounded-full text-rep-ink-label transition-[transform,background-color] duration-120 hover:bg-rep-divider active:scale-[0.98]"
        >
          <ArrowLeft className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
        </button>
        <h1 className="m-0 text-rep-title text-rep-ink desktop:text-rep-title-d">¿Dónde ocurrió?</h1>
      </header>

      {/* 2. Mapa: el pin queda fijo al centro y se mueve el mapa */}
      <div className="relative flex-1 overflow-hidden bg-rep-surface-sunken">
        <div ref={mapContainerRef} data-testid="adjust-map-container" className="h-full w-full" />

        {isGpsUnavailable ? (
          <div
            data-testid="gps-unavailable-card"
            role="alert"
            className="absolute inset-x-3 top-3 z-10 flex flex-col gap-2 rounded-2xl bg-rep-surface px-4 py-3.5 shadow-rep-float desktop:left-1/2 desktop:right-auto desktop:top-6 desktop:w-[420px] desktop:-translate-x-1/2"
          >
            <div className="flex items-center gap-2.5">
              <LocateOff aria-hidden="true" className="h-5 w-5 shrink-0 text-rep-danger" strokeWidth={2.25} />
              <span className="text-rep-body font-extrabold text-rep-ink">No encontramos tu ubicación</span>
            </div>
            <p className="m-0 text-rep-label text-rep-ink-body">
              {isGpsDenied
                ? 'El permiso de ubicación está bloqueado. Podés habilitarlo en los ajustes del navegador, o marcar el punto en el mapa y elegir la localidad para seguir con el reporte.'
                : 'El GPS no responde. Podés marcar el punto en el mapa y elegir la localidad para seguir con el reporte.'}
            </p>
            {!isGpsDenied && onRetryGps && (
              <button
                type="button"
                onClick={handleRetryGps}
                disabled={isRetryingGps}
                className="rep-focus inline-flex min-h-touch items-center gap-1.5 self-start rounded-xl px-1 text-rep-label font-bold text-rep-accent disabled:opacity-45"
              >
                <RotateCw aria-hidden="true" className={`h-4 w-4 ${isRetryingGps ? 'motion-safe:animate-spin' : ''}`} strokeWidth={2.25} />
                Volver a intentar con GPS
              </button>
            )}
          </div>
        ) : (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-center gap-2.5 rounded-2xl bg-rep-surface px-3.5 py-3 shadow-rep-float desktop:left-1/2 desktop:right-auto desktop:top-6 desktop:-translate-x-1/2">
          <Move className="h-5 w-5 shrink-0 text-rep-ink-muted" strokeWidth={2.25} aria-hidden="true" />
          <span className="text-rep-body font-semibold leading-snug text-rep-ink-body">
            Arrastrá el mapa para corregir el punto exacto.
          </span>
        </div>
        )}

        {/* La punta del pin marca el centro exacto del mapa, que es la coordenada que se confirma */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-full flex-col items-center">
          <MapPin
            className="h-11 w-11 text-rep-accent drop-shadow-[0_4px_8px_rgba(20,40,80,0.3)]"
            strokeWidth={1.75}
            fill="currentColor"
            fillOpacity={0.15}
            aria-hidden="true"
          />
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[5] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-rep-accent/30 bg-rep-accent/15" />

        <button
          type="button"
          onClick={handleRecenter}
          aria-label="Mi ubicación actual"
          className="rep-focus absolute bottom-3 right-3 z-10 flex h-12 w-12 desktop:bottom-auto desktop:right-6 desktop:top-6 items-center justify-center rounded-xl bg-rep-surface text-rep-accent shadow-rep-float transition-[transform,filter] duration-120 active:scale-[0.98] md:hover:brightness-[.96] dark:md:hover:brightness-[1.06]"
        >
          <LocateFixed className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>

      {/* 3. Panel de confirmación */}
      {/* Teléfono: panel inferior (M12) · escritorio: tarjeta flotante sobre el mapa (D13) */}
      <footer className="z-20 shrink-0 border-t border-rep-divider bg-rep-surface px-4 pt-3.5 pb-[max(14px,env(safe-area-inset-bottom,14px))] desktop:absolute desktop:bottom-6 desktop:right-6 desktop:w-[400px] desktop:rounded-2xl desktop:border desktop:border-rep-border desktop:p-5 desktop:shadow-rep-float">
        <div className="mx-auto w-full max-w-lg">
          <div className="mb-3 flex items-start gap-2.5">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-rep-accent" strokeWidth={2.25} aria-hidden="true" />
            <div className="min-w-0">
              <div data-testid="adjust-street-address" className="text-[15px] font-extrabold leading-snug text-rep-ink">
                {confirmedAddress ? [confirmedAddress.street, confirmedAddress.number].filter(Boolean).join(' ') : addressDetails.street}
              </div>
              <div className="mt-0.5 text-rep-label font-medium text-rep-ink-muted">
                {localityLabel || addressDetails.locality}
              </div>
            </div>
          </div>

          {/* REP-3843: dirección aproximada, sugerida y corregible. Opcional: vacía se confirma igual */}
          <div className="mb-3 flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-rep-label font-semibold text-rep-ink-muted">Calle</span>
              <input
                type="text"
                value={street}
                maxLength={120}
                onChange={(e) => handleStreetChange(e.target.value)}
                placeholder="Opcional"
                className="rep-focus w-full rounded-xl border border-rep-border bg-rep-surface px-3 py-2 text-rep-body text-rep-ink"
              />
            </label>
            <label className="w-24 shrink-0">
              <span className="mb-1 block text-rep-label font-semibold text-rep-ink-muted">Altura</span>
              <input
                type="text"
                inputMode="numeric"
                value={streetNumber}
                onChange={(e) => handleNumberChange(e.target.value)}
                placeholder="Opcional"
                className="rep-focus w-full rounded-xl border border-rep-border bg-rep-surface px-3 py-2 text-rep-body text-rep-ink"
              />
            </label>
          </div>
          {addressSource === 'sugerida' && (
            <p className="-mt-2 mb-3 text-[11px] text-rep-ink-faint">{OSM_ATTRIBUTION}</p>
          )}

          {/* R-4 (REP-2500): la localidad la elige el ciudadano; la dirección no la reemplaza */}
          <div className="mb-3">
            <LocalitySelector value={localityId} onChange={handleLocalityChange} />
          </div>

          {localityLooksFar && (
            <div
              data-testid="locality-pin-mismatch-warning"
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-2xl border border-rep-warning/40 bg-rep-warning-soft px-3.5 py-3"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rep-warning" strokeWidth={2.25} aria-hidden="true" />
              <span className="text-rep-label font-semibold text-rep-warning-ink">
                El barrio elegido parece estar lejos del punto marcado en el mapa. Revisá que sea el correcto; si lo es, podés confirmar igual.
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirmLocation}
            disabled={!localityId}
            aria-label="Confirmar ubicación"
            className="rep-focus flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-rep-accent px-4 text-rep-button text-rep-on-accent shadow-rep-accent transition-[transform,background-color] duration-120 hover:bg-rep-accent-strong active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:bg-rep-accent disabled:active:scale-100"
          >
            Confirmar ubicación
          </button>
        </div>
      </footer>
    </div>
  );
};

export default AdjustLocationModal;
