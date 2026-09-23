# Reporte de Ejecución — REP-3787 · Bloque 4 (Sin conexión y errores del reporte)

- **Tarea:** REP-3787 · **Bloque:** 4 · **Pantallas:** M20 · M21 · M22 · M23
- **Tickets relacionados:** REP-2703 · REP-3107 (CP-OFF-09, CP-OFF-11, CP-OFF-21)
- **Rama:** `feat/REP-3787-uj33` · **Base:** `staging` en `542ec57`
- **Fecha:** 21/09/2026 · **Estado:** READY_FOR_PR

---

## 1. Este bloque agrega lógica, no capa visual

A diferencia de los anteriores, toca `AuthContext`, `App.jsx` y el envío real de la cola
offline. Archivos nuevos: `pendingSyncService.js`, `PendingSyncManager.jsx`,
`PendingReportsPage.jsx`, `SessionExpiredPage.jsx` y `sessionMarker.js`.

## 2. Aplicación

El parche falló en 2 de 12 archivos (`App.jsx` y `NewReportPage.jsx`). Se resolvió con el mismo
método del Bloque 3: el blob base faltante se reconstruyó desde la carpeta `archivos/` del
Bloque 3, cuyos hashes coinciden con el índice del parche (`a12004e` y `c4bc78c`). El resto
aplicó limpio con `--3way`.

### Conflictos resueltos

**`src/App.jsx`** — el parche arrastraba también los cambios de `App.jsx` del Bloque 3, que en
su momento se resolvieron distinto. Se tomó solo lo propio del Bloque 4: las rutas
`/pendientes` y `/sesion-vencida`, el montaje de `PendingSyncManager` y los cambios de
`ProtectedRoute`. Se descartó la ruta `/reporte/:id` que proponía el bloque, porque el detalle
ya tiene `/reportes/:id` desde REP-3789 y dos rutas a la misma pantalla es cruft.

**`src/pages/NewReportPage.jsx`** — el bloque reemplazaba la desestructuración de
`useGeolocation` por una que expone `status`, `isDenied` y `refreshLocation` para M22, pero
perdía `isGranted`, que REP-2500-PRESEL necesita para distinguir una lectura real de GPS del
valor por defecto. Se combinaron: el hook ya expone las cuatro cosas.

## 3. Corrección de privacidad conservada (H-25)

El bloque quita el respaldo `previewUrl` en el adjunto de evidencias. Verificado tras el merge:

```js
// H-25 (REP-3791 Bloque 4): nunca se usa previewUrl (la foto original sin difuminar) como respaldo
const sanitizedUrl = evidence.sanitizedUrl;
if (!sanitizedUrl) continue;
```

Importa porque el merge del Bloque 2 había dejado ahí `evidence.sanitizedUrl || evidence.previewUrl`,
y `attachReportEvidence` sube esa URL al bucket público. El respaldo significaba subir la foto
original sin difuminar cada vez que el pipeline no devolvía la versión protegida.

## 4. El hallazgo del bloque: la cola offline nunca se enviaba (H-29)

En staging, los reportes guardados sin conexión quedaban en IndexedDB como `PENDING_SYNC` y
**nunca se enviaban**. `getAllPendingSyncReports` existía pero ningún código lo llamaba,
mientras la interfaz le prometía al ciudadano «Se enviará automáticamente apenas recuperes
señal».

El bloque lo resuelve con `pendingSyncService` (recorre la cola de a uno, reutiliza los mismos
servicios del envío con conexión, es idempotente por `client_side_id`) y `PendingSyncManager`,
montado una vez en `App`, que dispara el envío al abrir la app con conexión y cada vez que
vuelve la conexión.

Los casos CP-OFF-09 y CP-OFF-11 de REP-3107 deberían estar fallando en staging hoy.

## 5. Quality Gates

| Gate | Comando | Resultado |
|---|---|---|
| Unit tests | `pnpm test` | **276 / 276 en verde** (40 archivos, a la primera corrida) |
| Build | `pnpm build` | **Compila.** PWA `injectManifest`, `dist/sw.js` |

La baseline sube de 270 a 276 por los 6 tests nuevos del bloque, que cubren entre otras cosas
el caso de privacidad: sin URL protegida del servidor no se envía nada y el borrador queda.

## 6. Observaciones abiertas, por prioridad

| ID | Observación | Responsable |
|---|---|---|
| **H-30** | **Privacidad, la más importante.** El pipeline tiene un camino «emulador» (cuando `uploadToQuarantine` devuelve `isFallback`, cuando `shouldInvokeSupabaseBackend()` es falso, o en DEV si falla la Edge Function) que **solo limpia EXIF, no difumina**, informa 2 zonas ficticias y devuelve éxito con una URL `blob:`. La cola offline ya rechaza esas URLs; **el envío con conexión todavía las adjunta**. Hay que asegurar que ese camino no pueda ocurrir fuera de DEV, o aplicar la misma regla de solo `http(s)` en `NewReportPage`. | Matías |
| **H-35** | `createCitizenReport` rechaza descripción vacía, pero M10 deja avanzar sin ella. Con conexión el envío falla al final con «Faltan datos obligatorios»; sin conexión el pendiente **no se puede enviar nunca** y queda trabado en la cola. Decisión: hacerla obligatoria en M10 (REP-2203) o aceptarla vacía en el servicio. | Hernán (PO) · Matías |
| H-34 | Si falla la subida de una foto a mitad de camino, el reintento vuelve a adjuntar todas (posibles duplicados). Tampoco se contempla el límite de 5 reportes por hora (RT-03, CP-OFF-21). | Matías |
| H-31 | M23 guarda en el dispositivo una marca «hubo sesión» con el email. Supabase ya guarda la sesión en el mismo almacenamiento; se documenta por transparencia. | Matías · Hernán (PO) |
| H-32 | M22 «Calle y altura» y direcciones recientes requieren geocodificación (relacionada con H-10). | Hernán (PO) · Matías |
| H-33 | M20 dibuja «Listo para enviar», estado que no existe en nuestro flujo: las fotos se protegen recién al enviar. | Iván (UX) · Hernán (PO) |

## 7. Qué revisar con más cuidado en el PR

1. `pendingSyncService.js` y `PendingSyncManager.jsx`: lógica nueva que corre sobre datos reales
   y dispara envíos solo.
2. Los cambios de `ProtectedRoute` y `AuthContext`: tocan el flujo de sesión de toda la app.
3. Que cerrar sesión a mano desde Perfil **no** muestre «Tu sesión venció».

## 8. Estado del sprint

Con los bloques 0, 1, 1-D, 2, 3 y 4 aplicados, **el recorrido del ciudadano del Sprint Goal
queda completo en código**: capturar, clasificar, revisar, aceptar términos, enviar, ver el
fundamento legal, y los caminos de error y sin conexión. Los bloques 5 en adelante son de
sprints posteriores.

---

*Reportalo · REP-3787 · Sprint 13 · Matías Krepchuk*
