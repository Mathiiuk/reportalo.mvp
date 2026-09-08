# Reportalo

*Plataforma de Auditoría Ciudadana*

## FEEDBACK DE INVESTIGACIÓN 2 — REVISIÓN INTERNA DEL ENFOQUE DE CORPUS LEGAL

**Versión 1.0 · 7 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Jira:** [REP-2906](https://unlz2026.atlassian.net/browse/REP-2906) · [REP-3764](https://unlz2026.atlassian.net/browse/REP-3764) · [REP-2905](https://unlz2026.atlassian.net/browse/REP-2905) (relevamiento previo, 18/08/2026)
**Referencia:** [REP-2906_investigacion_corpus_legal.md](./REP-2906_investigacion_corpus_legal.md) · [REP-2906_guia_interpretacion_documentos.md](./REP-2906_guia_interpretacion_documentos.md) — este memo audita el razonamiento detrás de esos dos documentos
**Confluence contrastado:** [Acta de Inicio v3.0](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/23167009) · [Plan de Alcance v2.0](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/37552129) · [Anexo C — Arquitectura v2.1](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/22904876) · [Relevamiento Normativa Avellaneda (REP-2905)](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/89980938)

**Equipo:** Hernán Gregorini (PO / Autor) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

**Consultor Especialista:** Carlos Ruiz (auditor externo · asesoría metodológica)

> **Propósito.** Durante la investigación del corpus legal (sesión del 05-07/09/2026) surgieron varias líneas de razonamiento sobre cómo debía funcionar la IA jurídica — algunas antes de contrastar con la documentación formal del proyecto. Este memo las coteja contra el Acta, el Plan de Alcance y el Anexo C vigentes, marca qué estaba alineado, qué ya existía como decisión previa del equipo (REP-2905) sin que se supiera, y qué fue un desvío real de esfuerzo que conviene no repetir.

---

## 1. Qué se planteó durante la investigación (resumen de lo dicho, no reescrito)

En orden cronológico dentro de la sesión:

1. El corpus necesita una **cascada jurisdiccional** (Nación → Provincia → Municipio) en vez de un filtro que reste niveles, para no perder el fundamento nacional cuando falta el municipal.
2. Toda norma resuelve como máximo tres preguntas — **obligación, conducta prohibida, sanción** — y lo que cambia entre jurisdicciones es cuáles de esas tres están cubiertas, no la estructura.
3. La geografía **nunca debe vivir en el embedding** (evidencia: el buscador confundió Avellaneda de Buenos Aires con Avellaneda de Santa Fe) — tiene que ser filtro estructurado sobre `pgvector`, no parte del texto vectorizado.
4. Dado que el país tiene ~2.300 municipios, la única forma de escalar es que la **investigación legal sea por provincia (~25 jurisdicciones)** y que el dato municipal (organismo + contacto) sea alta de datos, no investigación jurídica.
5. Cuando el usuario aclaró que Reportalo no emite sanciones, se propuso reducir el modelo a dos casilleros — **fundamento** y **competencia** — y sacar la capa de sanción del alcance.
6. Cuando el usuario aclaró que el objetivo es la **agregación de reportes** como evidencia de patrón sistémico, se planteó que la taxonomía de categorías tiene que ser estable entre jurisdicciones para que agregar tenga sentido, y se sugirió sacar "zonas de robos" del alcance por no encajar en la lógica de incumplimiento estatal.
7. Cuando el usuario aclaró que el corpus existe para que el reporte **no quede en queja** ("amparo legal"), se planteó que una cita incorrecta es peor que ninguna, que el estado "sin evidencia suficiente" debe ser una respuesta válida (no un rechazo), y que el criterio de vigencia deja de ser un detalle formal.

## 2. Contraste contra la documentación oficial

| Punto planteado | Qué dice el Acta / Plan de Alcance / Anexo C | Veredicto |
|---|---|---|
| Cascada jurisdiccional Nación→Provincia→Municipio | No está escrito explícitamente en ningún documento de alcance, pero **REP-2905** (18/08, previo a esta sesión) ya proponía "apoyo en normativa de rango superior" y "jurisdicción explícita en el modelo, de modo que un reporte de Avellaneda nunca se fundamente con normativa de otra ciudad" — es la misma idea con otras palabras | **Alineado — y ya decidido antes.** No era un hallazgo nuevo |
| Tres casilleros (obligación/conducta/sanción), luego reducidos a dos | El Acta v3 y el Plan de Alcance v2.0 dicen textualmente: *"No emite multas ni sanciones. El ciudadano aporta la evidencia; el organismo competente decide si actúa. **Eso es lo que lo hace legal.**"* — confirmado dos veces, en dos documentos de alcance distintos | **Alineado, y confirmado como decisión de producto explícita, no una interpretación** |
| Geografía fuera del embedding, filtro estructurado | No está escrito en el Anexo C (que documenta `pgvector` pero no esta regla puntual). Es una inferencia razonable a partir de la arquitectura, no una decisión ya tomada | **Alineado con el stack, pero es una recomendación nueva — vale la pena que quede registrada como tal, no como algo "que ya se sabía"** |
| Investigación por provincia, dato municipal como alta de datos | Coherente con el Plan de Alcance §4: *"Cobertura acotada a CABA y Avellaneda. La expansión es posterior al MVP"* y con la limitación de recursos que REP-2905 ya documentó para Avellaneda | **Alineado como principio de diseño a futuro.** Advertencia: el MVP no necesita esto todavía — es diseño para no tener que rehacer el esquema cuando se agregue una tercera jurisdicción, no una tarea del sprint 11 |
| Catálogo categoría → organismo | El Plan de Alcance §3.2 **ya trae esta tabla completa** (Tránsito, Infraestructura, Ambiente, Comercio irregular → organismo), y el Acta v3 trae una versión equivalente | **No fue un hallazgo: ya existía.** La propuesta de "construir un catálogo" fue redescubrir una tabla que el PO ya había escrito en agosto |
| Taxonomía estable para que la agregación tenga sentido | El Acta v3 fundamenta el mapa de calor exactamente en esto: *"Una esquina que acumula 40 reportes de baches en dos semanas es un dato de gestión pública"* | **Alineado** |
| Excluir "zonas de robos" | El Plan de Alcance §4 ya excluye explícitamente delitos y emergencias (van al 911/134) | **Alineado — el corte ya estaba hecho, con el mismo criterio** |
| "Sin evidencia suficiente" como respuesta válida, no rechazo | No está escrito en ningún documento de alcance. Es una implicancia razonada a partir de "eso es lo que lo hace legal", pero es una **propuesta nueva de diseño de producto**, no una confirmación de algo ya decidido | **Coherente con el espíritu del Acta, pendiente de que el PO la adopte formalmente** |

## 3. Dónde hubo desvío real de esfuerzo

Un ítem no pasa el filtro de "estaba alineado" ni de "ya estaba decidido": **la investigación profunda de la capa de sanción de CABA.**

Durante la sesión se invirtió un esfuerzo considerable en:

- Confirmar el artículo exacto de la Ley 451 (6.1.52, 6.1.37, 6.1.54);
- Descargar y extraer el PDF consolidado completo (para lo cual se escribió una herramienta nueva, `tools/extraer_pdf.py`);
- Verificar el valor de la Unidad Fija y su historial;
- Diseñar la regla de arquitectura de "no embeber el monto en pesos".

El Acta y el Plan de Alcance son explícitos y **anteriores a toda esa investigación**: Reportalo no sanciona. Ese trabajo no fue en vano —los artículos de la Ley 2148/451 siguen sirviendo para **acreditar que la conducta reportada es una infracción real** (el casillero "conducta prohibida" del punto 2 de la sección anterior)— pero se investigó con un nivel de detalle (montos, actualizaciones semestrales, decisiones de arquitectura sobre cómo convertir UF a pesos) que **no tiene ningún uso en el producto tal como está definido**.

**Causa raíz:** la sesión avanzó varios pasos sin haber contrastado contra el Acta / Plan de Alcance vigentes. Recién se leyeron a pedido explícito del PO, después de que la corrección ("no emite multas") ya la había dado el propio PO en el chat. Si se hubiera consultado el Plan de Alcance al principio de REP-2906, esa rama de investigación no se habría abierto.

## 4. Recomendación

1. **No profundizar más la capa de Ley 451/sanción.** Lo ya descargado en `docs/fuentes/normativas/` queda como referencia (sirve para el casillero de conducta prohibida), pero no es prioridad de REP-2906 cerrar sus pendientes (P-6, P-7, P-8 relacionados a sanción/Ordenanza 7180 bajan de prioridad).
2. **Actualizar REP-2906_investigacion_corpus_legal.md** para marcar la capa de sanción como "documentada pero fuera de alcance del producto", en vez de presentarla como un hueco crítico a cerrar.
3. **Antes de abrir una tarea de investigación exploratoria de este tipo, leer primero el Plan de Alcance vigente** — no asumir que la memoria de conversación o el CLAUDE.md alcanzan; ambos pueden estar desactualizados frente a la última versión de Confluence (como pasó acá con el Acta v2.0 vs. v3.0, que todavía referencia PostGIS).
4. Formalizar como decisión de producto (no dejarlo solo en este memo) el estado **"sin evidencia suficiente"** como resultado válido del RAG — es coherente con el Acta pero no está escrito en ningún documento de alcance todavía.

---

**Documentos relacionados:** [REP-2906_investigacion_corpus_legal.md](./REP-2906_investigacion_corpus_legal.md) · [REP-2906_guia_interpretacion_documentos.md](./REP-2906_guia_interpretacion_documentos.md) · [Plan de Alcance v2.0](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/37552129) · [Acta de Inicio v3.0](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/23167009) · [Anexo C — Arquitectura v2.1](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/22904876) · [REP-2905](https://unlz2026.atlassian.net/browse/REP-2905) · [REP-2906](https://unlz2026.atlassian.net/browse/REP-2906) · [REP-3764](https://unlz2026.atlassian.net/browse/REP-3764)
