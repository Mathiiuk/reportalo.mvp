# Specification — REP-ANDROID-TWA

## 1. Objetivo

Publicar Reportalo en Google Play como app Android. iPhone sigue con la PWA instalable.

## 2. Problema actual

La app solo existe como PWA. En Android hay usuarios que buscan la app en Play Store y no la encuentran.

## 3. Resultado esperado

Un AAB firmado (`ar.com.reportalo.app`) que abre la PWA de staging a pantalla completa (sin barra de URL) y se sube al track de prueba interna de Play Console.

## 4. Alcance

### Incluido

- Íconos PNG reales (192, 512, 512 maskable) en el manifest y el ícono de 512 para la ficha de Play.
- `/.well-known/assetlinks.json` con la huella de la upload key (Digital Asset Links).
- Proyecto Android generado con Bubblewrap (`android/twa`) y scripts de build local firmado.
- Workflow de GitHub Actions que compila y firma el AAB con el keystore en secrets.
- Guía paso a paso para Play Console (`docs/android/PLAY_STORE.md`).

### No incluido

- Capacitor o plugins nativos: la TWA corre en Chrome y conserva Service Worker, Web Push, OAuth de Google y magic link sin cambios.
- Ambiente de producción: esta versión apunta a `reportalo-staging.vercel.app`.
- Alta de la cuenta de Play Console, ficha, capturas y política de privacidad (las hace una persona).

## 5. Criterios de aceptación

- [ ] AC-01: Cada ícono del manifest es un PNG que mide lo que declara; hay 192/512 `any` y 512 `maskable`.
- [ ] AC-02: `assetlinks.json` delega `handle_all_urls` a `ar.com.reportalo.app` con huellas SHA-256 válidas y queda en `dist` tras `pnpm build`.
- [ ] AC-03: `android/twa/twa-manifest.json` usa el mismo paquete, host de staging e íconos del manifest web.
- [ ] AC-04: `pnpm android:build` genera un AAB y un APK firmados con la upload key.
- [ ] AC-05: El workflow de CI compila y firma el AAB y lo publica como artifact.

## 6. Restricciones

- El keystore y sus contraseñas nunca entran al repo (`~/.reportalo-android/` local, secrets en CI).
- El `applicationId` no se puede cambiar una vez publicado.

## 7. Dependencias

- JDK 17 y Android SDK (build-tools 35, platform 35).
- `@bubblewrap/core` solo como herramienta de generación (devDependency).

## 8. Riesgos

- Si la huella de Play App Signing no se agrega a `assetlinks.json`, la app instalada desde Play abre con barra de URL.
- Al pasar a producción cambia el host: hay que regenerar el proyecto y publicar `assetlinks.json` en el dominio nuevo.

## 9. Impacto

### Frontend
Manifest e íconos nuevos; también mejoran la instalación de la PWA.
### Backend
Ninguno.
### Database
Ninguno.
### Infraestructura
Nuevo workflow de CI y archivo estático `/.well-known/assetlinks.json` en Vercel.
### Seguridad
Upload key fuera del repo; Play App Signing custodia la clave de distribución.

## 10. Preguntas / incertidumbres

- Logo en alta resolución o vector para el ícono final (hoy se reescala desde 257x322).

## 11. Trazabilidad

Manifest: `.agents/workflow/tasks/REP-ANDROID-TWA.yml` · Bitácora: `docs/bitacora/REP-ANDROID-TWA.md`
