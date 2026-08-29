import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuración de Vite para Reportalo MVP
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
    // Definir ámbito de tests en la carpeta src para no incluir archivos de skills internas
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.agents'],
  },
});
