/**
 * @file Rep3827TandaAbandonadaYReintentoDeSubida.test.jsx
 * @description REP-3827 (D7): dos correcciones acotadas del tramo previo al alta.
 *   A. Cuando la pantalla de procesamiento se rinde (el reporte pasa a la cola) o se cierra, la tanda en
 *      vuelo deja de procesar fotos: antes seguía subiendo, anonimizando y guardando copias protegidas que
 *      ningún reporte usaba, y la cola volvía a procesarlo todo.
 *   B. La subida a cuarentena reintenta (2 veces) ante errores transitorios como un 520, y no ante un 4xx.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';

const BUCKET = 'evidence-quarantine';

/** Carga el servicio con un cliente de Supabase mockeado (mismo patrón que QuarantinePipelineService.test.js). */
const cargarServicio = async ({ upload, remove = vi.fn().mockResolvedValue({ data: {}, error: null }), invoke = vi.fn() }) => {
  vi.resetModules();
  vi.doMock('../lib/supabaseClient', () => ({
    isSupabaseConfigured: true,
    supabase: {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-3827' } } } }) },
      storage: { from: vi.fn(() => ({ upload, remove })) },
      functions: { invoke },
    },
  }));
  return import('../services/quarantinePipelineService');
};

const foto = (nombre = 'foto.jpg') => new File(['mock-img'], nombre, { type: 'image/jpeg' });
const exitoUpload = { data: { path: 'user-3827/temp.jpg' }, error: null };
const errorHttp = (status) => ({ data: null, error: { message: `HTTP ${status}`, status, statusCode: String(status) } });
const exitoFuncion = {
  data: { success: true, sanitizedUrl: 'https://x.supabase.co/storage/v1/object/public/report-evidences/a_sanitized.jpg', clientSideId: 'c', entitiesDetectedCount: 0 },
  error: null,
};

afterEach(() => {
  cleanup();
  vi.doUnmock('../lib/supabaseClient');
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('REP-3827 B: isTransientUploadError', () => {
  it('UT-3827-01: 5xx (incluido el 520 de Cloudflare), 408, 429 y los cortes de red son transitorios', async () => {
    const { isTransientUploadError } = await cargarServicio({ upload: vi.fn() });
    expect(isTransientUploadError({ status: 520 })).toBe(true);
    expect(isTransientUploadError({ status: 503 })).toBe(true);
    expect(isTransientUploadError({ statusCode: '520' })).toBe(true); // supabase-js trae el código como texto
    expect(isTransientUploadError({ status: 408 })).toBe(true);
    expect(isTransientUploadError({ status: 429 })).toBe(true);
    expect(isTransientUploadError({ message: 'Failed to fetch' })).toBe(true); // sin respuesta HTTP
  });

  it('UT-3827-02: los 4xx (sesión, política de Storage, archivo inválido) no se reintentan', async () => {
    const { isTransientUploadError } = await cargarServicio({ upload: vi.fn() });
    [400, 401, 403, 404, 409, 413].forEach((status) => {
      expect(isTransientUploadError({ status })).toBe(false);
    });
  });
});

describe('REP-3827 B: reintento acotado de la subida a cuarentena', () => {
  it('UT-3827-03: dos 520 seguidos y luego éxito → la subida termina bien, con 3 llamadas y las esperas acordadas', async () => {
    const upload = vi.fn()
      .mockResolvedValueOnce(errorHttp(520))
      .mockResolvedValueOnce(errorHttp(520))
      .mockResolvedValueOnce(exitoUpload);
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const servicio = await cargarServicio({ upload });

    const result = await servicio.uploadToQuarantine(foto(), 'c-3827', {
      retryDelaysMs: servicio.UPLOAD_RETRY_DELAYS_MS,
      sleepFn,
    });

    expect(result.success).toBe(true);
    expect(upload).toHaveBeenCalledTimes(3);
    expect(sleepFn.mock.calls.map(([ms]) => ms)).toEqual([800, 2000]);
    // Todos los intentos usan el MISMO nombre de archivo
    const rutas = upload.mock.calls.map(([ruta]) => ruta);
    expect(new Set(rutas).size).toBe(1);
  });

  it('UT-3827-04: si el 520 persiste, se rinde a los 3 intentos con el mensaje de siempre', async () => {
    const upload = vi.fn().mockResolvedValue(errorHttp(520));
    const servicio = await cargarServicio({ upload });

    const result = await servicio.uploadToQuarantine(foto(), 'c-3827', { sleepFn: vi.fn().mockResolvedValue(undefined) });

    expect(upload).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Fallo al subir a cuarentena/);
  });

  it('UT-3827-05: un 403 (política de Storage) no se reintenta', async () => {
    const upload = vi.fn().mockResolvedValue(errorHttp(403));
    const sleepFn = vi.fn();
    const servicio = await cargarServicio({ upload });

    const result = await servicio.uploadToQuarantine(foto(), 'c-3827', { sleepFn });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(sleepFn).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it('UT-3827-06: si el primer intento sí se guardó y solo se perdió la respuesta, el 409 del reintento cuenta como éxito', async () => {
    const upload = vi.fn()
      .mockResolvedValueOnce(errorHttp(520))
      .mockResolvedValueOnce(errorHttp(409));
    const servicio = await cargarServicio({ upload });

    const result = await servicio.uploadToQuarantine(foto(), 'c-3827', { sleepFn: vi.fn().mockResolvedValue(undefined) });

    expect(result.success).toBe(true);
    expect(result.quarantinePath).toMatch(/^user-3827\/temp_c-3827_\d+\./);
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('UT-3827-07: un 409 en el PRIMER intento es un fallo normal (no se confunde con un reintento)', async () => {
    const upload = vi.fn().mockResolvedValue(errorHttp(409));
    const servicio = await cargarServicio({ upload });

    const result = await servicio.uploadToQuarantine(foto(), 'c-3827', { sleepFn: vi.fn() });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
  });

  it('UT-3827-08: una excepción de red también se reintenta', async () => {
    const upload = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(exitoUpload);
    const servicio = await cargarServicio({ upload });

    const result = await servicio.uploadToQuarantine(foto(), 'c-3827', { sleepFn: vi.fn().mockResolvedValue(undefined) });

    expect(result.success).toBe(true);
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('UT-3827-09: si la tanda se abandonó, no se sigue reintentando', async () => {
    const upload = vi.fn().mockResolvedValue(errorHttp(520));
    const sleepFn = vi.fn();
    const servicio = await cargarServicio({ upload });

    const result = await servicio.uploadToQuarantine(foto(), 'c-3827', { sleepFn, shouldAbort: () => true });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(sleepFn).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it('UT-3827-10: el log del reintento no incluye datos de la foto ni del usuario', async () => {
    const upload = vi.fn().mockResolvedValueOnce(errorHttp(520)).mockResolvedValueOnce(exitoUpload);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const servicio = await cargarServicio({ upload });

    await servicio.uploadToQuarantine(foto('privada.jpg'), 'c-3827', { sleepFn: vi.fn().mockResolvedValue(undefined) });

    const mensajes = warn.mock.calls.map((args) => args.join(' ')).join('\n');
    expect(mensajes).toMatch(/intento 1 de 3, HTTP 520/);
    expect(mensajes).not.toMatch(/privada\.jpg|user-3827|c-3827/);
  });
});

describe('REP-3827 A: la tanda abandonada deja de procesar', () => {
  it('UT-3827-11: si se abandona después de la primera foto, las demás no se suben ni se anonimizan', async () => {
    const upload = vi.fn().mockResolvedValue(exitoUpload);
    const invoke = vi.fn().mockResolvedValue(exitoFuncion);
    const servicio = await cargarServicio({ upload, invoke });
    let abandonada = false;
    invoke.mockImplementation(async () => {
      abandonada = true; // la pantalla se rinde mientras se anonimiza la foto 1
      return exitoFuncion;
    });

    const result = await servicio.processAllEvidencesThroughQuarantine({
      evidenceList: [1, 2, 3, 4].map((n) => ({ id: `e${n}`, file: foto(`f${n}.jpg`) })),
      clientSideId: 'c-3827',
      shouldAbort: () => abandonada,
    });

    expect(result.success).toBe(false);
    expect(result.aborted).toBe(true);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('UT-3827-12: si se abandona durante la subida, se purga la original y NO se invoca la anonimización', async () => {
    let abandonada = false;
    const upload = vi.fn().mockImplementation(async () => {
      abandonada = true;
      return exitoUpload;
    });
    const remove = vi.fn().mockResolvedValue({ data: {}, error: null });
    const invoke = vi.fn().mockResolvedValue(exitoFuncion);
    const servicio = await cargarServicio({ upload, remove, invoke });

    const result = await servicio.processEvidenceThroughQuarantine({
      file: foto(),
      clientSideId: 'c-3827',
      shouldAbort: () => abandonada,
    });

    expect(result.aborted).toBe(true);
    expect(remove).toHaveBeenCalledWith(['user-3827/temp.jpg']);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('UT-3827-13: sin abandono, todo sigue igual (4 fotos, 4 subidas, 4 anonimizaciones)', async () => {
    const upload = vi.fn().mockResolvedValue(exitoUpload);
    const invoke = vi.fn().mockResolvedValue(exitoFuncion);
    const servicio = await cargarServicio({ upload, invoke });

    const result = await servicio.processAllEvidencesThroughQuarantine({
      evidenceList: [1, 2, 3, 4].map((n) => ({ id: `e${n}`, file: foto(`f${n}.jpg`) })),
      clientSideId: 'c-3827',
    });

    expect(result.success).toBe(true);
    expect(upload).toHaveBeenCalledTimes(4);
    expect(invoke).toHaveBeenCalledTimes(4);
  });

  it('UT-3827-14: un corte por abandono no se presenta como un fallo de protección', async () => {
    const servicio = await cargarServicio({ upload: vi.fn().mockResolvedValue(exitoUpload) });

    const result = await servicio.processAllEvidencesThroughQuarantine({
      evidenceList: [{ id: 'e1', file: foto() }],
      clientSideId: 'c-3827',
      shouldAbort: () => true,
    });

    expect(result).toMatchObject({ success: false, aborted: true, reason: 'aborted' });
  });
});

describe('REP-3827 A: la pantalla de procesamiento cancela la tanda', () => {
  const cargarPantalla = async () => {
    vi.resetModules();
    return (await import('../components/report/ReportProcessingScreen')).ReportProcessingScreen;
  };

  it('UT-3827-15: al vencer la espera y pasar a la cola, la tanda en vuelo recibe la orden de cortar', async () => {
    const ReportProcessingScreen = await cargarPantalla();
    let shouldAbort;
    const onSaveForLater = vi.fn();
    render(
      <ReportProcessingScreen
        evidenceList={[{ previewUrl: 'blob:foto' }]}
        processFn={(args) => {
          shouldAbort = args.shouldAbort;
          return new Promise(() => {});
        }}
        durationMs={50}
        timeoutMs={200}
        onSaveForLater={onSaveForLater}
        onProcessingComplete={vi.fn()}
      />
    );

    await waitFor(() => expect(shouldAbort).toBeTypeOf('function'));
    expect(shouldAbort()).toBe(false); // mientras la espera no venza, sigue procesando
    await waitFor(() => expect(onSaveForLater).toHaveBeenCalledTimes(1), { timeout: 1000 });
    expect(shouldAbort()).toBe(true);
  });

  it('UT-3827-16: al cerrar la pantalla, la tanda en vuelo recibe la orden de cortar', async () => {
    const ReportProcessingScreen = await cargarPantalla();
    let shouldAbort;
    const { unmount } = render(
      <ReportProcessingScreen
        evidenceList={[{ previewUrl: 'blob:foto' }]}
        processFn={(args) => {
          shouldAbort = args.shouldAbort;
          return new Promise(() => {});
        }}
        durationMs={50}
        timeoutMs={0}
        onProcessingComplete={vi.fn()}
      />
    );

    await waitFor(() => expect(shouldAbort).toBeTypeOf('function'));
    expect(shouldAbort()).toBe(false);
    unmount();
    expect(shouldAbort()).toBe(true);
  });

  it('UT-3827-17: un resultado exitoso que llega a tiempo sigue avanzando (sin regresión)', async () => {
    const ReportProcessingScreen = await cargarPantalla();
    const onProcessingComplete = vi.fn();
    render(
      <ReportProcessingScreen
        evidenceList={[{ previewUrl: 'blob:foto' }]}
        processFn={() => Promise.resolve({ success: true, processedEvidences: [{ id: 'e1' }] })}
        durationMs={50}
        timeoutMs={5000}
        onSaveForLater={vi.fn()}
        onProcessingComplete={onProcessingComplete}
      />
    );

    await waitFor(() => expect(onProcessingComplete).toHaveBeenCalledTimes(1), { timeout: 1000 });
  });
});
