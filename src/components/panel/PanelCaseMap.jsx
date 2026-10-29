import React, { useEffect, useRef, useState } from 'react';
import { loadMapLibre } from '../../lib/maplibreLoader';

// Mismo estilo de calles que el mapa del vecino (CitizenMap, AdjustLocationModal)
const OPENFREEMAP_BRIGHT_STYLE = 'https://tiles.openfreemap.org/styles/bright';

/**
 * REP-3749 (Matías, 29/10) · Mapa chico con solo el caso abierto, dentro del panel: el operador no sale a la app del
 * vecino. MapLibre se baja recién cuando se abre (pesa ~255 kB gzip; ver maplibreLoader).
 *
 * @param {{ latitud: number, longitud: number, label: string }} props
 */
export const PanelCaseMap = ({ latitud, longitud, label }) => {
  const containerRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let map = null;
    let cancelled = false;
    loadMapLibre()
      .then(({ Map, Marker }) => {
        if (cancelled || !containerRef.current) return;
        map = new Map({
          container: containerRef.current,
          style: OPENFREEMAP_BRIGHT_STYLE,
          center: [longitud, latitud],
          zoom: 16,
          attributionControl: false,
        });
        // Un solo pin: el del caso
        const pin = document.createElement('span');
        pin.className = 'case-pin';
        new Marker({ element: pin }).setLngLat([longitud, latitud]).addTo(map);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      try {
        map?.remove();
      } catch {
        // el mapa ya no existe
      }
    };
  }, [latitud, longitud]);

  return failed ? (
    <p className="hint case-map-err" role="alert">
      No pudimos cargar el mapa. Revisá la conexión y volvé a abrirlo.
    </p>
  ) : (
    <div ref={containerRef} className="case-map" role="img" aria-label={`Mapa con la ubicación del caso: ${label}`} />
  );
};

export default PanelCaseMap;
