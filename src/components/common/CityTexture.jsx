import React from 'react';

/**
 * Textura de calles dibujada en SVG (REP-3791 Bloques 11-C y 11-D). Reemplaza la captura del mapa
 * de los mockups: pesa casi nada, no depende de la red y no necesita la atribución de OpenStreetMap.
 * El color sale de `currentColor`, así que se tiñe con una clase de texto.
 *
 * Usos: héroe de la portada en escritorio (D01, sobre azul) y fondo atenuado de «Tu sesión
 * venció» (M23, bajo la tarjeta).
 *
 * @param {string} [className] Posición, tamaño y color (por ejemplo, 'text-white').
 * @param {number} [opacity]   Opacidad del trazo, de 0 a 1.
 */
export const CityTexture = ({ className = '', opacity = 0.09 }) => (
  <svg
    aria-hidden="true"
    className={`pointer-events-none ${className}`}
    viewBox="0 0 1200 640"
    preserveAspectRatio="xMidYMid slice"
    fill="none"
  >
    <defs>
      <pattern id="rep-city-grid" width="54" height="54" patternUnits="userSpaceOnUse" patternTransform="rotate(-17)">
        <path d="M0 0H54M0 0V54" stroke="currentColor" strokeWidth="1.4" />
      </pattern>
    </defs>
    <g opacity={opacity}>
      <rect width="1200" height="640" fill="url(#rep-city-grid)" />
      <path d="M-40 560L1240 170" stroke="currentColor" strokeWidth="9" />
      <path d="M180 -40L520 700" stroke="currentColor" strokeWidth="7" />
      <path d="M760 -40L980 700" stroke="currentColor" strokeWidth="6" />
      <path d="M-40 180C300 240 520 120 820 210S1120 330 1240 300" stroke="currentColor" strokeWidth="5" />
      <rect x="590" y="330" width="86" height="58" rx="10" fill="currentColor" opacity="0.5" transform="rotate(-17 633 359)" />
      <rect x="170" y="120" width="64" height="44" rx="10" fill="currentColor" opacity="0.4" transform="rotate(-17 202 142)" />
    </g>
  </svg>
);

export default CityTexture;
