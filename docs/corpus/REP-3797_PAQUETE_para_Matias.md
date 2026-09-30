# Reportalo

*Plataforma de Auditoría Ciudadana*

## PAQUETE DE ENVÍO — CORPUS COMPLETO Y LOTE 2

**Versión 1.0 · 29 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Jira:** [REP-3797](https://unlz2026.atlassian.net/browse/REP-3797) · Sprint 14
**De:** Hernán Gregorini (PO · DBA) · **Para:** Matías Krepchuk (Líder Técnico)
**Confluence:** espacio `Reportalo` — pendiente de publicar

> **Qué es esto.** El índice de todo lo que va en este envío, en qué orden se lee y se corre, y qué queda pendiente. Es la hoja de ruta; el detalle está en cada documento.

---

## 1. Por dónde empezar

| Orden | Archivo | Qué es | Tiempo |
|---|---|---|---|
| 0 | `REP-3797_devolucion_verificar_y_corregir.md` | **Leer primero.** Responde tu pedido del 29/09: las correcciones A.1 a A.3 aplicadas, los pedidos B, la tabla de verificación C con URL y fecha, y la evaluación de D | 8 min |
| 1 | `REP-3797_respuesta_verificacion_Matias.md` | Las respuestas a los nueve hallazgos de la verificación, **ya con A.1, A.2 y A.3 corregidos** | 10 min |
| 2 | `REP-3797_lote2_corpus_S14.sql` | El lote complementario: 6 fuentes, 39 fragmentos, 3 correcciones. Idempotente, con guardas y reversión | correr |
| 3 | `REP-3797_INSTRUCTIVO_carga_corpus_S14.md` | El instructivo del lote 1, que ya aplicaste. Sirve como referencia de convenciones: las del lote 2 son las mismas | consulta |
| 4 | `REP-3797_ampliacion_corpus_normativo.md` | El informe del relevamiento: qué se verificó, cómo, y las trampas de vigencia | consulta |
| 5 | Los archivos de fuentes (§4) | Texto verbatim de cada norma, con URL oficial y fecha. Entrada del loader de [REP-3774](https://unlz2026.atlassian.net/browse/REP-3774) | consulta |

---

## 2. El lote 2 en una pantalla

**Antes:** 20 fuentes · 84 fragmentos (83 vigentes) · 89 mapeos
**Después:** 26 fuentes · 124 fragmentos (120 vigentes) · 159 mapeos

| Operación | Detalle |
|---|---|
| `INSERT` de 6 fuentes | ids `50000000-…` |
| `INSERT` de 40 fragmentos | ids `60000000-…` |
| `INSERT` de 70 mapeos | en `fragment_services` |
| **3 `UPDATE`** | baja lógica de los dos fragmentos de Ley 2148 que se recargan con encabezado · baja lógica del fragmento del art. 49 b.3 de la Ley 24.449, que estaba cortado al medio · normalización del `
` en `content`, a pedido de Matías. Ningún fragmento se borra: quedan como historial y sus reemplazos los referencian |
| **1 `DELETE`** | una fila de `fragment_services`: quita el mapeo a comercio irregular del fragmento de la Ley 24.449 art. 48 inc. t). Es la corrección de un error mío del lote 1 — el art. 5 de esa ley define "Camino: una vía rural de circulación" |

Sin DDL. Sin `ALTER`, sin `DROP`, sin `TRUNCATE`. Arranca con guardas que abortan **antes de escribir** si falta el lote 1 o los dos fragmentos que versiona. Nueve transacciones separadas. Se puede correr dos veces.

---

## 3. Los tres pasos que no son el lote

Sin estos, el lote no cambia nada de lo que ve el ciudadano:

1. **Embeddings.** El lote no los genera. Los 39 fragmentos nuevos no se recuperan por similitud hasta que corra el paso del loader con el modelo activo (`gemini-embedding-2@768` en el volcado del 28/09). **W-5** los lista y debe quedar vacía.
2. **Normalizar el `\r\n`.** Verifiqué que no viene de las fuentes: el `.sql` y los 23 `.md` no tienen ni un CRLF. Entró en el camino de carga. Hay que quitarlo de `content` y regenerar los embeddings de esos fragmentos — el texto guardado tiene que ser idéntico al oficial, o el corpus deja de ser citable. **W-6** cuenta los que quedan.
3. **4.1 y 4.2**, en ese orden, en rama aparte con test.

El punto 2 ya viene resuelto dentro del lote (Parte 8 quater), así que de tu lado queda sólo el **re-embedding de los 50 fragmentos** cuyo texto cambia ahí: el vector viejo quedó calculado sobre un texto que ya no está en la base.

---

## 4. Las fuentes completas

Todas leídas sobre la página oficial de la jurisdicción que dictó la norma. La única excepción es la Ley 451, que viene del PDF consolidado oficial conservado en el repositorio desde REP-2906.

### 4.1 Del lote 1 (ya cargado)

| Archivo | Norma | Ámbito | Categoría |
|---|---|---|---|
| `ley_5902_caba_veredas.md` | Ley 5902 | CABA | Infraestructura |
| `ley_1854_caba_basura_cero.md` | Ley 1854 | CABA | Ambiente |
| `ley_6101_caba_actividades_economicas.md` | Ley 6101 | CABA | Comercio irregular |
| `ley_3706_caba_situacion_de_calle.md` | Ley 3706 | CABA | Vulnerabilidad social |
| `ley_4036_caba_derechos_sociales.md` | Ley 4036 | CABA | Vulnerabilidad social |
| `ley_451_caba_faltas_lote_s14.md` | Ley 451 (8 artículos) | CABA | Cuatro categorías |
| `ley_13592_pba_residuos.md` | Ley 13.592 | Prov. Buenos Aires | Ambiente |
| `ley_15625_pba_situacion_de_calle.md` | Ley 15.625 | Prov. Buenos Aires | Vulnerabilidad social |
| `ley_13927_pba_transito_arts_1_2.md` | Ley 13.927 | Prov. Buenos Aires | Tránsito |
| `LOM_decreto_ley_6769-58_art_27.md` | LOM art. 27 | Prov. Buenos Aires | Comercio, ambiente, infraestructura |
| `ley_27654_nacional_situacion_de_calle.md` | Ley 27.654 + Decreto 373/2025 | Nacional | Vulnerabilidad social |
| `canales_oficiales_derivacion.md` | Canales oficiales | Las cuatro jurisdicciones | Las cinco |

### 4.2 Nuevas, del lote 2

| Archivo | Norma | Ámbito | Qué cierra |
|---|---|---|---|
| `decreto_ley_8751-77_pba_faltas_municipales.md` | Decreto-Ley 8751/77 | Prov. Buenos Aires | El marco de la Ordenanza 7180 y el respaldo legal del reporte en Avellaneda (art. 35) |
| `ley_1217_caba_procedimiento_faltas.md` | Ley 1217 | CABA | El mismo respaldo en CABA (Anexo art. 2) y qué debe contener un acta (art. 3) |
| `ley_5901_caba_aperturas_roturas.md` | Ley 5901 | CABA | Pendiente P-13: quién repara cuando rompió una prestadora |
| `ley_1166_caba_permisos_espacio_publico.md` | Ley 1166 | CABA | Pendiente P-14: prohibición de vender en el espacio público sin permiso |
| `ley_11723_pba_ambiente.md` | Ley 11.723 | Prov. Buenos Aires | Derecho a denunciar y responsabilidad municipal por omisión |
| `ley_2148_caba_arts_7.1.8_7.1.9_completos.md` | Ley 2148 arts. completos | CABA | Corrección del chunking de dos fragmentos ya cargados |
| `ley_451_caba_faltas_lote_s14_bis.md` | Ley 451, 4 artículos más | CABA | Auto abandonado, aperturas, cierre y reparación defectuosa |
| `canales_oficiales_derivacion.md` (actualizado) | Teléfonos oficiales vigentes | CABA | 147 con su horario real, 103 de emergencias, 108 y 102 |

Además: `PENDIENTES_corpus.md` queda como registro vivo de lo resuelto, lo abierto y las vías muertas.

---

## 5. Cobertura final

Las cinco categorías tienen, en las dos jurisdicciones, norma de fundamento, organismo competente y canal real. Y ahora tienen algo que antes no: **el respaldo legal del propio reporte**, que en las dos jurisdicciones dice lo mismo con palabras casi iguales —"toda falta da lugar a una acción pública que puede ser promovida por simple denuncia verbal o escrita"—, en el Decreto-Ley 8751/77 art. 35 para Avellaneda y en el Anexo art. 2 de la Ley 1217 para CABA.

| Categoría | CABA | Avellaneda |
|---|---|---|
| **Tránsito** | Ley 2148 (6 incisos con encabezado) + Ley 451 (6.1.37, 6.1.52, 6.1.54, 1.3.31) | Ley 24.449 (48 i, 48 t, 49 b.1, b.3, b.7 + definiciones) + Ley 13.927 (1, 2, 2 bis) |
| **Infraestructura** | Ley 5902 + Ley 5901 + Ley 210 + Ley 451 (2.1.8, 2.1.13, 2.1.14, 2.1.15, 2.1.15.1) | Const. PBA 192.4 + LOM 52, 59, 27.2 |
| **Ambiente** | Ley 1854 + Ley 210 art. 2 c) + Ley 451 (1.3.13, 1.3.10.1, 1.3.2.3.4) | Ley 13.592 + Ley 11.723 + LOM 52, 27.8, 27.17 + DL 8751/77 art. 4 bis |
| **Comercio irregular** | Ley 6101 + Ley 1166 + Ley 451 (4.1.1, 4.1.2) | LOM 27.1 y 27.6 + DL 8751/77 art. 4 bis inc. e) |
| **Vulnerabilidad social** | Ley 3706 + Ley 4036 + Ley 27.654 + Línea 108 y 102 | Ley 15.625 + Ley 27.654 + Desarrollo Social y guardia de Niñez |
| **Procedimiento (las cuatro con conducta)** | Ley 1217, Anexo arts. 1, 2, 3, 34 | DL 8751/77 arts. 1, 18, 35, 38 |

---

## 6. Lo que queda abierto, dicho sin adornos

| Pendiente | Estado | Impacto |
|---|---|---|
| **Ordenanza 7180 de Avellaneda** (y las de habilitaciones) | Texto no digitalizado. La vía es institucional: Secretaría Legal y Técnica o Juzgado de Faltas. Pedido esta semana, sin fecha garantizada | **Bajó a bajo.** El marco provincial (DL 8751/77 + LOM + Ley 11.723) cubre materia, organismo y procedimiento |
| **Línea telefónica provincial** de la Ley 15.625 art. 14 | La ley la crea; el número no está publicado y no encontré la reglamentación en el registro oficial. **Por eso no hay ningún 0-800 inventado en el corpus** | Medio. Avellaneda no tiene guardia 24 h para personas adultas y el dictamen no debe sugerir que la hay |
| **Incisos no cargados** de artículos que sí están | Ley 3706 art. 4 incs. d) a l), Ley 2148 art. 7.1.9 incs. j), m), n) y los puntos 3 a 8 del l), LOM art. 27 inc. 15 | Bajo. **No quedaron partidos**: cada uno es un chunk posible, cargable sin tocar nada |
| **Ley 451 art. 2.1.20** (declarar emergencia para evitar el permiso) | Relevado, no cargado | Bajo |
| **Leyes 25.675 y 25.916** (marco ambiental nacional) | Relevadas por remisión, no cargadas | Bajo |
| **Validación jurídica externa** | No existe. Ni la lectura del equipo técnico ni este documento la reemplazan | A decidir si el MVP la necesita antes de UAT |

Y la limitación que no se arregla cargando normas: **vulnerabilidad social no tiene infractor**. El corpus puede fundamentar el deber del Estado y dar el canal. Si el análisis usa una sola plantilla para las cinco categorías, ésta es la que va a sonar falsa.

---

**Documentos relacionados:** [REP-3797](https://unlz2026.atlassian.net/browse/REP-3797) · [REP-3795](https://unlz2026.atlassian.net/browse/REP-3795) · [REP-3774](https://unlz2026.atlassian.net/browse/REP-3774) · [REP-3784](https://unlz2026.atlassian.net/browse/REP-3784) · [REP-2906](https://unlz2026.atlassian.net/browse/REP-2906) · [Modelo de Datos v3](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/90406917)
