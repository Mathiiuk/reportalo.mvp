/**
 * @file PwaRecargaTrasDeploy.test.jsx
 * @description Después de un deploy, el service worker nuevo se activa solo y borra los archivos de la versión anterior.
 * Una pestaña abierta con la versión vieja que entra a otra pantalla pide un archivo que ya no existe y caía en
 * «Oops, hubo un problema». Ahora la app recarga una sola vez para tomar la versión nueva; si vuelve a fallar enseguida,
 * muestra la pantalla de error (sin bucle de recargas).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { isChunkLoadError, reloadOnceForNewVersion, installChunkReloadHandler, CHUNK_RELOAD_KEY, reloader } from '../lib/chunkReload';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

// sessionStorage de prueba
const almacen = () => {
  const datos = new Map();
  return { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, String(v)), datos };
};

describe('Recarga tras un deploy (archivos de la versión anterior)', () => {
  // jsdom no deja recargar: se espía la recarga real de la app
  let recargar;
  beforeEach(() => {
    sessionStorage.clear();
    recargar = vi.spyOn(reloader, 'reload').mockImplementation(() => {});
  });

  it('UT-PWA-R1: reconoce el error de carga de archivos en Chrome, Firefox y Safari, y no otros errores', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/MapPage-abc.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error("'text/html' is not a valid JavaScript MIME type."))).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it('UT-PWA-R2: recarga una vez; si vuelve a fallar enseguida, no recarga de nuevo (sin bucle)', () => {
    const storage = almacen();
    const reload = vi.fn();
    expect(reloadOnceForNewVersion({ storage, now: 1000, reload })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.datos.get(CHUNK_RELOAD_KEY)).toBe('1000');
    expect(reloadOnceForNewVersion({ storage, now: 5000, reload })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    // Un deploy posterior, pasado el margen, vuelve a recargar
    expect(reloadOnceForNewVersion({ storage, now: 1000 + 60_000, reload })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('UT-PWA-R3: si no se puede guardar la marca (modo privado), no recarga para no entrar en bucle', () => {
    const reload = vi.fn();
    const roto = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } };
    expect(reloadOnceForNewVersion({ storage: roto, now: 1000, reload })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('UT-PWA-R4: el aviso de Vite (vite:preloadError) recarga y evita que el error llegue a la pantalla', () => {
    const target = new EventTarget();
    installChunkReloadHandler(target);
    const evento = new Event('vite:preloadError', { cancelable: true });
    target.dispatchEvent(evento);
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(evento.defaultPrevented).toBe(true);
  });

  it('UT-PWA-R5: si el error llega a la pantalla, ErrorBoundary recarga una vez sola; con otro error, no', () => {
    const Falla = ({ error }) => {
      throw error;
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(
      <ErrorBoundary>
        <Falla error={new TypeError('Failed to fetch dynamically imported module: /assets/MapPage-abc.js')} />
      </ErrorBoundary>
    );
    expect(recargar).toHaveBeenCalledTimes(1);
    unmount();
    recargar.mockClear();
    sessionStorage.clear();
    render(
      <ErrorBoundary>
        <Falla error={new Error('Cannot read properties of undefined')} />
      </ErrorBoundary>
    );
    expect(recargar).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /oops, hubo un problema/i })).toBeInTheDocument();
  });

  it('UT-PWA-R6: Vercel no responde index.html para archivos de /assets que no existen (da 404)', () => {
    const vercel = JSON.parse(readFileSync(resolve(__dirname, '../../vercel.json'), 'utf8'));
    const regla = vercel.rewrites.find((r) => r.destination === '/index.html');
    const fuente = new RegExp(`^${regla.source.replace('/(', '/(')}$`);
    expect(fuente.test('/mapa')).toBe(true);
    expect(fuente.test('/panel/reportes/abc')).toBe(true);
    expect(fuente.test('/assets/MapPage-abc.js')).toBe(false);
  });

  it('UT-PWA-R8: el service worker no guarda HTML como si fuera un .js o un .css', () => {
    const sw = readFileSync(resolve(__dirname, '../sw.js'), 'utf8');
    expect(sw).toMatch(/addPlugins\(\[/);
    expect(sw).toMatch(/cacheWillUpdate/);
    expect(sw).toMatch(/isAsset && isHtml \? null : response/);
    // El plugin se registra antes de precacheAndRoute
    expect(sw.indexOf('addPlugins([')).toBeLessThan(sw.indexOf('precacheAndRoute(self.__WB_MANIFEST'));
  });

  it('UT-PWA-R7: la app instala el manejo de recarga al arrancar', () => {
    const main = readFileSync(resolve(__dirname, '../main.jsx'), 'utf8');
    expect(main).toMatch(/import \{ installChunkReloadHandler \} from '\.\/lib\/chunkReload'/);
    expect(main).toMatch(/installChunkReloadHandler\(\)/);
  });
});
