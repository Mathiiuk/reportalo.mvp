# Especificación Funcional — REP-2500-PRESEL

- **ID:** REP-2500-PRESEL
- **Título:** Preseleccionar la localidad detectada para agilizar el envío del reporte
- **Ticket padre:** [REP-2500](https://unlz2026.atlassian.net/browse/REP-2500)
- **Tipo:** feat
- **Responsable:** Matías Krepchuk
- **Rama base:** `feat/REP-3789-...` (apilada: toca `NewReportPage`, ya modificado allí)
- **Estado:** PLANNED — **requiere aprobación**, ver §6

---

## 1. Problema

Al enviar un reporte, el ciudadano ya entregó su ubicación: la app obtiene las coordenadas del
dispositivo automáticamente y hasta etiqueta cada foto con ellas al capturarla. Sin embargo, el
paso de revisión le exige **abrir un modal y elegir la localidad a mano** antes de poder enviar.

El resultado es un paso percibido como redundante que frena el envío, señalado por el Líder
Técnico durante la validación de REP-3789.

## 2. Por qué estaba así

No es un descuido. En [`docs/REP-2500_resolucion-locality-id.md`](../../../docs/REP-2500_resolucion-locality-id.md)
se evaluaron cuatro opciones y se eligió la **Opción 1 (selector manual)** por ser *"el cambio
mínimo que produce un dato correcto y confiable, sin depender de resolver el geocoding real — que,
de decidirse, queda mejor planteado como una tarea aparte"*.

Además, `localityCentroids.js` declaraba explícitamente que los centroides **nunca** debían usarse
para inferir el barrio automáticamente.

## 3. Qué cambia

Se introduce un punto intermedio entre la Opción 1 (todo manual) y la Opción 4 (geocoding real,
diferido): **preseleccionar y que el ciudadano confirme**.

La localidad más cercana a la ubicación real del dispositivo llega ya elegida, de modo que el
ciudadano solo presiona el botón de envío. La confirmación no desaparece: sigue siendo él quien
acepta, viendo qué localidad se eligió y con "Ajustar" siempre disponible.

## 4. Restricción legal que se mantiene

La ubicación se sigue obteniendo **exclusivamente de la API de Geolocalización del navegador**.
No se leen metadatos EXIF de las fotografías, en cumplimiento de la Ley 25.326 y de la regla
declarada en `locationService.js`. Esta tarea no toca esa restricción.

## 5. Criterios de aceptación

| # | Criterio |
|---|---|
| CA-01 | Con permiso de GPS concedido y dentro del área habilitada, la localidad llega preseleccionada y el envío procede sin pasos extra. |
| CA-02 | El ciudadano ve que la localidad fue detectada automáticamente y puede corregirla. |
| CA-03 | Sin permiso de GPS no se sugiere nada: el flujo queda exactamente como antes. |
| CA-04 | Fuera de CABA/Avellaneda no se sugiere nada. |
| CA-05 | Una localidad elegida a mano, o restaurada de un borrador, tiene prioridad sobre la sugerencia. |

## 6. Riesgo y aprobación requerida

Los centroides son **aproximados, no polígonos oficiales**. Cerca de un límite entre barrios
—Caballito, Almagro y Flores se tocan— la sugerencia puede no ser la correcta. Y el `locality_id`
define **qué organismo recibe el reclamo**, así que una sugerencia equivocada y aceptada sin
mirar deriva el reporte a la jurisdicción incorrecta.

Mitigaciones aplicadas:
- Solo se sugiere con lectura real de GPS, nunca con el valor por defecto.
- No se sugiere si el centroide más cercano está a más de 5 km.
- El aviso de "detectada por tu ubicación" es explícito y visible junto al botón de ajuste.

> **Requiere sign-off.** Esta tarea modifica la decisión registrada en REP-2500 y responde al punto
> abierto **O-1** de ese documento, asignado a **Leonel Nuñez** y **Hernán Gregorini**. No debería
> mergearse sin esa aprobación.

## 7. Fuera de alcance

- Geocoding real con polígonos oficiales (Opción 4 de REP-2500).
- Ampliar la cobertura de centroides más allá de los 56 barrios actuales.
- Cualquier uso de EXIF como fuente de ubicación.
