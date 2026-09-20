# Ejecución de Tarea: REP-2500-PRESEL

## Contexto
- **ID:** REP-2500-PRESEL
- **Título:** Preseleccionar la localidad detectada para agilizar el envío del reporte
- **Ticket padre:** [REP-2500](https://unlz2026.atlassian.net/browse/REP-2500)
- **Rama:** `feat/REP-2500-PRESEL-preseleccionar-la-localidad-detectada-para-agilizar-el-envio-del-reporte`
- **Base:** rama de REP-3789 (apilada, porque ambas tocan `NewReportPage`)
- **Fecha:** 2026-09-20

## Resumen de Ejecución

El flujo ya obtenía las coordenadas del dispositivo automáticamente, pero el `locality_id` salía
**solo** del modal manual, de modo que el ciudadano debía elegir el barrio aunque la app ya supiera
dónde estaba. Esta tarea preselecciona la localidad más cercana y deja la confirmación en el botón
de envío.

### Cambios

| Archivo | Acción | Detalle |
|---|---|---|
| `src/services/localityCentroids.js` | `[MODIFY]` | Nueva `findNearestLocality(coords, localities)` y `NEAREST_LOCALITY_MAX_METERS`. Se actualizó el encabezado del archivo, que declaraba que los centroides nunca se usarían para inferir el barrio. |
| `src/pages/NewReportPage.jsx` | `[MODIFY]` | Efecto que preselecciona la localidad y marca `isAutoSuggested`. Una confirmación manual limpia esa marca. |
| `src/components/report/ReportReviewStep.jsx` | `[MODIFY]` | Aviso "Detectamos esta localidad por tu ubicación" con invitación a ajustar. |
| `src/test/NearestLocality.test.js` | `[NEW]` | 6 pruebas de la función pura. |
| `src/test/ReportReviewStep.test.jsx` | `[MODIFY]` | 2 pruebas del aviso. |

### Decisiones de diseño

1. **Solo con lectura real de GPS.** `useGeolocation` inicializa las coordenadas en
   `DEFAULT_CITY_COORDINATES` (centro de CABA) como respaldo. Sugerir a partir de ese valor sería
   inferir jurisdicción desde una ubicación inventada, así que la sugerencia se condiciona a
   `isGranted`.
2. **Umbral de 5 km.** Si el centroide más cercano está más lejos, no se sugiere nada: el
   ciudadano probablemente esté fuera de CABA/Avellaneda.
3. **La elección explícita gana.** Si ya hay localidad elegida a mano o restaurada de un borrador,
   la sugerencia no corre. Si el borrador se restaura después, su valor reemplaza a la sugerencia.
4. **La sugerencia es visible.** Se avisa que fue detectada automáticamente, porque los centroides
   son aproximados y el `locality_id` define el organismo receptor.

## Quality Gates

| Gate | Comando | Resultado |
|---|---|---|
| Unit tests | `npx vitest run` | **237 tests / 34 suites en verde** (8 nuevos) |
| Build | `npx vite build` | Correcto |
| BDD | — | Gate desactivado: deuda transversal ya elevada al PM |

## Pendientes

- [ ] **Sign-off de Leonel Nuñez y Hernán Gregorini.** Esta tarea responde al punto abierto O-1 de
      `docs/REP-2500_resolucion-locality-id.md` y modifica la decisión allí registrada. No debería
      mergearse sin esa aprobación.
- [ ] Validación manual en dispositivo con GPS real, especialmente cerca de límites entre barrios.

## Estado

**READY_FOR_PR**, condicionado a la aprobación del punto O-1.

---

## Seguimiento post-merge (20/09) — la preseleccion no llegaba a dispararse

Al validar en la app, la localidad seguia apareciendo en blanco y el paso tardaba
mucho. El modal mostraba el punto en `(-34.6200, -58.4200)`, que es exactamente
`DEFAULT_CITY_COORDINATES`: nunca habia llegado una lectura real de GPS.

**La guarda de la tarea funciono como fue disenada** — no se sugirio ningun barrio
porque `isGranted` era false. Sin ella, se habria propuesto una localidad del centro
de CABA a un ciudadano que estaba en otro barrio.

### Causa raiz

`getUserCoordinates` pedia `enableHighAccuracy: true` con `timeout: 8000`. La alta
precision exige un fijado GPS fino que en escritorio suele fallar y en movil puede
demorar varios segundos; recien al agotarse el timeout se caia al valor de respaldo.

### Correccion

Estrategia de dos etapas:

1. **Fijacion rapida y aproximada** (`enableHighAccuracy: false`, timeout 5s,
   `maximumAge` 5 min). Una lectura por red/wifi ubica la manzana y llega en menos
   de un segundo: alcanza de sobra para resolver el barrio.
2. **Refinamiento de alta precision en segundo plano** desde `useGeolocation`, sin
   bloquear la vista. Si llega, mejora las coordenadas; si falla, la aproximada ya
   cumplio su funcion.

Ademas, mientras la localidad siga siendo una sugerencia se re-evalua al llegar
coordenadas mejores, de modo que el reporte se envia con la precision fina. Una
eleccion manual del ciudadano nunca se pisa: la protege `hasManualLocationRef`, un
ref y no estado, para no provocar renders.

### Verificacion

- 242 tests en verde sobre 35 suites, con 8 nuevos de geolocalizacion
  (`GeolocationSpeed.test.jsx`). Los 14 preexistentes de ubicacion siguen pasando.
- Build correcto.
- Validado en la app por Matias: el pin se posiciona solo y el barrio llega elegido.
