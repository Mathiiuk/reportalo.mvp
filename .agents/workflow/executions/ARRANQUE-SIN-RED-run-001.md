# Reporte de Ejecución: ARRANQUE-SIN-RED-run-001

## Identificación
- **Tarea**: Abrir la app y reportar con poca señal (sesión guardada, arranque sin red, envío a la cola)
- **Rama**: `fix/arranque-sin-red-sesion-y-reporte-local` (desde `staging` @ `e0be0e2`)
- **Fecha**: 2026-09-24
- **Estado**: Exitoso — Vitest y build en verde. Sin ticket Jira asignado todavía.

---

## 1. Problema

Video de Matías (iPhone, 4G débil, 24/09 07:29): al abrir la PWA quedaban **~12 s de pantalla negra** y la app entera (no solo el mapa) aparecía de golpe a los ~16 s. Se encontraron tres causas encadenadas:

1. **Primer pintado bloqueado por Google Fonts.** `index.html` cargaba dos hojas de `fonts.googleapis.com` que el navegador marca como `render-blocking`. El service worker precachea el HTML/JS/CSS propios (72 archivos) pero nada externo, así que con poca señal nada se dibujaba hasta que Google respondía. Una de las dos (Material Symbols) ya no se usaba desde REP-ICONS-SWEEP.
2. **La sesión esperaba a la red.** `supabase.auth.getSession()` renueva el token vencido (dura 1 h) antes de responder: con señal lenta, «Cargando...» indefinido. Peor aún, **sin** señal auth-js conserva la sesión en el almacenamiento pero emite `INITIAL_SESSION` con `null`, y `AuthContext` lo tomaba como cierre de sesión → «Tu sesión venció».
3. **El envío con señal débil no caía a la cola.** El teléfono sigue «online», así que el reporte iba al pipeline de cuarentena y a `createCitizenReport` sin límite de espera. La cola de pendientes solo reintentaba al abrir la app o al pasar de offline a online, cosa que con señal débil nunca ocurre.

## 2. Cambios

| Archivo | Cambio |
|---|---|
| `index.html`, `src/main.jsx`, `src/index.css`, `tailwind.config.js`, `NotFoundReportPage.jsx` | Manrope servida desde la app (`@fontsource-variable/manrope`); se quitaron Google Fonts y la clase huérfana `.material-symbols-rounded`. |
| `vite.config.js` | El SW precachea también `woff2`. |
| `src/lib/storedSession.js` (nuevo) | Lectura síncrona de la sesión que dejó supabase-js (clave `supabase.auth.storageKey`). |
| `src/context/AuthContext.jsx` | Arranca con la sesión guardada (`loading=false` sin esperar red). Un `null` de auth-js con la sesión todavía guardada no desloguea; `SIGNED_OUT` o sesión borrada por auth-js (refresh token rechazado) sí. |
| `src/App.jsx` | Con sesión guardada precarga las pantallas de mapa y nuevo reporte. |
| `src/pages/NewReportPage.jsx` | `saveForLaterAndExit()` único para la cola. La categoría y el alta tienen 20 s de espera máxima; timeout o error de red → cola de pendientes y vuelta al mapa. La aceptación de términos ya no espera el insert remoto (queda guardada local al instante). |
| `src/components/report/ReportProcessingScreen.jsx` | `timeoutMs` (45 s) + `onSaveForLater`: si la protección de fotos no termina, el reporte pasa a la cola; un resultado tardío se ignora. En la vista de error, botón «Guardar y enviar cuando haya señal». |
| `src/components/common/PendingSyncManager.jsx` | Reintento cada 60 s mientras queden pendientes, al volver a la app (`visibilitychange`) y al entrar un reporte nuevo a la cola (`PENDING_QUEUED_EVENT`). |
| `src/services/reportSubmissionService.js` | Se exporta `isNetworkFailure`. |

Seguridad: la sesión optimista solo decide qué pantalla mostrar; cada pedido al servidor sigue validado por su token y RLS. Idempotencia: si un alta que venció por tiempo igual llega al servidor, `createCitizenReport` es idempotente por `client_side_id` y la cola recupera ese reporte y adjunta las fotos sin duplicarlas (`getAttachedEvidenceUrls`).

## 3. Evidencia de Quality Gates

- **Vitest**: `npx vitest run` → **61 archivos, 427 tests en verde** (415 previos + 12 nuevos en `src/test/ArranqueConPocaSenal.test.jsx`).
- **Tests contra el código viejo**: con el `AuthContext` anterior fallan UT-SENAL-03 y UT-SENAL-04, que reproducen el problema.
- **Build**: `pnpm build` limpio; precache 77 entradas (incluye los woff2 de Manrope).
- **Navegador (dev)**: sin recursos `render-blocking` ni pedidos a Google; `document.fonts.check('Manrope Variable')` = true.
- **Red lenta simulada** (`VITE_SUPABASE_URL` apuntando a una IP que no responde, sesión guardada vencida):
  - Código nuevo: entra a `/mapa` con «Reportar» visible y se mantiene ahí más de 10 s; `/nuevo-reporte` abre la cámara sin red.
  - Código viejo: `AppLoadingScreen` más de 11 s sin llegar nunca al mapa.
- `pnpm test:bdd` no existe en `package.json`; no se corrió.

## 4. Pendiente / riesgos

- No se probó en un iPhone real con la build de producción: conviene repetir el escenario del video tras el deploy de preview.
- Tras un timeout, la subida en curso no se cancela (no hay `AbortController` en el pipeline); la cola puede volver a subir las fotos. El huérfano en Storage lo limpia la purga de REP-2501.
- `attachReportEvidence` en el envío directo no tiene límite de espera propio (sí lo cubre el reintento de la cola).
- No hay test de integración de `NewReportPage` para el camino «timeout de alta → cola»; está cubierto el componente de procesamiento y el manager.
