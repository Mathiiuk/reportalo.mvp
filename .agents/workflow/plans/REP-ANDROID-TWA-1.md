# Implementation Plan — REP-ANDROID-TWA-1

Ver spec `.agents/workflow/specs/REP-ANDROID-TWA-1.md` y bitácora `docs/bitacora/REP-ANDROID-TWA.md`.

- Stack: Vite 6 + React 18 PWA (vite-plugin-pwa injectManifest), TWA con Bubblewrap 1.27, JDK 17, Android SDK 35.
- Branch base: staging.
- Tests: `src/test/AndroidTwaConfig.test.js` (Vitest) + `pnpm build`.
