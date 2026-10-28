/**
 * @file Rep3843GeocodingService.test.js
 * @description REP-3843: el frontend pide la dirección al proxy y, ante cualquier problema, sigue sin ella.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { functions: { invoke: (...args) => invokeMock(...args) } },
}));

import { suggestAddress, formatAddress, ADDRESS_UNAVAILABLE } from '../services/geocodingService';

describe('REP-3843 · geocodingService', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('UT-3843-S1: pide la dirección al proxy con las coordenadas y la devuelve', async () => {
    invokeMock.mockResolvedValue({ data: { address: { street: 'Jean Jaures', number: null, roadType: 'secundaria' } }, error: null });
    const res = await suggestAddress({ lat: -34.6083, lng: -58.4106 });
    expect(invokeMock).toHaveBeenCalledWith('geocodificar-direccion', { body: { lat: -34.6083, lng: -58.4106 } });
    expect(res).toEqual({ street: 'Jean Jaures', number: null, roadType: 'secundaria' });
  });

  it('UT-3843-S2: error del proxy o respuesta sin dirección → null', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await suggestAddress({ lat: -34.6, lng: -58.4 })).toBeNull();
    invokeMock.mockResolvedValue({ data: { address: null }, error: null });
    expect(await suggestAddress({ lat: -34.6, lng: -58.4 })).toBeNull();
  });

  it('UT-3843-S3: sin conexión no consulta y devuelve null', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    expect(await suggestAddress({ lat: -34.6, lng: -58.4 })).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('UT-3843-S4: si tarda más que el límite, sigue sin dirección', async () => {
    vi.useFakeTimers();
    invokeMock.mockReturnValue(new Promise(() => {}));
    const pendiente = suggestAddress({ lat: -34.6, lng: -58.4 });
    await vi.advanceTimersByTimeAsync(4100);
    expect(await pendiente).toBeNull();
    vi.useRealTimers();
  });

  it('UT-3843-S5: formato para mostrar, con altura opcional y sin dirección', () => {
    expect(formatAddress({ street: 'Avenida Bartolomé Mitre', number: '745' })).toBe('Avenida Bartolomé Mitre 745');
    expect(formatAddress({ street: 'Jean Jaures', number: null })).toBe('Jean Jaures');
    expect(formatAddress({ street: 'Jean Jaures', number: '1200' }, { withNumber: false })).toBe('Jean Jaures');
    expect(formatAddress(null)).toBe(ADDRESS_UNAVAILABLE);
    expect(ADDRESS_UNAVAILABLE).toBe('Dirección no disponible');
  });
});
