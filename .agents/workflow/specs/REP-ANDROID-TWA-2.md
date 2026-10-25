# Specification — REP-ANDROID-TWA-2

Fase 2 de `REP-ANDROID-TWA` (spec general: `.agents/workflow/specs/REP-ANDROID-TWA.md`).

## Objetivo
Proyecto Android TWA generado con Bubblewrap y build local firmado.

## Criterios de aceptación
- [x] AC-03: `android/twa/twa-manifest.json` con paquete `ar.com.reportalo.app`, host de staging, íconos del manifest web y colores del manifest.
- [x] AC-04: `pnpm android:build` regenera el proyecto y produce `app-release-bundle.aab` y `app-release-signed.apk` firmados con la upload key.
