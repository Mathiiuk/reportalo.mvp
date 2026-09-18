<!--
PLANTILLA UNIVERSAL — Documento Reportalo
Base: formato de casa (.claude/skills/SKILL.md, docs-reportalo), verificada
contra dos documentos reales de Confluence con estructuras muy distintas:
- Reportalo_Modelo_Datos_v3 (page 90406917) — documento técnico, secciones
  numeradas simples, callouts tipo panel.
- Reportalo_Plan_Costos (page 37584907) — documento de gestión, subsecciones
  decimales (11.1, 11.2...), callout como encabezado en negrita + párrafo,
  línea de "Referencia" en la cabecera.
Sirve como base para CUALQUIER tipo de documento del proyecto: planes,
informes de UX/UI, checklists de QA, ADR, análisis y resoluciones, actas,
registros de riesgo. La cabecera es fija; el cuerpo es una caja de
patrones — se usan los que el contenido necesite, no todos a la vez.

Cómo usarla:
1. Copiar este archivo con el nombre del documento nuevo.
2. Reemplazar cada [placeholder] entre corchetes.
3. Armar el cuerpo combinando los patrones de la sección 2 de esta guía.
4. Borrar este bloque de comentario y las instrucciones en cursiva antes de publicar.
5. Todo link a Jira o Confluence va con URL real (https://unlz2026.atlassian.net/...),
   nunca una ruta local (./archivo.md) ni un número de página sin resolver.
6. Si el documento no tiene página propia en Confluence todavía, la línea de
   referencias apunta a la tarea de Jira que lo originó y se actualiza cuando
   la página exista.
7. Generar el .docx con: tools/.venv/Scripts/python tools/md_to_docx.py
   <entrada.md> <salida.docx> "<Título>"
-->

# Reportalo

*Plataforma de Auditoría Ciudadana*

## [TÍTULO DEL DOCUMENTO EN MAYÚSCULAS]

**Versión [X.Y] · [fecha, ej. 4 de septiembre de 2026] · [etapa — Discovery / Construcción / Cierre] · Proyecto RAR-2026**

**Jira:** [REP-XXXX](https://unlz2026.atlassian.net/browse/REP-XXXX) ([tipo] · épica [REP-YYYY](https://unlz2026.atlassian.net/browse/REP-YYYY))
**Confluence:** [espacio `Reportalo` · categoría/carpeta] — [Nombre de la página](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/PAGEID) si ya existe, o "pendiente de publicar" si todavía no
<!-- Línea opcional, solo si el documento se apoya directamente en otros planes vigentes (patrón tomado del Plan de Costos): -->
**Referencia:** [Documento 1](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/PAGEID), [Documento 2](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/PAGEID)

**Equipo:** Hernán Gregorini (PO / Autor) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

**Consultor Especialista:** Carlos Ruiz (auditor externo · asesoría metodológica)

> **Propósito.** [Una o dos frases: qué resuelve este documento, quién lo consume y para qué.]

---

## 1. [Primera sección del cuerpo]

[Ver sección 2 de esta guía para elegir el patrón adecuado a cada tipo de contenido.]

---

**Documentos relacionados:** [Nombre documento 1](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/PAGEID) · [Nombre documento 2](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/PAGEID) · [REP-XXXX](https://unlz2026.atlassian.net/browse/REP-XXXX)

<!--
======================================================================
2. PATRONES DE CUERPO — usar los que el documento necesite, no todos.
   Esta sección entera se borra antes de publicar; es guía, no contenido.
======================================================================

2.1 — Sección numerada simple
------------------------------
## 1. Nombre de la sección
Texto de apertura breve. Preferir tablas a párrafos largos cuando el
contenido es comparable, enumerable o tiene más de tres datos.

2.2 — Subsección decimal (para documentos largos con una sección que
       crece — patrón del Plan de Costos §11.1, 11.2, 11.3)
------------------------------------------------------------
### 5.1  [Subtema]
### 5.2  [Otro subtema dentro de la misma sección 5]

2.3 — Tabla comparativa o enumerable
-------------------------------------
| [Columna A] | [Columna B] |
|---|---|
| [dato] | [dato] |

2.4 — Tabla de decisiones u observaciones (siempre que el documento
       registre resoluciones o puntos pendientes — nunca sueltos en texto)
----------------------------------------------------------------------------
| Ref. | Observación / Decisión | A quién corresponde |
|---|---|---|
| O-1 | [descripción] | [rol o persona] |

2.5 — Callout, DOS formatos válidos según el caso:

  a) Panel con cita — para una idea autocontenida y corta:
     > **Decisión.** [contenido]
     Etiquetas de uso frecuente: Propósito · Decisión · Fundamento ·
     Advertencia de alcance · Pendiente formal.

  b) Encabezado en negrita + párrafo — para una idea que necesita más
     desarrollo o va seguida de una tabla propia (patrón del Plan de
     Costos, ej. "**Qué resuelve este plan**" seguido de un párrafo):
     **[Encabezado corto en negrita]**

     [Párrafo de desarrollo.]

2.6 — Lista numerada o con viñetas
-------------------------------------
1. [Paso o ítem]
2. [Otro]

- [Ítem sin orden]
- [Otro]

2.7 — Nota de versión (solo a partir de la primera actualización,
       nunca en la v1.0 de un documento nuevo)
--------------------------------------------------------------------
## Nota de versión

**v[X.Y] — [fecha]**

| Qué cambió | Por qué |
|---|---|
| [cambio] | [motivo] |

Si el cambio toca una línea base (alcance, tiempo, costo), se registra
además en Control de Cambios — no alcanza con esta tabla.

2.8 — Cierre del documento (obligatorio siempre, según SKILL.md)
--------------------------------------------------------------------
**Documentos relacionados:** enlaza cada Jira y cada página de
Confluence que el documento mencionó, con URL real.

======================================================================
-->

<!--
Checklist antes de publicar:
[ ] Título en mayúsculas, versión y fecha correctas
[ ] Jira, Confluence y Referencia de la cabecera son URLs reales, no locales
[ ] Equipo incluye UX/UI para Matías Y para Iván (estándar de casa desde 04/09/2026 — Iván
    trabaja en conjunto con Matías en UX/UI; algunos documentos viejos de Confluence,
    como el Plan de Costos v2, no lo tienen y quedan desactualizados en ese punto)
[ ] Carlos Ruiz = Consultor Especialista, nunca Sponsor
[ ] Ningún número o cifra sin verificar contra la fuente viva (Jira/Confluence, no un CSV local)
[ ] No se menciona "materia", "profesor" ni "consigna" en ningún lado
[ ] Se dice "Git", nunca el nombre de la plataforma de hosting
[ ] Todo link a Jira/Confluence resuelto a URL real, incluidos los del cuerpo
[ ] Documentos relacionados cierra el documento
[ ] Si toca línea base (alcance/tiempo/costo): registrado también en Control de Cambios
[ ] .docx generado y verificado con tools/md_to_docx.py antes de subir a Confluence
-->
