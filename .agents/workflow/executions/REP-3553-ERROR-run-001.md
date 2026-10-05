# Reporte de Ejecución: REP-3553-ERROR-run-001

## Identificación
- **Tarea**: Estado de error propio en Mis reportes cuando falla la lectura (hallazgo de REP-3553; sin clave de Jira propia: pasarle una si se crea el ticket)
- **Rama**: `fix/REP-3553-ERROR-estado-de-error-propio-en-mis-reportes-cuando-falla-la-lectura` (apilada sobre `test/REP-3553-…`: se mergea después)
- **Fecha**: 2026-10-05
- **Estado**: READY_FOR_PR

## 1. Problema
Si la lectura de los reportes fallaba (sin red, error de la base), `/reportes` decía «Todavía no enviaste reportes» y ofrecía «Hacer mi primer reporte»: el ciudadano podía creer que perdió sus reportes.

## 2. Cambio (`src/pages/ReportsPage.jsx`)
- Distingue tres situaciones (UJ v3.3 M26-M28): cargando, vacío de verdad y **error de lectura**.
- El error muestra «No pudimos cargar tus reportes. Revisá tu conexión y probá de nuevo. Tus reportes no se perdieron.» con **Reintentar** y «Ver el mapa de la zona». Los borradores sin enviar siguen a la vista.
- «Reintentar» vuelve a pedir la lista (muestra «Cargando…» mientras tanto); si funciona muestra la lista y, si de verdad no hay reportes, recién ahí el estado vacío.
- No cambia el sondeo en vivo (una falla de refresco sigue ignorándose) ni el resto de la pantalla.

## 3. Pruebas
- 6 pruebas nuevas (`Rep3553ErrorLectura.test.jsx`): el error no dice «todavía no enviaste», reintentar con éxito, reintento fallido y después vacío real, cargando durante el reintento, borradores visibles, salida al mapa. Las pruebas existentes de la pantalla siguen en verde.

## 4. Rollback
Revertir el commit.
