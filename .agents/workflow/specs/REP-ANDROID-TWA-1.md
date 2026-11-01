# Specification — REP-ANDROID-TWA-1

Fase 1 de `REP-ANDROID-TWA` (spec general: `.agents/workflow/specs/REP-ANDROID-TWA.md`).

## Objetivo
Que el manifest web y el Digital Asset Links cumplan lo que exige una TWA.

## Criterios de aceptación
- [x] AC-01: íconos PNG 192/512 `any` y 512 `maskable` que miden lo que declaran (UT-TWA-01, UT-TWA-02).
- [x] AC-01b: ícono 512x512 para la ficha de Play en `android/store/` (UT-TWA-03).
- [x] AC-02: `public/.well-known/assetlinks.json` con `ar.com.reportalo.app` y huella SHA-256 de la upload key (UT-TWA-04).
