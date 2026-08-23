import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuración de Vite para Reportalo V2
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
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['**/node_modules/**', '**/.agents/**', '**/dist/**'],
    css: false,
  },
});
