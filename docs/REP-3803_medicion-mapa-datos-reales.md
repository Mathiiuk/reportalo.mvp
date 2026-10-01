# Reportalo

*Plataforma de Auditoría Ciudadana*

## REP-3803 — MEDICIÓN DE /MAPA CON DATOS REALES Y EVALUACIÓN DE AJUSTES DEL MOTOR (4A)

**Versión 1.0 · 1 de octubre de 2026 · Construcción · Proyecto RAR-2026**

**Jira:** [REP-3803](https://unlz2026.atlassian.net/browse/REP-3803) (tarea · independiente del lote [REP-3798](https://unlz2026.atlassian.net/browse/REP-3798))
**Confluence:** espacio `Reportalo` — pendiente de publicar
**Referencia:** [PERF_mapa-escala_propuesta-para-PM.md](PERF_mapa-escala_propuesta-para-PM.md) v1.0 (30/09/2026) · [PERF_mapa-mobile_rendimiento-y-alternativas.md](PERF_mapa-mobile_rendimiento-y-alternativas.md)

**Equipo:** Hernán Gregorini (PO / Autor) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

> **Propósito.** Dejar una línea base reproducible de `/mapa` con la sesión armada y los reportes reales cargados, evaluar uno por uno los ajustes de motor del punto 4A, y registrar qué se concluye. **Resultado: ningún ajuste de 4A mejora la medición por encima del ruido, por lo que no se incorpora ninguno.** Además, la línea base real es bastante peor que lo medido el 30/09 con el mapa vacío.

---

## 1. Resumen

- **Ningún ajuste de 4A se conserva.** `fadeDuration`, `pixelRatio`, `renderWorldCopies` y el tamaño de la caché de tiles, medidos aislados y combinados, quedan dentro de la variación que el propio equipo de medición muestra entre dos corridas de la misma base. No hay cambios en `src/` por esta tarea.
- **La línea base real no cumple el Plan de Calidad §3.2 en celular.** Con 187 reportes reales y caché fría: Performance **43** (criterio ≥ 80) y FCP **~2,56 s** (criterio < 2,5 s). En desktop la mediana es **81** (cumple, con poco margen).
- **Las cifras anteriores no eran representativas.** Las del 30/09 (Performance 77–80 mobile, 99 desktop) se tomaron con el mapa **vacío** (la consulta de reportes devolvía 401) y con la caché ya tibia. No deben usarse como referencia del flujo real.
- **El costo está en ejecutar JavaScript, no en las opciones del motor.** En el diagnóstico, de ~3,9 s de ejecución de scripts en mobile, ~2,1 s son del bundle de `maplibre-gl` y ~1,4 s del bundle principal de la app.
- **Hoy hay 187 reportes con coordenadas**, no 176. El tope de la consulta es 200: quedan **13 de margen (93,5 % del tope)**. Ver sección 8.
- **No se hizo** el QA independiente en staging ni la prueba en Android e iPhone reales (alcance 5 del ticket). Siguen pendientes y se describen en la sección 9.

---

## 2. Escenario de medición

### 2.1 Cómo se resolvió el 401 sin tocar autenticación ni RLS

El 401 de las mediciones anteriores se debía a que el arnés guardaba una sesión con un `access_token` inventado: PostgREST rechaza un JWT que no puede verificar. La solución no modifica la aplicación, la autenticación ni las políticas:

- La consulta del mapa lee `citizen_reports` por la política pública ya existente (`lectura_publica`).
- El arnés siembra en `localStorage` una **sesión simulada**, solo para que la guarda de rutas del cliente deje abrir `/mapa`, con el `access_token` igual a la **clave publicable** del proyecto (la misma que ya viaja en el bundle del cliente).
- Con esa configuración la consulta responde **HTTP 200**. Se verificó en cada corrida, en Lighthouse y en la sonda.

**Qué implica y qué no.**

- La lectura es la pública de siempre; no se accede a nada que no pueda ver cualquier visitante con la clave publicable.
- La sesión es **simulada**: el usuario no existe. Las llamadas que dependen de un usuario real (por ejemplo, sincronizar el consentimiento de términos) pueden fallar; no afectan a la consulta del mapa ni se midieron.
- La clave no se guarda en los resultados ni en el repositorio: el script la lee de `.env` al ejecutarse.

### 2.2 Datos cargados

Consulta de conteo, hecha el 1/10/2026 con la misma política pública:

| Dato | Valor |
|---|---|
| Reportes en `citizen_reports` | **187** |
| Reportes con coordenadas (los que pide el mapa) | **187** |
| Tope de la consulta (`MAP_REPORTS_LIMIT`) | 200 |
| Pines dibujados en cada corrida | **187** (verificado por la sonda en las 45 corridas de las tablas) |
| Estado HTTP de la consulta en cada corrida | **200** (sin 401/403) |

---

## 3. Entorno y condiciones

| Aspecto | Valor |
|---|---|
| Código medido | Commit `7845916` (rama `fix/REP-3803-perf-mapa-ajustes-motor`), sobre `staging` `5c94f78` |
| Optimización previa (base, no cuenta como trabajo nuevo) | Actualización de marcadores por diferencia (punto 1 de la propuesta), commit `53c4426` original, aplicado como `7845916` |
| Compilación | Producción (`vite build`), servida con `vite preview` |
| Navegador | Microsoft Edge 154.0.4258.37 (no hay Chrome instalado en la máquina de prueba) |
| Lighthouse | 13.5.0 (`puppeteer-core` 25.12.0, Node v24.15.0) |
| Sistema | Windows 11, una sola máquina, sin otra carga durante las corridas |
| **Mobile (Lighthouse)** | Emulación Moto G Power: 412×823, DPR 1,75; throttling simulado: RTT 150 ms, 1,6 Mbps, CPU 4× más lenta |
| **Desktop (Lighthouse)** | 1350×940, DPR 1; RTT 40 ms, 10 Mbps, sin ralentizar CPU |
| **Sonda "pines visibles"** | Estrangulamiento **real** por protocolo del navegador: en mobile CPU 4× y red de 150 ms / 1,6 Mbps de bajada / 0,75 Mbps de subida (aproximación de la "4G lenta" de Lighthouse); en desktop, sin estrangular |
| Caché | **Fría**: perfil de navegador nuevo en cada corrida, sin service worker registrado. No se midió la visita repetida (con el service worker ya instalado) |
| Corridas | 5 por configuración y perfil; se informa **mediana [mínimo–máximo]** |

**Sobre la compilación base.** La carpeta `dist-base` se compiló desde `7845916` sin ninguna modificación en `src/`.

---

## 4. Resultados — Mobile

Mediana [mínimo–máximo] de 5 corridas; entre paréntesis, la diferencia de la mediana contra `base-a`.

| Métrica | base-a | base-b | `fadeDuration: 0` | `pixelRatio ≤ 1,5` | `renderWorldCopies: false` | `maxTileCacheZoomLevels: 2` | Combinada |
|---|---|---|---|---|---|---|---|
| **Performance** | 43 [42–45] | 44 [43–49] | 42 [40–46] | 42 [38–46] | 43 [42–46] | 45 [42–46] | 45 [41–47] |
| **FCP (ms)** | 2564 [2495–2655] | 2624 [2505–2667] | 2623 [2482–3651] | 2563 [2555–3319] | 2566 [2553–3526] | 2559 [2389–2767] | 2624 [2552–3530] |
| **LCP (ms)** | 6884 [5993–7451] | 6817 [5540–6960] | 7518 [5670–7658] | 6116 [5861–7704] | 6031 [5666–7003] | 6548 [5935–6996] | 5942 [5685–6969] |
| **TBT (ms)** | 2135 [1428–2475] | 1970 [1202–2205] | 2296 [1472–2391] | 2383 [1480–3903] | 2062 [1760–2198] | 2035 [1437–2224] | 2098 [1344–2504] |
| **CLS** | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **Pines visibles (ms)** | 5259 [5051–5375] | 5405 [5322–5695] | 5426 [5110–5922] | 5327 [4934–5359] | 5425 [4870–5662] | 5254 [5185–5735] | 5452 [5229–5699] |

`base-a` y `base-b` son **la misma compilación medida al principio y al final de la tanda** (7 configuraciones × 5 corridas), para estimar cuánto deriva el propio equipo de medición. "Pines visibles" es el instante en que el mapa muestra los 187 pines (en todas las corridas aparecen todos juntos, por eso "primero" y "todos" coinciden).

### Lectura

- **Ruido medido:** entre `base-a` y `base-b`, la misma compilación difiere 165 ms en TBT, 146 ms en pines visibles y 67 ms en LCP. Los rangos mínimo–máximo de cada configuración son aún más amplios (por ejemplo, TBT de 1202 a 2475 ms en la base).
- **Ninguna variante se separa de ese ruido.** Todas las diferencias de mediana caen dentro de la banda de la base y los rangos se superponen. La combinada baja el LCP 942 ms en mediana, pero su rango (5685–6969) está contenido en el de la base (5993–7451) y el TBT y los pines no mejoran.
- **`pixelRatio` no solo no mejora: es la variante con peor dispersión** (TBT hasta 3903 ms en una corrida). Además tiene un costo de nitidez en pantallas densas.

### Resultado por ajuste

| Ajuste | Qué se probó | Resultado | Decisión |
|---|---|---|---|
| `fadeDuration` | `0` | Sin mejora medible. En MapLibre 6.6.0 controla el desvanecimiento de **etiquetas**, no la aparición de tiles (la propuesta del 30/09 lo describía mal) | No se incorpora |
| `pixelRatio` | `min(devicePixelRatio, 1.5)`; el emulador usa 1,75, así que sí recorta | Sin mejora, mayor dispersión; riesgo de legibilidad | No se incorpora |
| `renderWorldCopies` | `false` | Sin efecto medible. El mapa ya está acotado con `maxBounds`, por lo que no se repite el mundo | No se incorpora |
| Caché de tiles | `maxTileCacheZoomLevels: 2` (por defecto 5) | Sin mejora medible. Su beneficio esperable es de memoria, no de tiempo de carga | No se incorpora |
| Combinación de los cuatro | Todos juntos | Sin mejora separable del ruido | No se incorpora |

**No se probó** `maxTileCacheSize` con un valor fijo: no hay un valor que justificar sin medir memoria, y la medición de memoria en dispositivos físicos queda fuera de lo hecho (sección 9).

---

## 5. Resultados — Desktop

Mediana [mínimo–máximo] de 5 corridas. Se midieron la base y la combinación; con mobile sin ninguna mejora aislada no se justificó repetir cada variante.

| Métrica | Base | Combinada |
|---|---|---|
| Performance | 81 [78–90] | 81 [77–87] |
| FCP (ms) | 656 [582–795] | 782 [583–794] |
| LCP (ms) | 1384 [1256–1768] | 1633 [1370–1734] |
| TBT (ms) | 279 [178–319] | 267 [183–311] |
| CLS | 0 | 0 |
| Pines visibles (ms) | 785 [740–1655] | 816 [754–1798] |

Sin diferencia separable del ruido. La base de desktop (81) cumple el umbral de 80 con muy poco margen.

---

## 6. Evaluación contra el Plan de Calidad §3.2

Criterios citados en el ticket: **Lighthouse ≥ 80 y FCP < 2,5 s en 4G.**

| Perfil | Métrica | Medido (mediana) | ¿Cumple? |
|---|---|---|---|
| Mobile | Performance | 43 | **No** |
| Mobile | FCP | 2564 ms | **No** (por 64 ms; rango 2495–2655) |
| Desktop | Performance | 81 | Sí (margen de 1 punto; rango 78–90) |
| Desktop | FCP | 656 ms | Sí (la métrica de FCP < 2,5 s se aplica a 4G; desktop se informa como referencia) |

**Incumplimientos pendientes:** Performance en mobile y FCP en mobile, con caché fría.

**Alcance de esta evaluación.** Se midieron solo estas métricas, en una máquina, con un navegador y una conexión simulada. No se declara conformidad global con el Plan de Calidad; hay otros criterios que esta tarea no evaluó.

---

## 7. Dónde se va el tiempo (diagnóstico de una corrida mobile)

Una corrida con el reporte completo de Lighthouse sobre la base (Performance 44, TBT 1542 ms). Los valores son los que informa Lighthouse; son de una sola corrida y sirven para orientar, no para cuantificar mejoras.

| Concepto | Tiempo |
|---|---|
| Ejecución de scripts (total) | ~3,9 s |
| Bundle de `maplibre-gl` | ~2,1 s de scripting |
| Bundle principal de la app (`index`) | ~1,4 s de scripting |
| Resto no atribuido | ~0,3 s |
| Estilo y layout | ~0,4 s |

Tareas largas más grandes: 453 ms y 312 ms (`maplibre-gl`), 414 ms y 356 ms (bundle principal). Peso transferido: ~1,08 MB (249 KiB `maplibre-gl`, 183 KiB bundle principal, más tiles y la imagen del mapa base).

**Lectura:** con la tecnología actual, el tiempo se reparte entre el motor del mapa y la aplicación en sí. Un ajuste de opciones del motor no toca ninguno de los dos.

---

## 8. Riesgo funcional separado: el tope de 200 reportes

- Hoy hay **187 reportes con coordenadas** y el mapa pide hasta **200**: **13 de margen**.
- Cuando se supere el tope, el mapa deja de mostrar los reportes **más antiguos** de cualquier zona, sin aviso al ciudadano.
- Este margen es verificable con la consulta de conteo de la sección 2.2. El número del 30/09 (176) era un dato de la propuesta, no un conteo.
- **Recomendación:** no esperar a 1.000 reportes. Definir antes de llegar a 200 qué hace el mapa al superar el tope (por ejemplo, avisar que se muestran los más recientes, o planificar la consulta por zona del punto 3 de la propuesta). Esa decisión no se toma en esta tarea.

---

## 9. Lo que NO se hizo y próximos pasos

### 9.1 Pendiente del alcance de REP-3803

- **QA independiente en staging** (alcance 5): no se hizo. Como esta tarea no cambia código de la aplicación, no hay nada nuevo que desplegar a staging; la base ya está allí. Si se quiere medir staging, el arnés acepta cualquier carpeta de compilación, pero para medir una URL de staging habría que extenderlo.
- **Prueba en Android e iPhone reales** (alcance 5): no se hizo. No hay dispositivos disponibles para el agente. Debe hacerla una persona, registrando modelo y versión, y diferenciando carga inicial de fluidez al mover y seleccionar.
- **Visita repetida:** no se midió. Con el service worker instalado la carga puede ser mucho más rápida; hoy solo se conoce la primera visita.
- **Medición con Chrome:** se usó Edge. Conviene repetir una tanda con Chrome para confirmar que no cambia las conclusiones.
- **Memoria y fluidez al mover el mapa:** no se midieron. Los ajustes de caché y `pixelRatio` podrían tener beneficios ahí que Lighthouse no captura.

### 9.2 Próximos pasos si se quiere mejorar el rendimiento

Ordenados por lo que sugiere el diagnóstico. **Ninguna mejora está medida**; el esfuerzo es orientativo.

| Paso | Qué ataca | Esfuerzo (orientativo) | Dependencias |
|---|---|---|---|
| Partir el bundle principal (`index`, ~1,4 s de scripting) y cargar por demanda lo que `/mapa` no necesita al inicio | Ejecución de la app | 1 a 2 días | Auditar qué dependencias entran al bundle (por ejemplo `react-dom/server`, usado solo para los íconos de los pines) |
| Cargar MapLibre después del primer pintado | Primer pintado | Ya probado el 30/09: no baja el TBT y empeoró el LCP de desktop | — |
| Reportes como capas del mapa en lugar de elementos DOM (punto 2 de la propuesta) | Costo de dibujar los pines y escala | 2 a 4 días | Decisión de accesibilidad de los pines |
| Mapa base propio en PMTiles (punto 4B de la propuesta) | Dependencia de OpenFreeMap, uso sin conexión | 2 a 4 días | Dónde alojarlo; fuera del alcance de esta tarea |
| Consulta por zona visible (punto 3 de la propuesta) | Tope de 200 | 3 a 5 días | Decisión del PO sobre la lectura pública; fuera del alcance |

Los tres últimos están **fuera de alcance de REP-3803** y requieren refinamiento propio, como indica el ticket.

---

## 10. Reproducción y reversión

### 10.1 Reproducir

Todo el arnés está en `scripts/perf-mapa/` (independiente del paquete principal).

1. `cd scripts/perf-mapa && npm install`
2. Compilar la base: `pnpm exec vite build --outDir .perf/dist-base --emptyOutDir` (desde la raíz).
3. Compilar las variantes de 4A: `node scripts/perf-mapa/build-variants.mjs fade0 pixel15 mundo cache combinada`. Requiere que `CitizenMap.jsx` tenga una constante `MAP_ENGINE_OPTIONS = {};`, que **no está en el código por esta tarea**; hay que agregarla temporalmente para repetir la comparación (el script la reemplaza y restaura el archivo).
4. Medir: `node scripts/perf-mapa/measure.mjs --dist .perf/dist-base --profile mobile --runs 5 --label base-a --out .perf/results` (el perfil puede ser `mobile` o `desktop`). Requiere un `.env` con las variables públicas de Supabase y Edge instalado (o `--browser` con otra ruta).
5. Resumir: `node scripts/perf-mapa/summarize.mjs .perf/results mobile base-a base-b fade0 pixel15 mundo cache combinada`.

Los JSON de las corridas de este informe están en `docs/perf/REP-3803/`. Cada uno guarda las 5 corridas y el entorno.

### 10.2 Reversión

**No hay nada que revertir en la aplicación:** esta tarea no modifica `src/`. Lo único que se agrega son el arnés (`scripts/perf-mapa/`), esta documentación, los resultados y la línea `.perf/` en `.gitignore`. Para deshacerlo basta con borrar esas rutas.

---

## 11. Correcciones a documentos anteriores

- **`PERF_mapa-escala_propuesta-para-PM.md` §5.1:** decía que `fadeDuration: 0` quita la "animación de aparición de tiles". En MapLibre 6.6.0 controla el desvanecimiento de las etiquetas. Corregido en ese documento.
- **Cifras del 30/09** (Performance 80 mobile / 99 desktop, TBT ~790 ms): se midieron con el mapa vacío y caché tibia. Quedan reemplazadas por las de este informe.

---

**Documentos relacionados:** [REP-3803](https://unlz2026.atlassian.net/browse/REP-3803) · [REP-3798](https://unlz2026.atlassian.net/browse/REP-3798) · [Plan de Calidad §3.2](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/51871745) · [PERF_mapa-escala_propuesta-para-PM.md](PERF_mapa-escala_propuesta-para-PM.md)
