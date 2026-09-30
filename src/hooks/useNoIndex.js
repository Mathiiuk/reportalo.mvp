/**
 * @file useNoIndex.js
 * @description Pide a los buscadores que no indexen la pantalla actual (REP-3798 / H-61).
 *
 * Es una SPA: Vercel responde 200 con index.html para cualquier ruta, así que las pantallas de
 * error (404, 403) no pueden devolver el código HTTP real. Para que los buscadores no las
 * indexen como si fueran contenido, se agrega `<meta name="robots" content="noindex">` mientras
 * la pantalla está montada y se quita al salir.
 */
import { useEffect } from 'react';

/**
 * Agrega `noindex` al <head> mientras el componente está montado.
 * @returns {void}
 */
export const useNoIndex = () => {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    // Al desmontar se quita solo la etiqueta que puso este hook.
    return () => {
      meta.remove();
    };
  }, []);
};

export default useNoIndex;
