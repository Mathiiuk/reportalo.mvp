# REP-3797 — Pedido de verificación y corrección (para la IA de Hernán)

De: Matías Krepchuk (Líder Técnico) · Fecha: 29/09/2026
Contexto: Hernán entregó `REP-3797_respuesta_verificacion_Matias.md`, `REP-3797_PAQUETE_para_Matias.md` y `REP-3797_lote2_corpus_S14.sql`. Se revisaron contra la base real (proyecto CiudadAR). Este documento lista **qué corregir, qué verificar contra fuentes oficiales y qué decisión de diseño evaluar**. Nada de esto invalida el lote 2: las guardas se cumplen, las sentencias son las que se declaran y es idempotente.

**Actualización tras el comentario 10640 de Jira (29/09):** Hernán ya aprobó el orden de trabajo (logging → normalizar el dato y regenerar embeddings → validador) y aceptó el hueco de la ordenanza de Avellaneda. Este documento queda solo con lo que **sigue abierto**: A.1 y A.2 (correcciones que su comentario repite), B.2 y B.3 (cambios al lote), C (verificación contra fuentes oficiales) y D (riesgo de ranking). A.3 y B.1 quedan resueltos (ver abajo).

Reglas para quien lo ejecute: no inventar datos; cada afirmación jurídica se contrasta con la página oficial de la jurisdicción y se cita la URL y la fecha de lectura; si no se puede verificar, decirlo.

---

## A. Correcciones a los documentos entregados

### A.1 «83 fragmentos afectados por `\r\n`» → son 50
En `REP-3797_respuesta_verificacion_Matias.md` §2 punto 2 dice «Son 83». En la base son **50** (49 vigentes + 1 no vigente). Solo tienen `\r\n` los fragmentos de **varias líneas**; los de una línea no tienen salto y no están afectados.

| Grupo de fragmentos | Total | Con `\r\n` |
|---|---|---|
| Corpus original (ids `20000000-…`) | 16 | 9 |
| Lote 1 (ids `40000000-…`) | 67 | 40 |
| `b6717f77-c30e-4cca-985a-6346d741fe38` (Ley 24.449 art. 48 t) | 1 | 1 |

Todos son `\r\n` puros: **0** con `\r` suelto y **0** con `\r` después de reemplazar `\r\n` por `\n`. Verificación:

```sql
select count(*) filter (where content ~ E'\\r') con_cr,
       count(*) filter (where content ~ E'\\r(?!\\n)') cr_suelto
from knowledge_fragments;
```

Lo que **sí** se confirma de su análisis: el `.sql` del lote 1 y los `.md` no tienen ningún `\r`; el `\r` entró por el camino de carga. Conviene corregir la cifra y el «83 embeddings a regenerar» (bastan los 50, y los que traiga el lote 2 si vuelven a entrar con `\r`).

### A.2 §3.1 (vereda rota por raíces): la premisa era un error del equipo técnico
El documento dice que la cita del modelo «cortó justo antes de "o por raíces de árboles"» y propone investigar un truncado. **No hubo truncado.** El informe técnico abreviaba la cita con "…"; la cita real guardada en `report_ai_evidence.quoted_text` es:

> «Si la vereda resultare destruida, parcial o totalmente, como consecuencia de obras ejecutadas por el Gobierno de la Ciudad Autónoma de Buenos Aires, por sí o por terceros, o por raíces de árboles, la reparación o reconstrucción corre por cuenta y cargo de aquél.»

Es completa. Conclusión: Ley 5902 art. 7 alcanza y el modelo citó bien. Corresponde **quitar** del documento la hipótesis del truncado y el punto 4 de §7 («qué muestra la `cita_textual` del caso de raíces»), que queda cerrado.

### A.3 La búsqueda no usa la columna `fts` — informativo, ya sabido
`match_knowledge_fragments` ordena solo por similitud vectorial. `fts` es una columna generada (`to_tsvector('spanish', content)`) con índice GIN, sin uso hoy. Sostiene la propuesta de búsqueda híbrida; la evaluación y la decisión son del equipo técnico.

---

## B. Cambios pedidos a los entregables

### B.1 `ley_210_caba_ente_regulador.md` — RESUELTO (era una colisión de nombres)
Hernán aclaró que no tocó el archivo: su versión es el original de REP-2906 (07/09), en prosa. El repo tiene otro archivo con **el mismo nombre** y formato del loader (REP-3774: front matter + bloques `## fragmento`), que sirve de prueba del loader. Al copiar la carpeta de Drive a `corpus/normativas/` el original pisó al del repo. Ambos son válidos. Pedido mínimo: cuando entregue archivos nuevos, que **no reutilice nombres** de archivos que ya están en el repo, o los deje en una carpeta aparte (p. ej. `docs/actualizacion de normativas/`) para que no se pisen.

**Aclaración sobre lo que ofreció:** no hace falta adaptar los `.md` a `embed-pending.mjs`, porque ese script **no lee `.md`**: trabaja sobre la base y solo calcula vectores. Quien lee `.md` es `load-corpus.mjs`, y como el lote 2 va por SQL, tampoco es necesario.

### B.2 Hacer el lote 2 inmune al `\r\n`
El lote llega limpio (0 `\r`) y aun así la base terminó con `\r\n`; al aplicarlo desde un editor puede volver a pasar. Pedido: agregar al **final del lote** (transacción propia, antes de la verificación) una normalización con control:

```sql
begin;
update public.knowledge_fragments
   set content = replace(content, E'\r\n', E'\n')
 where content ~ E'\\r';
commit;
```

y dejar **W-6** (conteo de fragmentos con `\r`) en la verificación. Aclarar en el instructivo que después hay que **regenerar los embeddings de los fragmentos cuyo texto cambió** (no alcanza con «faltantes»).

### B.3 Aclarar el instructivo del lote 2
- Que el lote 2 debe correrse **después** del lote 1 (las guardas ya lo exigen; decirlo en el índice).
- Que W-5 (fragmentos sin embedding) y W-6 (fragmentos con `\r`) son la condición de cierre.
- Los conteos esperados que se declaran (26 fuentes · 123 fragmentos (120 vigentes) · 158 mapeos) deben poder comprobarse con una consulta incluida en el lote (ya existe la parte de verificación: confirmar que W-1 los imprime).

---

## C. Verificar contra fuentes oficiales (no se pudo hacer del lado técnico)

Cada punto: contrastar con la página oficial y devolver URL + fecha + texto literal.

1. **Ley 24.449 art. 5**: inc. i) «Camino: una vía rural de circulación»; incs. h) y z) tal como quedaron en el fragmento `60000000-…39`. El lote 2 se apoya en esto para **quitar** el mapeo de art. 48 t) a comercio irregular.
2. **Ley 24.449 art. 49 inc. b) punto 7** («por un período mayor de cinco días o del lapso que fije la autoridad local») y que el art. 49 rija «en zona urbana». Es el único fundamento propuesto para «auto abandonado» en Avellaneda.
3. **Ley 451 (CABA), art. 1.3.31** «Vehículo abandonado en la vía pública»: texto del hecho y del procedimiento (intimación por diez días hábiles, remolque). Confirmar que la numeración corresponde al texto consolidado vigente.
4. **Decreto-Ley 8751/77 art. 35** («acción pública… simple denuncia verbal o escrita») y **art. 4° bis** (incorporado por Ley 11.723): confirmar el texto y quién lo incorporó.
5. **Ley 1217 (CABA)**, Anexo art. 2 y art. 3.
6. **Teléfonos y horarios** (147, 103, 108, 102; Desarrollo Social y guardia de Niñez de Avellaneda): fecha de lectura de cada página. Los teléfonos cambian; conviene guardar la fecha en `verified_at` de cada fuente.
7. **Ley 5902 art. 7, segundo párrafo**: el texto literal ya está en la base y coincide con lo que Hernán citó; verificarlo contra el Boletín Oficial.

Aclaración que debe quedar escrita: **la lectura técnica y la del PO no son validación jurídica externa.**

---

## D. Decisión de diseño a evaluar (riesgo de ranking)

El lote 2 mapea **8 fragmentos de procedimiento** (DL 8751/77 arts. 1, 18, 35, 38 y Ley 1217 Anexo arts. 1, 2, 3, 34) a **las cuatro categorías con conducta** (`TRANSITO`, `INFRAESTRUCTURA`, `AMBIENTE`, `COMERCIO_IRREGULAR`). La búsqueda trae solo 6 fragmentos por reporte y ordena por similitud.

En la verificación del 29/09 ya se vio que fragmentos **no normativos** (canales del municipio) ocupan los primeros puestos en Avellaneda y desplazan normas de fondo. Fragmentos de procedimiento («toda falta da lugar a una acción pública…») son textos genéricos que pueden repetir ese efecto y ocupar 1 o 2 de los 6 lugares en **todos** los reportes de esas categorías.

Pedido: evaluar si conviene (a) mapearlos solo a una categoría o a ninguna y usarlos como texto fijo de la respuesta, o (b) mantener el mapeo y aceptar el riesgo. No se pide cambiarlo sin datos: **después de cargar el lote 2 se repetirán los casos** y se medirá si desplazan a las normas de fondo. Si desplazan, se decide.

---

## E. Qué NO cambiar

- Los ids `50000000-…` y `60000000-…` y la idempotencia (`on conflict do nothing`): ya se validaron.
- El único `delete` (mapeo de `b6717f77` a comercio irregular) y el único `update` (baja lógica de los dos fragmentos de Ley 2148): se revisaron y son coherentes con lo declarado.
- Las fuentes verbatim: la corrección de `\r\n` se hace en la base y en la ingesta, no en los `.md`.

## F. Qué se devuelve

Un documento corto con: (1) correcciones A.1 y A.2 aplicadas, (2) el lote 2 con B.2 incorporado, (3) la tabla de la sección C con URL, fecha y texto literal, (4) su evaluación de la sección D.
