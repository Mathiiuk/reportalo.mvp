import React, { useEffect, useRef, useState } from 'react';
import { loadMapLibre } from '../../lib/maplibreLoader';
import { MIN_CASOS } from '../../services/observatorioService';
import { fmtNum } from './obsFormat';

/**
 * OBS · F3 · Mapa de calor del observatorio (POC D57/M50): un círculo por zona, en su centro aproximado.
 *
 * - Tamaño y color crecen con la cantidad de reportes (escala de un solo azul, validada: 4 pasos de claro a oscuro).
 *   No verde-rojo: «más reportes» no es «zona mala».
 * - Con menos de 5 reportes el círculo va gris.
 * - Zoom máximo 15: ninguna vista llega a mostrar un caso ni una dirección. No hay puntos sueltos, solo zonas.
 * - Los círculos son botones (se tocan y se enfocan con el teclado). Tocar uno baja un nivel.
 */

const ESTILO = 'https://tiles.openfreemap.org/styles/bright';
export const ZOOM_MAXIMO = 15;
// Centro y zoom iniciales: CABA y Avellaneda (donde hoy hay reportes)
const INICIO = { center: [-58.42, -34.62], zoom: 10 };

// Escala de un solo azul, de claro a oscuro (validador: monotonía, saltos visibles y contraste del extremo claro)
export const ESCALA = ['#7DAFE8', '#4A8FDC', '#1E6FCB', '#15539E'];
export const GRIS_POCOS = '#B8C2CE';

/** Paso de la escala para n reportes sobre el máximo del nivel (0 a 3), o null si son menos de 5. */
export const pasoDeEscala = (n, max) => (n < MIN_CASOS ? null : Math.min(ESCALA.length - 1, Math.max(0, Math.ceil((ESCALA.length * n) / Math.max(1, max)) - 1)));

/**
 * Diámetro del círculo en px: crece con la raíz (el área es proporcional a la cantidad).
 * En un mapa angosto (teléfono) los círculos son más chicos para que no se tapen entre sí.
 */
export const diametro = (n, max, compacto = false) =>
  Math.round((compacto ? 22 : 28) + (compacto ? 20 : 30) * Math.sqrt(n / Math.max(1, max)));

const crearCirculo = (item, max, compacto) => {
  const paso = pasoDeEscala(item.reportes, max);
  const d = diametro(item.reportes, max, compacto);
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'obs-circulo';
  el.textContent = item.reportes ? fmtNum(item.reportes) : '0';
  el.setAttribute(
    'aria-label',
    `${item.nombre}: ${fmtNum(item.reportes)} reportes${item.onClick ? '. Tocá para ver sus zonas' : ''}`
  );
  el.title = `${item.nombre}: ${fmtNum(item.reportes)} reportes`;
  Object.assign(el.style, {
    width: `${d}px`,
    height: `${d}px`,
    borderRadius: '9999px',
    border: '2px solid #FFFFFF', // anillo de superficie: separa círculos que se tocan
    background: paso === null ? GRIS_POCOS : ESCALA[paso],
    color: paso === null || paso === 0 ? '#15304F' : '#FFFFFF',
    font: `800 ${compacto ? 11 : 12}px Manrope, system-ui, sans-serif`,
    boxShadow: item.seleccionado ? '0 0 0 3px #15539E' : '0 2px 6px rgba(20, 40, 80, 0.25)',
    cursor: item.onClick ? 'pointer' : 'default',
    opacity: 0.92,
  });
  if (item.onClick) el.addEventListener('click', item.onClick);
  return el;
};

/**
 * @param {Array<{ id, nombre, centro: [number, number]|null, reportes: number, onClick?: Function, seleccionado?: boolean }>} items
 * @param {string} etiqueta descripción del mapa para lectores de pantalla
 */
export const ObsMapa = ({ items, etiqueta }) => {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const marcadores = useRef([]);
  const libreria = useRef(null);
  const [estado, setEstado] = useState('cargando');

  // El mapa se crea una vez
  useEffect(() => {
    let cancelado = false;
    loadMapLibre()
      .then((maplibre) => {
        if (cancelado || !contenedor.current) return;
        libreria.current = maplibre;
        const m = new maplibre.Map({ container: contenedor.current, style: ESTILO, ...INICIO, maxZoom: ZOOM_MAXIMO, attributionControl: { compact: true } });
        m.on('load', () => {
          if (cancelado) return;
          // El crédito de OpenStreetMap queda plegado en el botón «i» (desplegado tapaba medio mapa en el teléfono)
          contenedor.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
          setEstado('listo');
        });
        m.on('error', () => {}); // un mosaico que falla no rompe la pantalla
        mapa.current = m;
      })
      .catch(() => !cancelado && setEstado('error'));
    return () => {
      cancelado = true;
      marcadores.current.forEach((mk) => mk.remove());
      try {
        mapa.current?.remove();
      } catch {
        /* el mapa ya no existe */
      }
      mapa.current = null;
    };
  }, []);

  // Los círculos se rehacen cuando cambian las zonas o sus cifras
  useEffect(() => {
    const m = mapa.current;
    const { Marker, LngLatBounds } = libreria.current ?? {};
    if (estado !== 'listo' || !m || !Marker) return;

    marcadores.current.forEach((mk) => mk.remove());
    const conCentro = items.filter((i) => i.centro);
    const max = Math.max(1, ...conCentro.map((i) => i.reportes));
    const compacto = (contenedor.current?.clientWidth ?? 600) < 520;
    // Los más chicos arriba: se dibujan al final para que un círculo grande no los tape
    marcadores.current = [...conCentro]
      .sort((a, b) => b.reportes - a.reportes)
      .map((i) => new Marker({ element: crearCirculo(i, max, compacto) }).setLngLat(i.centro).addTo(m));

    if (conCentro.length === 1) m.easeTo({ center: conCentro[0].centro, zoom: 13, duration: 500 });
    else if (conCentro.length > 1 && LngLatBounds) {
      const b = new LngLatBounds(conCentro[0].centro, conCentro[0].centro);
      conCentro.forEach((i) => b.extend(i.centro));
      m.fitBounds(b, { padding: compacto ? 28 : 56, maxZoom: 13, duration: 500 });
    }
  }, [estado, items]);

  return (
    <div className="relative h-[300px] w-full overflow-hidden rounded-xl border border-rep-border bg-rep-surface-sunken desktop:h-[420px]">
      {/* h-full y no absolute: MapLibre le pone position: relative al contenedor y con inset-0 quedaba en 0 de alto */}
      <div ref={contenedor} role="region" aria-label={etiqueta} className="h-full w-full" />
      {estado === 'cargando' && (
        <div role="status" className="absolute inset-0 flex items-center justify-center text-rep-label text-rep-ink-faint">
          Cargando el mapa…
        </div>
      )}
      {estado === 'error' && (
        <div role="alert" className="absolute inset-0 flex items-center justify-center px-6 text-center text-rep-label text-rep-ink-muted">
          No pudimos cargar el mapa. Las cifras de cada zona siguen en la tabla.
        </div>
      )}
    </div>
  );
};

/** Leyenda del mapa: la escala de azul y el gris de «menos de 5». */
export const LeyendaMapa = () => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] font-semibold text-rep-ink-muted">
    <span className="inline-flex items-center gap-1.5">
      Menos reportes
      <span aria-hidden="true" className="inline-flex overflow-hidden rounded-full">
        {ESCALA.map((c) => (
          <i key={c} className="h-2.5 w-5" style={{ background: c }} />
        ))}
      </span>
      Más reportes
    </span>
    <span className="inline-flex items-center gap-1.5">
      <i aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: GRIS_POCOS }} />
      Menos de {MIN_CASOS}
    </span>
  </div>
);
