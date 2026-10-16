# RAG del Sprint 15 · Lo aplicado en staging durante el Sprint 16

**Fecha:** 13/10/2026 · **De:** Matías Krepchuk · **Para:** Hernán Gregorini (PO) · **Con copia a:** Leonel Nuñez
**Base:** tu entrega `Entrega_Matias_RAG_Sprint15` (00_LEEME del 08/10/2026) y `docs/Respuesta_Matias_a_Hernan_RAG_Sprint15.md`. Este documento **reemplaza el estado «NO aplicado»** de esa respuesta.

> **Para leer primero.** Lo que tu LEEME pedía y no se había hecho en el Sprint 15 se aplicó en el Sprint 16 sobre staging (proyecto Supabase *Reportalo*). Acá está **qué se aplicó, cómo se verificó, qué se midió y qué sigue siendo un hueco**. Todo número sale de consultas a la base de staging o de corridas del runner `scripts/rag-local-dev/rep-diag-generacion` del 13/10/2026.

## 1. Resumen

| Pedido (sección 10 de tu LEEME) | Estado |
|---|---|
| 1 · Lote de corpus + embeddings | **Aplicado y verificado.** 29 fuentes, 132 fragmentos (127 vigentes), 169 mapeos; 8 vectores generados; ningún fragmento vigente sin vector |
| 2 · Despublicar el índice 8031/73 y cargar el art. 49 | **Aplicado** |
| 3 · Línea del prompt para D5 y 10 corridas | **Medido y desplegado** (prompt v5, función `analizar-reporte` versión 44) |
| 4 · Medir D2, D3 y D4 con tres redacciones | **Medido la recuperación (30 combinaciones) y la generación de D2 y D3.** D4 sigue siendo un hueco, ver sección 5 |
| 5 · Repetibilidad con más corridas | **No hecho** |
| 6 · 10 a 15 textos reales para tu revisión jurídica | **Hecho:** `docs/RAG-S15_muestra_revision_juridica_O-4.md` (14 casos) |
| 7 · D7 y D8 | Sin cambios respecto de la respuesta anterior (ver REP-3827 y REP-3828) |
| 8 · Temperatura y semilla | Respondido antes |
| 9 · Costo por foto y reporte | Tokens y latencia medidos antes; **costo en moneda no calculado** |
| 10 · Filtro de contenido y patentes | Respondido antes; la contradicción de la FAQ sigue abierta |

## 2. Corpus: qué se aplicó y cómo se verificó

### 2.1 Contraste del texto literal (el paso que faltaba)
El instructivo marcaba como **no verificado** el texto literal de los 8 fragmentos. Se contrastó el 13/10/2026 contra las fuentes oficiales:

| Fragmento | Fuente | Método | Resultado |
|---|---|---|---|
| Ordenanza Fiscal 31321, arts. 132, 231, 233 y 235 | SIBOM (boletín 13987) | Comparación del texto de la página, normalizando espacios | **Idénticos, palabra por palabra** |
| Decreto-Ley 8031/73, art. 49 | normas.gba.gob.ar | Ídem | **Idéntico** |
| Ley 1777, arts. 10 y 11 | PDF del texto actualizado (Boletín Oficial CABA) | Comparación palabra por palabra | **Mismo contenido.** Solo difiere el separador del título («–» vs «.») y una marca `#` de hipervínculo del PDF |
| Ley 6684, art. 26 según Ley 6.851 (20 incisos) | PDF de la Ley 6.851 (Boletín Oficial CABA 23/12/2025) | Ídem | **Mismo contenido.** Solo difieren un encabezado de página y la comilla de cierre |

Las dos fuentes de la Ciudad solo publican el texto en PDF; los dos PDF los descargaste vos y están en `docs/Entrega_Matias_RAG_Sprint15/` (`830430.pdf` y `LEY A – Nº 1.777.pdf`).

### 2.2 Aplicación
Se corrió `docs/corpus/RAG-S15_lote3_corpus.sql` (partes 0 a 4) tal cual. Estado previo: 26 / 124 / 120 / 159, nada del lote cargado, ningún fragmento vigente sin vector.

| Verificación | Esperado | Obtenido |
|---|---|---|
| W-1 · fuentes / fragmentos / vigentes / mapeos | 29 / 132 / 127 / 169 | **29 / 132 / 127 / 169** |
| W-4 · vigentes sin categoría | 0 | **0** |
| W-6 · fragmentos con retorno de carro | 0 | **0** |
| Índice del Código de Faltas (`2000…0015`) | `is_current = false` | **false** |
| Largos guardados (arts. 132, 231, 233, 235, 10, 11, 26, 49) | los del archivo | 432, 1584, 927, 1378, 867, 1578, 3543, 848 |

### 2.3 Embeddings
`embed-pending.mjs` (modelo activo `gemini-embedding-2@768`): primero `--dry-run` (8 pendientes, exactamente los del lote), luego la corrida real: **8 vectores generados**. W-5 (vigentes sin vector) pasó de 8 a **0**.

## 3. Prompt v5: medición y despliegue

Runner `rep-diag-generacion`, contexto congelado, temperatura 0, 10 corridas por celda. La v4 se corrió sobre el **mismo contexto** (`--reusar`) usando temporalmente el archivo del commit anterior, y se restauró después.

| Caso | v4 | v5 | Lectura |
|---|---|---|---|
| **D5-CABA-1** («venden en la calle», CABA) | 3 de 10 fundamentado, 7 indeterminado | **10 de 10 fundamentado**, mismo conjunto de citas | Cumple tu criterio (≥ 9 de 10, mismas citas) |
| **D4-CABA-INFRA** (control: baches en CABA) | 10 de 10 sin_normativa | 10 de 10 sin_normativa | No cambia |

**Desplegado:** función `analizar-reporte` **versión 44** en staging (la 43 era la v4), `verify_jwt` activo. Antes se verificó que lo desplegado era el v4 del repo. El comentario de `PROMPT_VERSION` en el código se actualizó con estas mediciones (antes decía «SIN MEDIR TODAVÍA»).

**No verificado:** no hice una corrida de punta a punta de la función desplegada con un reporte real (la función solo acepta llamadas del despacho de la cola, con un token que no manejo). La siguiente vez que un reporte pase por la cola, su análisis debería quedar con `prompt_version = 'v5'` en `report_ai_analysis`: ese es el chequeo pendiente.

## 4. D2, D3 y D5 con el lote cargado

### 4.1 Recuperación (qué llega al modelo)
Se midió en qué posición queda cada fragmento nuevo con tres redacciones por caso. El modelo solo ve el top 8 sobre el umbral 0,45. Solo lectura.

| Caso | Redacciones | Fragmentos nuevos dentro del top 8 | Fuera del top 8 |
|---|---|---|---|
| **D2** · comercio en Avellaneda | coloquial · técnica · jurídica | **Ord. Fiscal art. 233 (posición 4 o 5), en las tres** | art. 235 (pos. 11) y art. 231 (pos. 12) |
| **D3** · alumbrado en Avellaneda | coloquial · técnica · jurídica | **Ord. Fiscal art. 132 (pos. 4 a 8), en las tres** · DL 8031 art. 49 en la técnica (pos. 7) | DL 8031 art. 49 en las otras dos (pos. 9 y 10) |
| **D4** · baches en CABA | coloquial · técnica · jurídica | **Ninguno, en las tres** | **Ley 1777 art. 10 (pos. 22 a 26), art. 11 (25 a 27), Ley 6684 art. 26 (pos. 28)** |
| **D5** · comercio en CABA | «venden en la calle» | Ninguno (no hace falta: sus normas ya estaban) | Ley 1777 art. 11 (18), Ley 6684 art. 26 (19) |

### 4.2 Generación con v5 (contexto recuperado con el lote cargado)

| Caso (texto) | Estados (10 corridas) | Qué cita |
|---|---|---|
| **D2-AVE-4** («venta de mercadería en la calle sin habilitación ni controles…») | **10 de 10 fundamentado** | Ord. Fiscal art. 233 + DL 8751/77 art. 4 bis; aclara que aplica si no cuentan con el permiso y que corresponde que el organismo lo verifique |
| **D2-AVE-1** («venta ambulante») | **10 de 10 sin_normativa** | Nada: el modelo dice que los fragmentos no regulan expresamente la venta ambulante, aunque el art. 233 estaba en el contexto |
| **D3-AVE-ALUMBRADO** («No funciona el alumbrado público de la cuadra») | **10 de 10 fundamentado**, `es_infraccion = false` | DL 6769/58 art. 52 y Ord. Fiscal art. 132, en combinaciones aceptables (5 conjuntos distintos); **ninguna corrida cita el art. 49 del Código de Faltas** (que marcaste como no aceptable como único fundamento) |

## 5. Lo que sigue siendo un hueco

1. **D4 (baches en CABA) no está resuelto, y el lote solo no lo resuelve.** Las normas de competencia (Ley 1777 art. 10, Ley 6684 art. 26) están cargadas y con vector, pero compiten con ~28 fragmentos de INFRAESTRUCTURA de CABA y quedan en las posiciones 22 a 28; el modelo solo recibe 8. Subir `match_count` a ~30 no es razonable (costo de tokens y ruido). Las opciones reales son cambios de diseño de la recuperación y afectan a todas las categorías, por eso **no las toqué**:
   - reservar un cupo del top-k para fragmentos de tipo `competencia`;
   - partir el art. 26 por inciso (como advertías, un fragmento de 20 incisos se recupera mal);
   - ajustar el mapeo por categoría de los fragmentos de la Ley 451 y 5901 que hoy ocupan el top 8 para «bache».
   Requiere tu decisión y una medición de regresión sobre la batería de 81 casos.
2. **Textos muy cortos en Avellaneda (D2-AVE-1, «venta ambulante»)** siguen en «sin_normativa» aun con la Ordenanza Fiscal en el contexto. No es un problema de recuperación sino de cómo el modelo encuadra «ambulante» frente a «ocupación del espacio público con puestos».
3. **Variación de citas en D3.** Cinco conjuntos distintos en 10 corridas; todos dentro de lo aceptable de tu sección 5, pero no es 100 % repetible.

## 6. Lo que necesito de vos

1. **D4:** ¿qué enfoque para la recuperación? (cupo para `competencia`, partir el art. 26, o ajustar el mapeo). Hasta que lo decidas el caso queda como hoy.
2. Las decisiones que dejé abiertas en el lote y que **ya están aplicadas con mi criterio**: `foundation_type` de la Ordenanza Fiscal (art. 132 `competencia`, arts. 231 y 233 `obligacion`, art. 235 `sancion`), Ley 6684 art. 26 **sin** mapear a AMBIENTE, y la etiqueta del art. 235. Si querés cambiar alguna, es un `UPDATE` sobre filas ya cargadas (hay que regenerar el vector solo si cambia el texto).
3. La última mirada a los **boletines de Avellaneda posteriores al 117º** (modificatorias de la Ordenanza Fiscal), que quedó de tu lado.
4. Tu revisión de los 14 fundamentos de `docs/RAG-S15_muestra_revision_juridica_O-4.md`.

## 7. Reversión
- **Corpus:** parte 6 de `docs/corpus/RAG-S15_lote3_corpus.sql`. Si algún análisis ya citó los fragmentos nuevos, **no borrar** (se pierde `report_ai_evidence`): marcar `is_current = false` en los fragmentos `80000000-…` y reponer el índice del Código de Faltas. Si ninguno los citó, vale el borrado por patrón de id que describe esa parte.
- **Prompt:** volver a desplegar el `index.ts` del commit `3519c73~1` (v4).
