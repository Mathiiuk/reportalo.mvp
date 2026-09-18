# Reportalo

*Plataforma de Auditoría Ciudadana*

## VERIFICACIÓN DEL RAG — SEXTA RONDA: LO URGENTE Y LO QUE FALTA PARA CERRAR

**Versión 1.0 · 17 de septiembre de 2026 · Proyecto RAR-2026**

**Responde a:** `REP-2908-VERIF_devolucion-cierre-ronda5.md` (Matías, 16/09)
**Jira:** [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) · [REP-3772](https://unlz2026.atlassian.net/browse/REP-3772) · [REP-2900](https://unlz2026.atlassian.net/browse/REP-2900) · [REP-3777](https://unlz2026.atlassian.net/browse/REP-3777) · [REP-2405](https://unlz2026.atlassian.net/browse/REP-2405) · [REP-2500](https://unlz2026.atlassian.net/browse/REP-2500) · [REP-3775](https://unlz2026.atlassian.net/browse/REP-3775)
**Archivos de apoyo (carpeta Drive del proyecto):** https://drive.google.com/drive/folders/1JJ6T0Y2MhhzONvaffT8PN7j34lTJjoe9 (`REP-3769_seed_y_RAG.sql`, `REP-2908-VERIF_ronda5_hernan.md`)

**Equipo:** Hernán Gregorini (PO · DBA) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

---

## 0. Reglas

1. Este documento es la única fuente de instrucciones. Si algo no está claro, se le pregunta a Matías.
2. **Nunca se escribe una clave** en archivos, commits, capturas ni chat. El token del despacho y las claves se usan desde variables de entorno.
3. **Nada se aplica en CiudadAR sin probarlo antes en el proyecto descartable,** salvo U-1, que es una verificación.
4. **Los cambios del corpus se hacen con el OK de Hernán**, respetando el versionado: un fragmento no se edita, se reemplaza.
5. **El backup de la sección 4 nunca va a Git ni a una carpeta compartida.**

---

## 1. Urgente, hoy

### U-1 · Verificar que la subida de fotos funcione en producción

**Por qué.** La cuarentena ya no permite actualizar archivos, pero el arreglo del frontend (quitar `upsert: true`) **no está desplegado**: el PR no está abierto. Según la documentación de Supabase, una subida con `upsert` necesita también permiso de lectura y de actualización, así que **la app publicada podría estar fallando al subir fotos**.

**Qué hacer:**
1. Desde la app publicada (Vercel), con un usuario del equipo, enviar **un reporte con foto**.
2. **Si falla:** mergear y desplegar el PR ya (ver C-6), y repetir.
3. **Si funciona:** avisar igual, con la evidencia de abajo.

**Qué mandar** (este reporte también sirve como C-4):
- una captura del reporte enviado, con la foto difuminada y sin datos personales;
- el `id` del reporte y el resultado de esta consulta:

```sql
select r.id, r.created_at,
       (select count(*) from public.report_images i where i.report_id = r.id) as imagenes,
       a.result_status_code, a.status_reason, a.prompt_version, a.generation_model_code,
       a.input_tokens, a.output_tokens
from public.citizen_reports r
left join public.report_ai_analysis a on a.report_id = r.id
where r.id = '<id del reporte>';
```

### U-2 · Alerta de presupuesto en Google Cloud

Son cinco minutos. Mandar una captura con el monto, sin la clave.

---

## 2. Lo que falta para cerrar esta ronda

### C-1 · Versionar bien la separación del art. 48 inc. t) — REP-3777

**Qué pasó.** La decisión de separar la cláusula de venta es correcta, pero **se editó en el lugar** el fragmento `20000000-0000-4000-8000-000000000008`. El modelo dice que los fragmentos son **inmutables y versionados**. Por eso los análisis anteriores que citaron `…008` ahora apuntan a un texto distinto del que citaron. Eso incumple el criterio de REP-3777: "un análisis histórico no pierde trazabilidad si el corpus cambia".

**Estado final esperado:**

| Fragmento | Contenido | Vigente | Reemplaza a | Inciso | Categoría |
|---|---|---|---|---|---|
| `…008` | Texto literal **original y completo** del inciso t) (restaurado) | No | — | `t` | Se mantiene (histórico) |
| `20000000-0000-4000-8000-000000000016` (nuevo) | Cláusula de obstrucción (el texto actual de `…008`) | Sí | `…008` | `t.obstruccion` | TRANSITO |
| `b6717f77-c30e-4cca-985a-6346d741fe38` | Cláusula de venta | Sí | `…008` | `t.venta` | Ninguna |

**Paso 1: mandar el estado actual, antes de tocar nada:**

```sql
select id, article, subsection, is_current, replaces_fragment_id, hierarchy_path, content, md5(content)
from public.knowledge_fragments
where id in ('20000000-0000-4000-8000-000000000008','b6717f77-c30e-4cca-985a-6346d741fe38',
             '20000000-0000-4000-8000-000000000016');

select fragment_id, model_code, created_at from public.fragment_embeddings
where fragment_id in ('20000000-0000-4000-8000-000000000008','b6717f77-c30e-4cca-985a-6346d741fe38',
                      '20000000-0000-4000-8000-000000000015');
```

**Paso 2 [ESCRIBE, con OK de Hernán después de ver el paso 1; primero en el proyecto descartable].** La migración está protegida: en una base vacía o ya corregida no hace nada.

```sql
do $$
declare
  original constant text := $f$Está prohibido en la vía pública:
t) Estorbar u obstaculizar de cualquier forma la calzada o la banquina y hacer construcciones, instalarse o realizar venta de productos en zona alguna del camino;$f$;
begin
  if not exists (select 1 from public.knowledge_fragments where id = '20000000-0000-4000-8000-000000000008')
     or exists (select 1 from public.knowledge_fragments where id = '20000000-0000-4000-8000-000000000016') then
    raise notice 'C-1: nada que hacer (base vacía o ya corregida).';
    return;
  end if;

  -- a) Fragmento nuevo vigente con la cláusula de obstrucción (copia exacta del texto actual de …008)
  insert into public.knowledge_fragments
    (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code, is_current, replaces_fragment_id)
  select '20000000-0000-4000-8000-000000000016', source_id,
         'Ley 24.449 — Ley de Tránsito > Artículo 48 (prohibiciones) > inciso t) (obstrucción)',
         '48', 't.obstruccion', content, foundation_type_code, true, id
  from public.knowledge_fragments where id = '20000000-0000-4000-8000-000000000008';

  -- b) Su embedding: el mismo vector ya generado para ese texto (sin llamar a la API)
  insert into public.fragment_embeddings (fragment_id, model_code, embedding)
  select '20000000-0000-4000-8000-000000000016', model_code, embedding
  from public.fragment_embeddings where fragment_id = '20000000-0000-4000-8000-000000000008'
  on conflict do nothing;

  -- c) Su categoría
  insert into public.fragment_services (fragment_id, service_id)
  select '20000000-0000-4000-8000-000000000016', s.id from public.services s where s.service_code = 'TRANSITO'
  on conflict do nothing;

  -- d) …008 vuelve a su texto literal original y queda histórico
  update public.knowledge_fragments
     set content = original, subsection = 't', is_current = false
   where id = '20000000-0000-4000-8000-000000000008';

  -- e) La cláusula de venta queda versionada contra …008
  update public.knowledge_fragments
     set subsection = 't.venta', replaces_fragment_id = '20000000-0000-4000-8000-000000000008', is_current = true
   where id = 'b6717f77-c30e-4cca-985a-6346d741fe38';
end $$;
```

**Nota sobre el embedding de `…008`:** quedó calculado para el texto recortado. No se usa en la búsqueda, porque el fragmento ya no está vigente. Se deja así; no hace falta regenerarlo.

**Paso 3: verificación a mandar:**
- repetir las consultas del paso 1 después de aplicar;
- comprobar que el texto de `…016` y el de `b6717f77` son **partes literales** del original:

  ```sql
  select id,
         position(replace(content, E'Está prohibido en la vía pública:\nt) ', '') in
           $f$Estorbar u obstaculizar de cualquier forma la calzada o la banquina y hacer construcciones, instalarse o realizar venta de productos en zona alguna del camino;$f$) > 0 as es_literal
  from public.knowledge_fragments
  where id in ('20000000-0000-4000-8000-000000000016','b6717f77-c30e-4cca-985a-6346d741fe38');
  ```

- **Incidente del embedding del Código de Faltas:** generar de nuevo el embedding del texto de `…015` con el script de embeddings y mandar la similitud contra el guardado. Tiene que dar 0,99 o más.

**Además:**
- ¿la migración `20260916040000_r5_08_split_ley24449_art48_t_venta_de_transito.sql` corre sin error en una base vacía? Si no, se corrige con el mismo tipo de protección;
- Hernán actualiza `REP-3769_seed_y_RAG.sql` con este estado final.

**Se cierra cuando** el paso 3 muestra el estado final esperado, los dos fragmentos dan `es_literal = true` y la similitud de `…015` es de 0,99 o más.

---

### C-2 · Corridas con la función desplegada y regla para `asistencia` — REP-2908, REP-3772, REP-2900

**Qué pasó.** Las 37 corridas se hicieron con un **script local que copia la lógica**, no con la función desplegada. Es el mismo tipo de copia que causó el error de `responseSchema`. Además, D-CABA ("no anda la luz") devolvió `asistencia` una vez de cinco: no inventó nada, pero es un error, porque el ciudadano leería que es un caso de asistencia social.

**Qué hacer:**
1. **Regla fija en `validateLlmAnalysis`:** si `estado = 'asistencia'` y la categoría del reporte no es `VULNERABILIDAD_SOCIAL`, el resultado es `indeterminado` con motivo. Agregar un test unitario.
2. **Correr 1 vez cada caso con la función desplegada** (A, B, C, D-Av, D-CABA, E, E-sin-categoría, prueba 1 y prueba 2), por el camino real: reporte insertado → cola → función con token → guardado.
   - **Dónde:** en el proyecto descartable (C-5), con la función desplegada ahí.
   - **Si no llega a tiempo:** en CiudadAR, mandando la lista de `id` de los 9 reportes para limpiarlos después con el OK de Hernán.
3. **Correr D-CABA 5 veces más** con la regla nueva.

**Qué mandar:**
- una tabla por corrida: caso, `id` del reporte, estado, `status_reason`, fragmentos citados y versión de la función;
- la diferencia (`diff`) entre el script local y `analizar-reporte/index.ts`;
- el `prompt_version` usado en las 37 corridas del script.

**Se cierra cuando:**
- las 9 corridas dan el mismo resultado que el script;
- ninguna cita queda fuera de lo recuperado ni deja de ser literal;
- D-CABA no tiene ningún `asistencia` aceptado.

---

### C-3 · Evidencias de privacidad que faltan — REP-2405, REP-2500

Desde una terminal **sin sesión**, con la clave pública del proyecto en una variable de entorno:

```bash
# 1) Listar la cuarentena: tiene que devolver [] o error de permiso
curl -s -X POST "$SUPABASE_URL/storage/v1/object/list/evidence-quarantine" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: application/json" -d '{"prefix":""}'

# 2) Subir a la evidencia pública: tiene que fallar por permiso
curl -s -X POST "$SUPABASE_URL/storage/v1/object/report-evidences/prueba-sin-sesion.jpg" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: image/jpeg" --data-binary @imagen-de-prueba-sin-personas.jpg

# 3) Insertar un reporte sin sesión: tiene que fallar por permiso
curl -s -X POST "$SUPABASE_URL/rest/v1/citizen_reports" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: application/json" -d '{"description":"prueba"}'
```

Y esta consulta, solo con conteos:

```sql
-- C8: ¿quedaron fotos originales en cuarentena?
select count(*) as objetos, min(created_at) as mas_viejo, max(created_at) as mas_nuevo
from storage.objects where bucket_id = 'evidence-quarantine';
```

**Qué mandar:** la respuesta de los 3 comandos (sin encabezados ni claves), la salida de C8 y U-1.

**Se cierra cuando:**
- los 3 comandos fallan o devuelven una lista vacía;
- U-1 funciona;
- C8 da 0, o, si hay objetos, se informa cuántos y desde cuándo, **sin borrarlos** (Hernán decide).

---

### C-4 · Un reporte real analizado con la versión 16

Se cumple con el reporte de U-1. **Se cierra cuando** ese reporte tiene análisis con `prompt_version`, `generation_model_code` y tokens cargados.

---

### C-5 · Reconstrucción en el proyecto descartable (P-08)

1. Seguir la sección 4 de la guía de replicación reescrita **tal como está escrita**, en el proyecto descartable.
2. Anotar **cada paso donde la guía no alcanzó** o hubo que improvisar.
3. Correr la PARTE 8 de `REP-3769_seed_y_RAG.sql`.
4. Usar ese proyecto para C-1 y C-2. Borrarlo al terminar.

**Qué mandar:**
- salida de `supabase migration list` contra CiudadAR (todas las filas coincidiendo);
- PARTE 8 del proyecto descartable;
- lista de desvíos de la guía;
- confirmación de que el proyecto se borró.

---

### C-6 · PR, revisión y despliegue

1. Abrir el PR de `fix/REP-2908-VERIF-v03-security-hardening` contra `staging`.
2. **Revisión de base por Hernán antes del merge.** Lista de migraciones a revisar: `20260916030000`, `20260916030100`, `20260916030200`, `20260916040000`, la de `persist_rag_analysis`, la del despacho aislado, la de los permisos de `match_knowledge_fragments` y la de C-1.
3. Mergear y desplegar en Vercel. Si U-1 falló, esto va primero, sin esperar la revisión de base: la parte del frontend es solo quitar `upsert`.
4. Confirmar que `staging` solo acepta cambios por PR.

**Qué mandar:** el enlace al PR y la fecha del despliegue en Vercel.

---

## 3. Preguntas: qué y cómo se hizo

| # | Pregunta |
|---|---|
| Q-1 | ¿Las migraciones de privacidad (`030000` a `030200`) se aplicaron directo en CiudadAR o se probaron antes? ¿Con qué herramienta (MCP, editor SQL, CLI)? |
| Q-2 | ¿Cómo se verificó "antes de aplicar" que el frontend manda el `user_id` de la sesión? ¿Qué archivo y qué línea? |
| Q-3 | ¿Qué artículo e inciso tiene hoy `b6717f77`? ¿Cómo evitó el índice único de fragmentos vigentes (fuente, artículo, inciso)? |
| Q-4 | En el incidente del id repetido, ¿con qué texto exacto y qué parámetros se regeneró el embedding de `…015`? ¿Hubo análisis reales entre que se pisó y se restauró? |
| Q-5 | El caso A ahora cita la Constitución PBA 192.4 5 de 5 (antes nunca). ¿Cambió el prompt, el umbral o el top-k? |
| Q-6 | ¿Cómo se compara el token en la función (igualdad simple)? ¿Qué pasa si falta `RAG_DISPATCH_TOKEN` en Edge Functions? (Debería responder 403 siempre.) |
| Q-7 | `persist_rag_analysis`: ¿es `security definer` o no? ¿Qué permisos de ejecución tiene? Mandar la salida de C5 de la ronda 5 para esa función |
| Q-8 | La prueba de falla controlada: ¿cuántos mensajes válidos se procesaron después del archivado, y en cuánto tiempo? |
| Q-9 | ¿Cómo quedó `is_infraction` en los `indeterminado` por error técnico: `false` o `null`? |
| Q-10 | Los 3 duplicados de migraciones resueltos al mergear `staging`: ¿cuáles eran y con qué criterio se eligió cuál quedaba? |
| Q-11 | ¿El proyecto descartable sigue activo? |
| Q-12 | Los 2 reportes que no calzan con el patrón de prueba (`cd012356-…`, `7949dba0-…`): mandar su fecha, el rol de quien los creó y si tienen imagen. **No borrarlos.** |

---

## 4. Documentos y backup para que analicemos nosotros

### 4.1 Documentos

Subir a la carpeta Drive del proyecto (son documentos sin datos personales):
- `REP-2908-VERIF_P01-corridas-post-filtro.md`;
- la guía de replicación reescrita;
- las migraciones `20260916030000`, `20260916030100`, `20260916030200` y `20260916040000`, más las de `persist_rag_analysis`, el despacho aislado y los permisos;
- `supabase/functions/analizar-reporte/index.ts` (versión 16);
- el script local de las 37 corridas (`scripts/rag-local-dev/p01-r5-final/`), **sin archivos `.env`**.

### 4.2 Backup del estado actual de CiudadAR

**Condiciones, porque el backup incluye datos personales (Ley 25.326):**
- **Nunca a Git** (repositorio público) **ni a la carpeta Drive compartida.**
- Se entrega a Hernán como un zip cifrado con contraseña, **y la contraseña va por otro canal**.
- **No incluye** datos de `auth` ni de `vault`, ni los datos de `profiles`, `terms_consents` y `agency_contacts` (de esas tablas va solo el esquema y un conteo).
- La cadena de conexión se toma de una variable de entorno; nunca se escribe en un archivo.

**Comandos** (Supabase CLI, con `SUPABASE_DB_URL` en el entorno):

```bash
# 1) Esquema completo (tablas, funciones, políticas, triggers)
supabase db dump --db-url "$SUPABASE_DB_URL" -f 01_esquema.sql

# 2) Datos del esquema public, sin las tablas con datos personales directos
supabase db dump --db-url "$SUPABASE_DB_URL" -f 02_datos_public.sql --data-only --use-copy -s public \
  -x public.profiles -x public.terms_consents -x public.agency_contacts
```

Si la versión de la CLI no acepta `-x`, usar `pg_dump` con `--data-only --schema=public` y un `--exclude-table-data` por cada una de esas tres tablas.

**Consultas complementarias** (guardar la salida como `03_complementos.txt`):

```sql
select version, name from supabase_migrations.schema_migrations order by version;
select schemaname, tablename, policyname, cmd, roles, qual, with_check from pg_policies
  where schemaname in ('public','storage') order by 1, 2, 3;
select jobname, schedule, active from cron.job order by 1;
select queue_name from pgmq.list_queues();
select name from vault.secrets order by 1;               -- solo nombres
select role, (agency_id is not null) as con_organismo, count(*) from public.profiles group by 1, 2;
select count(*) from public.terms_consents;
select contact_channel, count(*) from public.agency_contacts group by 1;
select bucket_id, count(*) from storage.objects group by 1;
```

**Antes de enviar, comprobar** que los archivos no contengan claves ni tokens:

```bash
grep -lE "eyJ[A-Za-z0-9_-]{10,}\.|sb_secret_|AIza[0-9A-Za-z_-]{20,}" 01_esquema.sql 02_datos_public.sql 03_complementos.txt
# tiene que salir vacío
```

---

## 5. Lista de entrega y cierre

| # | Qué | ✔ |
|---|---|---|
| 1 | U-1: reporte con foto en producción, captura y consulta | ☐ |
| 2 | U-2: captura de la alerta de presupuesto | ☐ |
| 3 | C-1: estado antes y después, `es_literal` y similitud de `…015` | ☐ |
| 4 | C-2: regla de `asistencia` con test, 9 corridas con la función, 5 de D-CABA, `diff` y `prompt_version` | ☐ |
| 5 | C-3: 3 comandos sin sesión y C8 | ☐ |
| 6 | C-5: `migration list`, PARTE 8 del descartable, desvíos de la guía y proyecto borrado | ☐ |
| 7 | C-6: PR y despliegue | ☐ |
| 8 | Preguntas Q-1 a Q-12 respondidas | ☐ |
| 9 | Documentos en Drive (4.1) | ☐ |
| 10 | Backup cifrado (4.2) entregado a Hernán, con la comprobación de claves vacía | ☐ |

**La ronda queda cerrada cuando U-1, C-1, C-2 y C-3 están completos.** C-5, C-6 y el backup pueden terminar al inicio del Sprint 13, **declarados como pendientes** en la Sprint Review.

---

**Documentos relacionados:** [REP-1009 — Épica IA jurídica / RAG](https://unlz2026.atlassian.net/browse/REP-1009) · `REP-2908-VERIF_ronda5_hernan.md` (Drive)
