import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Polyfills o mocks globales para el entorno de prueba jsdom
if (typeof window !== 'undefined') {
  // Mock de replaceState para pruebas de sanitización de URL
  if (!window.history.replaceState) {
    window.history.replaceState = vi.fn();
  }
}
