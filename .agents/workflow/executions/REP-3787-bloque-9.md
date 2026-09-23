# Reporte de Ejecución — REP-3787 · Bloque 9 (Estados vacíos y errores)

- **Tarea:** REP-3787 · **Bloque:** 9 · **Pantallas:** M26 – M32 / D33 · D34 · D35
- **Rama:** `feat/REP-3787-uj33` · **Base declarada:** `e2f9f7e` (Bloque 6) + Bloque 8
- **Fecha:** 22/09/2026 · **Estado:** READY_FOR_PR

---

## 1. Aplicación

Falló solo en **`src/components/map/CitizenMap.jsx`**, el archivo que se había reescrito el
mismo día para conectar el mapa a datos reales (H-36). El resto aplicó limpio, incluidos los
ajustes a `MapFlow.test.jsx`.

| Archivo | Cambio |
|---|---|
| `src/components/common/EmptyState.jsx` | Nuevo. Estado vacío reutilizable. |
| `src/pages/ReportsPage.jsx` · `NewsPage.jsx` · `NotificationsPage.jsx` | Usan `EmptyState` con el copy del diseño. |
| `src/pages/NotFoundPage.jsx` · `NotFoundReportPage.jsx` | Colores a tokens; el 404 de ruta queda con una sola salida. |
| `src/pages/ForbiddenPage.jsx` | Nuevo. 403. |
| `src/App.jsx` | Ruta `/acceso-restringido`. |
| `src/components/map/CitizenMap.jsx` | Vacío del mapa unificado. **Resuelto a mano.** |

## 2. La resolución del mapa: el bloque asumía algo que dejó de ser cierto

La tarjeta que trae el bloque para M29 dice: *«Hay reportes en la zona, pero ninguno coincide
con los filtros activos»*, y ofrece «Limpiar filtros».

Eso era razonable cuando el mapa leía datos de prueba: **siempre** había cinco reportes, así que
un mapa vacío solo podía deberse a los filtros. Con datos reales hay tres situaciones distintas,
y decirlas igual sería mentirle al ciudadano:

| Situación | Qué se muestra |
|---|---|
| La consulta todavía viaja | «Cargando reportes…» |
| No hay ningún reporte en la zona | «Todavía no hay reportes en la zona» + qué va a pasar cuando los haya |
| Hay reportes, los filtros los dejaron afuera | La tarjeta del bloque, con el filtro activo y «Limpiar filtros» |

Solo la tercera ofrece limpiar filtros: en las otras dos el botón no arreglaría nada.

Además, la etiqueta del filtro activo se pasó por `filterLabel`. El bloque la imprimía cruda, y
desde el Bloque 5 el filtro guarda el código del §10: el ciudadano habría leído «en_revision»
en lugar de «En revisión».

Se retiró también el banner de vacío de teléfono, como pide el bloque: había dos avisos
distintos para lo mismo.

## 3. Quality Gates

| Gate | Comando | Resultado |
|---|---|---|
| Unit tests | `pnpm test` | **300 / 300 en verde** (47 archivos) |
| Build | `pnpm build` | **Compila.** PWA con service worker propio |

## 4. Observaciones

| ID | Observación | Responsable |
|---|---|---|
| H-48 | El 403 queda sin uso real hasta que exista el control por rol del panel del municipio. La ruta está registrada para engancharlo. | Matías |
| H-49 | El vacío del mapa no puede decir cuántos reportes hay en la zona ni ofrecer «Ampliar a 30 días» mientras no haya filtro por fecha (H-39). La parte de H-36 ya está resuelta: el mapa lee datos reales. | Matías · Hernán (PO) |
| H-50 | El copy del vacío de Novedades cambió al del diseño y se ajustaron dos tests. Si el PO prefiere el anterior, se revierte en una línea. | Hernán (PO) · Iván |

## 5. Estado del handoff

Con este bloque quedan aplicados **0, 1, 1-D, 2, 3, 4, 5, 6, 7, 8 y 9**.

Pendientes, todos trabados por definiciones ajenas:

- **Bloque 6-B** — Perfil (M19 / D20), a la espera de H-09.
- **Bloque 7-B** — onboarding y permisos (M04–M07), a la espera de PA-01 y del material gráfico.
- **Bloque 10** — municipio y oficial (D21–D30), fuera del Sprint 13.

---

*Reportalo · REP-3787 · Sprint 13 · Matías Krepchuk*
