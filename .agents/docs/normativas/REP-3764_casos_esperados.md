# Reportalo

*Plataforma de Auditoría Ciudadana*

## CASOS ESPERADOS — VERTICAL SLICE RAG

**Versión 1.0 · 7 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Jira:** [REP-3764](https://unlz2026.atlassian.net/browse/REP-3764) (T · Definir casos esperados para el vertical slice RAG · Sprint 11)
**Confluence:** espacio `Reportalo` — pendiente de publicar
**Referencia:** [REP-2906_corpus_minimo_estructura.md](./REP-2906_corpus_minimo_estructura.md) — los 6 casos de este documento se construyen exclusivamente sobre el corpus de 8 normas definido ahí

**Equipo:** Hernán Gregorini (PO / Autor) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

**Consultor Especialista:** Carlos Ruiz (auditor externo · asesoría metodológica)

> **Propósito.** Este es el entregable de REP-3764: el dataset de consultas/casos esperados que Matías usa para evaluar el vertical slice de REP-2907, sin que DEV tenga que inventar los ejemplos funcionales. Cumple los cinco criterios de aceptación de la tarea.

---

## 1. Qué se considera un resultado útil en Sprint 11

Por alcance de la tarea, **no** se exige clasificación jurídica final, prompt productivo ni precisión objetivo definitiva. Para cada caso, el resultado mínimo útil es: **el pipeline recupera el/los fragmento(s) esperado(s), con fuente, artículo y jurisdicción visibles, y con trazabilidad al chunk de origen.**

## 2. Los 6 casos

| Caso | Tipo | Reclamo (texto de ejemplo) | Jurisdicción | Debe recuperar | Debe descartar |
|---|---|---|---|---|---|
| **A** | Positivo | "Hay una boca de tormenta rota hace semanas en mi cuadra" | Avellaneda | Ítems 1, 2, 3 del corpus (Const. PBA 192.4 + LOM 52 + LOM 59) | Ítem 8 (Código de Faltas — no cubre esto) |
| **B** | Positivo | "Un auto está estacionado sobre la rampa para discapacitados de la esquina" | CABA | Ítem 6 (Ley 2148, conducta) **y** ítem 7 (Ley 451, sanción) — las dos juntas | Ítem 5 (Ley 24.449 — no aplica en CABA) |
| **C** | Control negativo (geográfico) | Mismo texto que el caso B | Avellaneda | Ítem 5 (Ley 24.449 art. 49) | Ítems 6 y 7 (son de CABA — probar que el filtro de jurisdicción funciona, no solo la similitud semántica) |
| **D** | Positivo (asimetría jurisdiccional) | "No anda la luz de la calle hace tres días" | Una vez Avellaneda, una vez CABA | Avellaneda → ítem 2 (LOM art. 52). CABA → ítem 4 (Ley 210) | Que el sistema devuelva la misma norma para las dos — sería la señal de que no distingue la lógica jurídica por jurisdicción |
| **E** | **Ambiguo** | "Hay quilombo en la esquina, discuten y frenan el tránsito todos los días" | Avellaneda | Ítem 5 (Ley 24.449 — encuadre de tránsito, por "frenan el tránsito") | Ítem 8 (Código de Faltas 8031/73) — comparte vocabulario de "orden público"/"falta" con el reclamo, pero no cubre tránsito (ver corrección en `REP-2906_investigacion_corpus_legal.md` §3.3). Este caso prueba específicamente que el pipeline no confunde ambos por similitud léxica |
| **F** | **Sin evidencia suficiente** | "Un puesto vende bebidas en la vereda sin habilitación" | Avellaneda o CABA | **Nada del corpus** — comercio irregular no está investigado todavía (ver `REP-2906_sintesis_corpus_legal.md` §2) | Cualquier norma de los otros ítems citada como si fundamentara esto. El resultado esperado es que el sistema declare que no tiene fundamento normativo cargado para esta categoría — no que invente una cita ni que rechace el reporte como inválido |

## 3. Por qué estos dos casos (E y F) son los más importantes del set

No son un requisito de checklist — son los que prueban la promesa central del producto:

- **Caso E** prueba que el sistema no cae en un falso positivo por parecido de vocabulario. Es la situación real que ya se detectó en la investigación (el Código de Faltas 8031/73 comparte lenguaje de "falta"/"infracción" con tránsito sin cubrirlo).
- **Caso F** prueba el comportamiento cuando el corpus todavía no cubre una categoría. Si Reportalo inventa una cita para no dejar el campo vacío, deja de ser mejor que una app de quejas — sería peor, porque parecería tener un fundamento que no existe. El resultado correcto acá es una salida indeterminada y transparente, no un rechazo ni una invención.

## 4. Fuera de este dataset (a definir en una próxima ronda)

No hay ningún caso de **vulnerabilidad social** todavía. Es la categoría con naturaleza jurídica distinta (deber de asistencia, no conducta prohibida — ver `REP-2906_sintesis_corpus_legal.md` §3.1) y sin corpus cargado, así que no se puede construir un caso positivo real para ella en este sprint. Queda pendiente para cuando se investigue esa categoría.

## 5. Cumplimiento de los criterios de aceptación

| Criterio (REP-3764) | Cómo se cumple |
|---|---|
| Conjunto acotado de consultas con resultado esperado/documentado | 6 casos, tabla de §2 |
| Los casos usan únicamente el corpus definido en REP-2906 | Todos los ítems referenciados (1 a 8) son del corpus de `REP-2906_corpus_minimo_estructura.md` |
| Incluye casos positivos, ambiguos y sin soporte suficiente | A/B/D positivos, C control negativo, E ambiguo, F sin evidencia suficiente |
| REP-2907 puede ejecutarse sin que DEV invente los ejemplos | Los 6 casos están completos con texto de reclamo, jurisdicción y resultado esperado |
| Material preparado para reutilizarse en REP-2908/REP-2910 | Formato tabular simple, sin dependencias de implementación |

---

**Documentos relacionados:** [REP-2906](https://unlz2026.atlassian.net/browse/REP-2906) · [REP-2907](https://unlz2026.atlassian.net/browse/REP-2907) · [REP-3764](https://unlz2026.atlassian.net/browse/REP-3764) · [REP-2906_corpus_minimo_estructura.md](./REP-2906_corpus_minimo_estructura.md)
