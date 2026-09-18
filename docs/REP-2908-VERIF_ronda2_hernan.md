# Reportalo

*Plataforma de Auditoría Ciudadana*

## VERIFICACIÓN DEL RAG — SEGUNDA RONDA Y DECISIONES SOBRE REP-2500

**Versión 1.0 · 15 de septiembre de 2026 · Proyecto RAR-2026**

**Responde a:** `REP-2908-VERIF_devolucion-a-hernan` y `REP-2500_resolucion-locality-id` (Matías, 14/09)
**Reemplaza, en lo que está abierto:** `REP-DEPLOY-RAG-SUPABASE_devolucion_y_verificacion.md` (v1.0, 14/09). Lo que ya se cerró no se repite.
**Jira:** [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) · [REP-2909](https://unlz2026.atlassian.net/browse/REP-2909) · [REP-2500](https://unlz2026.atlassian.net/browse/REP-2500) · [REP-3772](https://unlz2026.atlassian.net/browse/REP-3772) · [REP-3773](https://unlz2026.atlassian.net/browse/REP-3773) · [REP-3775](https://unlz2026.atlassian.net/browse/REP-3775) · [REP-3776](https://unlz2026.atlassian.net/browse/REP-3776) · [REP-2910](https://unlz2026.atlassian.net/browse/REP-2910)
**Archivos de apoyo (carpeta Drive del proyecto):** https://drive.google.com/drive/folders/1JJ6T0Y2MhhzONvaffT8PN7j34lTJjoe9
- `REP-3769_seed_y_RAG.sql` (PARTES 3, 4 y 8)
- `REP-3769_guia_ejecucion_seeds_y_RAG.md` (v2.3)
- `REP-DEPLOY-RAG-SUPABASE_devolucion_y_verificacion.md` (plantillas de V-06, V-09 y V-11)

**Equipo:** Hernán Gregorini (PO · DBA) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

---

## 0. Reglas (iguales a las del documento anterior)

1. Este documento es la única fuente de instrucciones. Si algo no está claro, se le pregunta a Matías. No se completa por intuición.
2. Nunca se escribe una clave en ningún lado: ni archivos, ni commits, ni capturas, ni chat. Las consultas devuelven **nombres**, nunca valores.
3. Las consultas son de solo lectura, salvo las marcadas **[ESCRIBE]**, que se corren con el OK de Matías.
4. Nada se borra sin el OK escrito de Hernán (DBA). Donde este documento recomienda borrar algo, lo dice explícitamente y pide ese OK.
5. Todo cambio de base se hace con una migración y entra por Pull Request.
6. Si un nombre real difiere del de este documento, se usa el real y se anota la diferencia.

---

## 1. Primero: gracias, y tres correcciones a nuestro documento anterior

La devolución fue muy buena. Encontró dos problemas que nosotros no habíamos visto y los resolvió:

- **Las funciones de la cola se podían llamar desde afuera.** `dispatch_rag_analysis_queue` y `enqueue_rag_analysis` estaban abiertas por la API a usuarios sin sesión, y cualquiera podía generar costo de Gemini. Quedó corregido.
- **La cola reprocesaba mensajes para siempre.** El borrado de mensajes procesados fallaba sin avisar, porque el esquema `pgmq` no está expuesto en la API. Quedó resuelto con un wrapper.

Estas son las tres correcciones a nuestro documento:

| # | Qué dijimos | Qué es correcto |
|---|---|---|
| C-1 | La consulta 1 de V-01 buscaba claves en `pg_proc` y `cron.job` | Era incompleta: **no revisaba los triggers** (`pg_trigger`), que es justo donde estaba la clave. La consulta corregida está en V-01 |
| C-2 | El PR va contra `develop` | La rama base del Sprint 12 es **`staging`**. Corregimos la convención del proyecto |
| C-3 | (Tu documento de REP-2500, O-2) "Avellaneda" figura duplicada en `localities` | **No es un error:** es a propósito. Ver sección 4.2 |

---

## 2. Estado después de tu devolución

| ID | Tema | Tu estado | Nuestro estado | Qué falta |
|---|---|---|---|---|
| V-01 | Clave service_role | Cerrado | **Aceptado con un detalle** | Correr la consulta corregida (C-1) |
| V-02 | Backup en Git | Parcial | **Abierto — P1** | Sacar los archivos del repositorio (`.gitignore` no alcanza) y decidir sobre el historial |
| V-03 | Seguridad heredada | Parcial | **Abierto — P1** | Lista de las 17 tablas sin políticas y corrección de `search_path` |
| V-04 | Estado de la base | Parcial | **Abierto — P1** | Recargar los seeds demo (**decidido: sí**) |
| V-05 | Migraciones y PR | Parcial | **Abierto — P1** | PR contra `staging` y prueba de reconstrucción |
| V-06 | Mismo embedding | No iniciado | Abierto — P2 | Sin cambios |
| V-07 | Punta a punta | Cerrado | **Aceptado** | — |
| V-08 | Reintentos y presupuesto | No iniciado | **Abierto — P1, el más urgente** | Todo |
| V-09 | A–F × 5 | No iniciado | Abierto — P2 | Sin cambios |
| V-10 | Caso A | Decisión de Hernán | Hernán, en REP-3773 | — |
| V-11 | Modelo y parámetros | No iniciado | Abierto — **se sube a P1** (son dos consultas) | Todo |
| V-12 | Clave de Gemini en el frontend | Cerrado | **Aceptado** | — |
| V-13 | Jira | Pendiente | Abierto — P2 | Comentario en REP-2908 |
| N-01 | Funciones de la cola expuestas por la API | Hallazgo nuevo | **Aceptado** | Que quede en la migración (V-05) |
| N-02 | `pgmq` no expuesto en la API, reproceso infinito | Hallazgo nuevo | **Aceptado con pedido** | Documentarlo y medir el costo que generó (V-08) |

**Orden de trabajo sugerido hasta el viernes 18/09:** V-08 → V-02 → V-11 → V-04 → V-05 (PR) → V-03 → V-13. V-06 y V-09 si queda tiempo; si no, pasan al Sprint 13 como pendientes declarados.

---

## 3. Puntos abiertos: qué hacer, qué mandar y cuándo se cierra

### V-01 · Clave service_role — aceptado, con un detalle

La rotación está bien hecha: claves nuevas `sb_secret_...`, claves viejas deshabilitadas, Vault actualizado y producción verificada. El detalle es que `audit_ia` **está desactivado pero sigue existiendo**. Su definición todavía tiene el JWT viejo. Esa clave ya no sirve, pero sigue apareciendo en cualquier dump de la base.

**Consulta corregida (C-1)** — busca en triggers, funciones y tareas programadas, y devuelve solo nombres:

```sql
select 'trigger' as tipo, c.relname as objeto, t.tgname as nombre
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where not t.tgisinternal
  and pg_get_triggerdef(t.oid) ~ '(eyJ[A-Za-z0-9_-]{10,}\.|sb_secret_)'
union all
select 'function', n.nspname, p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.prosrc ~ '(eyJ[A-Za-z0-9_-]{10,}\.|sb_secret_)'
union all
select 'cron', 'cron', j.jobname
from cron.job j
where j.command ~ '(eyJ[A-Za-z0-9_-]{10,}\.|sb_secret_)';
```

**Recomendación:** eliminar el trigger `audit_ia` con una migración. La tabla `infractions` es heredada y tiene 0 filas. **Requiere el OK escrito de Hernán.**

**Qué mandar:**
- la salida de la consulta;
- una captura de la pantalla de claves de la API donde se vean las claves viejas deshabilitadas (sin valores).

**Se cierra cuando** la consulta devuelve 0 filas. Mientras Hernán no dé el OK para borrar, se acepta que devuelva solo `audit_ia`, con la captura que prueba que las claves viejas están deshabilitadas.

---

### V-02 · Backup en Git — P1

**Aclaración importante:** agregar `supabase/backups/` al `.gitignore` **no saca los archivos que ya están en el repositorio**. `.gitignore` solo evita que se sumen archivos nuevos. Los que ya se commitearon se siguen versionando y cualquiera que clone el repositorio los recibe.

**Paso 1 [ESCRIBE en Git]** — dejar de versionarlos, sin borrarlos del disco:

```bash
git rm -r --cached supabase/backups/
git commit -m "chore: dejar de versionar backups de la base"
git ls-files supabase/backups/ | wc -l     # tiene que dar 0
```

**Paso 2** — contestar dos preguntas:
1. **¿El repositorio remoto es público o privado?**
2. **¿Qué datos personales hay en el backup?** Listar, por tabla, las columnas con nombre, email, teléfono, DNI, dirección o ubicación de personas. Solo los nombres de las columnas, **nunca los valores**.

**Paso 3 — qué hacer según las respuestas:**

| Situación | Qué se hace |
|---|---|
| Repositorio **público**, cualquiera sea el contenido | Limpiar el historial (`git filter-repo --path supabase/backups --invert-paths`), forzar el push de `staging` y avisar al equipo que vuelva a clonar. Esto va antes que cualquier otro punto |
| Repositorio **privado** y los datos personales son solo de cuentas del equipo | Se acepta el riesgo, con registro escrito en REP-2908. No se limpia el historial |
| Repositorio **privado** con datos de terceros (ciudadanos) | Se limpia el historial igual que en el caso público |

**Paso 4:** guardar el backup fuera del repositorio, con acceso restringido.

**Qué mandar:**
- la salida de `git ls-files` (tiene que dar 0);
- las respuestas a las preguntas 1 y 2;
- qué camino se tomó y dónde quedó guardado el backup (el lugar, no el archivo).

**Se cierra cuando** se cumple el camino que corresponde de la tabla.

---

### V-03 · Seguridad heredada — P1

**Qué mandar:**

1. **La lista de las 17 tablas con RLS activo y sin políticas.** Sale de esta consulta:

   ```sql
   select c.relname as tabla
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
     and not exists (select 1 from pg_policies p
                     where p.schemaname = 'public' and p.tablename = c.relname)
   order by 1;
   ```

   Hernán marca cada tabla como **"solo servidor, correcto"** o **"le falta política"**. Algunas son esperables, según nuestro diseño: `embedding_models`, `generation_models` y `fragment_embeddings`.
2. **[ESCRIBE, por migración]** Fijar el `search_path` de las 10 funciones que marca el Security Advisor:

   ```sql
   alter function public.<nombre>(<argumentos>) set search_path = public;
   ```

3. **Protección de contraseñas filtradas en Auth:** activarla si el plan de Supabase lo permite; si no, decirnos que no está disponible.
4. **Extensión `vector` en el esquema `public`:** **no moverla ahora.** Moverla puede romper las columnas y funciones que usan el tipo `vector`. Queda como deuda técnica anotada.

**Se cierra cuando:**
- Hernán clasificó las 17 tablas;
- el Security Advisor no muestra más los avisos de `search_path`;
- la protección de contraseñas está resuelta (activada, o registrado que el plan no la permite).

---

### V-04 · Recargar los seeds demo — P1 (decidido: sí)

Los seeds de REP-3605 son obligatorios. Además, recargarlos sirve como prueba real: los 8 reportes demo disparan 8 análisis de Gemini, de costo bajo. Varios caen en categorías que todavía no tienen corpus (ambiente, comercio irregular y vulnerabilidad social), así que prueban la abstención con datos reales.

**Pasos:**

1. **Crear en Auth los usuarios demo**, como indica la guía v2.3 antes de la PARTE 3.
2. **[ESCRIBE]** Correr la PARTE 3 (perfiles) y la PARTE 4 (reportes demo) de `REP-3769_seed_y_RAG.sql`. El script es idempotente.
3. Esperar un minuto y correr la PARTE 8 completa.
4. Correr esta consulta:

   ```sql
   select r.id, s.service_code, l.name as localidad, a.result_status_code,
          a.is_infraction, a.confidence_score,
          (select count(*) from public.report_ai_evidence e where e.analysis_id = a.id) as recuperados,
          (select count(*) from public.report_ai_evidence e where e.analysis_id = a.id and e.was_cited) as citados
   from public.citizen_reports r
   join public.services s on s.id = r.service_id
   join public.localities l on l.id = r.locality_id
   left join public.report_ai_analysis a on a.report_id = r.id
   where r.id::text like '40000000-0000-4000-8000-%'
   order by r.id;
   ```

5. Para cada reporte con citas, mandar también el detalle de las citas: `hierarchy_path` y `quoted_text`. Es la consulta de evidencia de V-07 del documento anterior.

**Aparte:** mandar la definición de `profile_attends_report`, que ya no contiene claves (así lo confirma V-01). Hernán la compara contra la PARTE 5B.

```sql
select pg_get_functiondef('public.profile_attends_report(uuid,uuid)'::regprocedure);
```

**Se cierra cuando:**
- la PARTE 8 da todo `OK`;
- los 8 reportes demo tienen su análisis;
- ninguna cita está fuera de lo recuperado ni deja de ser literal;
- Hernán revisó el fundamento de cada uno.

---

### V-05 · Migraciones y Pull Request — P1

La reconstrucción desde `supabase_migrations.schema_migrations`, con los timestamps reales, está muy bien.

**Pasos:**

1. **Abrir el PR contra `staging`** (C-2). La descripción tiene que incluir:
   - la lista de migraciones y qué hace cada una;
   - los nombres de los secretos que hay que cargar (`rag_analizar_reporte_url`, `rag_service_role_key`, `GEMINI_API_KEY`) y dónde se carga cada uno, **sin valores**;
   - el comando para regenerar los embeddings;
   - la explicación de N-02: por qué existe el wrapper de `pgmq` y qué pasa si se lo quita;
   - un enlace a este documento.
2. **Probar que la base se reconstruye.** En el entorno local, correr `supabase db reset`, después el script de seeds y después la PARTE 8. Tiene que dar todo `OK`, salvo `fragment_embeddings`, que da 0 hasta correr el script de vectores.
3. **Revisión:** la parte de base (migraciones, RLS, funciones) la revisa Hernán.
4. **Proteger `staging`:** desde ahora, a `staging` se llega solo por PR. El backup de V-02 llegó por un merge directo, y esto evita que se repita.

**Qué mandar:**
- el enlace al PR;
- la salida del `db reset` sin errores;
- la PARTE 8 en local.

**Se cierra cuando** el PR está aprobado y mergeado, y la reconstrucción en local da `OK`.

---

### V-08 · Límite de reintentos y presupuesto — P1, el más urgente

Este riesgo ya ocurrió una vez: es el reproceso infinito de N-02. Hoy no hay nada que lo frene si vuelve a pasar por otra causa, por ejemplo Gemini devolviendo 429 durante horas.

**Qué hacer:**

1. **Alerta de presupuesto en Google Cloud** para el proyecto de la clave de Gemini. Son cinco minutos; hacerlo primero.
2. **Máximo de intentos por mensaje (propuesta: 3).** Cuando `read_ct` supera el máximo:
   - el mensaje se archiva con `pgmq.archive`;
   - se guarda el análisis con `result_status_code = 'indeterminado'` y el motivo.
3. **Tarea de limpieza de `cron.job_run_details`:** borrar lo anterior a 7 días. Con una corrida cada 10 segundos, suma unas 8.640 filas por día.
4. **Medir el costo de N-02:** cuánto se gastó en Gemini desde que se activó la facturación. Hernán lo necesita para el Plan de Costos.

```sql
-- Estado actual de la cola
select count(*) as pendientes, max(read_ct) as max_intentos from pgmq.q_rag_analysis_queue;
select count(*) as archivados from pgmq.a_rag_analysis_queue;

-- Código del despacho, después del cambio
select pg_get_functiondef('public.dispatch_rag_analysis_queue'::regproc);
```

**Qué mandar:**
- una captura de la alerta de presupuesto (el monto, sin la clave);
- el código del despacho con el máximo de intentos;
- el nombre de la tarea de limpieza;
- el gasto en Gemini hasta hoy.

**Se cierra cuando** un mensaje que falla siempre termina archivado a los N intentos y queda guardado como `indeterminado`. Si no se puede simular una falla sin afectar la base real, alcanza con mostrar el código y explicarlo.

---

### V-11 · Modelo y parámetros — se sube a P1

Son dos consultas y una lectura de código. Sin este dato no podemos estimar el costo por reporte ni cerrar REP-3773.

```sql
select code, provider, model_name, is_active from public.embedding_models;
select code, provider, model_name, is_active from public.generation_models;

-- ¿Qué modelo y qué versión de prompt quedaron guardados en los análisis?
select generation_model_code, prompt_version, count(*),
       round(avg(input_tokens)) as tokens_entrada_prom,
       round(avg(output_tokens)) as tokens_salida_prom
from public.report_ai_analysis
group by 1, 2;
```

**Qué mandar:**
- la salida de las tres consultas;
- de la llamada de generación en la Edge Function: modelo, temperatura, nivel o presupuesto de razonamiento, máximo de tokens de salida y si `responseSchema` está presente.

**Se cierra cuando** el modelo que usa la Edge Function coincide con la fila activa de `generation_models` y cada análisis guarda `generation_model_code` y `prompt_version`.

---

### V-06 y V-09 — sin cambios (P2)

Siguen igual que en el documento anterior (plantillas en el Drive). Si no entran esta semana, pasan al Sprint 13 **declarados como pendientes** en la Sprint Review, no como hechos.

### V-13 · Jira — P2

Comentar en REP-2908 un resumen de las dos rondas, con enlace a los dos documentos. Hernán y Leo deciden aparte cómo reflejar en Jira el trabajo adelantado de REP-3772, REP-3775 y REP-3776.

### Preguntas que quedaron sin responder

| Pregunta | Cómo se responde |
|---|---|
| ¿Las pruebas manuales con `curl` guardaron filas? | `select report_id, created_at, result_status_code from public.report_ai_analysis order by created_at;` — mandar la salida. Las filas que no correspondan a un reporte real se informan; **no se borran** |
| ¿Por qué se regeneró la clave de Gemini? | Matías: dónde había quedado expuesta y confirmación de que la anterior está **eliminada** en Google |

---

## 4. REP-2500 — Decisiones y recomendaciones

### 4.1 Decisión del PO

- **Se aprueba la Opción 1 (selector de localidad)** para cerrar REP-2500 en el Sprint 12.
- **La geolocalización real queda como deuda técnica.** Se abre una historia de usuario aparte (la carga Leo, o Hernán) para que la localidad se **preseleccione** automáticamente a partir del GPS y el ciudadano solo la confirme en el mismo selector. Lo que se construya ahora no se tira.

### 4.2 El "duplicado de Avellaneda" no es un error (cierra O-2)

Hay **dos Avellaneda reales**: el partido de Avellaneda en la provincia de **Buenos Aires** y el departamento Avellaneda en **Santa Fe**. Cada uno tiene una localidad "Avellaneda". Las cargamos a propósito para probar que el sistema **nunca identifica un lugar solo por su nombre**. La PARTE 8 lo comprueba: la Avellaneda de Santa Fe no recibe ninguna norma.

Consecuencias:
- **Nunca se busca una localidad solo por nombre**, que es lo que hacía la Opción 2. Siempre se usa el `id`.
- **O-2 se cierra como "no se corrige".**

### 4.3 Requisitos del selector

| # | Requisito | Por qué |
|---|---|---|
| R-1 | Cada opción muestra **"Localidad — Partido/Comuna, Provincia"** (por ejemplo, "Avellaneda — Avellaneda, Buenos Aires") | Distingue las localidades con el mismo nombre |
| R-2 | La lista se limita a la **zona piloto**: los barrios de CABA y las localidades del partido de Avellaneda (Buenos Aires). Santa Fe no aparece | Es un dato de prueba de la cascada, no una zona de operación |
| R-3 | El texto del campo pide **dónde está el problema, no dónde vive la persona** (por ejemplo: "¿En qué barrio o localidad está el problema?") | Evita el error más probable |
| R-4 | Junto al selector se ve el **pin del mapa** con la ubicación real del GPS | El ciudadano puede comprobar que eligió bien |
| R-5 | Se busca con autocompletado mientras se escribe, sin distinguir tildes ("pineyro" encuentra "Piñeyro") | Son 56 opciones; una lista larga sin búsqueda es incómoda en el celular |

**Por qué esto importa más que un dato de presentación:** el RAG usa `locality_id` para decidir qué leyes aplican (CABA o provincia de Buenos Aires). Si el ciudadano elige mal, **el fundamento legal sale mal**. Por eso R-3 y R-4 no son opcionales, y la deuda técnica de preselección tiene prioridad real.

### 4.4 Correcciones que entran con REP-2500 (no son deuda)

| # | Qué | Por qué |
|---|---|---|
| E-1 | **Quitar la calle inventada** que muestra hoy `resolveAddressDetails()` (por ejemplo, "Av. Mitre 1240"). Mostrar el pin y las coordenadas, o nada | Si el reporte pasa a ser real, no se le puede pedir al ciudadano que confirme un dato falso |
| E-2 | **Borrar el borrador local solo cuando el servidor confirma que guardó el reporte**, no al llegar a la pantalla de éxito | Si el envío falla, hoy se pierde el reporte |
| E-3 | Si se reintenta, usar el mismo `client_side_id`. La restricción `UNIQUE` evita el duplicado; ante un conflicto, se recupera el reporte existente en lugar de mostrar un error | Idempotencia del flujo sin conexión (ADR-009) |
| E-4 | La pantalla de éxito muestra el **código real** del reporte guardado, no uno fijo | Hoy el código está hardcodeado |

### 4.5 Criterios de aceptación de REP-2500 (para QA)

1. Un reporte enviado queda en `citizen_reports` con el `locality_id` elegido, y ese reporte dispara el análisis del RAG (se ve en `report_ai_analysis`).
2. Elegir "Avellaneda — Avellaneda, Buenos Aires" guarda el `id` de Buenos Aires, nunca el de Santa Fe.
3. Un reporte armado sin conexión se guarda una sola vez al recuperar la conexión, aunque se reintente.
4. Si el envío falla, el borrador sigue en el dispositivo.
5. En ninguna pantalla aparece una calle inventada.

### 4.6 Deuda técnica: preselección por GPS (para la historia nueva)

Lo registramos ahora para no perderlo. **No es trabajo de este sprint.**

- **Criterio central:** tiene que funcionar **sin conexión**, porque el reporte se arma offline (ADR-009). Una API externa no está disponible en ese momento y, además, le mandaría la ubicación del ciudadano a un tercero.
- **Opción a evaluar primero:** polígonos oficiales de barrios y localidades cargados en el frontend, con un cálculo local de en qué polígono cae el punto. Funciona sin conexión, sin costo y sin PostGIS (ADR-002).
- **Opciones a comparar:** la API Georef de datos.gob.ar (oficial) y Nominatim (OpenStreetMap). En las dos hay que verificar la política de uso, la cobertura a nivel de barrio y localidad, y el tratamiento de datos.
- **Pendiente de Hernán:** investigar y verificar las fuentes antes de estimar la historia.

---

## 5. Lista de entrega (segunda ronda)

Se sube al Drive del proyecto o se le manda a Hernán. **Sin claves en ningún archivo.**

| # | Evidencia | Punto | ✔ |
|---|---|---|---|
| 1 | Captura de la alerta de presupuesto, código del despacho con máximo de intentos, tarea de limpieza y gasto en Gemini hasta hoy | V-08 | ☐ |
| 2 | `git ls-files` en 0, repositorio público o privado, columnas con datos personales y camino tomado | V-02 | ☐ |
| 3 | Modelos, parámetros de generación y tokens promedio | V-11 | ☐ |
| 4 | PARTE 8 en `OK`, tabla de los 8 análisis demo con sus citas y definición de `profile_attends_report` | V-04 | ☐ |
| 5 | Enlace al PR contra `staging` y reconstrucción en local en `OK` | V-05 | ☐ |
| 6 | Consulta corregida de claves y captura de las claves viejas deshabilitadas | V-01 | ☐ |
| 7 | Lista de las 17 tablas sin políticas y Security Advisor después de corregir `search_path` | V-03 | ☐ |
| 8 | Salida de la consulta sobre las pruebas con `curl` y respuesta sobre la clave de Gemini | Preguntas | ☐ |
| 9 | Comentario en REP-2908 | V-13 | ☐ |
| 10 | (Si hay tiempo) V-06 y V-09 | P2 | ☐ |

---

## 6. Cuándo damos por cumplido el RAG del Sprint 12

1. **Seguridad:** V-01, V-02, V-03 y V-12 cerrados.
2. **Reproducible:** V-04 en `OK` con los seeds demo, y V-05 con el PR aprobado y la reconstrucción probada.
3. **Trazable:** V-07, que ya está, más V-08 con el límite de reintentos y la alerta de presupuesto.
4. **Sin inventar:** ninguna cita fuera de lo recuperado o no literal en los 8 análisis demo (V-04), ni en V-09 si llega a correrse.
5. **Controlado:** V-11 respondido.
6. **Registrado:** V-13.

REP-2500 cierra aparte, con los criterios de 4.5.

---

**Documentos relacionados:** [REP-1009 — Épica IA jurídica / RAG](https://unlz2026.atlassian.net/browse/REP-1009) · [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) · [REP-2500](https://unlz2026.atlassian.net/browse/REP-2500) · `REP-DEPLOY-RAG-SUPABASE_devolucion_y_verificacion.md` (Drive)
