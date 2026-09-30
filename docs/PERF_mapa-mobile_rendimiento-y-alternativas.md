# Reportalo

*Plataforma de Auditoría Ciudadana*

## RENDIMIENTO DEL MAPA EN CELULARES Y ALTERNATIVAS DE ESCALA

**Versión 1.0 · 30 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Jira:** REP-XXXX (pendiente: se completa con el número del ticket que abra el PO)
**Confluence:** espacio `Reportalo` — pendiente de publicar

**Equipo:** Hernán Gregorini (PO / Autor) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

> **Propósito.** Dejar por escrito cómo rinde hoy la pantalla `/mapa` en un celular (medido con Lighthouse), qué se probó para bajar el bloqueo del hilo principal y con qué resultado, y qué técnicas conviene usar para que el mapa siga fluido cuando haya muchos reportes repartidos por toda la ciudad.

---

## 1. Resumen

- **`/mapa` abre rápido en pantalla pero se traba al arrancar en celulares.** En mobile (CPU 4× más lenta, red 4G simulada), el primer contenido aparece a los ~0,13 s y la pantalla queda usable a los ~2 s, pero el hilo principal queda bloqueado unos **790 ms** (TBT) y hay una tarea larga de ~650 ms. En desktop no se nota (TBT ~110 ms, Performance 98–99).
- **Diferir la carga de MapLibre, por sí solo, no baja el TBT.** Se probó (sección 3) y el TBT quedó igual (792 → 794 ms). Mejoró el primer pintado (133 → 106 ms) y la tarea más larga (648 → 448 ms), pero el LCP en desktop empeoró (476 → 621 ms). Ese cambio **no está commiteado** y no conviene presentarlo como el arreglo del TBT.
- **Las mediciones de este documento no incluyen los marcadores de reportes.** Se corrió con una sesión ficticia y Supabase respondió 401, así que el mapa se dibujó vacío. El costo real con 176 reportes es mayor y falta medirlo (sección 6).
- **El punto que más escala mal es cómo se dibujan los reportes**, no el peso de la librería: cada reporte es un elemento DOM y todos se destruyen y recrean en cada render (sección 4.1). Con los ~200 de hoy alcanza para notarlo; con miles se vuelve inusable.

---

## 2. Mediciones

### 2.1 Cómo se midió

- Lighthouse 13.4.1 sobre el **build de producción** (`pnpm build` + `vite preview`), no sobre el dev server.
- Navegador: Microsoft Edge (Chromium). No hay Chrome instalado en la máquina de prueba; los valores son comparables con Chrome pero no idénticos.
- Mobile: emulación estándar de Lighthouse (Moto G Power, throttling simulado, CPU 4×). Desktop: preset desktop.
- Ruta `/mapa` con una sesión guardada ficticia y los flags de onboarding y permisos completos. Sin sesión, `/mapa` redirige a la bienvenida y se mediría otra pantalla.
- **3 corridas por modo y por versión; se informa la mediana.** Una sola corrida engaña: la primera medición aislada dio TBT 1030 ms y Performance 77, y la base repetida dio ~792 ms y 80.

### 2.2 Resultados (mediana de 3 corridas)

**Mobile**

| Métrica | Antes | Con MapLibre diferido |
|---|---|---|
| Performance | 80 | 80 |
| First Contentful Paint | 133 ms | 106 ms |
| Largest Contentful Paint | 1962 ms | 2017 ms |
| Total Blocking Time | 792 ms | 794 ms |
| Tarea larga más grande | 648 ms | 448 ms |
| Cantidad de tareas largas | 8 | 7 |
| CLS | 0,010 | 0,010 |

**Desktop**

| Métrica | Antes | Con MapLibre diferido |
|---|---|---|
| Performance | 99 | 98 |
| First Contentful Paint | 52 ms | 52 ms |
| Largest Contentful Paint | 476 ms | 621 ms |
| Total Blocking Time | 109 ms | 125 ms |
| Tarea larga más grande | 159 ms | 175 ms |

**Ruido a tener en cuenta:** una de las corridas base en mobile dio Performance 71 y Speed Index de 18,8 s (LCP 1184 ms en esa misma corrida), lo que indica que una corrida puede desviarse mucho sin que cambie el código. Por eso se usa la mediana y por eso diferencias de ±50 ms no son concluyentes.

### 2.3 Otros hallazgos del reporte (no relacionados con el mapa)

- **Accesibilidad 90:** falla el contraste de los textos de la barra inferior y de dos elementos de una lista; un botón del header tiene el nombre accesible distinto de su texto visible; el `<meta viewport>` tiene `user-scalable=no` y `maximum-scale=1`, lo que impide hacer zoom.
- **SEO 63–66:** `is-crawlable` marca `robots.txt`. Puede ser intencional (REP-3798 H-61); confirmar. Fallan también las auditorías `llms-txt` y `ard-schema`, que son nuevas y no aplican a una app con login.

---

## 3. Qué se probó y por qué no alcanzó

**Cambio:** MapLibre pasó de importarse de forma estática a cargarse con `import()` dinámico, con un cargador compartido (`src/lib/maplibreLoader.js`) que trae el motor, su worker y su CSS, y arranca el mapa después del primer pintado. Se aplicó a `CitizenMap` y a `AdjustLocationModal` (este último importaba MapLibre y `App.jsx` precarga `NewReportPage` al arrancar con sesión). Los 554 tests pasan y el build compila.

**Por qué el TBT no bajó:** Lighthouse mide el bloqueo entre el primer pintado y que la página queda interactiva. Diferir el mapa solo cambia *cuándo* se ejecuta MapLibre; sigue cayendo dentro de esa ventana. El costo está en ejecutar el motor (~1,5 s de scripting en el bundle de `maplibre-gl` en el reporte inicial), no en el orden de carga.

**Qué sí aportó:** el primer pintado llega antes y la tarea más larga se reduce, o sea, la pantalla responde algo antes al principio. Además, el precargado de `NewReportPage` ya no arrastra MapLibre. Es una mejora de percepción, no de TBT.

**Costo:** el LCP en desktop subió unos 145 ms porque el mapa aparece después. Decidir si se acepta ese intercambio o se descarta el cambio.

---

## 4. Dónde está el costo real (por lectura del código)

Estos puntos salen de leer `CitizenMap.jsx` y `mapReportsService.js`; **no están medidos todavía**.

### 4.1 Marcadores DOM que se recrean en cada render

- `filteredReports` se calcula con `reports.filter(...)` en cada render, sin `useMemo`, por lo que es un array nuevo cada vez.
- Ese array es dependencia del efecto que dibuja los marcadores, junto con `selectedReport` y `userLocation`. El efecto borra todos los marcadores y los vuelve a crear.
- Consecuencia: tocar un pin, moverse con GPS o cualquier re-render reconstruye los ~200 elementos DOM y sus estilos.
- Cada marcador llama a `renderToStaticMarkup` de `react-dom/server` para armar el ícono, aunque hay solo unas 7 variantes de ícono. Es trabajo repetido que se puede cachear.

### 4.2 Tope de 200 reportes, los más recientes

`getPublicMapReports` trae `limit(200)` ordenado por fecha. Hoy es un tope razonable, pero con volumen real el mapa **muestra solo los 200 últimos** y oculta en silencio los más viejos de cualquier zona. Con muchos reportes, esto es un problema de datos además de rendimiento.

### 4.3 Dependencia del proveedor de mapa

El estilo y los tiles vienen de `tiles.openfreemap.org` (servicio gratuito, sin acuerdo de nivel de servicio). Sin red, el mapa queda sin calles: el service worker precachea el código de MapLibre (~2,8 MB en total de precache) pero no los tiles.

### 4.4 La leyenda «Menos / Más»

En `CitizenMap.jsx` hay una leyenda «Menos → Más» pero no encontré una capa de calor que la use. Confirmar si es intencional o si la capa quedó pendiente; es el lugar natural para una vista de densidad (sección 5.3).

---

## 5. Técnicas recomendadas cuando hay muchos reportes

Los rangos son orientativos y **no fueron medidos en Reportalo**; sirven para ordenar prioridades, no como umbrales garantizados.

### 5.1 Corregir el redibujado (horas de trabajo, riesgo bajo)

1. Envolver `filteredReports` en `useMemo` sobre `[reports, activeFilter]`.
2. Cachear el HTML del ícono por categoría (una llamada a `renderToStaticMarkup` por ícono distinto, no por reporte).
3. Actualizar los marcadores **por diferencia**: crear los que faltan, quitar los que sobran, y no tocar el resto. Que seleccionar un pin no reconstruya nada.

Con esto los marcadores DOM aguantan bien unos pocos cientos.

### 5.2 Dibujar los reportes como capas de MapLibre en lugar de elementos DOM (la mejora más importante)

Cargar los reportes como una **fuente GeoJSON** y dibujarlos con capas `circle` o `symbol`, que se renderizan en WebGL junto al mapa:

- Escala a miles de puntos en el cliente sin crear elementos DOM.
- La selección se resuelve con `feature-state` o filtrando la capa, sin reconstruir nada.
- Los íconos por categoría se registran una sola vez con `map.addImage` (son ~7).
- El clic se maneja con `queryRenderedFeatures` o el evento `click` de la capa.
- Costo: reescribir el efecto de marcadores y ajustar los tests que hoy buscan `marker-<id>` en el DOM.

### 5.3 Agrupar (clustering) y vista de densidad

- **Clustering nativo:** la fuente GeoJSON acepta `cluster: true`, `clusterRadius` y `clusterMaxZoom`. El agrupamiento corre en el worker, no en el hilo principal. Se muestran círculos con el conteo, y al tocar uno se hace zoom con `getClusterExpansionZoom`.
- **Mapa de calor a zoom bajo:** una capa `heatmap` cuando se ve toda la ciudad, y puntos o clusters al acercarse. Encaja con la leyenda «Menos / Más» existente.
- Esto responde al caso «muchos reportes por todo el mapa»: a zoom de ciudad no se ven 5.000 pines, se ve densidad.

### 5.4 Traer solo lo que se ve (cuando el volumen supere lo que conviene bajar entero)

- **Consulta por área visible (bounding box)** en lugar de «los 200 últimos». Con PostGIS, un `ST_MakeEnvelope` dentro de una función RPC; verificar que exista un índice sobre la ubicación (hoy la tabla guarda `latitud` y `longitud` como columnas separadas).
- **Agregación en el servidor a zoom bajo:** devolver celdas con conteo (grilla o geohash) en vez de puntos, y puntos individuales solo a zoom alto.
- **Ficha bajo demanda:** el mapa solo necesita id, coordenadas, categoría y estado. La descripción y la localidad se piden al tocar el pin. Reduce el payload y el trabajo de parseo.
- **Tiles vectoriales propios (Martin, pg_tileserv):** solo si se llega a decenas de miles de reportes. Es una pieza de infraestructura más para mantener; hoy sería excesivo.

### 5.5 Reducir el costo de arranque del motor (lo que sí ataca el TBT)

- **Mapa base propio y liviano:** un archivo PMTiles con solo CABA y Avellaneda, servido desde Storage o CDN y cacheable por el service worker. Quita la dependencia de OpenFreeMap, permite usar el mapa sin red y achica el estilo que se evalúa al inicio.
- **Simplificar el estilo:** menos capas y menos etiquetas implican menos trabajo de evaluación al cargar. El estilo `bright` de OpenFreeMap está pensado para uso general.
- **Ajustes de instancia** (`Map`): `fadeDuration: 0`, `pixelRatio` acotado en pantallas de muy alta densidad, `renderWorldCopies: false`, `maxTileCacheSize` moderado.
- **Carga diferida con interacción:** mostrar una imagen o fondo estático de la ciudad y arrancar el motor al primer toque o en un momento ocioso. Baja el TBT medido, pero empeora la primera experiencia si el ciudadano llega al mapa para actuar. No es aconsejable como pantalla de inicio.

### 5.6 Cambiar de librería (no recomendado hoy)

Leaflet pesa mucho menos (~42 kB gzip contra ~261 kB de MapLibre) y arranca más rápido, pero renderiza en DOM/canvas raster: perdemos el estilo vectorial y el WebGL que sostiene los puntos por capas, y hay que rehacer el mapa y los tests. Solo tendría sentido si se decidiera un mapa mínimo, sin vectores. Con la solución 5.2 + 5.3 no hace falta.

---

## 6. Alternativas por tipo de dispositivo

| Dispositivo | Qué esperar | Qué hacer |
|---|---|---|
| **Android gama baja** (2–3 GB de RAM, CPU lenta) | Es el caso que reproduce el 4× de Lighthouse: tarea larga al arrancar, marcadores DOM lentos, riesgo de que el sistema cierre la pestaña por memoria. | Marcadores por capas y clusters (5.2, 5.3); `pixelRatio` acotado y `maxTileCacheSize` bajo; estilo simplificado (5.5). Considerar un perfil «liviano» activado por `navigator.hardwareConcurrency` (o `deviceMemory`, solo Chromium). |
| **Android gama media/alta** | Fluido con el volumen actual; el bloqueo de arranque existe pero es corto. | 5.1 alcanza por ahora. |
| **iPhone (Safari / PWA instalada)** | GPU y CPU fuertes; el riesgo es la memoria de la pestaña y el comportamiento del WebGL al volver de segundo plano. Ni `deviceMemory` ni algunas APIs de detección existen en Safari. | Probar en dispositivo real la pantalla con volumen alto; evitar recrear el contexto WebGL; usar capas (5.2) que consumen menos memoria que cientos de nodos DOM. |
| **Sin conexión o red mala** | Mapa base sin calles (los tiles no se cachean); los reportes vienen de la red. | PMTiles propio precacheado (5.5); guardar la última lista de reportes para mostrarla sin red. |
| **Tablet / escritorio** | Sin problema de TBT. | Solo revisar que las mejoras de escala (5.2–5.4) se mantengan en pantallas grandes, donde entran más pines a la vez. |

Nada de esto se probó en dispositivos físicos: las conclusiones por dispositivo son inferencias a partir del emulador de Lighthouse y del comportamiento conocido de cada plataforma.

---

## 7. Orden sugerido y qué falta medir

**Orden recomendado**

1. **5.1** corregir el redibujado. Bajo riesgo, se puede hacer ya y se mide fácil.
2. **5.2 + 5.3** capas GeoJSON con clustering y densidad a zoom bajo. Es el cambio de fondo para «muchos reportes».
3. **5.4** consulta por área visible o agregada, cuando el volumen real supere lo que conviene traer entero.
4. **5.5** mapa base propio y ajustes de instancia, para atacar el TBT de arranque y el uso sin red.
5. Decidir sobre el LCP de desktop del cambio ya probado (sección 3): descartarlo o conservarlo con esa contrapartida.

**Pendiente de medir**

- Lighthouse con **datos reales**: hoy la consulta de reportes falla con la sesión ficticia y el mapa se mide vacío. Hay que repetir con la lista real (~176 reportes) y con conjuntos sintéticos de 1.000, 5.000 y 20.000 puntos para ver dónde se quiebra cada técnica.
- Comparar marcadores DOM contra capas GeoJSON con el mismo volumen (tiempo de dibujado, memoria, fluidez al mover el mapa).
- Prueba en al menos un Android de gama baja y un iPhone reales.
- Repetir todo con Chrome, si se instala, para confirmar que Edge no cambia las conclusiones.

---

## 8. Estado: punto 5.1 aplicado (30 de septiembre de 2026)

Se corrigió el redibujado de marcadores en `CitizenMap.jsx`:

- `filteredReports` pasó a `useMemo` sobre `[reports, activeFilter]`.
- El HTML del ícono se arma una vez por variante y se reutiliza.
- Los marcadores se actualizan **por diferencia** (clave: id del reporte más una firma de color, ícono, título y coordenadas). Seleccionar un pin o moverse el punto de GPS ya no los reconstruye; el marcador del usuario tiene su propio efecto.
- Se agregaron los tests `UT-MP-13` y `UT-MP-14` (`MapFlow.test.jsx`). Ambos **fallan con el código anterior y pasan con el nuevo**.

**Verificación:** 556 tests en verde y build sin errores. En el navegador, con datos reales (176 reportes) y el dev server, al tocar un pin se abre la ficha y no se elimina ni se crea ningún nodo de marcador: los 176 son los mismos elementos antes y después. Con el código anterior el efecto destruía y recreaba los 176 en cada render (por lectura del código y por el fallo de los tests nuevos; no se midió en el navegador).

**Lo que no se midió:** el efecto de esto sobre Lighthouse. El arranque sigue creando los marcadores una vez, así que el TBT de carga no cambia; la mejora es en la interacción (tocar pines, filtrar, GPS) y crece con la cantidad de reportes.

---

**Documentos relacionados:** [REP-3798](https://unlz2026.atlassian.net/browse/REP-3798) (frontend UJ v3.3, origen del mapa actual) · [REP-3791](https://unlz2026.atlassian.net/browse/REP-3791)
