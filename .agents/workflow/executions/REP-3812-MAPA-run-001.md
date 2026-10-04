# Reporte de Ejecución: REP-3812-MAPA-run-001

## Identificación
- **Tarea**: El mapa principal `/mapa` se traba en horizontal con la vista alejada en escritorio (seguimiento de REP-3812; sin clave de Jira propia: pasarle una si se crea el ticket)
- **Rama**: `fix/REP-3812-MAPA-el-mapa-principal-mapa-se-traba-en-horizontal-con-la-vista-alejada-en-escritorio` (apilada sobre la rama de REP-3812: reutiliza `getMinZoomToContainBounds`)
- **Fecha**: 2026-10-04
- **Estado**: READY_FOR_PR (falta la validación de QA en staging)

## 1. Problema
`CitizenMap` (`/mapa`) tenía la misma combinación que «¿Dónde ocurrió?»: `maxBounds` de CABA y Avellaneda (≈ 22 km de ancho) con `minZoom` fijo de 11,5. En un monitor ancho, la vista alejada supera el ancho del límite y MapLibre bloquea el eje horizontal.

## 2. Cambio
- `CitizenMap.jsx`: el `minZoom` inicial se calcula con el tamaño real del contenedor (`getMinZoomToContainBounds`, de REP-3812) y se recalcula con `map.on('resize')` + `setMinZoom`. El zoom inicial es `max(12,8; mínimo)` para que no arranque por debajo del mínimo en pantallas muy anchas (≥ ~2400 px).
- **El mapa sigue cerrado en CABA y Avellaneda**: `maxBounds` no cambia (prueba UT-3812-12 lo verifica). Solo sube el zoom mínimo en pantallas anchas; en teléfono es el de siempre (11,5).

## 3. Quality Gates
- Pruebas nuevas: 5 (`Rep3812MinZoomMapaPrincipal.test.jsx`). Sin el arreglo fallan las dos que dependen de él (zoom mínimo en 1920 px y recálculo al redimensionar); las otras tres son de control (límite, teléfono, zoom inicial).
- `vitest run`: 88 archivos, 644 tests en verde. `vite build`: OK.
- **Verificación en el navegador a 1920 px** (instancia de MapLibre enganchada para medir el centro):
  - Con el arreglo: `minZoom` 12,49; al zoom mínimo, arrastres reales en ambos sentidos mueven la longitud (−58,4273 ↔ −58,4327), sin salir del límite.
  - Sin el arreglo: `minZoom` 11,5 y el centro queda clavado en −58,43 aunque se pida −58,40 (eje horizontal bloqueado).

## 4. Rollback
Revertir el commit.
