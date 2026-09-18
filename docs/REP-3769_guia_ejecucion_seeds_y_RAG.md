# Reportalo

*Plataforma de Auditoría Ciudadana*

## GUÍA PARA EL AGENTE — CARGAR LA BASE DESDE CERO Y DEJARLA LISTA PARA EL RAG

**Versión 2.3 · 14 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Jira:** [REP-3769](https://unlz2026.atlassian.net/browse/REP-3769) (DER, Sprint 12) · [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) y [REP-3772](https://unlz2026.atlassian.net/browse/REP-3772) (RAG, Sprint 12) · [REP-3605](https://unlz2026.atlassian.net/browse/REP-3605) (definición del seed, obligatoria)
**Confluence:** [Modelo de Datos v3.1 (en revisión)](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/90406917)
**Archivos:** [carpeta de Drive del proyecto](https://drive.google.com/drive/folders/1JJ6T0Y2MhhzONvaffT8PN7j34lTJjoe9)

**Equipo:** Hernán Gregorini (PO / DBA / Autor) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

> **Propósito.** Los datos semilla se borraron el 12/09/2026 durante unas pruebas. Esta guía acompaña al script **`REP-3769_seed_y_RAG.sql`**, que vuelve a cargar todo, normaliza el modelo de organismos y la traza del reporte, y deja la base lista para arrancar el RAG. Hay dos secciones clave: la **2**, qué cambia en la base y qué hay que cambiar en el código, y la **7**, las mejoras opcionales que Matías evalúa antes de aplicarlas.

---

## 0. Archivos en la carpeta de Drive

| Archivo | Para qué | ¿Obligatorio? |
|---|---|---|
| **`REP-3769_seed_y_RAG.sql`** | El script que se ejecuta | **Sí** |
| **`REP-3769_guia_ejecucion_seeds_y_RAG.md`** | Esta guía | **Sí** |
| `REP-3769_DER_v3.2.txt` | DER objetivo (TO-BE) en DBML, para dbdiagram.io | Consulta |
| `REP-3605_dataset_funcional_sprint10.md` | Definición obligatoria del seed y su fundamento | Consulta |
| `REP-3764_casos_esperados.md` | Casos de las pruebas de humo (§6) | Consulta |
| Archivos de normativa (`constitucion_pba_arts_190_192.md`, `LOM_decreto_ley_6769-58_arts_52_59.md`, `ley_210_caba_ente_regulador.md`, `ley_24449_arts_48_49.md`, `ley_2148_caba_arts_7.1.8_7.1.9.md`, `ley_451_texto.txt`, `codigo_faltas_decreto_ley_8031-73_indice.md`) | Origen de cada texto legal del script | Trazabilidad |

## 1. Reglas para el agente

1. **Esta guía y el script son la única fuente de verdad.** No uses conocimiento propio para completar datos, nombres, textos legales, URLs, identificadores ni valores.
2. **No edites el script.** En especial, los textos legales de la PARTE 7 son copias literales verificadas: no se corrigen, no se "mejoran" y no se vuelven a extraer de la web.
3. **Ejecutá las partes activas (0 a 8, incluida la 5B) en el orden de la sección 3.** Si una parte falla o una verificación no da lo esperado, **detenete**.
4. **Ante cualquier duda, discrepancia o error, detenete y preguntale a Matías** con el formato de la sección 9. No hay otra persona a quién preguntar ni otra fuente que consultar.
5. **Las PARTES 9, 11, 12, 13, 15 y 16 están comentadas: son mejoras opcionales.** No descomentes ninguna sin la **decisión escrita** de quien figura como responsable en la sección 7. Antes de aplicar una, Matías evalúa el impacto en el código que describe esa sección. (Las PARTES 10 y 14 ya no existen: su contenido pasó a las partes activas 5B y 7.)
6. **No borres datos.** Las partes activas no borran nada. Los `DROP` que aparecen en las partes opcionales son pasos finales, con OK escrito aparte.
7. **No toques** las tablas `infraction_types`, `infractions`, `high_priority_zones` y `notifications` (legado sin definir, REP-3443).
8. **Nunca escribas claves, contraseñas ni tokens** en código, en el repositorio, en los logs ni en esta guía.
9. **Nombres del esquema en inglés.** Los valores de catálogo (`RECIBIDO`, `TRANSITO`, `obligacion`…) son semillas obligatorias del PO y **no se traducen**.
10. **Cada cambio de la sección 2 marcado "Cambia el código: Sí" es obligatorio en el código.** Si no encontrás dónde aplicarlo, o aplicarlo rompe algo, preguntá.

## 2. Qué cambia en la base y qué tenés que cambiar en el código

| Ref. | Cambio en la base (parte del script) | ¿Cambia el código? | Qué hacer en el código |
|---|---|---|---|
| C-1 | `citizen_reports.current_state_code`: el valor por defecto pasa de `'borrador'` a `'RECIBIDO'` (PARTE 1) | **Sí** | Ningún código usa, envía ni espera `'borrador'`. Los borradores y los reportes pendientes de envío viven **en el teléfono** (IndexedDB, `PENDING_SYNC`), no en el servidor |
| C-2 | `citizen_reports.locality_id` pasa a **obligatorio** (PARTE 1) | **Sí** | Todo alta de reporte tiene que enviar o resolver `locality_id`. Sin localidad, el INSERT falla. De la localidad parten el RLS por jurisdicción y la cascada del RAG |
| C-3 | `UNIQUE(padre, nombre)` en `states_provinces`, `subdivisions` y `localities` (PARTE 1) | No | Solo afecta a quien cargue geografía |
| C-4 | Las categorías son exactamente 5, con código en **MAYÚSCULAS**: `TRANSITO`, `INFRAESTRUCTURA`, `AMBIENTE`, `COMERCIO_IRREGULAR`, `VULNERABILIDAD_SOCIAL` (PARTE 2) | **Sí** | Si el código usa otros códigos (minúsculas, o las 4 categorías del seed anterior de REP-3471), reemplazarlos. La pantalla de categorías (REP-2202) muestra las 5 |
| C-5 | Los estados son exactamente 5: `RECIBIDO`, `EN_ANALISIS`, `DERIVADO`, `RESUELTO`, `DESESTIMADO` (PARTE 2) | **Sí** | "Vencido" no es un estado (es un cálculo de tiempo) y `borrador` tampoco. No usar otros códigos |
| C-6 | Módulo RAG nuevo: `knowledge_sources`, `knowledge_fragments`, `fragment_embeddings`, `source_adhesions` y catálogos. **Reemplaza a `normativas`** (PARTES 6 y 7) | **Sí** | **Dejar de usar** la tabla `normativas`, el RPC `match_normativas`, el array `INITIAL_LEGAL_CORPUS`, el embedding local de 64 dimensiones (`generateDeterministicEmbedding`), el atajo por palabras clave del caso F, la resolución de jurisdicción por texto y el *fallback* silencioso al embedding local (todo en `legalRagService.js` del spike). **Usar** el RPC `match_knowledge_fragments` (sección 5) |
| C-7 | Modelos: `embedding_models` y `generation_models`, con un modelo activo en cada tabla (PARTE 7) | **Sí** | Vectorizar con **`gemini-embedding-2` a 768 dimensiones**. `text-embedding-004` fue apagado por Google el 14/01/2026 y ya no responde. Redactar con **`gemini-3.8-flash`**. El código lee los modelos de estas tablas (`where is_active`), no los escribe en duro |
| C-8 | `report_ai_analysis` suma columnas: `result_status_code`, `suggested_service_id`, `embedding_model_code`, `generation_model_code`, `prompt_version`, `input_tokens`, `output_tokens`, `latency_ms`. La del estado y la del modelo de embeddings son obligatorias si la tabla estaba vacía (PARTE 6) | **Sí**, cuando se guarde el análisis | Al guardar un análisis, completar esas columnas. Los tokens salen de lo que informa la API en cada respuesta |
| C-9 | Tabla nueva `report_ai_evidence`: qué fragmentos se recuperaron y cuáles se citaron (PARTE 6) | **Sí**, cuando se guarde el análisis | Guardar una fila por cada fragmento recuperado, con `rank`, `similarity`, `was_cited` y `quoted_text`. **Todavía no tiene política de lectura:** el cliente no la puede leer hasta aplicar la PARTE 13 (§7.4) |
| C-10 | Capa Open311: columna `report_states.open311_status`, tabla opcional `service_keywords`, columnas opcionales en `service_attributes` y 3 vistas `open311_*` (PARTE 5; la PARTE 5B redefine `open311_requests` para que `agency_responsible` diga "Organismo — Departamento", o solo el organismo) | No | No cambia nada de lo que existe. Las vistas sirven para exportar en el estándar si algún municipio lo pide |
| C-11 | `latitud` y `longitud` **no se renombran** | No | Siguen igual. La vista Open311 las publica como `lat` y `long` |
| C-12 | **Áreas y categorías de los organismos** (PARTE 5B): `agencies.parent_agency_id` (área → organismo del que depende), `agency_services` (categorías que atiende un área; sin filas = todas), `profile_services` (categorías de un funcionario dentro de su área; sin filas = todas las de su área) y la función `profile_attends_report(profile, report)` | **Sí** | Cada funcionario tiene su usuario, con `profiles.agency_id` = **su área**. El panel del organismo lista y abre solo los reportes para los que `profile_attends_report` da `true`. Al dar de alta un funcionario que atiende menos categorías que su área, cargar sus `profile_services`. El routing (REP-2800) elige el área por jurisdicción y por `agency_services`. **El RLS no cambia hasta aplicar la PARTE 16** (§7.3) |
| C-13 | **Traza del reporte** (PARTE 5B): `report_event_types`, `report_events` (solo inserción), la función `mark_report_viewed(report_id)` y la vista `report_timeline`, **fuente del informe** | **Sí** | El panel llama a `mark_report_viewed(report_id)` **cada vez que un funcionario abre un reporte**: la base registra solo la primera apertura por área y rechaza reportes que ese funcionario no atiende. **El informe y la línea de tiempo se arman con `report_timeline`**: `milestone`, `occurred_at`, `state_code`, `organization_name` y `department_name`. La vista **no trae al funcionario**: no mostrarlo en ningún informe (D-T2). Para auditoría interna, el funcionario está en `report_state_history.changed_by` y `report_events.actor_profile_id` |
| C-14 | `report_state_history.actor_agency_id` y `citizen_reports.client_created_at` (PARTE 5B) | **Sí** | Al registrar un cambio de estado, completar `actor_agency_id` con el área del funcionario **en ese momento**. La sincronización offline envía `client_created_at`: cuándo se creó el reporte en el teléfono |
| C-15 | El LOM art. 52 (FR02) queda asociado también a `AMBIENTE` (PARTE 7) | No | Solo cambia qué normas encuentra el RAG: los reportes de basurales y acumulación de residuos en Avellaneda ahora tienen fundamento |

**Qué se registra y qué se muestra, por decisión del PO (D-T1 y D-T2, 14/09/2026):**

- **Se registra siempre** el funcionario (su usuario, del que sale su nombre en `profiles`) y su **área**. De ella sale el **organismo** del que depende. Un municipio puede tener usuarios distintos por área (infraestructura, tránsito…): el modelo lo contempla con `parent_agency_id`, `agency_services` y `profile_services`.
- **El informe muestra organismo y departamento, nunca al funcionario.** Si el área no depende de otro organismo, se muestra solo el organismo. La regla está en la base (vista `report_timeline`), no en el código de pantalla.

## 3. Cómo ejecutar

1. **Con psql:** `psql -v ON_ERROR_STOP=1 -f REP-3769_seed_y_RAG.sql` (las partes comentadas no se ejecutan). **Con el editor SQL de Supabase:** pegar y ejecutar **una PARTE por vez**, en orden.
2. **PARTE 0:** si da un error, detenerse (Q-1). Si da un aviso, copiarlo y preguntar antes de seguir.
3. **PARTES 1 y 2.**
4. **Antes de la PARTE 3, crear en Supabase Auth estos 6 usuarios** (dominio `.test`, no enrutable). Matías indica si se crean por el panel o por la API de administración, y dónde se guardan las contraseñas (Q-2): `ciudadano.demo@reportalo.test`, `ciudadano.vecino@reportalo.test`, `ciudadano.consulta@reportalo.test`, `oficial.caba@reportalo.test`, `oficial.avellaneda@reportalo.test`, `admin.reportalo@reportalo.test`.
5. **PARTE 3** (perfiles y términos). **PARTE 4** (reportes de demostración): solo si Matías pide el perfil `full`.
6. **PARTES 5, 5B, 6 y 7.**
7. **Script de vectores** (sección 4).
8. **PARTE 8:** todo tiene que dar `OK`. Después, las pruebas de la sección 6.
9. **Partes opcionales:** solo las que tengan decisión escrita, en el orden que indica la sección 7.

## 4. Script de vectores (después de la PARTE 7)

Corre **del lado del servidor** (Edge Function o script de Matías, **nunca** en el frontend), con la clave de Gemini tomada de una variable de entorno.

1. Leer los fragmentos vigentes sin vector para el modelo activo:
   `select f.id, f.content from public.knowledge_fragments f where f.is_current and not exists (select 1 from public.fragment_embeddings e where e.fragment_id = f.id and e.model_code = 'gemini-embedding-2@768');`
2. Por cada uno, llamar a `embedContent` de la Gemini API ([referencia](https://ai.google.dev/api/embeddings)):
   - modelo: `gemini-embedding-2`
   - texto: **solo** `content` (sin la ruta ni la jurisdicción)
   - dimensión de salida: **768**
   - tipo de tarea `RETRIEVAL_DOCUMENT`, **solo si la API lo acepta para este modelo**. Si lo rechaza, no enviarlo y avisar (Q-4)
3. Insertar en `public.fragment_embeddings (fragment_id, model_code, embedding)` con `model_code = 'gemini-embedding-2@768'` y el vector como texto `'[v1,...,v768]'`.

**Verificación:** 15 filas, todas con `vector_dims(embedding) = 768`.

## 5. Cómo usa el código el RAG (contrato para REP-2908 y REP-3772)

**Búsqueda.** Desde el servidor, con `service_role`:

```
match_knowledge_fragments(query_embedding vector(768), p_locality_id uuid, p_model_code varchar, match_count int = 6)
  → fragment_id, source_id, hierarchy_path, content, scope_level, similarity
```

- `query_embedding`: el texto del reporte vectorizado con el modelo activo (tipo de tarea `RETRIEVAL_QUERY` si la API lo acepta).
- `p_locality_id`: la localidad del reporte. La función aplica sola la cascada (municipio → provincia o CABA → nación, con adhesiones). **No filtrar jurisdicción en el código.**
- `scope_level`: 1 municipio, 2 provincia o CABA, 3 nación. Se le pasa al LLM para priorizar la normativa más específica o local, **sin descartar los marcos superiores**.

**Parámetros provisorios del Sprint 12** (los fija Hernán en REP-3773; hasta entonces se usan estos y quedan registrados en cada resultado): `match_count` = 6 · umbral de similitud: se mide con los 6 casos de §6 y se informa, no se inventa · nivel de pensamiento del LLM: el más bajo que acepte el modelo.

**Salida del LLM:** JSON con esquema obligatorio. Cada campo va a:

| Campo del JSON | Se guarda en |
|---|---|
| `estado` | `report_ai_analysis.result_status_code` (valores de `ai_result_statuses`) |
| `es_infraccion` | `is_infraction` |
| `categoria` | `suggested_service_id`: **un código de `services`**, nunca texto libre |
| `organismo_sugerido_id` | `suggested_agency_id`: **un id de `agencies`**, el área que atiende esa categoría en esa jurisdicción |
| `fundamento_ciudadano` / `fundamento_oficial` | `citizen_feedback` / `official_legal_foundation` |
| `confianza` | `confidence_score` |
| `citas[]` (`fragment_id`, `cita_textual`) | `report_ai_evidence` (`was_cited = true`, `quoted_text`) |

**Validación en código (REP-3772).** Si falla, el resultado es `indeterminado` y **nunca** se usa un resultado de reemplazo:

- cada `fragment_id` citado está entre los recuperados;
- cada `cita_textual` aparece literalmente en el `content` de ese fragmento;
- el organismo existe en `agencies`.

Si ningún fragmento supera el umbral, el resultado es `sin_normativa` **y no se llama al LLM**. La categoría `VULNERABILIDAD_SOCIAL` devuelve `asistencia`, con `is_infraction = false`. **Nunca** se muestran montos ni sanciones al ciudadano: los fragmentos con `foundation_type_code = 'sancion'` sirven para fundamentar ante el organismo.

## 6. Pruebas

### 6.1 Búsqueda del RAG (casos conocidos de REP-3764)

Sirven para confirmar que la carga funciona, **no para medir calidad**. La medición se hace en REP-2910, con casos reservados que esta guía no incluye a propósito.

| Caso | Texto | Localidad | Tiene que aparecer | No puede aparecer |
|---|---|---|---|---|
| A | "Hay una boca de tormenta rota hace semanas en mi cuadra" | Piñeyro | FR01, FR02 o FR03 | Ningún fragmento de CABA |
| B | "Un auto está estacionado sobre la rampa para discapacitados de la esquina" | Retiro | FR12, y FR13 o FR14 | FR07 a FR10 (Ley 24.449): **excluidos por la cascada** |
| C | Mismo texto que B | Piñeyro | FR10 | FR11 a FR14 (CABA) |
| D | "No anda la luz de la calle hace tres días" | Piñeyro, después Retiro | Piñeyro: FR02 · Retiro: FR05 | El mismo resultado en las dos |
| E | "Hay quilombo en la esquina, discuten y frenan el tránsito todos los días" | Piñeyro | Algún fragmento FR07 a FR10 | FR15 primero |
| F | "Un puesto vende bebidas en la vereda sin habilitación" | Piñeyro | — (el resultado final esperado es `sin_normativa`) | — |

Las exclusiones por jurisdicción (B, C y la mitad de D) son obligatorias: si fallan, es un error de carga o de cascada, y hay que detenerse. Si falla algún "tiene que aparecer", **no se ajusta nada**: se registra el resultado y se avisa a Matías.

### 6.2 Áreas y traza (PARTE 5B, perfil `full`)

| Prueba | Resultado esperado |
|---|---|
| `profile_attends_report(<id de oficial.caba>, '40000000-0000-4000-8000-000000000002')` | `true` (RPT-02 es de Comuna 1) |
| `profile_attends_report(<id de oficial.avellaneda>, '40000000-0000-4000-8000-000000000002')` | `false` (no es su jurisdicción) |
| Con la sesión de `oficial.caba`, llamar dos veces a `mark_report_viewed('40000000-0000-4000-8000-000000000002')` | **Una** fila en `report_events` |
| Con la sesión de `oficial.avellaneda`, llamar a `mark_report_viewed('40000000-0000-4000-8000-000000000002')` | **Cero** filas nuevas |
| `select * from report_timeline where report_id = '40000000-0000-4000-8000-000000000004'` | 4 cambios de estado, en orden, más el evento de apertura si se lo registró. En las transiciones hechas por `oficial.caba`, `organization_name` = "Dirección General de Fiscalización — Comuna 1" y `department_name` vacío, porque esa área no depende de otro organismo en el seed. **Ninguna columna identifica al funcionario** |

## 7. Mejoras opcionales (PARTES 9, 11, 12, 13, 15 y 16, comentadas)

Cada una es la **mejor opción que encontramos para el modelo**, lista para aplicar. **Ninguna se aplica sola:** Matías evalúa primero qué código afecta, y se descomenta solo con decisión escrita del responsable que figura en cada caso.

**Orden si se aplican varias:** 11 antes que 15 · 12 antes que 16 · 9 al final de todo.

### 7.1 Evidencia anonimizada normalizada — PARTE 11 · decide Matías

- **Propuesta:** `citizen_report_media` + `media_types` reemplazan a `report_images` (diseño de REP-3443).
- **Por qué es lo mejor:** el nombre `anonymized_url` deja explícito que solo se guarda la versión anonimizada, nunca el original. El tipo de evidencia pasa a un catálogo, no texto libre. Deja lugar para video a futuro sin cambiar el esquema.
- **Condición previa:** confirmar que el guardado de la evidencia es **síncrono** (observación O-06). Si es asíncrono, así no sirve: hace falta una columna de estado.
- **Qué afecta en el código (Matías evalúa):**
  - la función de cuarentena, que pasa a escribir en `citizen_report_media` (`anonymized_url`, `mime_type`);
  - toda pantalla que muestre evidencia: detalle, Mis reportes (REP-3553), marcadores (REP-3752) y panel (REP-3749);
  - el contrato de `create_report` y las pruebas que lean `report_images`;
  - la vista `report_timeline` (PARTE 5B), que hay que ajustar como indica el SQL.
- **Qué hace la parte:** crea las tablas, carga `media_types = 'foto'`, copia lo que haya en `report_images`, activa RLS (la evidencia la ve quien puede ver el reporte; solo escribe el servidor) y actualiza la vista `open311_requests`. **`report_images` no se borra:** el `DROP` final va con OK aparte.
- **Verificación:** mismas filas en `citizen_report_media` que en `report_images`. Un INSERT sin `anonymized_url` o con un `media_type` inexistente tiene que fallar.

### 7.2 Organismos con jurisdicción en cualquier nivel — PARTE 12 · deciden PO y Matías, antes del Sprint 15

- **Propuesta:** tabla `agency_jurisdictions`, con el mismo "arco exclusivo" que `knowledge_sources`: cada fila ancla el área a un país, una provincia (o CABA) o un municipio/comuna, y un área puede tener varias filas. Función `agency_covers_locality(agency, localidad)` con la misma cascada del RAG.
- **Por qué es lo mejor:** resuelve dos cosas con una sola estructura normalizada:
  - el organismo **nacional** de vulnerabilidad social (Ministerio de Capital Humano), que hoy no se puede cargar;
  - organismos que cubren **varias comunas** o toda la Ciudad (observación O-6).

  Se combina con las áreas de la PARTE 5B: jurisdicción por `agency_jurisdictions` y categorías por `agency_services`.
- **Transición:** `agencies.subdivision_id` pasa a admitir nulo y convive con la tabla nueva hasta que el código migre. En ese período el dato está repetido (redundancia de transición). El `DROP` de la columna es el paso final, con OK aparte.
- **Qué afecta en el código (Matías evalúa):**
  - la función `profile_attends_report` (PARTE 5B), cuyo control de jurisdicción pasa a `agency_covers_locality`, como indica el SQL;
  - las políticas RLS del oficial (REP-2507);
  - el panel (REP-3747 y REP-3749) y el routing (REP-2800 y REP-3742);
  - todo código que lea `agencies.subdivision_id`.
- **Seeds:** copia la jurisdicción de los 2 organismos actuales y carga el **Ministerio de Capital Humano** a nivel nación (REP-3605 §8). **No lleva contacto:** el correo lo define el PO; sin él, el routing no puede enviarle nada.
- **Verificación:** `agency_covers_locality` da `true` para el Ministerio en Retiro y en Piñeyro, `true` para la Dirección de Fiscalización en Retiro, y `false` para la Secretaría de Avellaneda en Retiro.

### 7.3 Aplicar la granularidad por área y categoría al RLS del oficial — PARTE 16 · decide Matías

- **Propuesta:** que el oficial vea **solo los reportes que atiende**: jurisdicción de su área, categorías de su área y categorías propias. La base ya lo sabe calcular con `profile_attends_report` (PARTE 5B).
- **Por qué es lo mejor:** mínimo privilegio. Un funcionario de tránsito no ve reportes de ambiente, y la regla vive en la base, no en el código (principio del proyecto: el acceso lo resuelve el RLS).
- **Qué afecta en el código (Matías evalúa):**
  - la política SELECT de `citizen_reports` del rol organismo (REP-2507): se reemplaza **solo** la condición del oficial;
  - las tablas que siguen la visibilidad del reporte (`report_state_history`, `report_ai_analysis`, `report_events`);
  - los listados del panel (REP-3747 y REP-3749);
  - las pruebas de RLS de QA (CE-S10-19). Con `agency_services` vacía, el oficial de Avellaneda sigue viendo sus 3 reportes.
- **Seeds:** ninguno. Las áreas reales de cada municipio las define el PO. La parte trae un ejemplo con valores `<a completar>` que **no se ejecuta tal cual**.
- **Verificación:** con un área que tenga solo `TRANSITO` en `agency_services`, su funcionario ve RPT-06 y no RPT-07 (ambiente) ni RPT-08.

### 7.4 Política de lectura de `report_ai_evidence` — PARTE 13 · decide Matías

- **Propuesta:** la evidencia de un análisis la ve quien puede ver ese análisis. La política consulta `report_ai_analysis` con el RLS del propio usuario, así que no repite ningún criterio.
- **Por qué es lo mejor:** un solo lugar define quién ve un análisis. Si `report_ai_analysis` no tiene política de lectura, la evidencia tampoco se ve: falla cerrado.
- **Qué afecta en el código:** la pantalla del ciudadano **no muestra** los fragmentos de tipo `sancion`, porque Reportalo no muestra sanciones.
- **Verificación:** un ciudadano ve la evidencia de sus reportes y no la de otros.

### 7.5 LOM art. 52 también en `AMBIENTE` — aplicada

Decisión del PO (14/09/2026): "barrido, riego, limpieza" cubre basurales y acumulación de residuos. Ya está en la PARTE 7, que es activa: `fragment_services` tiene 15 filas. Ver cambio C-15.

### 7.6 Imágenes de los reportes de demostración — PARTE 15 · decide Matías

- **Condición:** que el bucket `seed-assets` tenga los 9 archivos. Nunca se generan ni se descargan imágenes.
- **Qué hace:** inserta 9 filas en `report_images` con la ruta `seed-assets/<archivo>` (convención de REP-3605). Si se aplicó la PARTE 11, se usa la variante sobre `citizen_report_media` que está en el mismo bloque.
- **Qué afecta en el código:** nada, si el código lee la ruta con esa convención. Si necesita la URL pública completa, Matías define el prefijo (Q-5).
- **Verificación:** 9 filas; RPT-02 con 2 imágenes.

### 7.7 Retiro de `normativas` — PARTE 9 · decide Matías

- **Condición:** que el código ya haya aplicado el cambio C-6 y no use `normativas` ni `match_normativas`.
- **Qué hace:** borra la función vieja y la tabla. Sus filas no se migran: su texto no es literal (informe de REP-2907).

### 7.8 Adhesión de CABA a la Ley 26.363 — sin SQL, a propósito

- CABA **no** adhirió a la Ley 24.449: tiene su propio código (Ley 2148). Adhirió al régimen de la **Ley 26.363** por la Ley 3134/2009.
- No hay SQL porque primero hay que curar el texto de la 26.363 (tarea de Hernán). Cuando esté, se carga la 26.363, se carga la Ley 3134 como fuente de CABA y se registra la adhesión en `source_adhesions`.

## 8. Checklist de Hernán antes de subir los archivos

- [x] **Ley 13.927, art. 1:** leído el 14/09/2026 en la [página oficial](https://normas.gba.gob.ar/documentos/0YqDnfd0.html): *"TÍTULO I - ADHESIÓN. ARTÍCULO 1.- ADHESIÓN. La Provincia de Buenos Aires adhiere, en cuanto no se opongan a las disposiciones de la presente, a las Leyes Nacionales 24.449 y 26.363, que como anexos se acompañan."* Coincide con lo que carga el script
- [x] **D-T1:** decidido. Se registran siempre el funcionario y su área u organismo (PARTE 5B)
- [x] **LOM art. 52 en `AMBIENTE`:** aprobado. Pasó a la PARTE 7 (activa)
- [x] **D-T2:** decidido. El funcionario se registra; el informe muestra organismo y departamento (solo organismo si no hay departamento)
- [ ] Subir a la carpeta de Drive los archivos de la sección 0

**Verificación hecha antes de entregar:** un script comparó cada línea de los 15 fragmentos del SQL contra su archivo fuente. Ignoró espacios, comillas y asteriscos de Markdown, y en la Ley 451 las marcas `es-ES` de la extracción del PDF. Todas coinciden. **El SQL no se ejecutó todavía contra una base real:** la primera corrida es la PARTE 0, en el entorno de Matías.

## 9. Cómo preguntarle a Matías, y preguntas previstas

> **PREGUNTA PARA MATÍAS — PARTE N / Ref.**
> **Qué encontré:** (resultado exacto, copiado)
> **Qué esperaba la guía:** (texto de la guía)
> **Qué necesito que decidas:** (una sola decisión)
> **Mientras tanto:** detenido en la PARTE N, sin cambios aplicados

| Ref. | Pregunta | Bloquea |
|---|---|---|
| Q-1 | La PARTE 0 falló (versión de Postgres, extensión `vector` o códigos fuera de la semilla) | Todo |
| Q-2 | ¿Cómo se crean los usuarios de Auth en este entorno y dónde se guardan las contraseñas? | PARTE 3 |
| Q-3 | ¿Se aplica la PARTE 13 (lectura de `report_ai_evidence`)? | Lectura desde el cliente |
| Q-4 | La API rechaza el tipo de tarea para `gemini-embedding-2` | Script de vectores |
| Q-5 | ¿Existen las 9 imágenes en `seed-assets`? ¿`image_url` guarda la ruta o la URL pública? | PARTE 15 |
| Q-6 | Algún cambio de la sección 2 rompe código existente | El cambio en cuestión |
| Q-7 | ¿El guardado de la evidencia anonimizada es síncrono (O-06)? | PARTE 11 |
| Q-8 | ¿Qué política de lectura llevan `report_events` y `profile_services`? Propuesta: `report_events`, la misma visibilidad que el reporte; `profile_services`, el propio funcionario y administración | Lectura de la traza desde el cliente |

## 10. Para que no vuelva a pasar

- **El seed vive versionado en el repositorio** (`supabase/seed.sql`), a partir de este script. Los datos se pueden perder; el script no.
- **Las pruebas destructivas se hacen en un entorno aparte y descartable**, nunca sobre la base compartida.
- **Antes de borrar datos compartidos, se avisa al equipo.**

---

**Documentos relacionados:** [Modelo de Datos v3.1 (Confluence)](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/90406917) · [Carpeta de Drive](https://drive.google.com/drive/folders/1JJ6T0Y2MhhzONvaffT8PN7j34lTJjoe9) · [Open311 GeoReport v2](https://wiki.open311.org/GeoReport_v2/) · [REP-3769](https://unlz2026.atlassian.net/browse/REP-3769) · [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) · [REP-3772](https://unlz2026.atlassian.net/browse/REP-3772) · [REP-3773](https://unlz2026.atlassian.net/browse/REP-3773) · [REP-3443](https://unlz2026.atlassian.net/browse/REP-3443) · [REP-3605](https://unlz2026.atlassian.net/browse/REP-3605) · [REP-3764](https://unlz2026.atlassian.net/browse/REP-3764) · [REP-2910](https://unlz2026.atlassian.net/browse/REP-2910)
