# Specification — REP-ANDROID-TWA-3

Fase 3 de `REP-ANDROID-TWA` (spec general: `.agents/workflow/specs/REP-ANDROID-TWA.md`).

## Objetivo
Compilar y firmar el AAB en GitHub Actions sin depender de una PC.

## Criterios de aceptación
- [x] AC-05: `.github/workflows/android-twa.yml` (manual + cambios en `android/twa`) decodifica el keystore desde secrets, compila con JDK 17 y sube el AAB/APK como artifact.
- [x] AC-05b: el workflow no imprime ni persiste contraseñas y borra el keystore al terminar.
