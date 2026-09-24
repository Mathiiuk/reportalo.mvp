import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  THEME_TOGGLE_ENABLED,
  getStoredTheme,
  applyTheme,
  setThemePreference,
  initTheme,
} from '../lib/themePreference';

// H-09: el tema se guarda por dispositivo y arranca siempre en claro (UJ v3.3 §10)
describe('H-09: preferencia de tema en el dispositivo', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.classList.remove('dark');
  });

  it('UT-TEMA-01: sin nada guardado arranca en claro', () => {
    expect(getStoredTheme()).toBe('light');
  });

  it('UT-TEMA-02: guarda el oscuro y lo aplica en <html>', () => {
    expect(setThemePreference('dark')).toBe('dark');
    expect(getStoredTheme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('UT-TEMA-03: volver a claro saca la clase y queda guardado', () => {
    setThemePreference('dark');
    setThemePreference('light');
    expect(getStoredTheme()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('UT-TEMA-04: un valor desconocido cuenta como claro', () => {
    window.localStorage.setItem('reportalo_theme', 'sepia');
    expect(getStoredTheme()).toBe('light');
    expect(setThemePreference('sepia')).toBe('light');
  });

  it('UT-TEMA-05: si el almacenamiento falla, igual aplica el tema y no rompe', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => setThemePreference('dark')).not.toThrow();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(getStoredTheme()).toBe('light');
  });

  it('UT-TEMA-06: applyTheme solo pone o saca la clase dark', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('UT-TEMA-07: con el conmutador apagado, el arranque queda en claro aunque haya un oscuro guardado', () => {
    expect(THEME_TOGGLE_ENABLED).toBe(false);
    window.localStorage.setItem('reportalo_theme', 'dark');
    document.documentElement.classList.add('dark');
    initTheme();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
