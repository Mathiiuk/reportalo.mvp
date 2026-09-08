# Reportalo

*Plataforma de Auditoría Ciudadana*

## SÍNTESIS DE INVESTIGACIÓN — CORPUS LEGAL Y FUNDAMENTO DE REPORTES

**Versión 1.0 · 7 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Jira:** [REP-2906](https://unlz2026.atlassian.net/browse/REP-2906) (T · Definir estructura de corpus legal · épica [REP-1009](https://unlz2026.atlassian.net/browse/REP-1009) EP | IA jurídica / RAG) · [REP-3764](https://unlz2026.atlassian.net/browse/REP-3764) (T · Definir casos esperados para el vertical slice RAG)
**Confluence:** espacio `Reportalo` — pendiente de publicar
**Referencia:** [Plan de Alcance v2.0](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/37552129), [Acta de Inicio v3.0](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/23167009), [Anexo C — Arquitectura v2.1](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/22904876)

**Equipo:** Hernán Gregorini (PO / Autor) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

**Consultor Especialista:** Carlos Ruiz (auditor externo · asesoría metodológica)

> **Propósito.** Resumir para el equipo el estado de la investigación de corpus legal de Sprint 11, qué queda dentro del alcance vigente, qué temas necesitan una decisión conjunta antes de que Matías arranque REP-2907, y qué queda deliberadamente fuera por ahora.

---

## 1. Qué resuelve el corpus legal — y qué no

Reportalo se diferencia de una app de quejas porque cada reporte llega al organismo **con fundamento legal**, no como una opinión aislada. El corpus legal es la base de datos de normas que el RAG usa para construir ese fundamento.

**Confirmado contra el Acta y el Plan de Alcance:** Reportalo **no emite multas ni sanciones**. El RAG resuelve dos preguntas por reporte, no tres:

| Pregunta | Ejemplo |
|---|---|
| ¿Qué norma respalda este reclamo? | Obligación del municipio de mantener la calzada, o prohibición de estacionar en una rampa |
| ¿A qué organismo corresponde derivarlo? | Ya está definido en el Plan de Alcance por categoría (ver tabla en §2) |

La sanción/multa no forma parte del fundamento que necesita el ciudadano ni el organismo — el organismo decide si actúa, Reportalo no reemplaza esa decisión.

## 2. Las cinco categorías del MVP y su estado de cobertura

| Categoría | Naturaleza jurídica | Cobertura del corpus (CABA / Avellaneda) |
|---|---|---|
| Infraestructura | Obligación del Estado incumplida | **Completa** — LOM art. 52/59 + Const. PBA (Avellaneda) · Ley 210 Ente Único (CABA) |
| Tránsito | Conducta prohibida | **Completa** — Ley 24.449 (Avellaneda) · Ley 2148 (CABA) |
| Ambiente | Obligación / conducta prohibida | **Parcial** — una ordenanza de Avellaneda relevada, alcance chico; CABA sin investigar |
| Comercio irregular | Conducta prohibida | **Sin investigar** |
| Vulnerabilidad social | Deber de asistencia del Estado (no incumplimiento) | **Sin investigar** — naturaleza jurídica distinta a las otras cuatro (ver §3) |

## 3. Temas para debatir con el equipo antes de REP-2907

1. **Vulnerabilidad social no encaja en el modelo de las otras cuatro categorías.** No hay conducta prohibida ni sanción — es una derivación de asistencia al Ministerio de Capital Humano. Falta acordar qué nivel de fundamento legal necesita: puede que alcance con identificar el organismo, sin una cita normativa tan elaborada como en infraestructura o tránsito.
2. **La lógica jurídica cambia entre Avellaneda y CABA para el mismo reclamo.** En Avellaneda el fundamento es "el municipio está obligado"; en CABA es "el Ente Único controla al prestador y tramita tu reclamo". Si el diseño del RAG asume una sola plantilla de razonamiento, va a fallar en una de las dos jurisdicciones.
3. **Falta definir el estado "sin evidencia suficiente" como resultado válido, no como rechazo.** Si el corpus no cubre una categoría en una jurisdicción (hoy pasa con comercio irregular y vulnerabilidad social), el sistema tiene que decirlo de forma transparente — nunca inventar una cita ni tratarlo como reclamo inválido. No está formalizado todavía en ningún documento de alcance.
4. **Comercio irregular y vulnerabilidad social son las dos categorías sin nada de corpus.** Son las que más urgen relevar antes de que REP-2907 necesite datos de las cinco categorías.

## 4. Fuera de alcance por ahora

- **Robos, vandalismo, inseguridad en general.** El Plan de Alcance excluye explícitamente reportar delitos (van al 911/134). Es una oportunidad de mejora a futuro, pero requiere analizar antes derechos, obligaciones legales y responsabilidad de la plataforma — no es una categoría Open311 más. Queda registrado para retomar más adelante, fuera de este sprint.
- **Detalle sancionatorio de Avellaneda (Ordenanza 7180) y de CABA (montos en Unidades Fijas).** Investigado parcialmente, pero de prioridad baja: no es información que el producto necesite mostrar.

## 5. Documentos de respaldo

Todo el detalle técnico (fuentes primarias, texto verbatim de cada norma, método de búsqueda, pendientes) está en:

- `docs/fuentes/normativas/` — normas descargadas con fuente y fecha.
- `docs/outputs/REP-2906_investigacion_corpus_legal.md` — investigación completa.
- `docs/outputs/REP-2906_guia_interpretacion_documentos.md` — cómo usar cada norma descargada.

---

**Documentos relacionados:** [REP-2906](https://unlz2026.atlassian.net/browse/REP-2906) · [REP-2907](https://unlz2026.atlassian.net/browse/REP-2907) · [REP-3764](https://unlz2026.atlassian.net/browse/REP-3764) · [REP-3767](https://unlz2026.atlassian.net/browse/REP-3767) · [Plan de Alcance v2.0](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/37552129)
