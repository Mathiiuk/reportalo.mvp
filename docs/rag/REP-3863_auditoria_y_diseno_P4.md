# REP-3863 · P4 · Auditoría del puente y diseño de la migración (sin aplicar)

**Fecha:** 22/10/2026 · **Responsable:** Matías · **Base:** Reportalo (`yryuhyiujyignkdhiyua`), solo lectura · **Catálogo de routing:** `REP-2806 v1.2`
**Dataset del PO:** `scripts/rep3863/dataset/` (copia del Drive de Hernán, PD-07 de REP-3858), generado por `generar_dataset_puente.py` desde la taxonomía SUACI 2023.

> Pasos 1 y 2 del ticket: auditar esquema, datos y routing, y diseñar la migración. **No se aplicó nada.** Hay dos condiciones para correrla: P0 tiene que estar medido, porque la prueba de aceptación es que M1 dé el mismo top 8, y la normativa nueva espera a REP-3837.

## 1. Conteos del dataset (coinciden con el ticket)

| Archivo | Filas | Control |
|---|---|---|
| `prestaciones.csv` | **107** | AMBIENTE 46 · INFRAESTRUCTURA 50 · COMERCIO_IRREGULAR 5 · TRANSITO 4 · VULNERABILIDAD_SOCIAL 2. Sin duplicados |
| `vocabulario.csv` | **176** | Origen: suaci 105 · po 31 · pruebas_s15 22 · norma 18. Todos aprobados; todos apuntan a una prestación existente; sin términos repetidos |
| `destino.csv` | **59** | 12 grupos de destino × CABA y Avellaneda, todos con fuente y fecha |
| `vinculos_norma.csv` | **58** | Ver §4 |

## 2. Lo que ya hay en la base

| Tabla | Hoy | Cómo la usa el sistema |
|---|---|---|
| `service_attribute_values` (atributo `prestacion`) | **37** prestaciones del catálogo REP-2806 v1.2 | `route_report` / `resolve_report_destination` (REP-2800) y la pregunta de menores (REP-3841) |
| `agency_services` | 863 filas (783 con `attribute_value_id`). Roles: principal 712 · urgencia 71 · general 80 | Routing. Las escribe `supabase/catalogo/rep2800_carga_catalogo_destinos.sql` **por grupo de destino** (`c_ruta`) |
| `agencies` / `agency_contacts` | 165 / 232 (230 aprobados) | Routing |
| `service_keywords` | **0 filas**. PK `(service_id, keyword)` | Nadie la lee: ni el frontend, ni las funciones, ni el motor |
| `fragment_services` | 169 filas. PK `(fragment_id, service_id)` | **La búsqueda**: `match_knowledge_fragments` filtra con `exists (… fs.fragment_id = f.id and s.service_code = p_service_code)` |

## 3. Prestaciones (107 contra 37)

- **34 coinciden exacto** por nombre, en la misma categoría.
- **3 de la base tienen otro nombre en el dataset** (son las mismas). Se conservan la clave y el nombre de la base, porque el routing y REP-3841 las usan:
  - `terreno_baldio_higienizacion` ↔ «Higienización, desratización, saneamiento de terreno baldío o casa abandonada» (el SUACI además la separa de «…de casa abandonada»);
  - `local_sin_habilitacion` ↔ «Establecimiento sin autorización para funcionar sin venta o elaboración de alimentos»;
  - `situacion_de_calle_ninez` ↔ «Niñas, niños o adolescentes en situación de calle o riesgo». **No se renombra**: es la clave que guarda «No sé» (#186).
- **70 prestaciones nuevas.** Todas pertenecen a uno de los 12 grupos que ya tiene `c_ruta`. Por eso, sumarlas al loader de REP-2800 (filas en `c_prest`) les da organismo y canal **sin tocar el routing que funciona y sin duplicar organismos ni canales**. Es justo lo que dice el encabezado del loader: «el resto entra con el mismo script cuando llegue el dataset».
- **`destino.csv` no agrega receptores**: los 12 grupos × 2 jurisdicciones ya están en `c_ruta`/`c_canal`, con la misma fuente del PO (14/10). Se usa para auditar que coincidan, no para cargar.

## 4. Vínculos con normas (58)

| Resultado | Filas | Detalle |
|---|---|---|
| Artículo identificado en el corpus vigente | **48** | Ley 6684 art. 26, Ley 1777 art. 10, Ley 5902, Ley 2148 7.1.8/7.1.9, Ley 451, Ley 1854, Ley 6101, Ley 1166, Ley 3706, Ordenanza 31321, Const. PBA 192, Ley 13.927, Ley 24.449, Ley 13.592, LOM 27/52/59, DL 8751/77 4 bis |
| Solo la ley, sin artículo | **8** | Ley 5901 · Ley 2148 art. 4 · Ley 4036 art. 37 · Ley 11.723 · Ley 15.625 (×2) · Ley 27.654. **Pedido al PO:** el artículo, o la lista de fragmentos aceptables. Hasta entonces quedan como excepción registrada |
| Fuera del corpus | **2** | Ley 5688 arts. 506 y 511 · Ley 2628 art. 3 (APRA). Se cargan con REP-3837 parte B, después de P2 (AC: «incluido APRA hasta cotejo») |

**El punto delicado es M1.** La búsqueda filtra por `fragment_services` a nivel categoría. Si un vínculo crea un par (fragmento, categoría) que hoy no existe, ese fragmento empieza a aparecer en esa categoría y **M1 cambia**. Al cruzarlo con la base, cada vínculo revisado contra su inciso:
- **45 pares ya existen.** Agregarles la prestación no cambia la búsqueda.
- **2 pares serían nuevos**: Ley 6684 art. 26 → AMBIENTE (CABA, higiene, inc. 16) y Ley 13.927 art. 2 → INFRAESTRUCTURA (Avellaneda, semáforos). **No se cargan en P4.** Quedan registrados para P5 («inclusión forzada», S18), que es donde el ticket ubica la activación.

## 5. Diseño de la migración

Borrador en [`REP-3863_propuesta_migracion_P4.sql`](REP-3863_propuesta_migracion_P4.sql), **fuera de `supabase/migrations/`** a propósito, para que nadie la aplique antes de tiempo.

1. **Esquema (idempotente):**
   - `service_keywords` suma `attribute_value_id` (FK, opcional) y `origin` (`suaci | norma | pruebas_s15 | po`). La PK pasa a ser un índice único `(service_id, lower(keyword), attribute_value_id)`.
   - `fragment_services` suma `attribute_value_id` (FK, opcional) y `tipo_fundamento`. La PK pasa a ser un índice único `(fragment_id, service_id, attribute_value_id)`, con un valor fijo para el caso nulo.
   - **Sin cambios** en `match_knowledge_fragments`, en RLS ni en `agency_services`.
2. **Datos, en el orden del ticket:**
   1. **Prestaciones:** las 70 nuevas al loader de REP-2800 (`c_prest`), que ya es idempotente y deja `agency_services` por grupo.
   2. **Destinos faltantes:** ninguno (§3).
   3. **Vínculos:** una fila por (fragmento, categoría, prestación del grupo) **solo si el par (fragmento, categoría) ya existe**. Los 2 pares nuevos, las 8 leyes sin artículo y las 2 normas fuera del corpus van a una tabla de excepciones del informe, no a la base.
   4. **Vocabulario:** 176 filas en `service_keywords`, con su prestación y su origen.
3. **Segunda corrida:** no duplica, por los índices únicos y el `on conflict do nothing`.
4. **Rollback:** se borran solo las filas con `attribute_value_id` que cargó P4. Se restauran las PK originales y se quitan las columnas nuevas. Las 70 prestaciones se borran **solo si ningún reporte las usa** (`infraction_attribute_responses`) y sacando antes sus filas de `agency_services`. Nunca se borra material que referencie un análisis.

## 6. Cómo se verifica (paso 5 del ticket)

- **Recuentos por conjunto** antes y después: 107 prestaciones, filas de `agency_services` por grupo, 176 términos y vínculos cargados más excepciones = 58.
- **Routing intacto:** `resolve_report_destination` para las 37 prestaciones actuales en CABA y Avellaneda tiene que dar **el mismo resultado** que antes.
- **Búsqueda intacta:** el conjunto de pares `(fragment_id, service_code)` distintos de `fragment_services` tiene que ser idéntico antes y después. Esa es la condición suficiente para que `match_knowledge_fragments` no cambie. Además, **M1 con el set v1 tiene que dar el mismo top 8** que la línea base de P0 (por eso P4 se aplica después de medir P0).

## 7. Pendientes

| Quién | Qué |
|---|---|
| Hernán (PO) | Artículo o fragmentos aceptables para las 8 leyes sin artículo. Confirmar que los 2 pares nuevos quedan para P5 |
| Matías | Cuando esté medido P0: generar las filas de `c_prest` y las de vocabulario y vínculos desde el CSV, aplicar en staging con tu OK y correr las verificaciones de §6 |
| Iván (REP-3864) | Auditoría de conteos y muestras |

## 8. Revisión de Iván (REP-3863, 23/10) y cambios

La propuesta ahora la **genera** `scripts/rep3863/generar_carga_p4.mjs` desde el dataset del PO: la migración trae los datos adentro y no se edita a mano. Uso: `node scripts/rep3863/generar_carga_p4.mjs <catalogo_fragmentos_2026-10-20.csv>`.

| Punto | Qué se hizo |
|---|---|
| **48 contra 51** | No es un error: se cuenta distinto. **51** filas del CSV nombran un artículo. De esas, **3** tienen el artículo **sin cargar** en el corpus (Ley 2148 art. 4 ×2 y Ley 4036 art. 37). Quedan **48** con el artículo cargado. Cerrando la cuenta: 48 + 3 + 5 solo con la ley + 2 fuera del corpus = 58 |
| **MIG-01** | `upsert_knowledge_fragment` se redefine en la misma migración. Reescribe solo las filas de categoría (`attribute_value_id is null`). Si versiona un fragmento, copia los vínculos de P4 a la versión vigente, pero solo en las categorías que siguen asignadas: nunca crea un par nuevo. La firma y los permisos no cambian. Así, una carga de corpus (REP-3837) ya no borra P4 en silencio |
| **MIG-02** | `p4_prestacion_grupo` (107 filas) queda dentro de la migración, con la columna `como`: `nombre` (34), `equivalencia` (3) o `nueva` (70). Las 3 equivalencias apuntan a la clave de la base, así que se conservan «local trucho», «chicos en la calle» y los otros 4 términos |
| **MIG-03** | **Antes** de cargar, aborta si no resuelven 107 prestaciones, 176 términos y los 57 vínculos. **Después**, aborta si aparece un par nuevo, si las filas de vínculo no son exactamente 466 o si los términos no son 176. No se descarta nada en silencio |
| **MIG-04** | Las PK reales son `fragment_services_pkey (fragment_id, service_id)` y `service_keywords_pkey (service_id, keyword)`. **Ninguna de las dos tablas está en Realtime**: `supabase_realtime` publica solo `infractions`, `report_state_history` y `report_ai_analysis`. Consultas de solo lectura del 23/10 |
| **MIG-05** | El rollback de prestaciones nuevas controla `infraction_attribute_responses`, `report_routing` (la clave va en `input`/`result` como JSON) y `service_keywords`. También vuelve atrás `upsert_knowledge_fragment` |
| **MIG-07** | El catálogo no se sube (es un adjunto de REP-3859 con ids internos). El generador **valida su SHA-256** (`3602a434…e6cb7`) y aborta si no coincide. Los pares de staging se versionan en `dataset/pares_fragment_services_2026-10-23.json` (169) |
| **Vínculos con inciso** | El emparejamiento ahora respeta el inciso. «LOM art. 27 incs. 1 y 6» toma solo esos dos fragmentos, no el 2, el 8 ni el 17. «4 bis» se toma como artículo, no como inciso: «Ley 13.927 art. 2» no arrastra el 2 bis |

**Resultado del generador:**
- 48 filas del CSV con artículo cargado se convierten en **57 vínculos** (fragmento, categoría, grupo) sobre pares que ya existen. Una norma puede tener varios fragmentos: por ejemplo, Ley 2148 art. 7.1.8 tiene 3 incisos cargados.
- Esos vínculos dan **466 filas** en `fragment_services`: cada vínculo por cada prestación de su grupo.
- **12 excepciones**, que no van a la base: 5 sin artículo, 3 con el artículo sin cargar, 2 fuera del corpus y 2 pares nuevos para P5 (Ley 6684 art. 26 inc. 16 → AMBIENTE y Ley 13.927 art. 2 → INFRAESTRUCTURA).
- Las 70 prestaciones nuevas, con su clave, están en `docs/rag/REP-3863_c_prest_nuevas.sql`, para el loader de REP-2800.

**No probado contra la base:** el SQL no se ejecutó, ni siquiera en una transacción revertida. Queda para el día que se aplique: primero un ensayo `begin … rollback` con el OK del LT y el aviso a QA.
