# REP-3791 · Cómo generar los bloques 5 en adelante

**Para:** la IA que asiste a Iván Juárez en la preparación del handoff del UJ v3.3
**De:** Matías Krepchuk (implementación, REP-3787)
**Fecha:** 21/09/2026 · **Actualizado:** 23/09/2026 · **Sprint:** 13

> **Estado de este documento (23/09/2026).** Se escribió cuando solo estaban aplicados los bloques 0 a 4. Desde entonces los
> **bloques 5 a 9 se implementaron y se mergearon** a `staging` (PR #96, `09c7e6f`), junto con REP-2203, REP-2501 y REP-2204. **Los bloques 6 y 7
> están parciales**: faltan **6-B (Perfil)** y **7-B (onboarding y permisos)**.
> Sigue sirviendo como guía para cualquier bloque o revisión del handoff que falte. Cambios de esta versión: regla nueva **R-7**,
> §4 y §5 actualizados al estado real y checklist de §6 ajustado. R-1 a R-6 y la historia de los bloques 0 a 4 se conservan.

---

## 1. Por qué existe este documento

Al 21/09, los bloques 0 a 4 estaban aplicados y funcionando: 279 tests en verde y build limpio. El
trabajo de diseño está bien hecho y los README de cada bloque son excelentes.

El problema no fue el diseño: fue **el estado del repositorio contra el que se generaron los
parches**. Eso causó, en orden creciente de gravedad:

| Bloque | Qué pasó |
|---|---|
| 0 y 1 | Aplicaron limpio, con offsets. Sin problema. |
| 1-D | Faltaba un archivo: el bloque importaba `useIsDesktopLayout` desde `src/hooks/useMediaQuery`, que no venía en la entrega. El build no compilaba. Lo escribió desarrollo. |
| 2 | Primer parche que no aplicó. Hubo que hacer un 3-way merge y resolver dos conflictos a mano. Uno de ellos borraba un aviso de REP-2500 y rompía dos tests. |
| 3 | **Colisión de diseño.** El bloque creaba `ReportDetailPage.jsx` y `reportDetailService.js` como archivos nuevos, pero ya existían desde REP-3789, con Supabase Realtime. Eran dos implementaciones paralelas de la misma pantalla. Hubo que integrarlas a mano. |
| 4 | Aplicó con 2 conflictos, uno porque el parche arrastraba cambios del Bloque 3. |

Todo eso tiene una sola causa y se evita con las reglas de abajo.

---

## 2. La causa: la base del handoff quedó vieja

Todos los bloques se generaron contra `staging` en el commit **`5898624`** (18/09/2026).

`staging` siguió avanzando mientras tanto. Al 21/09/2026 está en `542ec57`, **nueve commits
más adelante**, e incluye cuatro tickets que tocan exactamente las mismas pantallas del UJ:

- **REP-3789** — creó la pantalla de detalle del reporte con Realtime
- **REP-2500-PRESEL** — preselección de localidad en el alta
- **REP-3774** — loader del corpus
- **REP-3441** — orientación de fotos y EXIF

Cuando el README del Bloque 3 dice «staging no tenía pantalla de detalle del reporte», era
cierto en `5898624` y falso desde el 20/09. El bloque se escribió, se probó y se entregó sobre
una foto del repositorio que ya no existía.

---

## 3. Reglas para generar los bloques 5 en adelante

### R-1 · Generar contra la cabeza vigente de `staging`, siempre

Antes de escribir una sola línea:

```bash
git fetch origin
git checkout -B base-handoff origin/staging
git log --oneline -1          # anotar este commit en el README del bloque
```

No reutilizar una copia local vieja del repositorio. Si pasaron días entre bloque y bloque,
volver a hacer `fetch` y regenerar sobre la cabeza nueva.

### R-2 · Antes de crear un archivo, verificar si ya existe

Esta es la regla que hubiera evitado lo del Bloque 3. Para cada archivo que el bloque vaya a
crear como nuevo:

```bash
ls src/pages/LoQueVoyACrear.jsx
git log --oneline -3 -- src/pages/LoQueVoyACrear.jsx
```

Si existe, **no se crea: se modifica**. Y si lo que existe resuelve lo mismo de otra manera
(por ejemplo, con Realtime en vez de sondeo), hay que decirlo en el README en vez de
reemplazarlo en silencio. La decisión de cuál se queda es de desarrollo.

Lo mismo al revés: si el bloque **importa** algo, verificar que exista o que venga en la
entrega. Es lo que falló en el Bloque 1-D.

```bash
# desde la raíz del repo, tras aplicar el parche en una rama de prueba
npx vite build     # falla si falta cualquier import
```

Esta regla mira **rutas**. Cuando la responsabilidad ya vive en otro archivo con otro nombre, ver R-7.

### R-3 · Cada bloque trae solo sus propios cambios

El parche del Bloque 4 incluía también los cambios de `App.jsx` del Bloque 3. Como el Bloque 3
se había resuelto distinto, eso generó un conflicto evitable.

Generar cada parche con `git format-patch` **acotado al commit del bloque**, no acumulando la
cadena entera.

### R-4 · El `.patch` es la entrega; `archivos/` es referencia

Los README ofrecen las dos vías como equivalentes («los archivos completos en `archivos/`, por
si se prefiere copiar»). **No son equivalentes.**

Copiar `archivos/` revierte en silencio todo lo que cambió en `staging` después de la base del
bloque: no produce conflicto, no rompe tests, y la regresión pasa inadvertida. Verificado: el
`NewReportPage.jsx` de `archivos/` del Bloque 1 tenía 591 líneas y le faltaban REP-3789 y
REP-2500 enteros; el resultado del parche tenía 680 y los conservaba.

Dejar `archivos/` si sirve para leer el resultado final, pero marcar en el README que **la vía
de aplicación es el `.patch`**.

Dato útil: `archivos/` sí sirvió, inesperadamente, como *pre-imagen* para reconstruir el blob
base de un 3-way merge. Por eso conviene seguir incluyéndola.

### R-5 · Verificar los datos contra la base, no contra `seed.sql`

Esta es importante porque costó un bug.

La observación **H-23** decía que los estados de la base eran
`borrador / enviado / en_curso / resuelto / rechazado` y que por eso el frontend estaba mal.
Ese dato salía de `supabase/seed.sql`.

**Era incorrecto.** El catálogo real de `public.report_states` en el proyecto CiudadAR es:

```
RECIBIDO · EN_ANALISIS · DERIVADO · RESUELTO · DESESTIMADO
```

Los 17 reportes de `citizen_reports` y todas las filas de `report_state_history` usan esos
valores. El desactualizado era `seed.sql`, no el frontend. (Ya está corregido en el repo.)

Antes de afirmar en un README que el frontend no coincide con el modelo de datos, **consultar
la base real**. Si no hay acceso, escribir la observación como pregunta y no como hallazgo.

### R-6 · Verificar sobre una instalación propia

Los números de tests de los README (192/194, 200/202, 213/215) no coincidían con la realidad
porque venían de la base vieja. Correr:

```bash
pnpm install
pnpm test
pnpm build
```

Y reportar el resultado **junto con el commit de staging contra el que se corrió**. Un número
de tests sin su base no dice nada.

Nota de entorno: si `node_modules` está enlazado desde otra ruta, Vite rechaza resolver
`maplibre-gl` (`Denied ID ...`) y aparecen seis fallos de colección que no son reales.

### R-7 · Antes de implementar una funcionalidad, localizar su responsabilidad existente

R-2 detecta la colisión por **ruta**: si el archivo ya existe, se modifica. No detecta el caso en que la funcionalidad ya vive en
**otro archivo con otro nombre**. Ejemplo real: el detalle del reporte no está solo en `ReportDetailPage`; se reparte entre
`ReportDetailPage`, `useReportAnalysisLive`, `ReportAiAnalysisPanel` y `reportStatus`. Mirar solo el archivo principal no alcanza.

Otro ejemplo, de REP-2204: `NewReportPage` tenía un estado `isSubmittingReport` que se escribía y **no lo leía nadie**. Era una
implementación parcial de «evitar el doble envío», sin ningún consumidor. Un bloque que hubiera agregado su propio candado habría
creado una segunda fuente de verdad.

Para cada funcionalidad que el bloque agregue o cambie, buscar dónde vive hoy:

```bash
grep -rn "<ruta o texto visible>" src          # rutas y textos de la pantalla
grep -rn 'data-testid="<id>"' src              # elementos que ya cubren los tests
grep -rn "<nombreDeFuncionOHook>" src          # y, con eso, quién la consume
```

Si hay una implementación equivalente, aunque sea parcial o sin consumidores:

- **No se crea una segunda.** Se frena, se dice en el README del bloque y **decide desarrollo** (igual que en R-2).
- Si se extiende la existente, se anota qué archivos la consumen y qué tests la cubren.
- No se deja una segunda fuente de verdad.

**Entregable:** una tabla «responsabilidades existentes revisadas» en el README del bloque, con lo que se encontró y qué se hizo con cada cosa.

---

## 4. Estado actual del repositorio (al 23/09/2026)

Para que el próximo bloque parta de datos correctos.

### Rama y commits

Los bloques 0 a 9 están **mergeados en `staging`** (PR #96, `09c7e6f`, 21/09/2026). Al 23/09/2026 `staging` está en `b806eac` e incluye además
REP-2203, REP-2501 y REP-2204. Cualquier bloque nuevo se genera contra esa cabeza (R-1).

| Bloque | Commit |
|---|---|
| 0 · fundaciones | `adc9f4b` |
| 1 · nuevo reporte (móvil) / 1-D (escritorio) | `a180791` · `1315463` |
| 2 · revisión, consentimiento y envío | `a12a678` |
| 3 · detalle del reporte con fundamento legal | `557298e` |
| 4 · sin conexión y errores del reporte | `bcb8872` |
| 5 · mapa de inicio y navegación | `a549ba5` |
| 6 · mis reportes y notificaciones (M17, M18). **Parcial: falta 6-B, Perfil (M19)** | `e2f9f7e` |
| 7 · acceso y primer ingreso (M01 a M03). **Parcial: falta 7-B, onboarding y permisos (M04 a M07)** | `1cfc6d3` |
| 8 · novedades | `d1173f9` |
| 9 · estados vacíos y errores | `1f274d6` |

Tests al 23/09/2026: **371 en 56 archivos**, en verde, y build limpio.

### Decisiones tomadas durante la integración

| Tema | Cómo quedó |
|---|---|
| Ruta del detalle | **`/reportes/:id`** (plural). El Bloque 3 proponía `/reporte/:id`; se descartó para no tener dos rutas a la misma pantalla. |
| Carga del análisis jurídico | `useReportAnalysisLive` — **Supabase Realtime con polling de respaldo**. Se descartó el sondeo cada 15 s del Bloque 3. |
| Taxonomía de estados | `src/components/report/reportStatus.js`, que traduce los códigos reales a las etiquetas del §10: `RECIBIDO → Enviado`, `EN_ANALISIS → En revisión`, `DERIVADO → Notificado al responsable`, `RESUELTO → Resuelto`, `DESESTIMADO → Descartado`. |
| Número de reporte | `formatReportCode`, 8 caracteres (`#RP-ABCD1234`), en el detalle y en el acuse. |
| Regla de privacidad de evidencias | `isServerProtectedUrl` en `reportSubmissionService`: solo se adjunta una foto con URL `http(s)`, que es la señal de que la protegió el servidor. La usan las dos vías de envío. |
| Timeout de tests | 30 s (`vite.config.js`). |
| Descripción del reporte (REP-2203) | Obligatoria, de 10 a 280 caracteres, validada en el paso 2 (`ReportDetailsStep`), en el servicio (`createCitizenReport`) y en la base (CHECK). La regla vive en `reportDescription.js`. |
| Datos mínimos para enviar (REP-2204) | `reportReadiness.js` decide si «Enviar» está disponible y qué falta. El botón usa `aria-disabled` para que, sin localidad confirmada, siga abriendo el ajuste de ubicación. |
| Doble envío (REP-2204) | Candado síncrono (`submitLockRef`) en `NewReportPage` y segunda barrera en la persistencia. |
| Categoría al enviar (REP-2204) | `resolveServiceDbId` resuelve el `service_id` por `service_code`; si no se puede, no se envía sin categoría. |
| Evidencia y cuarentena (REP-2501) | La foto original se sube a `<user_id>/temp_…` en `evidence-quarantine`; solo se acepta JPEG (el cliente convierte lo demás con `ensureJpeg`); la función exige sesión; una purga programada elimina lo que lleve más de 1 hora. |

### Archivos que YA existen (no crear como nuevos)

Foto del 23/09/2026 (regenerarla con `ls` antes de usarla, R-2).

`src/components/report/`:
`AdjustLocationModal` · `ConsentSheet` · `EvidenceCaptureStep` · `EvidencePreviewScreen` ·
`EvidenceUploadDesktop` · `LocalitySelector` · `ReportAiAnalysisPanel` · `ReportDetailsStep` ·
`ReportFlowHeader` · `ReportProcessingScreen` · `ReportReviewStep` · `ReportSuccessScreen` ·
`StatusPill` · `categoryTone` · `reportStatus`

`src/pages/`:
`BlankAppPage` · `CheckEmailPage` · `ForbiddenPage` · `LoginPage` · `MapPage` · `MunicipiosPage` ·
`NewReportPage` · `NewsDetailPage` · `NewsPage` · `NotFoundPage` · `NotFoundReportPage` ·
`NotificationsPage` · `OnboardingPage` · `PendingReportsPage` · `PermissionsPage` · `PlanPage` ·
`ProfilePage` · `ReportDetailPage` · `ReportsPage` · `SessionExpiredPage` ·
`TermsAndPermissionsPage` · `WelcomePage`

`src/hooks/`: `useAuth` · `useEvidenceCapture` · `useGeolocation` · `useMediaQuery`
(con `useIsDesktopLayout`) · `useNetworkStatus` · `usePwaUpdate` · `useReportAnalysisLive`

`src/services/`:
`categoriesService` · `geminiClient` · `legalRagService` · `localitiesService` · `localityCentroids` ·
`locationService` · `mapReportsService` · `metadataSanitizer` · `newsService` · `notificationService` ·
`notificationsService` · `offlineStorageService` · `pendingSyncService` · `pushSubscriptionService` ·
`quarantinePipelineService` · `reportAiAnalysisPersistence` · `reportAiAnalysisService` ·
`reportDescription` · `reportDetailService` · `reportReadiness` · `reportSubmissionService` ·
`termsService` · `validateLlmAnalysis`

Las pantallas de los bloques 5 a 9 ya están construidas: cualquier bloque nuevo es un diff sobre ellas (R-2 y R-7).

### Stack (sin cambios)

React 18 en JSX sin TypeScript · Vite 6 · Tailwind 3.4 · react-router-dom 7 · lucide-react ·
framer-motion · sonner · MapLibre · vite-plugin-pwa con service worker propio · Vitest +
Testing Library.

---

## 5. Sobre el alcance de los bloques 5 a 10

**Estado al 23/09/2026.** Los bloques 5, 8 y 9 están completos y los bloques 6 y 7 están **parciales** (ver §4): faltan **6-B (Perfil)** y **7-B (onboarding y permisos)**.
**El bloque 10 (Municipio y oficial, D21–D30) no tiene commit en `staging`** y, según la hoja de ruta de Iván, queda fuera del Sprint 13. El tablero del
municipio (D39) no se implementa: está fuera del MVP.

Observaciones de producto y su estado. Fuente: código de `staging` y las respuestas de Iván en REP-3787 (23/09/2026):

| Observación | Estado al 23/09/2026 |
|---|---|
| **H-35**: la descripción es obligatoria en el servicio pero no en la pantalla | **Resuelta en lo principal** por REP-2203 (obligatoria, de 10 a 280 caracteres, en pantalla, servicio y base). **Falta la salida para los borradores trabados en la cola offline:** Pendientes no permite editarlos ni descartarlos, y con el mínimo de 10 caracteres es más probable que un borrador viejo falle al sincronizar. Iván lo confirma con Hernán |
| **H-33** (M20, Bloque 6): el estado «Listo para enviar» no existe en el flujo real | **Sigue abierta**: no hay ninguna implementación de ese estado en `src/` |
| **H-27** (Bloque 5/6): «Compartir» manda el link de una pantalla privada | **Sigue abierta**: `ReportDetailPage` comparte `window.location.href` y no existe una vista pública del reporte |
| **H-19**: el texto legal del consentimiento cambió y necesita validación del PO | **Postergada a otro sprint** (Iván, 23/09): el texto de M13 queda el de la v3.3 y la re-aceptación ocurre solo al cambiar la versión de términos. Ver la observación siguiente, que esa postergación no cubre |
| **H-09** (6-B): dónde se guarda la preferencia de tema | Iván: **tema claro por defecto**, sin importar el del dispositivo. **Sigue abierto** si es por dispositivo o por cuenta (Matías propuso por dispositivo). Lo confirma Hernán |
| **Descargar mis datos** (6-B) | Iván: **fuera del MVP**; como idea, un PDF con datos básicos y el listado de reportes por estado. Hoy el botón existe y descarga un JSON |
| **PA-01** (7-B): orden del recorrido | **Sigue abierta**: Iván no tiene la información; la respuesta es de Hernán. Solo hay que decidir si se corrigen los criterios de aceptación (la app ya hace bienvenida, acceso y onboarding) |
| **Ilustraciones del onboarding** (7-B) | **Resuelta**: van con **pictogramas**, y el 7-B se genera igual |
| **Términos en el onboarding** (7-B) | **Resuelta**: la pantalla de términos **sale** del recorrido. Los términos se exigen una sola vez, al enviar el primer reporte (M13), y vuelven solo si cambia la versión. El onboarding cierra en permisos y de ahí al mapa. Iván corrige el título del recorrido en el UJ |
| **H-06**: tests que fallan en un checkout limpio | **Confirmada** (se comprobó sin configuración de Supabase): fallan UT-QPS-14 y UT-QPS-15 (2 de 371). Dependen del `.env`; conviene que mockeen la configuración dentro del propio test, o fallarán en el CI (H-07) |

**Observación nueva, a resolver con el PO antes de cualquier bloque sobre consentimiento o privacidad: la app promete difuminado que el servidor no hace.**
El texto de la hoja de consentimiento dice «Difuminamos rostros y patentes en el servidor, antes de guardar», y hay promesas equivalentes en la captura
(`EvidenceCaptureStep`), la subida de escritorio (`EvidenceUploadDesktop`), el onboarding, los permisos y la vista previa («N zonas difuminadas»).
Pero la Edge Function `quarantine-anonymize` hoy **solo quita metadatos y detecta rostros y patentes; no aplica ningún difuminado** (REP-2501, REP-2400),
y sin `GOOGLE_VISION_API_KEY` informa zonas ficticias. El ciudadano consiente sobre una afirmación que no es cierta. O se implementa el difuminado,
o se cambian los textos, y eso lo decide el PO.

La regla de fondo se mantiene: **generar un bloque sobre una decisión de producto no tomada es otra forma de generar sobre una base vieja.**
Si una observación abierta cae sobre un bloque nuevo, se consulta antes de implementarlo.

---

## 6. Checklist antes de entregar un bloque

- [ ] Generado contra la cabeza vigente de `staging`, y el commit anotado en el README
- [ ] Ningún archivo «nuevo» pisa uno que ya existe
- [ ] Todo lo que el bloque importa existe o viene en la entrega
- [ ] El parche trae solo los cambios de este bloque
- [ ] El README dice que la vía de aplicación es el `.patch`
- [ ] Los datos afirmados sobre la base se verificaron contra la base, no contra `seed.sql`
- [ ] `pnpm install && pnpm test && pnpm build` sobre un checkout limpio, y el resultado
      reportado junto con su commit base
- [ ] Props, hooks, servicios, `data-testid` y textos usados por los tests, intactos
- [ ] No se introdujo una segunda implementación de una funcionalidad existente: se reutilizaron rutas,
      contratos y fuentes de verdad, y el README trae la tabla «responsabilidades existentes revisadas» (R-7)
- [ ] No se decidió por cuenta propia ninguna cuestión de producto pendiente (§5): se consultó al PO

---

*Reportalo · REP-3791 / REP-3787 · Sprint 13*
