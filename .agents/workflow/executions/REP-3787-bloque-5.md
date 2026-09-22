# Reporte de Ejecución — REP-3787 · Bloque 5 (Mapa de inicio y navegación)

- **Tarea:** REP-3787 · **Bloque:** 5 · **Pantallas:** M08 (teléfono) · D09 (escritorio)
- **Rama:** `feat/REP-3787-uj33` · **Base declarada por el bloque:** `3995cf3`
- **Fecha:** 22/09/2026 · **Estado:** READY_FOR_PR

---

## 1. Primer bloque que llega sin ningún problema

Generado contra `3995cf3`, que era exactamente la cabeza de la rama. **`git apply` limpio, sin
un solo offset** — algo que no había pasado en todo el handoff. Ivo aplicó las reglas R-1 a R-6
del documento de instrucciones y se nota en el resultado:

| Control | Resultado |
|---|---|
| Base declarada y real | Coinciden (`3995cf3`) |
| Archivos nuevos | Ninguno: modifica cuatro que ya existían |
| Imports | Todos resuelven |
| Alcance del parche | Solo el commit del bloque |
| Conflictos | Ninguno |

## 2. Qué se aplicó

| Archivo | Cambio |
|---|---|
| `src/components/layout/AppLayout.jsx` | Capa visual con tokens. Teléfono: cabecera con logo, campana con badge y cuatro pestañas. Escritorio: navegación en el encabezado con «Reportar» y avatar. Incluye el conmutador de tema, apagado (H-09). |
| `src/components/map/CitizenMap.jsx` | Se quita la columna lateral de 312 px: el mapa ocupa todo el ancho. Controles flotantes con tokens y ficha del reporte al tocar un pin. Prop nueva opcional `onOpenReport`. |
| `src/pages/MapPage.jsx` | Pasa `onOpenReport` para abrir `/reportes/:id` desde la ficha. |
| `src/test/MapFlow.test.jsx` | UT-MP-02 ajustado: «Reportar» sale de la barra de pestañas. |

Sin cambios en la lógica del mapa, props, hooks, servicios, `data-testid` ni textos de tests.

## 3. Quality Gates

| Gate | Comando | Resultado |
|---|---|---|
| Unit tests | `pnpm test` | **279 / 279 en verde** (41 archivos) |
| Build | `pnpm build` | **Compila.** PWA `injectManifest`, 58 entradas de precache |

**Diferencia con lo que reporta el bloque:** su README dice «277 de 279 en verde. Fallan
UT-QPS-14 y UT-QPS-15 (H-06)». Acá dan **279/279**. Esos dos tests quedaron corregidos por el
merge del PR #95 (REP-3774), que ya está en la base `3995cf3`. Es probable que el checkout de
verificación no estuviera del todo actualizado, o que el `node_modules` fuera de otra base.
**H-06 no existe desde el 21/09.**

## 4. H-36 confirmado: el mapa muestra datos de prueba

Verificado en el código:

```
src/components/map/CitizenMap.jsx:41:import { MOCK_REPORTS } from '../../data/mockReports';
```

El resumen, los filtros, la leyenda y la ficha del reporte trabajan sobre `mockReports.js`, no
sobre `citizen_reports`. Y «Ver el reporte» navega a `/reportes/:id` con ids inventados, así
que el detalle va a mostrar «No encontramos este reporte».

Las categorías de esos datos de prueba (`Alumbrado público`, `Higiene urbana`, `Espacios
verdes`, `Tránsito y semáforos`) no existen en la base.

**No bloquea el bloque**: el rediseño es correcto y se conecta a datos reales sin tocar la
presentación. Pero mientras el mapa siga con datos de prueba, la pantalla principal de la app
muestra reportes que no existen. Conviene abrir un ticket propio.

## 5. H-03 y H-04 resueltos contra la base (R-5)

Ivo los dejó marcados como «a verificar contra la base». Consultado `public.services` del
proyecto CiudadAR el 22/09/2026:

| service_code | service_name | group_name |
|---|---|---|
| `INFRAESTRUCTURA` | Infraestructura | Vía pública |
| `TRANSITO` | Tránsito | Vía pública |
| `AMBIENTE` | Ambiente | Vía pública |
| `COMERCIO_IRREGULAR` | Comercio irregular | Vía pública |
| `VULNERABILIDAD_SOCIAL` | Vulnerabilidad social | Asistencia social |

**H-03 — confirmada, y el UJ tiene razón.** La base dice «Infraestructura». Los que dicen
«Infraestructura vial» son `seed.sql` y el respaldo del frontend.

**H-04 — confirmada.** Producción tiene **cinco** categorías: «Comercio irregular» **y**
«Vulnerabilidad social» conviven, el UJ no reemplaza una por otra. La grilla de M10 mostraría
las cinco. Queda como decisión de producto si «Vulnerabilidad social» se muestra al ciudadano.

## 6. Hallazgo nuevo: el seed tiene el mismo problema en `services`

Es el mismo patrón que con `report_states`, en otra tabla:

| | Producción | `seed.sql` y frontend |
|---|---|---|
| Códigos | `INFRAESTRUCTURA`, `TRANSITO`, `AMBIENTE`, `COMERCIO_IRREGULAR`, `VULNERABILIDAD_SOCIAL` | `infraestructura_vial`, `infraccion_transito`, `medio_ambiente`, `comercio_irregular` |
| Cantidad | 5 | 4 |
| Nombres | Infraestructura · Tránsito · Ambiente | Infraestructura vial · Infracción de tránsito · Medio ambiente |

No coincide ni en código, ni en nombre, ni en cantidad. `DEFAULT_REPORT_CATEGORIES` del
frontend arrastra los mismos valores, así que si el fetch de categorías falla, el ciudadano ve
una lista que no existe.

Alinearlo es un cambio aparte de este bloque, porque los `service_id` del seed están
referenciados por los reportes de ejemplo y por el corpus.

## 7. Pendiente

- Abrir ticket para conectar el mapa a `citizen_reports` (H-36).
- Alinear `services` en `seed.sql` y `DEFAULT_REPORT_CATEGORIES` con la base (§6).
- **H-04 para Hernán:** ¿«Vulnerabilidad social» se muestra al ciudadano en M10?
- H-37 (mapa de calor), H-38 (chip de zona), H-39 (ventana de 7 días), H-40 (contador de no
  leídas): definiciones de producto, no bloquean.

---

*Reportalo · REP-3787 · Sprint 13 · Matías Krepchuk*
