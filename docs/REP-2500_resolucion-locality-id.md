# Reportalo

*Plataforma de Auditoría Ciudadana*

## RESOLUCIÓN DE LOCALITY_ID EN EL ENVÍO DE REPORTES

**Versión 1.0 · 14 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Jira:** [REP-2500](https://unlz2026.atlassian.net/browse/REP-2500) (Historia de Usuario · Sprint 12, stretch goal)
**Confluence:** espacio `Reportalo` · categoría Construcción — pendiente de publicar

**Equipo:** Hernán Gregorini (PO / Autor) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

**Consultor Especialista:** Carlos Ruiz (auditor externo · asesoría metodológica)

> **Propósito.** Documentar un bloqueo real encontrado al implementar REP-2500 (persistencia del reporte enviado) y presentar las opciones de resolución para debatir con Leo y Hernán antes de continuar la implementación.

---

## 1. Contexto

REP-2500 ("Conservar el reporte enviado para consultarlo después", Sprint 12, stretch goal) requiere que al enviar un reporte se cree un registro real y persistente en Supabase, reemplazando el flujo actual — que es enteramente simulado en la interfaz: no hace ningún insert real, muestra un código de reporte hardcodeado, y borra el único borrador local al llegar a la pantalla de "éxito".

Al planificar la implementación se encontró un bloqueo genuino, previo a cualquier cambio de código: la tabla `citizen_reports` exige un `locality_id` (localidad) válido y no nulo, y hoy no existe en el proyecto ninguna forma real de calcular esa localidad a partir de la ubicación GPS del ciudadano.

## 2. Estado real de la geolocalización hoy

La función `resolveAddressDetails()` (`src/services/locationService.js`) es la que arma hoy la dirección "legible" que ve el ciudadano. Es completamente simulada:

- Solo reconoce 3 zonas fijas por rango de coordenadas: Avellaneda, Palermo y San Nicolás (CABA).
- Para esas 3 zonas devuelve siempre la misma calle inventada (ej. "Av. Mitre 1240"), sin relación con la ubicación real del ciudadano dentro de la zona.
- Para cualquier otro punto (la gran mayoría de CABA y del conurbano) devuelve un genérico "Área Metropolitana de Buenos Aires", sin nombre de localidad utilizable.

**Advertencia de alcance.** El sistema nunca hizo geocoding real. Esto no es un bug introducido por REP-2500 — es una simulación preexistente que quedó expuesta al intentar conectar el envío del reporte a datos reales.

## 3. Hallazgos al inspeccionar la tabla `localities` en Supabase real

| Hallazgo | Detalle |
|---|---|
| Cobertura | Barrios de CABA y algunos partidos del conurbano (ej. Avellaneda), identificados solo por `id`, `name` y `subdivision_id`. |
| Sin geometría | No tiene polígonos ni bounding box — no hay forma de resolver "qué localidad corresponde a esta coordenada" con una consulta a esta tabla tal como está. |
| Duplicado de datos | Existen dos filas distintas con el mismo nombre "Avellaneda" y la misma subdivisión "Avellaneda" — un problema de calidad del seed, no atribuible al código. |
| Cobertura del mock | Los 3 nombres que usa el mock (Avellaneda, Palermo, San Nicolás) sí existen como filas reales — pero eso no alcanza, porque el mock solo cubre esas 3 zonas. |

## 4. Opciones evaluadas

**Opción 1 — Selector manual de localidad (recomendada)**

Agregar un combo/autocomplete en el paso de ubicación del formulario: el ciudadano confirma o elige su localidad de la lista real de `localities`. El GPS se sigue usando para latitud/longitud (eso ya funciona correctamente); `locality_id` pasa a salir de una elección explícita, no de un cálculo.

- A favor: resuelve el problema de raíz, dato confiable, cambio de alcance acotado (un selector + una consulta), no depende de arreglar el geocoding.
- En contra: agrega un paso de interacción; sin coordenadas de referencia por localidad no hay forma de preseleccionar automáticamente "la más cercana".

**Opción 2 — Mapear por el mock actual**

Reutilizar el texto `locality` que ya devuelve `resolveAddressDetails()` (ej. "Palermo, CABA") y buscarlo por nombre en `localities.name`.

- A favor: cero interfaz nueva, se integra ya con lo existente.
- En contra: solo cubre 3 zonas reales; fuera de ellas el valor devuelto no existe en la tabla y el insert fallaría. Además hereda el duplicado de "Avellaneda". No es viable sin antes arreglar el mock.

**Opción 3 — Localidad por defecto fija**

Insertar siempre el mismo `locality_id` (ej. una localidad "sin especificar" o la primera fila de Avellaneda), sin importar la ubicación real del ciudadano.

- A favor: mínimo esfuerzo, desbloquea el insert de inmediato.
- En contra: el dato de ubicación queda falso para prácticamente todos los reportes — contradice el propósito de una plataforma de auditoría ciudadana pública, donde la localidad del reporte es un dato relevante.

**Opción 4 — Resolver primero el geocoding real**

Ampliar el alcance para implementar reverse-geocoding real (servicio externo tipo Nominatim/Google Geocoding, o carga de polígonos reales por localidad) antes de tocar la persistencia del reporte.

- A favor: resuelve el problema de fondo de una sola vez, con datos geográficamente correctos.
- En contra: es un trabajo considerablemente más grande (integración externa o carga de geometrías), no está en el alcance original de REP-2500 y no encaja como tarea de Sprint 12 — sería una historia de usuario aparte.

## 5. Tabla comparativa

| Opción | Esfuerzo | Calidad del dato | Alcance de Sprint 12 |
|---|---|---|---|
| 1. Selector manual | Bajo | Alta (elegido por el ciudadano) | Sí |
| 2. Mapear por mock | Muy bajo | Baja (solo 3 zonas, con bug) | Sí, pero no funcional |
| 3. Default fijo | Mínimo | Muy baja (dato falso) | Sí, pero degrada el dato |
| 4. Geocoding real | Alto | Alta (real) | No — HU aparte |

## 6. Recomendación

> **Decisión propuesta.** Opción 1 (selector manual de localidad): es el cambio mínimo que produce un dato correcto y confiable, mantiene REP-2500 dentro del alcance de Sprint 12, y no depende de resolver el geocoding real — que, de decidirse, queda mejor planteado como una tarea aparte (Opción 4) dado su tamaño.

## 7. Pendientes de resolución

| Ref. | Observación / Decisión | A quién corresponde |
|---|---|---|
| O-1 | Aprobar si el selector manual de localidad forma parte del alcance de REP-2500 o si se prefiere otra opción | Leonel Nuñez, Hernán Gregorini |
| O-2 | Definir si el duplicado de "Avellaneda" en `localities` se corrige como tarea aparte de datos | Hernán Gregorini |
| O-3 | Si se opta por Opción 4, decidir si se abre una nueva HU de geocoding real y en qué sprint | Leonel Nuñez |

---

**Documentos relacionados:** [REP-2500](https://unlz2026.atlassian.net/browse/REP-2500)
