/**
 * Compila una variante de los ajustes del motor (REP-3803 · 4A) en `.perf/dist-<nombre>`.
 *
 * Reemplaza SOLO la constante MAP_ENGINE_OPTIONS de CitizenMap.jsx, compila y restaura el
 * archivo original, de modo que el código fuente nunca queda con una variante puesta.
 *
 * Uso: node build-variants.mjs fade0 pixel15 mundo cache combinada
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = path.join(repo, 'src', 'components', 'map', 'CitizenMap.jsx');

/** Cada ajuste de 4A, aislado, más la combinación de todos. */
export const VARIANTS = {
  // Desvanecimiento de las etiquetas del mapa (en 6.6.0 NO afecta la aparición de tiles)
  fade0: '{ fadeDuration: 0 }',
  // Densidad de píxeles acotada: el emulador móvil usa 1,75, así que 1,5 sí lo recorta
  pixel15: '{ pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5) }',
  // El mapa ya está acotado con maxBounds: se mide si esta opción aporta algo más
  mundo: '{ renderWorldCopies: false }',
  // Caché de tiles dinámica sobre 2 niveles de zoom en lugar de los 5 por defecto
  cache: '{ maxTileCacheZoomLevels: 2 }',
  combinada:
    '{ fadeDuration: 0, pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5), renderWorldCopies: false, maxTileCacheZoomLevels: 2 }',
};

const MARKER = 'const MAP_ENGINE_OPTIONS = {};';

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const original = fs.readFileSync(file, 'utf8');
  if (!original.includes(MARKER)) throw new Error('MAP_ENGINE_OPTIONS no está vacío o no existe: no se puede parchear');
  try {
    for (const name of process.argv.slice(2)) {
      if (!VARIANTS[name]) throw new Error(`variante desconocida: ${name}`);
      fs.writeFileSync(file, original.replace(MARKER, `const MAP_ENGINE_OPTIONS = ${VARIANTS[name]};`));
      const out = path.join('.perf', `dist-${name}`);
      const r = spawnSync('pnpm', ['exec', 'vite', 'build', '--outDir', out, '--emptyOutDir'], { cwd: repo, shell: true, encoding: 'utf8' });
      if (r.status !== 0) throw new Error(`falló el build de ${name}:\n${r.stdout}\n${r.stderr}`);
      console.log(`compilada ${name} -> ${out}`);
    }
  } finally {
    fs.writeFileSync(file, original);
  }
}
