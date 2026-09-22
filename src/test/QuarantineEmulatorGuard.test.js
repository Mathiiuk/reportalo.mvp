/**
 * @file QuarantineEmulatorGuard.test.js
 * @description H-30: el emulador local nunca debe correr fuera de DEV o de tests.
 *
 * El emulador limpia el EXIF pero NO difumina: no detecta caras ni patentes e
 * informa un conteo de zonas fijo. Devolvia success: true sobre una foto sin
 * anonimizar, y por ese camino podia terminar publicada en el bucket publico.
 *
 * El caso peligroso era un build de produccion con Supabase sin configurar:
 * shouldInvokeSupabaseBackend() daba falso y la ejecucion caia en el emulador.
 *
 * Nota: Vite reemplaza `import.meta.env.DEV` por un literal al compilar, asi que
 * no se puede simular produccion mutando el entorno. Por eso el servicio expone
 * `allowLocalEmulator`, que por defecto sale del entorno y solo estos tests pasan
 * de forma explicita.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) },
    functions: { invoke: vi.fn() },
  },
  isSupabaseConfigured: false,
}));

import { processEvidenceThroughQuarantine } from '../services/quarantinePipelineService';

const buildFile = () => new File(['bytes-de-la-foto'], 'foto.jpg', { type: 'image/jpeg' });

describe('REP-3787 H-30: el emulador de cuarentena no corre fuera de DEV', () => {
  it('UT-EMU-01: sin el emulador permitido corta con fail-safe en vez de emular', async () => {
    const result = await processEvidenceThroughQuarantine({
      file: buildFile(),
      clientSideId: 'cliente-1',
      allowLocalEmulator: false,
    });

    expect(result.success).toBe(false);
    expect(result.failSafeTriggered).toBe(true);
    // Lo que importa: no devuelve la URL de una foto sin difuminar.
    expect(result.sanitizedUrl).toBeUndefined();
  });

  it('UT-EMU-02: en desarrollo el emulador sigue disponible para no bloquear a quien programa', async () => {
    const result = await processEvidenceThroughQuarantine({
      file: buildFile(),
      clientSideId: 'cliente-2',
      allowLocalEmulator: true,
    });

    expect(result.success).toBe(true);
    expect(result.sanitizedUrl).toBeDefined();
  });

  it('UT-EMU-03: por defecto la decision sale del entorno, no de quien llama', async () => {
    // Sin pasar la bandera, bajo el runner de tests el emulador esta permitido.
    const result = await processEvidenceThroughQuarantine({
      file: buildFile(),
      clientSideId: 'cliente-3',
    });

    expect(result.success).toBe(true);
  });
});
