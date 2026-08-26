import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuración de Vite para Reportalo MVP
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    hmr: {
      clientPort: 3000,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
  },
});
