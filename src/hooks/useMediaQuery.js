/**
 * @file useMediaQuery.js
 * @description Hook reactivo para consultar media queries del navegador y derivar de ahí
 * el layout de escritorio del recorrido de nuevo reporte (REP-3787, UJ v3.3 · Bloque 1-D).
 *
 * Nota de trazabilidad: este archivo NO vino en el handoff de UX (REP-3791). El Bloque 1-D
 * importa `useIsDesktopLayout` desde acá pero no incluye el módulo, así que lo agregó
 * desarrollo respetando el contrato que fija el propio test del bloque
 * (`src/test/EvidenceUploadDesktop.test.jsx`): `window.matchMedia` devolviendo
 * `{ matches, media, addEventListener, removeEventListener }` y suscripción por `change`.
 */

import { useState, useEffect } from 'react';

// El §10 del UJ v3.3 define escritorio desde 1025 px. Entre 641 y 1024 px (tablet) se usa
// el layout de teléfono centrado, así que la consulta arranca justo arriba de ese rango.
export const DESKTOP_MEDIA_QUERY = '(min-width: 1025px)';

/**
 * Lee una media query sin romper cuando el entorno no la soporta.
 * En SSR y en tests que no mockean `matchMedia` devuelve false, que es el layout de teléfono:
 * es el camino seguro, porque el recorrido mobile es el que cubre la mayoría de los tests.
 * @param {string} query Media query a evaluar, por ejemplo '(min-width: 1025px)'.
 * @returns {boolean} true si la consulta coincide en este momento.
 */
const consultar = (query) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  // Algunos entornos de prueba devuelven un objeto incompleto: nos quedamos con el booleano.
  return Boolean(window.matchMedia(query)?.matches);
};

/**
 * Hook genérico para observar una media query y reaccionar a sus cambios.
 * @param {string} query Media query a evaluar.
 * @returns {boolean} Estado actual de la consulta.
 */
export const useMediaQuery = (query) => {
  // Inicializamos con el valor real para evitar un primer render con el layout equivocado.
  const [coincide, setCoincide] = useState(() => consultar(query));

  useEffect(() => {
    // Si el entorno no soporta matchMedia no hay nada que observar: queda en false.
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setCoincide(false);
      return undefined;
    }

    const lista = window.matchMedia(query);

    // Resincronizamos por si el ancho cambió entre el primer render y este efecto,
    // o si el test reemplazó el mock de matchMedia despues de montar.
    setCoincide(Boolean(lista?.matches));

    const alCambiar = (evento) => setCoincide(Boolean(evento?.matches));

    // API moderna. Se verifica que exista porque los mocks de los tests solo definen esta.
    if (typeof lista?.addEventListener === 'function') {
      lista.addEventListener('change', alCambiar);
      return () => lista.removeEventListener('change', alCambiar);
    }

    // Respaldo para navegadores viejos, que solo tienen addListener / removeListener.
    if (typeof lista?.addListener === 'function') {
      lista.addListener(alCambiar);
      return () => lista.removeListener(alCambiar);
    }

    // Objeto de media query sin forma de suscribirse: se deja el valor inicial.
    return undefined;
  }, [query]);

  return coincide;
};

/**
 * Indica si corresponde el layout de escritorio del recorrido de nuevo reporte.
 * @returns {boolean} true desde 1025 px de ancho.
 */
export const useIsDesktopLayout = () => useMediaQuery(DESKTOP_MEDIA_QUERY);

export default useMediaQuery;
