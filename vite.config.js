import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Configuración de Vite para Reportalo MVP
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',
      injectRegister: false,
      pwaAssets: { disabled: true },
      manifest: false,
      injectManifest: {
        // woff2: la fuente Manrope se sirve desde la app y tiene que abrir sin red
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        maximumFileSizeToCacheInBytes: 5000000,
      },
    })
  ],
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
    // El limite por defecto de vitest son 5 s. Las suites que montan MapLibre en
    // jsdom (OfflineReportFlow, LocationFlow, AdjustLocationModal) quedaban justo
    // en el borde: con la maquina cargada daban rojos intermitentes que no eran
    // del codigo. Verificado el 21/09/2026 apartando el cambio bajo prueba y
    // viendo que la suite igual fallaba. 30 s no oculta un test lento de verdad
    // y evita que el CI (H-07) empiece a fallar sin causa.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
