# Reportalo

*Plataforma de Auditoría Ciudadana*

## MAPA A ESCALA — PROPUESTA DE TRES MEJORAS PARA DECISIÓN DEL PM

**Versión 1.0 · 30 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Jira:** REP-XXXX (pendiente: se completa con el número del ticket que abra el PO)
**Confluence:** espacio `Reportalo` — pendiente de publicar
**Referencia:** [PERF_mapa-mobile_rendimiento-y-alternativas.md](PERF_mapa-mobile_rendimiento-y-alternativas.md) (mediciones y contexto técnico)

**Equipo:** Hernán Gregorini (PO / Autor) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

> **Propósito.** Que el PM pueda decidir si, cuándo y en qué orden se hacen tres mejoras de fondo del mapa (dibujar los reportes como capas del mapa, traer solo lo que se ve, y usar un mapa base propio). Cada una se describe con su objetivo, lo que cambia, lo que puede romper, cuánto cuesta, cómo se despliega y cómo se deshace.

---

## 1. Resumen para decidir

| | **Punto 2**<br>Reportes como capas del mapa | **Punto 3**<br>Traer solo lo visible | **Punto 4**<br>Mapa base propio y ajustes |
|---|---|---|---|
| **Qué resuelve** | El mapa se traba cuando hay muchos pines | El mapa no muestra reportes viejos y no escala en datos | Arranque lento, dependencia de un tercero, sin mapa sin conexión |
| **Esfuerzo (estimación)** | 2 a 4 días | 3 a 5 días | 4A: medio día · 4B: 2 a 4 días |
| **Riesgo** | Medio | **Alto** (toca la base y la privacidad) | 4A: bajo · 4B: medio |
| **¿Hace falta hoy?** | No con 176 reportes | **No** | 4A sí, es barato · 4B no urgente |
| **Cuándo conviene** | Al superar unos cientos de reportes | Al superar unos pocos miles, o si el tope deja reportes afuera | 4A ya · 4B si se quiere uso sin conexión |
| **Antes de empezar necesita** | Decisión de accesibilidad | Decisión del PO sobre la lectura pública | Dónde alojar el archivo de mapa |

**Recomendación:** hacer 4A (ajustes del motor) cuando haya un rato; **planificar el punto 2** para cuando el volumen se acerque a unos cientos de reportes; **no tocar el punto 3** hasta que el volumen o la decisión de privacidad lo pidan; dejar 4B como mejora de uso sin conexión.

Las estimaciones de esfuerzo son del autor, **no están medidas** y suponen a una persona que ya conoce el código.

---

## 2. Punto de partida

**Cómo funciona el mapa hoy**

- La pantalla `/mapa` trae los reportes con `getPublicMapReports` (`src/services/mapReportsService.js`), que pide los **200 más recientes** que tengan coordenadas.
- Hoy la consulta devuelve **176 reportes**: el tope de 200 **no está ocultando nada** todavía.
- Cada reporte se dibuja como un botón HTML colocado sobre el mapa (un «marcador DOM»).
- El estilo y las calles vienen de `tiles.openfreemap.org`, un servicio gratuito de terceros.

**Lo que ya se hizo (punto 1, sin relación con los tres de este documento)**

Se corrigió que los marcadores se destruyeran y recrearan en cada render. Ahora se actualizan por diferencia: tocar un pin ya no los reconstruye (verificado con los 176 reportes reales: cero nodos creados o eliminados al tocar un pin). Con eso, el mapa aguanta bien unos pocos cientos de reportes.

**Mediciones de arranque (Lighthouse, mobile, mediana de 3 corridas)**

| Métrica | Valor |
|---|---|
| Performance | 80 |
| First Contentful Paint | ~130 ms |
| Largest Contentful Paint | ~1,96 s |
| Total Blocking Time | ~790 ms |

Estas mediciones se hicieron con el mapa **vacío** (sin sesión real, la consulta de reportes falló). El costo real con los 176 pines es mayor y no está medido.

---

## 3. Punto 2 — Dibujar los reportes como capas del mapa

### 3.1 Objetivo

Que el mapa siga fluido en un celular cuando haya cientos o miles de reportes, en lugar de crear un elemento HTML por cada pin.

### 3.2 Qué cambia

Hoy cada reporte es un `<button>` que MapLibre posiciona encima del mapa. Con muchos, cada uno cuesta memoria y cálculo de layout en el hilo principal.

El cambio es que los reportes pasen a ser **datos que el mapa dibuja con la tarjeta gráfica**, igual que las calles:

1. Los reportes se cargan como una fuente de datos GeoJSON.
2. Una capa de círculos o símbolos los dibuja.
3. Los íconos por categoría (unos 7) se registran una sola vez.
4. Al tocar un pin, el mapa avisa cuál fue y se abre la misma ficha de hoy.
5. El pin seleccionado se resalta sin reconstruir nada.
6. **Agrupamiento:** los pines cercanos se juntan en un círculo con un número. Al tocarlo, el mapa hace zoom y se separan. MapLibre lo hace en un proceso aparte (worker), sin bloquear la pantalla.
7. **Vista de densidad a zoom de ciudad:** una capa de calor. La leyenda «Menos / Más» ya está en pantalla y hoy no tiene ninguna capa detrás.

### 3.3 Qué NO cambia

- `mapReportsService.js`: la forma de los datos que llegan.
- La ficha del reporte, los filtros por estado, el contador «N reportes visibles» y la navegación a `/reportes/<id>`.
- La regla de H-36: el mapa nunca inventa reportes.

### 3.4 Qué se rompe seguro

- **Los tests que buscan los pines en el HTML.** En `MapFlow.test.jsx`: `UT-MP-08`, `09`, `10`, `12`, `13` y `14` usan `marker-<id>`. Esos elementos dejan de existir y hay que reescribir los tests.
- **Los mocks de MapLibre.** Los de `MapFlow`, `LocationFlow` y `Bloque4OfflineErroresUJ33` no tienen funciones de capas y hay que ampliarlos.
- **Accesibilidad.** Los pines dejan de ser botones y con ellos su acceso por teclado y por lector de pantalla (ver decisión 7.1).

### 3.5 Lo que las pruebas automáticas no pueden verificar

En el entorno de pruebas (jsdom) **no hay gráficos**, así que ningún test puede confirmar que los pines se ven bien, que el agrupamiento se comporta o que el toque acierta el pin correcto. Eso solo se verifica **mirando** en un navegador y en teléfonos reales. Los tests reescritos protegen la lógica (filtros, ficha, datos), no el dibujo.

### 3.6 Cómo se despliega y cómo se deshace

- Se deja **el dibujo actual (marcadores) funcionando** y el nuevo detrás de un interruptor (una constante de configuración).
- Se despliega con el modo actual, se activa el nuevo en `staging` para que lo revisen el PM y el Sponsor, y recién después se cambia en producción.
- **Deshacer = cambiar ese valor.** No requiere revertir código ni tocar la base.
- Cuando el modo nuevo esté validado, se elimina el viejo en un cambio aparte.

### 3.7 Criterios de aceptación

- Con los reportes actuales, cada categoría se ve con su ícono y color, y el filtro por estado sigue mostrando solo los que corresponden.
- Tocar un pin abre la ficha correcta; «Ver el reporte» abre el detalle de ese reporte.
- Con un conjunto de prueba de 5.000 puntos, el mapa se mueve y se acerca sin trabarse en un Android de gama baja.
- Los tests existentes de filtros, ficha y «no inventa reportes» siguen en verde, reescritos.
- Se puede volver al modo anterior cambiando la constante.

### 3.8 Riesgos

| Riesgo | Mitigación |
|---|---|
| Pin seleccionado o ficha incorrectos al reescribir la lógica | Tests reescritos + revisión visual en `staging` |
| Los íconos no se ven como hoy | Comparar capturas antes y después |
| Diferencias entre iPhone y Android | Probar en al menos un dispositivo de cada tipo |
| Pérdida de accesibilidad de los pines | Decisión 7.1 |

---

## 4. Punto 3 — Traer solo lo que se ve

### 4.1 Objetivo

Que el mapa muestre **todos** los reportes de la zona que se está mirando, y que siga funcionando si la base crece a miles de reportes.

### 4.2 El problema que resuelve

- **Se pierden reportes.** El tope de 200 muestra los más recientes de toda la ciudad. Cuando haya más de 200, los más viejos de cualquier barrio desaparecen del mapa sin aviso. *Hoy no pasa: son 176.*
- **No escala en datos.** Bajar miles de filas completas cuesta descarga y trabajo de lectura en el celular.

### 4.3 Qué cambia

- **Consulta por área visible:** al mover o acercar el mapa, se piden solo los reportes que caen dentro de la pantalla.
- **Datos agregados a zoom bajo:** el servidor devuelve «en esta zona hay 340 reportes» en vez de 340 puntos, y los puntos reales aparecen al acercarse.
- **Ficha bajo demanda:** el mapa solo pide lo mínimo para dibujar (id, ubicación, categoría, estado). La descripción y la localidad se piden al tocar el pin.

### 4.4 Por qué es el punto más riesgoso

**Toca la base de datos y la privacidad.**

- La lectura de `citizen_reports` es pública a propósito (política `lectura_publica`) y H-36 se cuidó de no traer datos sensibles: ni `user_id`, ni análisis jurídico, ni fotos.
- Una migración anterior (R5-04) deja escrito que esa lectura pública **«expone `user_id` junto a coordenadas exactas»** y que revisarla es una **decisión pendiente del PO** (marcada `[DECISION HERNAN]`). Nada de este punto debe avanzar antes de que esa decisión esté tomada, porque una función nueva en la base puede ampliar o achicar lo que se expone.
- Una función del tipo `security definer` mal escrita (por ejemplo con `select *`) podría exponer columnas que hoy no se exponen.
- **La tabla `citizen_reports` no está versionada en el repositorio** (está en los archivos `schema_tablas_no_versionadas_*`), y la extensión de mapas (PostGIS) está marcada como «sin documentar». Hoy **no se sabe** si hay un índice sobre la ubicación; hay que verificarlo en la base real antes de estimar.
- Ya hubo un incidente de borrado de datos en la migración RAG. Cambiar la base sin ensayar previamente es un riesgo que este equipo ya vivió.

### 4.5 Qué NO cambia

La forma de los datos que consume el mapa debe seguir siendo la misma para no romper `UT-MAP-01` a `06` (adaptador de filas). Si la función nueva devuelve otra forma, hay que adaptar esos tests con cuidado.

### 4.6 Cómo se ensaya y se despliega

1. Verificar en la base real qué índices existen y cuántos reportes hay.
2. Crear la función y el índice en un **branch de Supabase** (no en producción) y probarla con datos.
3. **Revisión de las columnas devueltas** por el PO o el líder técnico antes de aplicar.
4. Aplicar en producción como una migración versionada en `supabase/migrations`.
5. Detrás de un interruptor en el cliente: el modo actual (200 más recientes) sigue disponible.

**Deshacer:** volver el interruptor al modo anterior. La función queda en la base sin uso; si hace falta se elimina con otra migración.

### 4.7 Criterios de aceptación

- Con más de 200 reportes en la base, el mapa muestra los de la zona visible, no solo los últimos 200 globales.
- La respuesta **no contiene** ninguna columna que hoy no se devuelve (verificado columna por columna).
- Mover el mapa rápido no genera pedidos en cascada ni pantallas parpadeando.
- Sin conexión, el mapa muestra lo último que tenía en lugar de quedar vacío.

### 4.8 Cuándo hacerlo

Cuando ocurra **una** de estas: el número de reportes con coordenadas se acerque a 200 y se empiecen a perder, o supere unos pocos miles. Antes es complejidad sin beneficio.

---

## 5. Punto 4 — Mapa base propio y ajustes del motor

Se divide en dos porque tienen costos y riesgos muy distintos.

### 5.1 Punto 4A — Ajustes del motor

**Qué es:** opciones que se pasan al crear el mapa, para que trabaje menos en celulares modestos: sin animación de aparición de tiles (`fadeDuration: 0`), densidad de píxeles acotada en pantallas muy densas (`pixelRatio`), no repetir el mundo (`renderWorldCopies: false`) y una caché de tiles moderada (`maxTileCacheSize`).

- **Esfuerzo:** medio día, más la medición.
- **Riesgo:** bajo. Cada opción se ve y se revierte con una línea.
- **Lo que no se sabe:** cuánto mejora el arranque. **No está medido**; se mide antes de decidir si entra.
- **Lo que puede notarse:** con `fadeDuration: 0` los tiles aparecen sin transición, y con un `pixelRatio` menor el mapa puede verse un poco menos nítido en pantallas muy densas.

### 5.2 Punto 4B — Mapa base propio (PMTiles)

**Situación actual.** Las calles y el estilo se descargan de `tiles.openfreemap.org`, un servicio gratuito **sin garantía de disponibilidad**. Sin conexión, el mapa queda sin calles, aunque la app sí abra: el service worker guarda el código de la app pero no los tiles.

**Qué es.** Un único archivo con el mapa de CABA y Avellaneda, alojado por nosotros (Storage de Supabase o una red de distribución de contenidos), que el navegador lee por partes. Se agrega la librería `pmtiles` al proyecto.

**Qué se gana**

- Se deja de depender de un servicio de terceros.
- El service worker puede guardar el mapa y la app puede mostrar calles **sin conexión**.
- Se puede simplificar el estilo (menos capas y etiquetas), lo que reduce el trabajo al cargar.

**Qué cuesta y qué puede fallar**

- Hay que **generar el archivo** con datos de OpenStreetMap recortados a la zona, y decidir cada cuánto se actualiza.
- Hay que **alojarlo** y confirmar que el servidor soporte lecturas parciales (rangos de bytes). Debe verificarse en el proveedor elegido, no está probado.
- Cambia **cómo se ve el mapa** de la pantalla principal: el estilo actual es el «bright» de OpenFreeMap. Necesita revisión de diseño.
- Se agrega una **dependencia nueva** y hay que revisar las cabeceras de `vercel.json` y las reglas del service worker.
- Un error de configuración puede dejar el mapa sin calles en producción aunque en local funcione; por eso se prueba en `staging` primero.

**Cómo se despliega y se deshace:** detrás de un interruptor entre el estilo actual (URL de OpenFreeMap) y el nuevo (PMTiles). Volver atrás es cambiar ese valor.

**Criterios de aceptación**

- El mapa se ve completo (calles, nombres, límites de CABA y Avellaneda) en un teléfono real.
- Sin conexión, después de haber abierto el mapa una vez, se siguen viendo las calles.
- Sin regresión en carga: Lighthouse mobile igual o mejor que la base.
- El modo anterior sigue disponible mientras se valida.

**Esfuerzo:** 2 a 4 días, sin contar el diseño ni el tiempo de decidir el alojamiento.

---

## 6. Orden sugerido y dependencias

1. **4A** — barato, bajo riesgo, se puede medir enseguida.
2. **Punto 2** — cuando el volumen se acerque a unos cientos de reportes. Es el cambio de fondo del lado del celular.
3. **4B** — si se decide que la app debe mostrar el mapa sin conexión o dejar de depender de OpenFreeMap.
4. **Punto 3** — solo si el volumen lo exige y **después** de la decisión del PO sobre la lectura pública.

**Dependencias entre puntos**

- Los puntos 2, 3 y 4 son independientes y pueden ir en ramas y PR separados. **No se mezclan**: si uno da problemas, se revierte solo ese.
- El punto 3 conviene después del 2: el mapa por capas maneja mejor los datos que llegan por área.
- El punto 4B es independiente del resto; solo cambia de dónde vienen las calles.

**Regla común de despliegue:** rama propia, interruptor, revisión en `staging` por PM y Sponsor, prueba en un Android de gama baja y un iPhone reales, y medición con los mismos scripts de Lighthouse antes y después. Si un cambio no mejora lo medido, no entra.

---

## 7. Decisiones que se necesitan

**7.1 Accesibilidad de los pines (punto 2).** Al pasar a capas, los pines dejan de ser botones navegables. Opciones:

- **(a)** Aceptarlo: el mapa es una vista visual y el listado accesible es «Mis reportes».
- **(b)** Ofrecer una vista de lista de los reportes cercanos como alternativa.
- **(c)** Mantener botones reales solo para lo visible y por debajo de un umbral de cantidad (mezcla más compleja).

*Requiere decisión de producto/UX. Sin ella no conviene empezar el punto 2.*

**7.2 Lectura pública de `citizen_reports` (punto 3).** Está pendiente como `[DECISION HERNAN]` desde la migración R5-04: qué se expone públicamente junto a las coordenadas. El punto 3 no debe avanzar antes.

**7.3 Alojamiento del archivo de mapa (punto 4B).** Storage de Supabase o red de distribución de contenidos, y quién lo actualiza y cada cuánto.

**7.4 Umbrales que disparan cada punto.** Propuesta a validar con el PM: revisar el punto 2 al superar ~300 reportes con coordenadas, y el punto 3 al superar ~1.000, o antes si el tope de 200 empieza a ocultar reportes. Son valores de partida, no medidos.

**7.5 Ticket de Jira.** Se necesita el número (o uno por punto) para nombrar las ramas `fix/REP-XXXX-...` según la regla del flujo de trabajo.

---

## 8. Lo que no está medido y las suposiciones

- **Las estimaciones de esfuerzo** son orientativas, del autor, y no se validaron con el equipo.
- **El rendimiento con reportes reales** en Lighthouse: las mediciones se hicieron con el mapa vacío. Falta medir con los 176 reales y con conjuntos de prueba de 1.000, 5.000 y 20.000 puntos.
- **La mejora concreta de cada punto** no se conoce hasta implementarlo y medirlo. Los beneficios descritos son los esperables por cómo funcionan las técnicas, no resultados obtenidos en Reportalo.
- **Ningún punto se probó en un dispositivo físico.** Las conclusiones por tipo de celular son inferencias del emulador de Lighthouse.
- **Se midió con Edge** (no hay Chrome instalado en la máquina de prueba); los números son comparables pero no idénticos.
- **Índices en la base:** no se pudo verificar desde el repositorio si `citizen_reports` tiene un índice sobre la ubicación.
- **Soporte de lecturas parciales** en el alojamiento elegido para el punto 4B: pendiente de comprobar.

---

**Documentos relacionados:** [REP-3798](https://unlz2026.atlassian.net/browse/REP-3798) · [REP-3791](https://unlz2026.atlassian.net/browse/REP-3791) · [PERF_mapa-mobile_rendimiento-y-alternativas.md](PERF_mapa-mobile_rendimiento-y-alternativas.md) · [REP-3787-H36-mapa-datos-reales.md](../.agents/workflow/executions/REP-3787-H36-mapa-datos-reales.md)
