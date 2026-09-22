# Reporte de Ejecución — REP-3787 · H-36: el mapa con datos reales

- **Tarea:** REP-3787 · **Observación:** H-36 (Bloque 5)
- **Rama:** `feat/REP-3787-uj33` · **Fecha:** 22/09/2026 · **Estado:** READY_FOR_PR

---

## 1. El problema

`CitizenMap` importaba `src/data/mockReports.js`. La pantalla principal de la app mostraba
**cinco reclamos inventados**, con categorías que no existen en la base («Alumbrado público»,
«Higiene urbana», «Espacios verdes»), y «Ver el reporte» navegaba a `/reportes/REP-101`, un id
ficticio, así que el detalle devolvía «No encontramos este reporte».

El resumen, los filtros, la leyenda y la ficha trabajaban sobre ese invento.

## 2. Qué se hizo

| Archivo | Cambio |
|---|---|
| `src/services/mapReportsService.js` | **Nuevo.** `getPublicMapReports()` lee `citizen_reports` y adapta cada fila a la forma que dibuja el mapa. |
| `src/components/map/CitizenMap.jsx` | Pasa a ser presentacional: recibe `reports` e `isLoadingReports` por prop. Filtros por estado real. Íconos para las cinco categorías. |
| `src/pages/MapPage.jsx` | Trae los reportes y los pasa al mapa. |
| `src/data/mockReports.js` | **Eliminado.** Quedó sin uso. |
| `src/test/MapReportsService.test.js` | **Nuevo.** 6 tests del servicio. |
| `src/test/MapFlow.test.jsx` | Los tres tests que verificaban los datos inventados ahora declaran sus propios datos. Se suma UT-MP-12. |

## 3. Decisiones

**La consulta es pública a propósito.** `citizen_reports` tiene la policy `lectura_publica`
justamente porque el mapa muestra los reclamos de todo el barrio, no solo los propios. Por eso
el `select` **no trae nada sensible**: ni `user_id`, ni el análisis jurídico, ni las fotos. El
detalle, que sí es privado, sigue validando pertenencia por su cuenta.

**Los filtros pasan al vocabulario del §10.** Antes eran «Enviado / En curso / Resuelto», el
vocabulario de los datos inventados. Ahora se compara contra el código normalizado
(`RECIBIDO`, `EN_ANALISIS`, `DERIVADO`, `RESUELTO`, `DESESTIMADO`), no contra la etiqueta
visible, así la traducción sigue viviendo en un solo lugar.

**El título sale de la descripción.** La base no guarda un título aparte: el ciudadano escribe
un solo texto. Se usa su primera oración, recortada a 70 caracteres, y el texto completo queda
como descripción.

**«Cargando» y «vacío» dejan de ser lo mismo.** Con datos inventados el mapa siempre tenía algo
que mostrar. Ahora decir «no hay reportes» mientras la consulta viaja sería mentir.

**Si la consulta falla, el mapa se dibuja igual.** Es la pantalla de inicio: no puede quedar en
blanco. Se avisa con un toast y no se inventa ningún reclamo.

## 4. Un bug que encontró su propio test

UT-MAP-05 falló en la primera corrida: `Number(null)` es `0`, que **es finito**, así que el
filtro de coordenadas dejaba pasar una fila sin ubicación y el reporte terminaba dibujado en el
golfo de Guinea. Se agregó `toCoordinate`, que convierte los vacíos en `NaN`, que es lo que el
filtro sabe rechazar.

## 5. Verificación contra la base

La consulta se probó contra producción (proyecto CiudadAR) antes de darla por buena: devuelve
las filas con sus joins de `services` y `localities` resueltos. Entre los datos reales aparece
un reporte de **«Vulnerabilidad social»**, la quinta categoría, lo que confirma que el manejo
del ícono y el color para esa categoría hacía falta de verdad.

## 6. Quality Gates

| Gate | Comando | Resultado |
|---|---|---|
| Unit tests | `pnpm test` | **295 / 295 en verde** (45 archivos) |
| Build | `pnpm build` | **Compila.** PWA con service worker propio |

## 7. Lo que sigue abierto del mapa

| ID | Observación | Responsable |
|---|---|---|
| H-37 | No hay capa de calor. El diseño muestra un mapa de calor y la leyenda «Menos/Más»; se dibujan marcadores. | Matías · Iván (UX) |
| H-38 | El chip de zona necesita coordenadas por localidad para centrar, y que los reportes traigan localidad para filtrar. | Hernán (PO) · Matías |
| H-39 | «Reportes · 7 días» no se puede sostener: no hay ventana temporal en la consulta. | Hernán (PO) · Matías |
| H-40 | La campana y el punto de «Novedades» siguen con valores fijos. | Matías |

---

*Reportalo · REP-3787 · Sprint 13 · Matías Krepchuk*
