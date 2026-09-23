import { describe, it, expect } from 'vitest';
import {
  QUARANTINE_MAX_AGE_MS,
  selectExpiredPaths,
} from '../../supabase/functions/quarantine-purge/purge';

// REP-2501: la foto original no puede quedar guardada en el backend. Si el cliente
// la sube a cuarentena y nunca invoca la función, esta purga la elimina.
describe('REP-2501: selectExpiredPaths', () => {
  const now = Date.parse('2026-09-23T12:00:00Z');
  const minutesAgo = (minutes) => new Date(now - minutes * 60 * 1000).toISOString();

  it('UT-PUR-01: la ventana de cuarentena es de 1 hora', () => {
    expect(QUARANTINE_MAX_AGE_MS).toBe(60 * 60 * 1000);
  });

  it('UT-PUR-02: elige solo lo que superó la ventana', () => {
    const objects = [
      { name: 'u1/vieja.jpg', created_at: minutesAgo(61) },
      { name: 'u1/justo.jpg', created_at: minutesAgo(60) },
      { name: 'u1/reciente.jpg', created_at: minutesAgo(5) },
    ];
    expect(selectExpiredPaths(objects, now)).toEqual(['u1/vieja.jpg', 'u1/justo.jpg']);
  });

  it('UT-PUR-03: ignora carpetas y objetos sin fecha (no se puede saber si vencieron)', () => {
    const objects = [
      { name: 'u1', created_at: null },
      { name: 'u1/sin-fecha.jpg' },
      { name: 'u1/vieja.jpg', created_at: minutesAgo(600) },
    ];
    expect(selectExpiredPaths(objects, now)).toEqual(['u1/vieja.jpg']);
  });

  it('UT-PUR-04: ignora fechas inválidas', () => {
    expect(selectExpiredPaths([{ name: 'a.jpg', created_at: 'no-es-fecha' }], now)).toEqual([]);
  });

  it('UT-PUR-05: lista vacía devuelve vacío', () => {
    expect(selectExpiredPaths([], now)).toEqual([]);
  });
});
