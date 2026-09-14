# 📑 Para Leo: lo que se adelantó hoy del RAG (y de qué sprints es en realidad)

**De:** Matías Krepchuk (con asistencia de Claude Code)
**Fecha:** 2026-09-14
**Épica:** [REP-1009: IA jurídica / RAG](https://unlz2026.atlassian.net/browse/REP-1009)
**Motivo del documento:** hoy avancé bastante más de lo que pensaba que correspondía a esta sprint. Mi supuesto era que estaba retomando directamente donde quedó la Sprint 11 (el vertical slice REP-2907 + los 6 casos que armó Hernán en REP-3764) y cerrando la Sprint 12 actual. Al cruzarlo contra Jira, una parte importante de lo que se hizo hoy corresponde a tickets de **Sprint 14 y 15, sin asignar todavía**.

---

## 1. De dónde venía mi supuesto (Sprint 11, cerrada)

La Sprint 11 (2026-09-05 al 2026-09-11) cerró con estos 4 tickets del RAG, todos Finalizados:

| Ticket | Qué era | Responsable |
|---|---|---|
| [REP-2907](https://unlz2026.atlassian.net/browse/REP-2907) | Implementar vertical slice RAG: carga, embeddings y retrieval | Matías |
| [REP-3764](https://unlz2026.atlassian.net/browse/REP-3764) | Definir casos esperados para el vertical slice RAG (los 6 casos A-F) | Hernán |
| [REP-3765](https://unlz2026.atlassian.net/browse/REP-3765) | Handoff técnico de offline, privacidad y RAG | Matías |
| [REP-3767](https://unlz2026.atlassian.net/browse/REP-3767) | Evaluar resultados del vertical slice RAG y decidir continuidad | Hernán |

Ese vertical slice (REP-2907) era una simulación: corpus hardcodeado en JS, "embedding" por matching de palabras, no un RAG real. Los 6 casos de Hernán (REP-3764) fueron el criterio de éxito con el que se evaluó esa simulación y se decidió continuar (REP-3767).

Mi supuesto era: "sigo desde ahí, con los casos de Hernán como vara, hasta tener el RAG real funcionando." Eso es correcto conceptualmente — pero en Jira, ese trabajo de continuación ya estaba **fraccionado en tickets separados repartidos entre Sprint 12, 13, 14 y 15** durante la planificación, no como un bloque único.

---

## 2. Qué dice Jira sobre la sprint actual (Sprint 12, activa)

**Objetivo de Sprint 12** (2026-09-13 al 2026-09-18), tal cual está escrito en el sprint: *"Reducir la incertidumbre técnica del RAG, logrando que un reporte expresado en texto recupere normativa exclusivamente desde el corpus controlado y genere una respuesta fundamentada y trazable, mientras se estabilizan los defectos pendientes del flujo offline."*

Los tickets del RAG en Sprint 12:

| Ticket | Qué es | Asignado | Estado |
|---|---|---|---|
| [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) | Crear prompt controlado con salida JSON | Matías | **En curso** |
| └─ [REP-3772](https://unlz2026.atlassian.net/browse/REP-3772) (subtarea) | Validar determinísticamente la salida del RAG | Matías | Por hacer |
| [REP-2900](https://unlz2026.atlassian.net/browse/REP-2900) | Sugerir norma aplicable (Historia) | Matías | Por hacer |
| [REP-2901](https://unlz2026.atlassian.net/browse/REP-2901) | Clasificar jurídicamente reporte (Historia) | Matías | Por hacer |
| └─ [REP-3741](https://unlz2026.atlassian.net/browse/REP-3741) (subtarea) | Persistir clasificación jurídica en el reporte | Matías | Por hacer |

**Esto es lo que sí corresponde 100% a esta sprint**, y es exactamente donde estuvo el foco real de hoy: el prompt de generación, el esquema JSON obligatorio, y la validación determinística que nunca deja pasar una alucinación (lo que arreglé hoy en `analizar-reporte` — el bug de `responseSchema` que hacía fallar todo a "indeterminado"). Con eso ya validado (los 6 casos de Hernán, REP-3764, dan el resultado esperado contra Supabase real), **REP-2908 y su subtarea REP-3772 están listos para pasar a revisión/Hecho**.

---

## 3. Lo que se adelantó — Sprint 14 y 15, sin asignar

El resto de lo que se hizo hoy (backfill de embeddings del corpus real, políticas RLS, pipeline asíncrono con cola/cron, deploy de la Edge Function, persistencia de evidencia y auditoría, prueba de punta a punta) corresponde a estos tickets, que **hoy no tienen a nadie asignado**:

| Ticket | Qué es | Sprint planificada | Asignado hoy |
|---|---|---|---|
| [REP-3774](https://unlz2026.atlassian.net/browse/REP-3774) | Productivizar ingesta y versionado del corpus RAG | **Sprint 14** (25/9 al 2/10) | Sin asignar |
| [REP-3775](https://unlz2026.atlassian.net/browse/REP-3775) | Implementar seguridad y aislamiento del RAG (RLS) | **Sprint 14** (25/9 al 2/10) | Sin asignar |
| [REP-3776](https://unlz2026.atlassian.net/browse/REP-3776) | Implementar orquestación asíncrona del análisis RAG | **Sprint 15** (2/10 al 9/10) | Sin asignar |
| [REP-3777](https://unlz2026.atlassian.net/browse/REP-3777) | Persistir evidencia y auditoría del análisis RAG | **Sprint 15** (2/10 al 9/10) | Sin asignar |

Es decir: hoy se completó y verificó contra el Supabase real trabajo que estaba planificado para **dentro de 1 y 2 sprints más** (dos semanas y media desde hoy, en el caso de Sprint 15).

Hay además un ticket de Sprint 13 que **no se tocó pero se generó evidencia real para resolverlo**:

| Ticket | Qué es | Asignado |
|---|---|---|
| [REP-3773](https://unlz2026.atlassian.net/browse/REP-3773) | Cerrar decisiones técnicas pendientes del RAG (umbral de similitud, versión exacta de modelos, etc.) | **Hernán**, Sprint 13 |

Por ejemplo: hoy quedó registrado que el umbral de similitud actual (0.45) es más permisivo de lo esperado con embeddings reales — un dato directo para una de las decisiones que tiene que cerrar Hernán en REP-3773. No resolví ese ticket (no me corresponde, es de Hernán), pero el hallazgo queda documentado para cuando lo revise.

---

## 4. Qué te pido que decidas vos

1. **REP-2908 + REP-3772** (Sprint 12, míos): ¿los paso a "En revisión"/"Hecho" ahora, o esperamos a algo puntual del board?
2. **REP-3774, REP-3775, REP-3776, REP-3777** (Sprint 14/15, sin asignar): están funcionalmente terminados y verificados contra Supabase real hoy. Homogéneamente adelantados. ¿Los asignamos y marcamos como hechos ahora, o preferís que quede reflejado de otra forma (para no descuadrar el burndown de esas sprints, o para que el equipo no se entere por el board de algo que preferís comunicar antes)?
3. **REP-3773** (Hernán, Sprint 13): no lo toqué, pero le puedo pasar directamente a Hernán el hallazgo del umbral de similitud si te parece útil para que lo tenga como insumo antes de esa sprint.

Documentación técnica completa de todo lo hecho hoy (con evidencia, comandos, y los 3 bugs reales encontrados y corregidos): `.agents/workflow/executions/REP-DEPLOY-RAG-SUPABASE-run-001.md` en el repo, rama `feat/REP-DEPLOY-RAG-SUPABASE-...` (PR abierto, pendiente de tu merge).
