import '@testing-library/jest-dom';
import { vi } from 'vitest';
// Importación de fake-indexeddb para emular IndexedDB en el entorno jsdom de pruebas
import 'fake-indexeddb/auto';
import { configure } from '@testing-library/react';

// Testing Library espera solo 1 s por defecto en waitFor / findBy*, y ese límite es independiente
// de testTimeout (vite.config.js). Con la CPU saturada (varios archivos en paralelo, el CI, una
// máquina ocupada) pasos que andan bien tardan más: medido el 23/09/2026 sobrecargando la máquina,
// la restauración del borrador de UT-OFF-FLOW-01 tardó 477, 536, 1006 y 1267 ms (normalmente ~350),
// y en una de cada cinco suites completas el test fallaba con «Unable to find an element».
// No es una carrera de lógica: 5 s deja margen sin ocultar un test que de verdad no llega.
configure({ asyncUtilTimeout: 5000 });

// Polyfills o mocks globales para el entorno de prueba jsdom
if (typeof window !== 'undefined') {
  // Mock de replaceState para pruebas de sanitización de URL
  if (!window.history.replaceState) {
    window.history.replaceState = vi.fn();
  }
}

