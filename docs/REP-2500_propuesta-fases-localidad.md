# Reportalo

*Plataforma de Auditoría Ciudadana*

## PROPUESTA — RESOLUCIÓN DE LOCALITY_ID EN DOS FASES

**Versión 1.0 · 15 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Responde a:** [REP-2500_resolucion-locality-id.docx](https://unlz2026.atlassian.net/browse/REP-2500) (v1.0) y a la devolución de Leo: *"de última dejás la opción 1 habilitada como contingencia de la 4, que si falla la geo o el reverse geo, que use la opción 1"* — Hernán de acuerdo.

**Jira:** [REP-2500](https://unlz2026.atlassian.net/browse/REP-2500) (Historia de Usuario · Sprint 12, stretch goal)

**Equipo:** Hernán Gregorini (PO / Autor) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

**Consultor Especialista:** Carlos Ruiz (auditor externo · asesoría metodológica)

> **Propósito.** Responder a la propuesta de Leo (Opción 4 automática con Opción 1 como contingencia) con un análisis técnico y una recomendación de cómo secuenciarla, antes de empezar a implementar.

---

## 1. La propuesta de Leo

Reverse-geocoding automático (Opción 4) como camino principal; si falla la geolocalización o el reverse-geo, cae al selector manual de localidad (Opción 1) como contingencia. Hernán está de acuerdo.

**Decisión.** El patrón es correcto — automático primero, con un camino manual de respaldo es justo lo que evita que el ciudadano quede trabado si una API externa falla. El punto de este documento no es objetar la idea, sino señalar que combina dos piezas de tamaño muy distinto y proponer cómo secuenciarlas.

## 2. Por qué esto no es solo "agregarle un fallback a la Opción 1"

Combinar las dos opciones trae de vuelta todo el tamaño de la Opción 4 (que en el documento anterior se había dejado fuera de alcance de REP-2500 precisamente por su tamaño). Implementar el reverse-geocoding real implica tres piezas nuevas, ninguna trivial:

**a) Elegir un proveedor externo.**

| Proveedor | Costo | Precisión en Argentina | Límite de uso |
|---|---|---|---|
| Google Geocoding API | Pago por request | Alta | Cuota configurable, requiere billing |
| Nominatim (OpenStreetMap) | Gratis | Media — puede fallar en zonas de CABA/Avellaneda | 1 request/segundo, sin SLA |

**b) Matchear el resultado contra `localities`.** El proveedor devuelve texto libre (ej. "Palermo, Buenos Aires, Argentina"), no un `id` de la tabla. Hay que resolver ese texto contra los nombres reales — no es un lookup directo.

**c) Ya hay un problema de datos que bloquea ese matching.** Encontramos que existen **dos filas "Avellaneda"** duplicadas en `localities` (mismo nombre, misma subdivisión). Si el matching automático no tiene un criterio de desambiguación, puede resolver a cualquiera de las dos sin control.

**d) Falta definir "cuándo cae al fallback".** ¿Solo si la API devuelve error? ¿También si devuelve algo pero con baja confianza (Nominatim puede devolver una coincidencia pobre sin marcarla como error)? Esto es una decisión de producto, no una consecuencia automática de "usar dos opciones juntas".

## 3. Recomendación: dos fases, no una entrega

**Fase 1 — REP-2500, Sprint 12 (ahora).** Implementar el selector manual (Opción 1) como única vía. Cierra el ticket sin depender de decisiones externas todavía pendientes (proveedor, costo, criterio de fallback). El ciudadano elige su localidad de una lista real; sin llamadas a servicios externos.

**Fase 2 — ticket aparte, sprint a definir.** Agregar el reverse-geocoding automático (Opción 4) *encima* del selector ya existente: se intenta resolver la localidad automáticamente y, si falla o no hay confianza suficiente, se precarga el selector de la Fase 1 en vez de dejarlo vacío — que es exactamente el comportamiento que pidió Leo, solo que construido sobre una base que ya funciona.

Antes de esa Fase 2 hace falta, como prerrequisito, corregir el duplicado de "Avellaneda" en `localities` (dato, no código) y decidir el proveedor.

## 4. Tabla de decisiones

| Ref. | Observación / Decisión | A quién corresponde |
|---|---|---|
| O-1 | Aprobar la secuencia en dos fases (selector ahora, geocoding + fallback después) | Leonel Nuñez, Hernán Gregorini |
| O-2 | Elegir proveedor de geocoding para la Fase 2 (Google vs. Nominatim vs. otro) | Hernán Gregorini, Matías Krepchuk |
| O-3 | Corregir el duplicado de "Avellaneda" en `localities` antes de la Fase 2 | Hernán Gregorini (dato) |
| O-4 | Definir el criterio exacto de "cuándo cae al fallback" en la Fase 2 | Hernán Gregorini, Leonel Nuñez |

---

**Documentos relacionados:** [REP-2500](https://unlz2026.atlassian.net/browse/REP-2500) · REP-2500_resolucion-locality-id.docx (v1.0, 14/09)
