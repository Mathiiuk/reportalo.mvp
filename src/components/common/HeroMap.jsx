import React, { useEffect, useRef } from 'react';
import { CityTexture } from './CityTexture';

// Mismo estilo que el mapa colaborativo (OpenFreeMap, sin API key)
const OPENFREEMAP_BRIGHT_STYLE = 'https://tiles.openfreemap.org/styles/bright';

// Centro de CABA / Avellaneda y zoom en el que se distinguen calles y avenidas
const HERO_CENTER = [-58.42, -34.62];
const HERO_ZOOM = 14.2;

// Deriva lenta hacia el nordeste, en grados por segundo (~15 m/s: se nota sin marear)
const DRIFT_LNG_PER_SEC = 0.00012;
const DRIFT_LAT_PER_SEC = 0.00006;
// Tras este tiempo el recorrido vuelve al origen para no salir de la zona con tiles
const DRIFT_RESET_SEC = 240;

/**
 * Mapa real de fondo para el héroe de la portada (REP-3802). Reemplaza la textura SVG estática:
 * muestra calles y avenidas de verdad y se desplaza despacio, sin gestos del usuario.
 *
 * - MapLibre se importa de forma diferida: no entra en el bundle de la portada ni retrasa el
 *   primer pintado. Mientras carga (o si falla, o no hay WebGL) queda visible `CityTexture`.
 * - Con `prefers-reduced-motion` el mapa se muestra quieto.
 * - La animación se pausa cuando la pestaña está oculta.
 *
 * Debe ir dentro de un contenedor `relative`; ocupa todo el espacio (`absolute inset-0`).
 */
export const HeroMap = () => {
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let map = null;
    let frameId = null;

    const init = async () => {
      try {
        const [maplibre, worker] = await Promise.all([
          import('maplibre-gl'),
          import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
          import('maplibre-gl/dist/maplibre-gl.css'),
        ]);
        if (cancelled || !containerRef.current) return;

        // El worker se sirve como asset de Vite: hay que indicarle la URL a MapLibre
        if (typeof maplibre.setWorkerUrl === 'function' && worker?.default) {
          maplibre.setWorkerUrl(worker.default);
        }

        map = new maplibre.Map({
          container: containerRef.current,
          style: OPENFREEMAP_BRIGHT_STYLE,
          center: HERO_CENTER,
          zoom: HERO_ZOOM,
          interactive: false, // es decorativo: sin arrastre, zoom ni foco de teclado
          attributionControl: { compact: true }, // OpenStreetMap/OpenFreeMap exigen atribución
          fadeDuration: 0,
        });

        // Solo se dibujan las calles: etiquetas, íconos y números de ruta competirían con el texto
        map.once('style.load', () => {
          (map.getStyle()?.layers ?? [])
            .filter((layer) => layer.type === 'symbol')
            .forEach((layer) => map.setLayoutProperty(layer.id, 'visibility', 'none'));
        });

        // Se revela el mapa recién cuando llegaron los tiles del primer cuadro, para no tapar la
        // textura de respaldo con un fondo vacío. No se espera a `load`: con la deriva constante
        // pide tiles nuevos sin parar y podría no dispararse nunca.
        const revealWhenReady = () => {
          if (cancelled || !map || !map.isStyleLoaded() || !map.areTilesLoaded()) return;
          map.off('render', revealWhenReady);
          if (wrapperRef.current) wrapperRef.current.style.opacity = '1';
        };
        map.on('render', revealWhenReady);

        const reducedMotion =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) return;

        let startedAt = null;
        const step = (now) => {
          if (cancelled || !map) return;
          if (startedAt === null) startedAt = now;
          // Si la pestaña está oculta no se mueve nada; el reloj sigue en pausa lógica
          if (!document.hidden) {
            const seconds = ((now - startedAt) / 1000) % DRIFT_RESET_SEC;
            map.jumpTo({
              center: [
                HERO_CENTER[0] + seconds * DRIFT_LNG_PER_SEC,
                HERO_CENTER[1] + seconds * DRIFT_LAT_PER_SEC,
              ],
            });
          }
          frameId = requestAnimationFrame(step);
        };
        frameId = requestAnimationFrame(step);
      } catch (error) {
        // Sin red, sin WebGL o chunk caído: la textura SVG de abajo sigue cumpliendo
        console.warn('[HeroMap] No se pudo iniciar el mapa de fondo:', error);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (frameId !== null) cancelAnimationFrame(frameId);
      if (map) map.remove();
    };
  }, []);

  return (
    <div aria-hidden="true" className="absolute inset-0">
      {/* Respaldo visible mientras el mapa carga o si no puede iniciarse */}
      <CityTexture className="absolute inset-0 h-full w-full text-white" />
      {/* MapLibre le pone `position: relative` a su contenedor, por eso va dentro de un envoltorio
          absoluto y ocupa el 100% de este. */}
      <div ref={wrapperRef} className="absolute inset-0 opacity-0 transition-opacity duration-700">
        <div ref={containerRef} data-testid="hero-map" className="h-full w-full" />
      </div>
      {/* Velo azul: el mapa aporta textura sin competir con el texto blanco (D01) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(165deg, rgba(42,123,214,0.6), rgba(21,83,158,0.7))' }}
      />
    </div>
  );
};

export default HeroMap;
