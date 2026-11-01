# Ejecución — REP-ANDROID-TWA · App Android (TWA) para Play Store

**Estado:** READY_FOR_PR · **Rama:** `feat/REP-ANDROID-TWA-app-android-para-play-store-como-twa-bubblewrap` (base `staging`)
**Bitácora de fases:** `docs/bitacora/REP-ANDROID-TWA.md` · **Guía:** `docs/android/PLAY_STORE.md`

## Decisión

TWA (Bubblewrap) en lugar de Capacitor: la PWA corre en Chrome, así que Service Worker,
Web Push, login con Google (Google bloquea OAuth en WebView) y magic link siguen
funcionando sin tocar código. iPhone sigue con la PWA instalable.

## Fases

| Fase | Resultado |
|---|---|
| REP-ANDROID-TWA-1 · Íconos PNG, manifest, assetlinks | ✔ |
| REP-ANDROID-TWA-2 · Proyecto TWA + build firmado | ✔ (minSdk 21→24 por androidbrowserhelper 2.7.4) |
| REP-ANDROID-TWA-3 · Workflow de CI | ✔ |
| Healthcheck (`pnpm test`, `pnpm build`) | ✔ |

## Evidencia

- `src/test/AndroidTwaConfig.test.js`: 10 tests (UT-TWA-01 a 09 + minSdk).
- `pnpm android:build`: `BUILD SUCCESSFUL`, AAB y APK firmados con
  `91:31:A7:DF:…:54:F3`, la misma huella publicada en `assetlinks.json`.
- `aapt2 dump badging`: `ar.com.reportalo.app` 1.0.0 (1), target/compile SDK 36, POST_NOTIFICATIONS.

## Pendiente (fuera del alcance del agente)

- Probar el APK en un teléfono Android después de deployar esta rama a staging.
- Cargar los secrets del workflow y correrlo una vez en GitHub.
- Play Console: cuenta, app, prueba interna y agregar la huella de App Signing a `assetlinks.json`.
- Logo en alta resolución para el ícono final.
