/**
 * @file PwaPantallaEnBlancoTrasDeploy.test.js
 * @description En la primera carga después de un deploy, el service worker anterior puede entregar el index.html viejo
 * mientras el nuevo ya borró sus archivos: el archivo principal da 404 y la pantalla queda en blanco (visto en staging
 * el 30/10 con el deploy de #202). La recarga de lib/chunkReload no alcanza porque vive dentro de ese archivo. Un script
 * chico en index.html recarga una sola vez, con la misma marca y el mismo margen que chunkReload.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
const inline = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';

// Corre el script de index.html con una ventana y un sessionStorage de prueba
const correr = ({ ahora = 100_000, marca = null, guardarFalla = false } = {}) => {
  const listeners = [];
  const datos = new Map(marca === null ? [] : [['reportalo_chunk_reload_at', String(marca)]]);
  const ventana = { addEventListener: (tipo, fn, captura) => listeners.push({ tipo, fn, captura }) };
  const storage = {
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => {
      if (guardarFalla) throw new Error('QuotaExceeded');
      datos.set(k, v);
    },
  };
  const location = { reload: vi.fn() };
  new Function('window', 'sessionStorage', 'location', 'Date', inline)(ventana, storage, location, { now: () => ahora });
  const fallar = (tagName, src) => listeners.filter((l) => l.tipo === 'error').forEach((l) => l.fn({ target: { tagName, src } }));
  return { listeners, datos, location, fallar };
};

describe('Pantalla en blanco en la primera carga después de un deploy', () => {
  it('UT-PWA-B1: index.html trae el script antes del archivo de la app y escucha errores en captura', () => {
    expect(inline).toBeTruthy();
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('<script type="module"'));
    const { listeners } = correr();
    expect(listeners).toEqual([expect.objectContaining({ tipo: 'error', captura: true })]);
  });

  it('UT-PWA-B2: si falla el archivo principal, recarga una vez y deja la marca de chunkReload', () => {
    const { fallar, location, datos } = correr({ ahora: 100_000 });
    fallar('SCRIPT', 'https://reportalo-staging.vercel.app/assets/index-CXXtC9C5.js');
    expect(location.reload).toHaveBeenCalledTimes(1);
    expect(datos.get('reportalo_chunk_reload_at')).toBe('100000');
  });

  it('UT-PWA-B3: si ya recargó hace menos de 30 segundos, no recarga (sin bucle)', () => {
    const { fallar, location } = correr({ ahora: 100_000, marca: 90_000 });
    fallar('SCRIPT', 'https://x/assets/index-CXXtC9C5.js');
    expect(location.reload).not.toHaveBeenCalled();
    const despues = correr({ ahora: 200_000, marca: 90_000 });
    despues.fallar('SCRIPT', 'https://x/assets/index-CXXtC9C5.js');
    expect(despues.location.reload).toHaveBeenCalledTimes(1);
  });

  it('UT-PWA-B4: otros errores no recargan: imágenes, otros scripts o sin poder guardar la marca', () => {
    const { fallar, location } = correr();
    fallar('IMG', 'https://x/assets/index-foto.js');
    fallar('SCRIPT', 'https://x/assets/MapPage-abc.js');
    fallar(undefined, undefined);
    expect(location.reload).not.toHaveBeenCalled();
    const privado = correr({ guardarFalla: true });
    privado.fallar('SCRIPT', 'https://x/assets/index-CXXtC9C5.js');
    expect(privado.location.reload).not.toHaveBeenCalled();
  });

  it('UT-PWA-B5: usa la misma marca y el mismo margen que lib/chunkReload', () => {
    const lib = readFileSync(resolve(__dirname, '../lib/chunkReload.js'), 'utf8');
    expect(lib).toContain("CHUNK_RELOAD_KEY = 'reportalo_chunk_reload_at'");
    expect(lib).toContain('RELOAD_WINDOW_MS = 30_000');
    expect(inline).toContain("'reportalo_chunk_reload_at'");
    expect(inline).toContain('30000');
  });
});
