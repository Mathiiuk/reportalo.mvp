/**
 * @file newsService.js
 * @description Novedades del municipio y de la app (UJ v3.3 · M24 / M25 · D31 / D32 —
 * REP-3791 Bloque 8).
 *
 * Todavía no hay origen de datos: no existe una tabla de publicaciones ni un panel donde el
 * municipio las cargue (H-46). Hasta que exista, `getPublishedNews` devuelve una lista vacía y la
 * pantalla muestra su estado vacío. El contenido de demostración sirve para revisar el diseño y
 * para que QA pueda validar la pantalla sin backend. Mis reportes ya no tiene demo: lee reportes reales.
 */

// Punto único donde enchufar la consulta real cuando exista la tabla
export const NEWS_SOURCE_READY = false;

export const NEWS_SOURCES = {
  municipio: { label: 'Municipio', tag: 'Municipio' },
  app: { label: 'App', tag: 'App' },
};

export const DEMO_NEWS = [
  {
    id: 'demo-1',
    source: 'municipio',
    tagDetail: null,
    title: 'Bacheo en Av. Mitre: cortes parciales del 8 al 12 de septiembre',
    summary: 'La cuadrilla trabaja por tramos entre Belgrano y Pavón, de 8 a 17.',
    publishedAt: '2026-09-08T09:00:00Z',
    author: 'Secretaría de Obras Públicas',
    hasLocation: true,
    body: [
      'La cuadrilla trabaja por tramos entre Belgrano y Pavón, de 8 a 17. Cada tramo se libera al final de la jornada y el desvío señalizado es por Colón.',
      'Los reportes de bache abiertos en ese tramo quedan asociados a la obra y se cierran a medida que avanza.',
    ],
  },
  {
    id: 'demo-2',
    source: 'app',
    tagDetail: 'v1.3',
    title: 'Ya podés descargar la constancia de cierre en PDF',
    summary: 'Disponible en el detalle de los reportes resueltos.',
    publishedAt: '2026-09-05T12:00:00Z',
    author: 'Equipo de Reportalo',
    hasLocation: false,
    body: ['Cuando un reporte pasa a Resuelto, el detalle ofrece la constancia de cierre en PDF.'],
  },
  {
    id: 'demo-3',
    source: 'municipio',
    tagDetail: null,
    title: 'Operativo de poda en Villa Domínico: cronograma por calle',
    summary: 'El cronograma se publica por cuadrante y se actualiza cada semana.',
    publishedAt: '2026-09-01T10:00:00Z',
    author: 'Secretaría de Espacios Públicos',
    hasLocation: true,
    body: ['El operativo recorre Villa Domínico por cuadrantes. El cronograma se actualiza cada semana.'],
  },
  {
    id: 'demo-4',
    source: 'municipio',
    tagDetail: null,
    title: 'Nuevos contenedores de reciclado en Piñeyro',
    summary: 'Se sumaron doce puntos de separación en origen.',
    publishedAt: '2026-08-28T10:00:00Z',
    author: 'Secretaría de Ambiente',
    hasLocation: true,
    body: ['Se sumaron doce puntos de separación en origen, con contenedores diferenciados.'],
  },
];

/**
 * @returns {Promise<{ news: Array<object>, pending: boolean }>} `pending` avisa que todavía no hay
 * origen de datos: la pantalla muestra el estado vacío en lugar de un error.
 */
export const getPublishedNews = async () => {
  if (!NEWS_SOURCE_READY) return { news: [], pending: true };
  return { news: [], pending: false };
};

/**
 * Nota completa. El contenido de demostración solo se entrega si quien llama lo pide
 * explícitamente (`includeDemo`), igual que `getPublishedNews`, que devuelve vacío
 * mientras no haya origen de datos.
 *
 * Sin esa condición, entrar a /novedades/demo-1 por un enlace compartido o por el
 * historial mostraba un comunicado redactado como oficial —firmado por una secretaría
 * del municipio— aunque la pantalla de Novedades estuviera vacía. Nadie publicó eso.
 *
 * @param {string} newsId
 * @param {object} [options]
 * @param {boolean} [options.includeDemo] true solo cuando la pantalla está en modo demostración
 */
export const getNewsItem = async (newsId, { includeDemo = false } = {}) => {
  const demoItem = includeDemo ? DEMO_NEWS.find((item) => item.id === newsId) : null;
  return { item: demoItem ?? null, pending: !NEWS_SOURCE_READY && !demoItem };
};

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
