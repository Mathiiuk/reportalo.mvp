/**
 * @file newsService.js
 * @description Novedades del municipio y de la app (UJ v3.3 · M24 / M25 · D31 / D32 —
 * REP-3791 Bloque 8).
 *
 * Todavía no hay origen de datos: no existe una tabla de publicaciones ni un panel donde el
 * municipio las cargue (H-46). Hasta que exista, `getPublishedNews` devuelve una lista vacía y la
 * pantalla muestra su estado vacío. No hay contenido de demostración: la app es funcional y
 * solo muestra lo que realmente se publicó.
 */

// Punto único donde enchufar la consulta real cuando exista la tabla
export const NEWS_SOURCE_READY = false;

export const NEWS_SOURCES = {
  municipio: { label: 'Municipio', tag: 'Municipio' },
  app: { label: 'App', tag: 'App' },
};

/**
 * @returns {Promise<{ news: Array<object>, pending: boolean }>} `pending` avisa que todavía no hay
 * origen de datos: la pantalla muestra el estado vacío en lugar de un error.
 */
export const getPublishedNews = async () => {
  if (!NEWS_SOURCE_READY) return { news: [], pending: true };
  return { news: [], pending: false };
};

/**
 * Nota completa. Mientras no haya origen de datos no hay ninguna publicación que servir.
 * La app ya no trae comunicados de ejemplo: uno firmado por una secretaría del municipio,
 * que nadie publicó, no puede aparecer ni desde un enlace compartido.
 *
 * @param {string} newsId
 */
export const getNewsItem = async (newsId) => ({ item: null, pending: !NEWS_SOURCE_READY });

// «Hace 2 días» · «5 de septiembre»
export const formatNewsDate = (isoDate) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
};
