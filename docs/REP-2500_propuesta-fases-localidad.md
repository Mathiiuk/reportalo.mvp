# Reportalo

*Plataforma de Auditoría Ciudadana*

## PROPUESTA — RESOLUCIÓN DE LOCALITY_ID EN DOS FASES

**Versión 1.2 · 15 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Responde a:** [REP-2500_resolucion-locality-id.docx](https://unlz2026.atlassian.net/browse/REP-2500) (v1.0) y a la devolución de Leo: *"de última dejás la opción 1 habilitada como contingencia de la 4, que si falla la geo o el reverse geo, que use la opción 1"* — Hernán de acuerdo, con la variante de usar OpenStreetMap en vez de Google para la Fase 2 (ver §5).

**Jira:** [REP-2500](https://unlz2026.atlassian.net/browse/REP-2500) (Historia de Usuario · Sprint 12, stretch goal)

**Equipo:** Hernán Gregorini (PO / Autor) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

**Consultor Especialista:** Carlos Ruiz (auditor externo · asesoría metodológica)

> **Propósito.** Responder a la propuesta de Leo (Opción 4 automática con Opción 1 como contingencia) con un análisis técnico y una recomendación de cómo secuenciarla, y resolver con evidencia la discusión abierta entre Leo y Hernán sobre qué proveedor de geocoding usar en la Fase 2.

---

## 1. La propuesta de Leo

Reverse-geocoding automático (Opción 4) como camino principal; si falla la geolocalización o el reverse-geo, cae al selector manual de localidad (Opción 1) como contingencia. Hernán está de acuerdo.

**Decisión.** El patrón es correcto — automático primero, con un camino manual de respaldo es justo lo que evita que el ciudadano quede trabado si una API externa falla. El punto de este documento no es objetar la idea, sino señalar que combina dos piezas de tamaño muy distinto y proponer cómo secuenciarlas.

## 2. Por qué esto no es solo "agregarle un fallback a la Opción 1"

Combinar las dos opciones trae de vuelta todo el tamaño de la Opción 4 (que en el documento anterior se había dejado fuera de alcance de REP-2500 precisamente por su tamaño). Implementar el reverse-geocoding real implica tres piezas nuevas, ninguna trivial:

**a) Elegir un proveedor externo.** Ver comparación detallada en §5.

**b) Matchear el resultado contra `localities`.** El proveedor devuelve texto libre (ej. "Palermo, Buenos Aires, Argentina"), no un `id` de la tabla. Hay que resolver ese texto contra los nombres reales — no es un lookup directo.

**c) Ya hay un problema de datos que bloquea ese matching.** Encontramos que existen **dos filas "Avellaneda"** duplicadas en `localities` (mismo nombre, misma subdivisión). Si el matching automático no tiene un criterio de desambiguación, puede resolver a cualquiera de las dos sin control.

**d) Falta definir "cuándo cae al fallback".** ¿Solo si la API devuelve error? ¿También si devuelve algo pero con baja confianza (Nominatim puede devolver una coincidencia pobre sin marcarla como error)? Esto es una decisión de producto, no una consecuencia automática de "usar dos opciones juntas".

## 3. Recomendación: dos fases, no una entrega

**Fase 1 — REP-2500, Sprint 12 (ahora).** Implementar el selector manual (Opción 1) como única vía. Cierra el ticket sin depender de decisiones externas todavía pendientes (proveedor, costo, criterio de fallback). El ciudadano elige su localidad de una lista real; sin llamadas a servicios externos.

**Fase 2 — ticket aparte, sprint a definir.** Agregar el reverse-geocoding automático (Opción 4) *encima* del selector ya existente: se intenta resolver la localidad automáticamente y, si falla o no hay confianza suficiente, se precarga el selector de la Fase 1 en vez de dejarlo vacío — que es exactamente el comportamiento que pidió Leo, solo que construido sobre una base que ya funciona.

Antes de esa Fase 2 hace falta, como prerrequisito, corregir el duplicado de "Avellaneda" en `localities` (dato, no código) y decidir el proveedor.

**Confirmado por Leo y Hernán (Jira, 15/09):** ambos coinciden con esta secuencia — Opción 1 ahora, Opción 4 como deuda técnica documentada para el próximo sprint. La única diferencia entre sus dos mensajes es el proveedor: Leo propone Google Geocoding, Hernán propone OpenStreetMap/Nominatim. Se resuelve en §5.

## 4. Fuera de alcance de esta propuesta

Todo lo referido al frente RAG (V-01 a V-13 de la devolución de Hernán) — Leo pidió explícitamente priorizar cerrar ese frente primero este sprint. Ver `docs/REP-2908-VERIF_devolucion-a-hernan.docx`.

## 5. Google Geocoding vs. OpenStreetMap/Nominatim — comparación para resolver O-2

Leo cita la [página oficial de precios de Google Maps Platform](https://developers.google.com/maps/billing-and-pricing/pricing): la Geocoding API da **10.000 solicitudes gratis por mes**, y recién a partir de la 10.001 cobra 5 USD por cada 1.000. Verificado contra la fuente: el número es correcto. Para el volumen de un MVP, sobra.

| | Google Geocoding API | OpenStreetMap / Nominatim |
|---|---|---|
| **Costo** | 0 USD hasta 10.000/mes, luego 5 USD/1.000 | Gratis, sin techo de costo |
| **Precisión de barrio en Argentina** | Alta — `address_components` estructurados (`sublocality`, `neighborhood`) | Media — los límites de barrio/comuna en OSM son de mantenimiento comunitario, con huecos conocidos en CABA |
| **Límite de uso** | Cuota configurable por cuenta de billing | Política pública: 1 request/segundo, requiere User-Agent identificando la app; para volumen real hay que auto-hostear |
| **Infraestructura a mantener** | Ninguna — es una API administrada | Si se supera el uso razonable del servidor público, hay que correr una instancia propia (carga del planeta OSM o un extracto regional) |
| **Requiere cuenta de billing** | Sí (tarjeta cargada, aunque el uso sea 0 USD) | No |
| **SLA / soporte** | Sí | No |

**Recomendación.** Google Geocoding API. Las dos razones que pesan más para este caso puntual:

1. **La precisión de barrio es justo lo que necesitan** — el objetivo es matchear contra `localities` (barrios de CABA + partidos del conurbano), que es precisamente el punto débil de Nominatim en Argentina.
2. **La cuenta de billing no es una superficie de riesgo nueva.** Ya van a necesitar una alerta de presupuesto en Google Cloud para la clave de Gemini (pendiente de V-08 en la devolución del RAG) — agregar la misma alerta para Geocoding es incremental, no un problema nuevo.

La contra de Nominatim (evitar depender de una cuenta de billing) es real, pero a cambio de peor precisión en el dato que más importa acá, y de un problema de infraestructura (auto-hosteo) que hoy no está en el radar del equipo.

**Si de todos modos se prefiere evitar la dependencia de Google**, la alternativa razonable no es Nominatim público (por las limitaciones de uso), sino evaluar un proveedor de geocoding en Argentina/LATAM con mejor cobertura que Google no requiera billing — pero eso es una investigación aparte, no algo para resolver en esta propuesta.

## 6. Tabla de decisiones

| Ref. | Observación / Decisión | Estado |
|---|---|---|
| O-1 | Aprobar la secuencia en dos fases (selector ahora, geocoding + fallback después) | ✅ Confirmado por Leo y Hernán (Jira, 15/09) |
| O-2 | Elegir proveedor de geocoding para la Fase 2 (Google vs. Nominatim) | 🟡 En discusión — recomendación de este documento: Google (§5) |
| O-3 | Corregir el duplicado de "Avellaneda" en `localities` antes de la Fase 2 | Pendiente — Hernán Gregorini (dato) |
| O-4 | Definir el criterio exacto de "cuándo cae al fallback" en la Fase 2 | Pendiente — Hernán Gregorini, Leonel Nuñez |
| O-5 | Armar la HU con subtareas para la Fase 2 (pedido de Leo, una vez haya luz verde de factibilidad técnica) | Pendiente — a cargo de Matías, con ayuda para redactarla |

---

## Nota de versión

**v1.1 — 15 de septiembre de 2026:** sin cambios de contenido registrados aparte (versión de transición).

**v1.2 — 15 de septiembre de 2026**

| Qué cambió | Por qué |
|---|---|
| Se agregó la comparación Google vs. Nominatim (§5) | Leo y Hernán propusieron proveedores distintos en Jira; hacía falta resolver O-2 con evidencia, no solo listar la disyuntiva |
| Se confirmó O-1 como aprobado | Ambos coincidieron con la secuencia de dos fases en Jira |
| Se agregó §4 (fuera de alcance) | Leo pidió explícitamente priorizar el frente RAG este sprint — se deja constancia de que esta propuesta no compite con esa prioridad |

---

**Documentos relacionados:** [REP-2500](https://unlz2026.atlassian.net/browse/REP-2500) · REP-2500_resolucion-locality-id.docx (v1.0, 14/09) · docs/REP-2908-VERIF_devolucion-a-hernan.docx
