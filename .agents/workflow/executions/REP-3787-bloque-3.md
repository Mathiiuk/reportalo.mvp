# Reporte de Ejecución — REP-3787 · Bloque 3 (Detalle del reporte y fundamento legal)

- **Tarea:** REP-3787 · **Bloque:** 3 · **Pantallas:** M16 (teléfono) · D17 (escritorio)
- **Tickets relacionados:** REP-3789 · REP-2909
- **Rama:** `feat/REP-3787-uj33` · **Base:** `staging` en `542ec57`
- **Fecha:** 21/09/2026 · **Estado:** READY_FOR_PR

---

## 1. Colisión de diseño, no conflicto de merge

El bloque llegó escrito sobre el supuesto de que **no existía pantalla de detalle**. Su README
lo dice: «staging no tenía pantalla de detalle del reporte» y «la ruta `/r/:id` siempre muestra
Este reporte ya no está». Era cierto en `5898624`, su base. Dejó de serlo con el merge del PR #91
(REP-3789).

Resultado: el parche creaba como nuevos `ReportDetailPage.jsx` y `reportDetailService.js`, que
ya existían, y fallaba en 6 de 12 archivos. No eran variantes del mismo código: eran **dos
implementaciones paralelas de la misma pantalla**.

| Archivo | REP-3789 | Bloque 3 |
|---|---|---|
| `ReportDetailPage.jsx` | 264 líneas · Realtime + polling de respaldo | 329 líneas · sondeo cada 15 s, 8 veces |
| `reportDetailService.js` | 201 líneas | 61 líneas |

Se descartó aplicar el bloque tal cual (habría borrado REP-3789) y también descartarlo. Por
decisión de Matías se hizo la **integración completa**: el diseño del UJ v3.3 sobre la capa de
datos de REP-3789.

## 2. El hallazgo que cambió el alcance: REP-3789 no coincidía con la base

`citizen_reports.current_state_code` tiene **FK a `report_states(code)`**, y el catálogo real,
verificado en todo el repositorio, es:

```
borrador · enviado · en_curso · resuelto · rechazado
```

REP-3789 construyó su taxonomía sobre `RECIBIDO`, `EN_ANALISIS`, `DERIVADO`, `RESUELTO` y
`DESESTIMADO`. **Ninguno puede existir en un reporte real**: la FK los rechaza. Consecuencias
contra datos de producción:

- `getStateMeta` caía siempre al valor por defecto: la píldora mostraba **«EN CURSO» para todos
  los reportes**, incluidos los resueltos y los rechazados.
- La misma función alimentaba la insignia de **Mis reportes**, así que un reporte cerrado
  también se listaba como en curso.
- `buildTimeline` no reconocía el estado actual y no marcaba bien los pasos alcanzados.

Origen del desvío: el seed de demostración
`20260915160000_v04_seed_demo_profiles_and_reports.sql` inserta códigos en mayúscula en
`report_state_history`, tabla **sin FK**. El repositorio tiene dos convenciones contradictorias
adentro y REP-3789 tomó la que no rige.

Es la observación H-23 de Ivo, pero más filosa: no es «el UJ no coincide con la base», es «el
frontend no coincide con la base».

## 3. Decisiones tomadas

| Punto | Decisión | Motivo |
|---|---|---|
| Taxonomía de estados | Adoptar `reportStatus.js` del bloque | Es la que coincide con el catálogo real y traduce `en_curso → en_revision`, `rechazado → descartado`. |
| Carga del análisis | Conservar `useReportAnalysisLive` | Realtime con polling de respaldo es mejor que el sondeo fijo del bloque. |
| Número de reporte | Pasar a 8 caracteres (`formatReportCode`) | Lo pide el UJ. Se cambió también el acuse para que no diverjan. |
| Panel de fundamento | Versión con tokens del bloque + lo que REP-3789 aportaba | Ver §4. |
| Ruta | Mantener `/reportes/:id` | Ya existía y está enlazada. El bloque proponía `/reporte/:id`; duplicarla era cruft. |

## 4. Qué se conservó de REP-3789 dentro del diseño nuevo

El bloque perdía cosas que su base no tenía. Se reinjertaron, restiladas con tokens:

- **Guarda de pertenencia** (`isOwnedBy` + `useAuth`). El bloque no validaba nada y confiaba
  solo en RLS; la policy de `citizen_reports` es de lectura pública porque la necesita el mapa.
- **Estado de error del panel** (`rag-panel-error`). Sin él, si la lectura del análisis falla el
  ciudadano queda esperando indefinidamente un «Analizando» que nunca resuelve.
- **Trazabilidad `data-analysis-id` / `data-generation-model` / `data-prompt-version`**, que es
  el CA-09 de REP-3789.
- **Categoría y descripción del reporte.** El mockup de M16 no las dibuja y el bloque tampoco
  las mostraba: el ciudadano no podía leer lo que él mismo había reportado.
- **Todas las evidencias.** El bloque recortaba a dos fotos en teléfono (`slice(0, 2)`).
  REP-3789 ya había resuelto esto con grilla hasta dos y carrusel desde tres. Recortar la
  galería escondería evidencia adjuntada por el ciudadano.
- **`agencies:suggested_agency_id ( name )`** en el `select`, que desambigua la FK. El del
  bloque era `agencies ( name )`, ambiguo.
- **Manejo de teclado de la tarjeta de Mis reportes**, que contempla también la barra
  espaciadora. El 3-way había dejado props duplicadas; se quitaron las del bloque.

## 5. Qué se retiró

- `src/components/report/ReportTimeline.jsx` y `src/test/ReportTimeline.test.jsx` (12 tests).
- De `reportDetailService.js`: `REPORT_STATE_META`, `getStateMeta`, `TIMELINE_LABELS`,
  `buildTimeline` y `buildShortCode`. Queda en su lugar una nota de migración que explica por
  qué y adónde se mudó cada cosa.

El servicio conserva lo que sí es correcto y no tenía equivalente en el bloque:
`getReportDetail`, `getReportStateHistory` e `isOwnedBy`.

## 6. Tests

`ReportDetailFlow.test.jsx` se actualizó a los códigos reales de la base en lugar de
reescribirse: el fixture pasa de `EN_ANALISIS` a `en_curso`, y las aserciones de línea de
tiempo a las claves del §10. Se agregó **UT-DET-07b**, que cubre justamente la regresión de
H-23: un reporte `rechazado` tiene que mostrarse como «Descartado» y no como en curso.

`ReportDetailUJ33.test.jsx` (7 tests del bloque) se adaptó a la capa de datos integrada:
mockea `getReportDetail` + `getReportStateHistory` + `useAuth` + `useReportAnalysisLive` en
lugar del sondeo. Las aserciones de diseño y de taxonomía no se tocaron.

## 7. Quality Gates

| Gate | Comando | Resultado |
|---|---|---|
| Unit tests | `pnpm test` | **270 / 270 en verde** (39 archivos) |
| Build | `pnpm build` | **Compila.** PWA `injectManifest`, `dist/sw.js`, 53 entradas de precache |

El total baja de 274 a 270 porque se retiraron los 12 de `ReportTimeline` y se sumaron los 7
del bloque más UT-DET-07b.

En la primera corrida completa fallaron 2 de `OfflineReportFlow` por `Test timed out in
5000ms`. Aislada da 4/4 y la corrida siguiente dio 270/270: es el mismo problema de timeout
bajo carga ya visto en el Bloque 1, no una regresión. **Conviene subir el `testTimeout` del
proyecto antes de conectar CI (H-07).**

## 8. Pendiente

- **H-23 sigue abierta para Hernán**, y ahora con más información: además de decidir el modelo
  definitivo de estados, hay que **alinear el seed de demostración**, que es el origen de los
  códigos en mayúscula.
- **H-25**: si el pipeline no devuelve URL anonimizada se adjunta la URL local (`blob:`), que no
  está anonimizada y después no se puede abrir. La pantalla ya muestra «Imagen no disponible»,
  pero conviene no adjuntar nada sin `sanitizedUrl`.
- **H-27**: «Compartir» manda el link de una pantalla privada. Falta definir si existe vista pública.
- **H-24**: verificar RLS de `report_state_history` para el ciudadano.
- Que Ivo revise `useMediaQuery.js` (Bloque 1-D) y regenere el **Bloque 4** contra la cabeza
  vigente de `staging`.

---

*Reportalo · REP-3787 · Sprint 13 · Matías Krepchuk*
