# Reporte de Ejecución: REP-3811-RESTAURACION-run-001

## Identificación
- **Tarea**: No restaurar borradores ya encolados al abrir un reporte nuevo (hallazgo de REP-3811; sin clave de Jira propia: pasarle una si se crea el ticket)
- **Rama**: `fix/REP-3811-RESTAURACION-no-restaurar-borradores-ya-encolados-al-abrir-un-reporte-nuevo` (desde `staging`, independiente de REP-3810 y REP-3811)
- **Fecha**: 2026-10-04
- **Estado**: READY_FOR_PR

## 1. Problema
Al abrir `/nuevo-reporte` sin una foto recién tomada, `NewReportPage` restauraba el borrador activo más reciente, **incluso uno ya en la cola de envío (`PENDING_SYNC`)**: el reporte nuevo adoptaba su `client_side_id`, precargaba su descripción, categoría y ubicación y lo pisaba al editar. Si el pendiente viejo se enviaba solo mientras tanto, el reporte nuevo reutilizaba el id de uno ya creado (causa del 42501 de REP-3810).

## 2. Cambio
- `getActiveDraftReport` (`offlineStorageService.js`) devuelve solo borradores en edición (`DRAFT_LOCAL`). Los `PENDING_SYNC` ya están en Pendientes y los envía `PendingSyncManager`. Único consumidor: `NewReportPage`.
- La restauración de un borrador en edición (recarga, navegación accidental) sigue funcionando.

## 3. Quality Gates
- Pruebas nuevas: 4. Servicio: UT-REST-01 (un `PENDING_SYNC` no es el activo) y UT-REST-02 (con uno encolado más reciente y uno en edición, el activo es el que está en edición). Flujo completo (`Rep3811RestauracionBorradores.test.jsx`): UT-REST-03 (con un pendiente existente, el reporte nuevo empieza con la descripción vacía y el pendiente queda con su id, descripción y foto) y UT-REST-04 (un borrador en edición sí se restaura). UT-REST-03 falló antes del cambio.
- `vitest run`: 87 archivos, 633 tests en verde. `vite build`: OK.

## 4. Efecto a tener en cuenta
Un borrador que pasó a `PENDING_SYNC` porque se cortó la conexión **mientras se editaba** ya no se reabre en el asistente tras una recarga: queda en Pendientes y se envía solo al volver la señal (si le falta algo, se completa desde su tarjeta, REP-3811). Es consistente con que `PENDING_SYNC` signifique «ya en la cola».

## 5. Rollback
Revertir el commit (cambio acotado a un filtro de estado).
