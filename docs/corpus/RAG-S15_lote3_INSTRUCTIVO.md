# Lote 3 del corpus (Sprint 15) · Instructivo de carga

**Fecha:** 13/10/2026 · **Origen:** devolución de Hernán del 08/10/2026 (`docs/Entrega_Matias_RAG_Sprint15/`, pedidos 1 y 2 de la sección 10)
**Archivo del lote:** [`RAG-S15_lote3_corpus.sql`](RAG-S15_lote3_corpus.sql) · **Texto fuente:** `docs/Entrega_Matias_RAG_Sprint15/corpus/Corpus_propuesta_lote_S15_para_generador.md`

> **Estado:** el lote está **escrito y probado, pero NO aplicado** en staging. Falta que lo contrastes con las páginas oficiales y lo corras vos (necesita acceso de escritura y la clave de Gemini para los embeddings).

## 1. Qué hace

| Cambio | Detalle |
| --- | --- |
| 3 fuentes nuevas | Ordenanza Fiscal 31321 de Avellaneda (ámbito: partido de Avellaneda), Ley 1777 (CABA), Ley 6684 (CABA) |
| 8 fragmentos nuevos | Ord. Fiscal arts. 132, 231, 233, 235 · Ley 1777 arts. 10 y 11 · Ley 6684 art. 26 (texto según Ley 6.851, 20 incisos) · Decreto-Ley 8031/73 art. 49 |
| 10 mapeos a categoría | 132 → INFRAESTRUCTURA · 231/233/235 → COMERCIO_IRREGULAR · L.1777 art. 10 → INFRA · art. 11 → INFRA + COMERCIO · L.6684 art. 26 → INFRA + COMERCIO · 8031 art. 49 → INFRA |
| 1 catálogo | `document_types`: se agrega `ordenanza` |
| 1 despublicación | El **índice** del Código de Faltas 8031/73 (`2000…0015`) pasa a `is_current = false`. No se borra |
| Conteos | Antes 26 / 124 (120 vigentes) / 159. Después **29 / 132 (127 vigentes) / 169** |

No hay `ALTER`, `DROP` ni `DELETE`. Todo es idempotente (`ON CONFLICT DO NOTHING`), en transacciones separadas, con ids deterministas (`7000…` fuentes, `8000…` fragmentos).

## 2. Qué se verificó (y qué no)

| Verificación | Resultado |
| --- | --- |
| Las guardas contra **la base real de staging** (solo lectura) | OK: lote 2 aplicado, Código de Faltas y su índice presentes (vigente, sin análisis que lo citen), servicios y tipos de fundamento presentes, partido de Avellaneda (Buenos Aires) presente, nada del lote 3 cargado todavía |
| El SQL en un Postgres local con esquema equivalente | Corre limpio, **8 fragmentos y 10 mapeos**, y una segunda corrida no duplica nada |
| Texto de cada fragmento | Extraído por script del archivo de Hernán (sin retranscribir): sin retornos de carro; Art. 26 con 20 incisos; Art. 49 con incisos a–d; Arts. 233 y 235 con 5 párrafos; Art. 231 con incisos a–g |
| Estructura contra la página oficial | Contrastada **por contenido** (no literal) el 13/10/2026: coincide número y fecha de la Ordenanza 31321 (27/11/2025, ejercicio 2026); arts. 132, 231, 233 y 235 con la misma estructura y el mismo artículo siguiente; Ley 1777 arts. 10 y 11 y su texto actualizado del 29/02/2024; Art. 26 de la Ley 6.851 con los 20 incisos en el mismo orden; Art. 49 con sus cuatro incisos y la marca `(Dec-Ley 9321/79)` |
| **Texto literal contra la página oficial** | **NO verificado.** La herramienta de lectura que usé no puede devolver el texto textual completo (limita las citas). Es el paso 1 de abajo y es tuyo |

## 3. Pasos para aplicarlo

1. **Contrastar el texto literal** de los 8 artículos con las páginas oficiales (links en la propuesta y abajo). Si algo difiere, corregir el SQL antes de correrlo:
   - Ordenanza 31321: https://sibom.slyt.gba.gob.ar/bulletins/13987/contents/2317189
   - Ley 1777: https://boletinoficial.buenosaires.gob.ar/normativaba/norma/77544
   - Ley 6.851 (art. 26 sustituido, **elegir el texto actualizado, no el original de la Ley 6684**): https://boletinoficial.buenosaires.gob.ar/normativaba/norma/830430
   - Decreto-Ley 8031/73: https://normas.gba.gob.ar/documentos/ZBOPDhkV.html
   - Pendiente de Hernán: una última mirada a los boletines de Avellaneda posteriores al 117º por si hay modificatorias de la Ordenanza Fiscal.
2. **Respaldo** previo, como en `docs/REP-3797_respaldo_pre-lote2_29-09-2026.md` (tablas del corpus).
3. Correr `RAG-S15_lote3_corpus.sql` en el SQL Editor de staging. La PARTE 0 aborta sin escribir si falta algo.
4. **Embeddings:** `node scripts/corpus-loader/embed-pending.mjs` (necesita `GEMINI_API_KEY` y la clave de servicio).
5. Verificar con las consultas del final del lote: **W-1** conteos 29 / 132 / 127 / 169 · **W-4** vacía · **W-5** vacía (sin fragmentos sin vector) · **W-6** en 0.
6. Recién ahí medir (D2, D3, D4, D5). Antes del paso 4 el RAG responde igual que hoy.

## 4. Decisiones que tomé y que conviene confirmar con Hernán

| Punto | Lo que hice | Alternativa |
| --- | --- | --- |
| `foundation_type` de la Ordenanza Fiscal | Art. 132 `competencia` (dice qué servicio presta el municipio); arts. 231 y 233 `obligacion` (deber de tener permiso y pagar); art. 235 `sancion` (habilita sanciones, sin montos) | Hernán no fijó el tipo para estos artículos. El catálogo solo admite `obligacion`, `conducta_prohibida`, `sancion` y `competencia` |
| Ley 6684 art. 26 en AMBIENTE | **No** lo mapeé (Hernán dice "si se quiere", por el inciso 16) | Agregar `(07, AMBIENTE)` en la PARTE 3 |
| Etiqueta del art. 235 | "renovación de permisos, revocación y ocupación sin permiso" | La propuesta lo titula "Ocupación sin permiso", pero el artículo es sobre renovación y revocación y recién en su 4.º párrafo habla de ocupación sin permiso; el título corto induciría a citarlo mal |
| Art. 26 de la Ley 6684 | Un solo fragmento de 20 incisos (3.543 caracteres), como pidió Hernán | La propuesta misma advierte que un fragmento tan largo puede recuperarse mal; medir en D4/D5 (opción: partir por inciso, solo si la medición lo justifica) |
| Despublicación del índice | `is_current = false` sin tocar su ruta | El lote 2 renombró la ruta de lo superado con "[SUPERADO…]"; acá no hizo falta porque no hay reemplazo directo |

## 5. Lo que este lote NO cubre (para no prometer de más)

- La **Ordenanza 7180** (Código de Faltas de Avellaneda) sigue sin articulado en línea: el dictamen **no debe citar montos ni multas** de Avellaneda.
- No hay definición de "vía secundaria" (Ley 1777 art. 10 inc. a).
- El art. 49 del Código de Faltas es la conducta de quien cava o apaga el alumbrado: **no fundamenta "la luminaria está apagada"** (eso es la Ordenanza Fiscal art. 132). Está mapeado solo a INFRAESTRUCTURA, no a comercio ni a vulnerabilidad social.

## 6. Reversión

Está en la PARTE 6 del lote. Si todavía no hubo análisis con estos fragmentos se pueden borrar por patrón de id; si ya los citó algún análisis, **no borrar**: marcar `is_current = false` y reponer el índice.
