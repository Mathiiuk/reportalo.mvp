# Reporte de Ejecución — REP-3787 · Bloque 6 (Mis reportes y Notificaciones)

- **Tarea:** REP-3787 · **Bloque:** 6 · **Pantallas:** M17 · M18 / D18 · D19
- **Rama:** `feat/REP-3787-uj33` · **Base declarada:** `3995cf3` + Bloque 5
- **Fecha:** 22/09/2026 · **Estado:** READY_FOR_PR

---

## 1. Aplicación

`git apply` limpio, sin offsets ni conflictos. Segundo bloque seguido sin fricción, con la base
declarada coincidiendo con la real. El commit `12c9c40` (alineación del seed) que la rama tenía
de más no toca ninguno de estos archivos.

| Archivo | Cambio |
|---|---|
| `src/pages/NotificationsPage.jsx` | Nuevo. Lista agrupada en Hoy, Esta semana y Antes. |
| `src/services/notificationsService.js` | Nuevo. Deriva los avisos de `report_state_history` y de los borradores en IndexedDB. Lo leído se guarda en el dispositivo. |
| `src/App.jsx` | Ruta protegida `/notificaciones`. |
| `src/components/layout/AppLayout.jsx` | La campana pasa a `/notificaciones`. |
| `src/pages/ReportsPage.jsx` | Capa visual nueva, filas en escritorio, borradores arriba. |
| `src/components/report/StatusPill.jsx` | Prop `short` para listas largas. |
| `src/test/Bloque6ReportesNotificacionesUJ33.test.jsx` | Nuevo. 5 tests. |

## 2. Quality Gates

| Gate | Comando | Resultado |
|---|---|---|
| Unit tests | `pnpm test` | **284 / 284 en verde** (42 archivos) |
| Build | `pnpm build` | **Compila.** PWA `injectManifest`, 64 entradas de precache |

El README del bloque reporta 282/284 por UT-QPS-14 y UT-QPS-15. Acá dan verde: **H-06 no existe
desde el 21/09**, lo corrigió el merge del PR #95. Es la segunda vez que el bloque lo reporta;
conviene que Ivo actualice su checkout de verificación.

## 3. H-24 resuelta, y a favor

El bloque depende de que el ciudadano pueda leer `report_state_history`: si RLS no lo permitiera,
la pantalla de Notificaciones quedaría solo con los avisos de borradores locales.

Consultado el catálogo de RLS de producción el 22/09/2026:

| Tabla | RLS | Policy de lectura |
|---|---|---|
| `report_state_history` | Activo | `read own or attended` — permite leer el historial de los reportes propios (`r.user_id = auth.uid()`) o de los que el perfil atiende |
| `citizen_reports` | Activo | `lectura_publica` — lectura abierta (`true`) |

**La pantalla va a funcionar.** H-24 puede cerrarse.

De paso queda confirmado que `citizen_reports` es de lectura pública, que es exactamente por lo
que la guarda de pertenencia (`isOwnedBy`) del detalle del reporte es necesaria y no redundante:
sin ella, cualquiera con el enlace vería el fundamento jurídico de un reporte ajeno.

## 4. Verificación de no regresión en el estado de los reportes

`ReportsPage` recibió capa visual nueva. Verificado que conserva la taxonomía real:

- sigue importando `isClosedState` de `reportStatus` para agrupar en «En curso» / «Resueltos»;
- usa `StatusPill` con `state={report.stateCode}`, así que traduce los códigos reales
  (`RECIBIDO`, `EN_ANALISIS`, `DERIVADO`, `RESUELTO`, `DESESTIMADO`) a las etiquetas del §10.

## 5. Observaciones

| ID | Estado |
|---|---|
| **H-24** | **Cerrada** (§3). |
| H-42 | Abierta. No hay tabla de notificaciones: la lista se deriva de `report_state_history` y lo leído se guarda en el dispositivo, así que desde otro teléfono las no leídas se recalculan. Un buzón real, o push, necesita tabla propia. Decisión de producto. |
| H-43 | Abierta. `getMyReports` no trae imágenes, por eso las filas no muestran miniatura. |
| H-40 | Abierta. Los contadores de la campana y de la pestaña siguen fijos. Con el servicio nuevo ya hay de dónde sacarlos; falta decidir cómo se comparte el dato entre pantallas. |
| H-36 | Abierta, del Bloque 5. El mapa sigue con datos de prueba, así que «Ver el reporte» desde el mapa no coincide con los reportes reales de esta lista. |

## 6. Pendiente

- **Perfil (M19 / D20) no entra acá**: va como Bloque 6-B y depende de H-09 (dónde se guarda la
  preferencia de tema) y de la definición de la descarga de datos.
- Ticket propio para conectar el mapa a `citizen_reports` (H-36).

---

*Reportalo · REP-3787 · Sprint 13 · Matías Krepchuk*
