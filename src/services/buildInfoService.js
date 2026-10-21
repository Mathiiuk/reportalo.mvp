/**
 * @file buildInfoService.js
 * @description Versión, commit y fecha del build para «Acerca de» (REP-3866). Lee `/build-info.json`, que genera
 * `scripts/build-info.mjs` en cada `dev` y `build`: ningún valor se escribe a mano. Portado de `rep-build-info.js` del
 * handoff de Iván (REP-3865).
 *
 * Se pide con `cache: 'no-store'` para ver el commit nuevo después de cada deploy. El Service Worker no lo precachea
 * (los .json no están en los globPatterns de vite.config.js).
 */

export const BUILD_INFO_URL = '/build-info.json';

/** Normaliza el JSON generado: tolera campos faltantes. */
export const normalizeBuildInfo = (raw = {}) => {
  const commit = String(raw.commit || '');
  return {
    version: String(raw.version || ''),
    commit,
    commitShort: raw.commitShort || commit.slice(0, 7),
    branch: String(raw.branch || ''),
    builtAt: String(raw.builtAt || ''),
    env: String(raw.env || 'development').toLowerCase(),
  };
};

/**
 * @returns {Promise<{ success: boolean, info?: object }>} nunca lanza
 */
export const loadBuildInfo = async (fetchImpl = globalThis.fetch) => {
  try {
    const response = await fetchImpl(BUILD_INFO_URL, { cache: 'no-store' });
    if (!response.ok) return { success: false };
    return { success: true, info: normalizeBuildInfo(await response.json()) };
  } catch {
    return { success: false };
  }
};

/** «20/10/2026»: día en Argentina, sin hora. Vacío si la fecha no es válida. */
export const formatBuildDate = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).formatToParts(date);
  const part = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${part('day')}/${part('month')}/${part('year')}`;
};
