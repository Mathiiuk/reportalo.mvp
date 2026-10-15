# REP-2502 · Estados y trazabilidad inicial del reporte

**Fecha:** 13/10/2026 · **Responsable:** Matías · **Estado:** mecanismo implementado y probado en local; **migración NO aplicada en staging**. **La máquina de estados y la definición de «resuelto» siguen pendientes de Hernán (H-2).**

## Lo que ya existía (relevado en staging, 13/10/2026)

| Dato | Valor |
|---|---|
| Estados en la base (`report_states`) | `RECIBIDO`, `EN_ANALISIS`, `DERIVADO`, `RESUELTO`, `DESESTIMADO` |
| Estados que nombra la HU | recibido, en revisión, aprobado y rechazado. **No coinciden con los de la base** (no existen «aprobado» ni «rechazado»); la app los traduce a su taxonomía en `reportStatus.js` |
| Quién cambia estados hoy | Dos funciones del RAG (`enqueue_rag_analysis`: RECIBIDO → EN_ANALISIS; `persist_rag_analysis`: EN_ANALISIS → DESESTIMADO o RESUELTO) y, según el comentario de REP-3798, quien atiende el reporte **por fuera de la app** |
| Reportes por estado | EN_ANALISIS 212 · RECIBIDO 174 · RESUELTO 20 · DERIVADO 2 · DESESTIMADO 2 (410) |
| Coherencia | Los 238 reportes que tienen historial coinciden con su último registro. 172 reportes no tienen historial (174 están en RECIBIDO; solo 2 tienen registro) |
| Lo que le faltaba al historial | Estado anterior, evento que lo causó y tipo de actor. Un intento no autorizado o inválido no dejaba rastro, y nada impedía una transición absurda |

## Qué se hizo (migración `20261013160000_rep2502_estados_y_trazabilidad_del_reporte.sql`)

| Pieza | Qué es |
|---|---|
| Columnas nuevas en `report_state_history` | `previous_state_code`, `event_code`, `actor_type`. Un trigger las completa solo en cada registro nuevo, venga de donde venga (incluidas las funciones del RAG, que **no se tocaron**). Se rellenan los registros viejos que se pueden deducir |
| `report_state_transitions` | La matriz de transiciones permitidas, **como datos**. Sembrada **solo** con las 3 que el sistema ya hace hoy (decisión de Matías, REP-3798). **Ninguna transición de organismo está aprobada.** Cuando Hernán las confirme se agregan como filas, sin tocar código |
| `report_state_change_rejections` | Evidencia de cada intento rechazado: quién, qué estado quiso, desde cuál, por qué. Solo la lee el servidor |
| `change_report_state(reporte, estado, motivo)` | **Único camino controlado** para cambiar un estado. Deduce al actor de la sesión (no se puede elegir), exige transición definida y, para un organismo, motivo. Si pasa, cambia estado e historial en una transacción; si no, **no toca el estado** y deja la evidencia |

Motivos de rechazo: `sin_permiso` (el actor no es el sistema ni un organismo que atiende ese reporte, incluida la propia autora), `estado_inexistente`, `mismo_estado`, `transicion_no_definida`, `motivo_requerido`, `reporte_inexistente`.

## Los escenarios del ticket

| Escenario | Estado |
|---|---|
| 1. Reporte nuevo persistido → estado inicial aprobado, con fecha y hora, sin saltar a «resuelto» | **Ya se cumple**: el reporte nace en `RECIBIDO` con `created_at`. **No agregué una fila «RECIBIDO» al historial**: generaría una notificación «pasó a Enviado» por cada reporte nuevo (la pantalla de notificaciones lee todo el historial) |
| 2. Cambio autorizado → se guarda actor, evento, fecha y estado anterior/nuevo | **Cubierto** por `change_report_state` y el trigger. Probado (S1, O3) |
| 3. Sin permiso o transición no definida → se rechaza, deja evidencia y no altera el estado | **Cubierto**. Probado (X1, P1–P3, O1) |
| 4. Sin respuesta institucional → no se comunica «resuelto» por inferencia del análisis de IA | **NO cubierto, y no lo toqué a propósito** (ver abajo) |

## Verificación

- **Prueba contra Postgres local** con un esquema de reemplazo: **50 aserciones**, todas pasan, incluida una segunda corrida de la migración (idempotente).
- 15 tests en el repositorio que fijan las garantías y las reglas que **no** se inventaron. Suite completa y build: ver el commit.
- Verifiqué contra staging (solo lectura) que las tablas tienen RLS, que `changed_at` e `id` tienen valor por defecto y que `citizen_reports.updated_at` existe.
- **No se probó contra la base real**: la migración no está aplicada.

## Lo que necesito de Hernán (H-2 del pedido)

1. **La máquina de estados.** ¿Los estados vigentes son los 5 de la base? ¿Se crean «aprobado» y «rechazado»? ¿Qué transiciones están permitidas, y para quién (sistema, organismo)? Cada una es una fila en `report_state_transitions`.
2. **Quién puede cambiar estados.** Hoy `change_report_state` acepta a quien `profile_attends_report` reconoce. No existe un panel para organismos: la regla del ticket es validarlo solo donde haya roles y flujo implementados.
3. **Qué es «resuelto».** Hoy `persist_rag_analysis` cierra como `RESUELTO` los reportes que la IA concluye como «asistencia» (decisión mía del 30/09). Hay **20 reportes en `RESUELTO`**: **19** salen de ese cierre automático (nota «Asistencia: se indicó al ciudadano los canales oficiales» y análisis `asistencia`) y **1** tiene un actor humano en el historial. Lo de los 19 es exactamente lo que el escenario 4 dice que **no** hay que comunicar como resolución sin respuesta institucional. Pendiente: ¿pasan a otro estado? ¿se muestran distinto al ciudadano? ¿«resuelto» queda reservado a una actuación del organismo?
4. El estado inicial y la nomenclatura, coordinados con la plantilla de REP-2805 y el envío de REP-2801.

## Lo que queda abierto

- **El escenario 4** (pantalla del ciudadano) y la decisión sobre `asistencia → RESUELTO`: dependen del punto 3.
- **UPDATE directo de `current_state_code`.** Nadie con sesión de ciudadano u organismo puede hacerlo (no hay policy de UPDATE en `citizen_reports`), pero las funciones del RAG y el SQL manual sí. Forzar que todo pase por `change_report_state` implicaría tocar esas funciones o agregar un guardián; lo dejé fuera.
- **172 reportes sin historial** (casi todos en `RECIBIDO`): no se rellenaron, no se inventa historia.
- **REP-2801** debe usar `change_report_state` cuando marque un reporte como notificado/derivado.
- Este ticket no cambia ninguna pantalla.

## Para aplicarla

1. Correr la migración en staging (aditiva; sin DROP ni DELETE).
2. Comprobar: `select count(*) from report_state_transitions` = 3, y `select change_report_state('<id>', 'RESUELTO', 'prueba')` con un usuario autenticado que no atiende el reporte debe devolver `sin_permiso`, dejar una fila en `report_state_change_rejections` y no cambiar el estado.

---

## Actualización 15/10/2026 · H-2 respondida por el PO

Hernán respondió la máquina de estados. Se carga como datos con la migración `20261015140000_rep2502_estados_definidos_por_el_po.sql` (**NO aplicada en staging al escribir esto**).

| Estado | Quién lo pone | Cuándo |
|---|---|---|
| `RECIBIDO` | — | Estado inicial |
| `EN_ANALISIS` | Sistema | Mientras la entrega sea borrador, el reporte se queda acá |
| `INFORMADO` (nuevo, **cerrado**) | Sistema | No se manda nada a un organismo y se le informa al vecino el canal que corresponde (vulnerabilidad social: 108, Desarrollo Social, 102 o Consejo de Niñez) |
| `DERIVADO` | Sistema | Solo cuando se envíe **de verdad** a un organismo (guardando cuál). Hoy no ocurre |
| `ESCALADO` (nuevo) | Organismo | Lo pasa a otro organismo o área. No se usa en borrador |
| `EN_DISCREPANCIA` (nuevo) | Organismo | La respuesta del organismo no coincide con lo reportado. No se usa en borrador |
| `RESUELTO` / `DESESTIMADO` | **Solo el organismo**, con motivo obligatorio | Nunca por lo que diga la IA. De `DERIVADO` se puede ir directo a cualquiera de los dos |

**Qué cambia en el sistema**
- Se **retiran** las dos transiciones por inferencia de la IA (`EN_ANALISIS → RESUELTO` y `→ DESESTIMADO`).
- `persist_rag_analysis` (RAG): «asistencia» y toda vulnerabilidad social pasan a `INFORMADO`. **«Fuera de alcance» ya no cierra** el reporte: queda en `EN_ANALISIS` hasta que lo revise una persona (**propuesta de Matías**, el PO no la había definido).
- Escenario 4 del ticket (no comunicar «resuelto» por inferencia de la IA): **cubierto**.
- La app muestra `Informado`, `Escalado a otro organismo` y `En discrepancia`; `INFORMADO` cuenta como cerrado y su notificación dice «Te informamos el canal que corresponde».
- **Datos de prueba** (el PO confirmó que todos los reportes actuales lo son): los `RESUELTO` sin actuación de un organismo pasan a `INFORMADO` (los 20), y los `DESESTIMADO` cerrados por la IA vuelven a `EN_ANALISIS`. Cada corrección deja su historial (evento `CORRECCION_PO_H2`). Los `DERIVADO` no se tocan.

**Lo que el PO no definió** (cargado como propuesta, marcado en `report_state_transitions.approved_by`): las salidas de `ESCALADO` y `EN_DISCREPANCIA` (a `RESUELTO`, `DESESTIMADO` y entre ellos). Y qué hacer con «fuera de alcance» (ver arriba).

**Verificación:** `scripts/rep2502/prueba_local_estados_po.sql` (Postgres local con esquema de reemplazo; 28 aserciones, incluida una segunda corrida de la migración) y `src/test/Rep2502EstadosDefinidosPorElPO.test.js` (16 tests).
