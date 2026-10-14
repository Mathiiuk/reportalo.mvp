# REP-2902 · Fundamento legal preliminar trazable para el reporte al organismo

**Fecha:** 13/10/2026 · **Responsable:** Matías · **Estado:** implementado y probado en local; **migración NO aplicada en staging**

## Qué se hizo

Un componente de contenido jurídico que reúne lo que el RAG ya produjo para un reporte y verifica que sea trazable al corpus. No es un segundo motor de envío (eso es REP-2801) ni genera texto nuevo.

| Pieza | Archivo |
|---|---|
| Función de la base `get_report_legal_foundation(p_report_id)` | `supabase/migrations/20261013140000_rep2902_fundamento_legal_preliminar.sql` |
| Servicio y armado del bloque de texto | `src/services/legalFoundationService.js` |
| Tests (20) | `src/test/Rep2902FundamentoLegalPreliminar.test.js` |
| Prueba de la función contra un Postgres local (29 aserciones) | `scripts/rep2902/prueba_local_fundamento.sql` |

## Cómo funciona

La función devuelve uno de cuatro resultados:

| Resultado | Cuándo |
|---|---|
| `fundamento_preliminar` | El análisis fue `fundamentado` **y** al menos una cita pasó la verificación |
| `sin_fundamento_verificado` | Cualquier otro caso. **Sin texto jurídico** y con el motivo (no se rellena nada) |
| `pendiente` | Todavía no hay análisis |
| `null` | Quien llama no es el autor, ni quien atiende el reporte, ni el servidor. No se revela ni si existe un análisis |

**Cada cita se verifica** y solo viaja si: (1) el análisis la citó y trae texto citado; (2) ese texto es una subcadena **literal** del fragmento del corpus; (3) la fuente aplica a la **jurisdicción del reporte** según `eligible_knowledge_sources` (el mismo cascade que usa la recuperación); y la fuente sigue vigente. Las que fallan se cuentan en `verification.citations_excluded` pero no se envían.

**Visibilidad.** Nunca se devuelve `citizen_feedback` (el texto para el ciudadano) ni `confidence_score`. Es `SECURITY INVOKER`, así que las policies de `report_ai_analysis` y `report_ai_evidence` siguen aplicando como segunda barrera. No se ejecuta como anónimo.

**Separación de la decisión administrativa.** Todo resultado lleva `is_ai_generated = true` y un aviso fijo: es un fundamento preliminar generado con asistencia de IA y **no** una decisión administrativa ni una resolución estatal.

## Los tres escenarios del ticket

| Escenario | Cómo se cubre | Dónde se prueba |
|---|---|---|
| 1. Norma recuperada y validada para su jurisdicción | Estado `fundamento_preliminar` con referencia legal, norma, fuente, fecha de verificación y cita textual | S1 (local), UT-2902-06 |
| 2. Sin norma suficiente o abstención del RAG | Estado `sin_fundamento_verificado` con el motivo, sin citas ni texto jurídico | S2, S3, S4, S6 (local), UT-2902-07/08/11 |
| 3. Observador que no es autor ni receptor autorizado | La función devuelve `null` | S8 (local), UT-2902-17 |

## Verificación

- **Prueba contra Postgres local** con un esquema de reemplazo (`auth.uid`, `auth.role`, `profile_attends_report` y una copia de `eligible_knowledge_sources` de staging): 29 aserciones, todas pasan. Incluye una cita inventada (no literal), una norma de CABA para un reporte de Avellaneda, una fuente derogada, un tercero, el autor, quien atiende y `service_role`.
- Suite completa: **959 de 959** tests; el build compila.
- **No se probó contra la base real**: la función no está desplegada.

## Para aplicarla

1. Correr `supabase/migrations/20261013140000_rep2902_fundamento_legal_preliminar.sql` en staging (crea una función; no toca tablas ni policies).
2. Probar con un reporte real: `select get_report_legal_foundation('<id>')` con la sesión del autor, y con otra cuenta (debe dar `null`).

## Lo que queda abierto

- **Qué parte viaja al organismo (H-4): resuelto el 14/10/2026.** Hernán eligió la opción C en REP-2805: norma, artículo, extracto literal y fuente oficial, con el aviso de que es preliminar y generado con IA. `buildLegalFoundationText` ya no incluye el resumen técnico de la IA (`official_foundation`), que no es una cita verificable. La función de la base **sigue devolviendo** ese campo (solo al autor y a quien atiende el reporte, que ya pueden leerlo en la tabla); no se tocó para no redesplegarla. Quien arme el mensaje al organismo debe usar `buildLegalFoundationText`, no leer el campo.
- **Política de visibilidad existente.** La policy `agency reads assigned report ai analysis` ya permite que un perfil que atiende el reporte lea **todo** el análisis, incluido `citizen_feedback`, directamente de la tabla. Esta función no lo cambia ni lo amplía, pero conviene que Hernán confirme si eso es lo que quiere (el ticket dice que la respuesta de IA completa es solo para el reportante).
- **REP-2801** debe consumir esta función (`buildLegalFoundationText`) en lugar de leer las tablas, y decide si algo se envía y por qué canal.
- El **dictamen de REP-3829** contrasta este componente.
- Una sola vista previa de la UI no aplica: este ticket no cambia ninguna pantalla.
