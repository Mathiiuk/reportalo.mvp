# Reportalo

*Plataforma de Auditoría Ciudadana*

## DEVOLUCIÓN — RESPUESTA A LA SEGUNDA RONDA DE HERNÁN

**Versión 2.0 · 15 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Responde a:** `REP-2908-VERIF_ronda2_hernan.md` (Hernán, 15/09)
**Jira:** [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) · [REP-2909](https://unlz2026.atlassian.net/browse/REP-2909) · [REP-2500](https://unlz2026.atlassian.net/browse/REP-2500) · [REP-3772](https://unlz2026.atlassian.net/browse/REP-3772) · [REP-3773](https://unlz2026.atlassian.net/browse/REP-3773) · [REP-3775](https://unlz2026.atlassian.net/browse/REP-3775) · [REP-3776](https://unlz2026.atlassian.net/browse/REP-3776) · [REP-2910](https://unlz2026.atlassian.net/browse/REP-2910)

**Equipo:** Hernán Gregorini (PO · DBA) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

**Consultor Especialista:** Carlos Ruiz (auditor externo · asesoría metodológica)

> **Propósito.** Responder punto por punto a la segunda ronda de Hernán: qué se cerró con evidencia, qué queda parcial y por qué, y qué acciones le quedan a Matías fuera de este documento (dashboard de Supabase, Google Cloud, GitHub, Jira).

---

## 1. Resumen de estado

| ID | Tema | Prioridad | Estado |
|---|---|---|---|
| V-01 | Clave `service_role` | P1 | ✅ Cerrado |
| V-02 | Backup en Git | P1 | ✅ Cerrado |
| V-03 | Seguridad heredada | P1 | 🟡 Parcial |
| V-04 | Seeds demo | P1 | ✅ Cerrado (falta el PR) |
| V-05 | Migraciones y PR | P1 | 🟡 Parcial |
| V-06 | Mismo embedding | P2 | ✅ Cerrado |
| V-07 | Punta a punta | P1 | ✅ Cerrado |
| V-08 | Reintentos y presupuesto | P1 | 🟡 Parcial |
| V-09 | Casos A–F × 5 | P2 | ✅ Cerrado (con corrección aplicada) |
| V-10 | Caso A | P3 | Decisión de Hernán |
| V-11 | Modelo y parámetros | P1 | ✅ Cerrado |
| V-12 | Clave de Gemini en el frontend | P1 | ✅ Cerrado |
| V-13 | Jira | P2 | ⚪ Pendiente (Matías) |

**Los 3 PR de V-01/V-02/V-03 ya están mergeados en `staging`** (#62, #63, #64). Falta abrir y mergear el de V-04.

---

## 2. Las tres correcciones que Hernán marcó a nuestro documento anterior

| # | Corrección de Hernán | Respuesta |
|---|---|---|
| C-1 | La consulta de V-01 no revisaba triggers | Corregida y corrida — ver §3, V-01 |
| C-2 | El PR va contra `staging`, no `develop` | Los 4 PR de esta ronda fueron todos contra `staging` |
| C-3 | El duplicado de "Avellaneda" no es un error | Aceptado — ver `REP-2500_propuesta-fases-localidad.docx` v1.2, ya no se trata como hallazgo |

---

## 3. Detalle por punto

### V-01 · Clave `service_role` — ✅ Cerrado

Corrida la consulta corregida (C-1), que ahora sí revisa `pg_trigger`:

```
tipo: trigger | objeto: infractions | nombre: audit_ia
```

Es el único resultado — exactamente el criterio de cierre de Hernán ("se acepta que devuelva solo `audit_ia`"). El trigger sigue desactivado sin borrar. Las claves legacy (JWT) fueron deshabilitadas desde el panel de Supabase por Matías, migradas al esquema moderno de `secret keys`.

### V-02 · Backup en Git — ✅ Cerrado

- **Repositorio:** público (verificado directamente en GitHub).
- **Datos personales:** `profiles.username` (email real) y `full_name`; `agency_contacts.contact_value`/`contact_channel`. Todo de cuentas del equipo, ninguno de ciudadanos.
- **Camino tomado:** repositorio público → se limpió el historial completo (`git filter-repo --path supabase/backups --invert-paths` + `git push --force origin staging`, ejecutado desde un clon aislado, con OK explícito de Matías y aviso previo al equipo).
- **Verificación:** `git ls-files supabase/backups/` da **0** tanto en el working tree como en `origin/staging`.
- El backup se movió fuera del repositorio, a una carpeta local con acceso restringido a Matías.

### V-03 · Seguridad heredada — 🟡 Parcial

**Lista de las 17 tablas con RLS sin política** (Hernán ya adelantó que `embedding_models`, `generation_models` y `fragment_embeddings` son esperables):

`agencies`, `agency_contacts`, `agency_subscriptions`, `countries`, `embedding_models` ✓, `fragment_embeddings` ✓, `generation_models` ✓, `infraction_attribute_responses`, `infraction_types`, `profile_services`, `profiles`, `report_events`, `report_outreach_logs`, `report_state_history`, `service_attribute_values`, `service_attributes`, `states_provinces`.

**Search_path corregido** en las 10 funciones que marcaba el Security Advisor — verificado, el aviso `function_search_path_mutable` ya no aparece.

**Extensión `vector` en `public`:** sin cambios, por instrucción explícita de Hernán ("no moverla ahora").

**Pendiente:**
- Que Hernán clasifique las 14 tablas restantes (`agencies` en adelante) como "solo servidor, correcto" o "le falta política".
- Activar "Leaked Password Protection" — es un toggle en el dashboard de Supabase, le queda a Matías.

### V-04 · Seeds demo — ✅ Cerrado (falta el PR)

Los 6 usuarios se crearon en Supabase Auth desde la propia terminal de Matías (nunca por este agente, que no maneja contraseñas). Corridas las PARTES 3 y 4 del seed.

**PARTE 8:** `citizen_reports` y `report_state_history` dan `OK` (8 y 18). `profiles`/`terms_consents` dan `REVISAR` contra el conteo esperado (11 y 5 en vez de 6 y 2) — esperable: ya existían 5 cuentas reales del equipo antes de este seed.

**Los 8 análisis, con evidencia:**

| Reporte | Categoría | Localidad | Estado | Confianza | Recuperados | Citados |
|---|---|---|---|---|---|---|
| 1 | TRANSITO | Retiro (CABA) | `fundamentado` | 0.98 | 4 | 3 |
| 2 | INFRAESTRUCTURA | San Nicolás (CABA) | `sin_normativa` | 0.1 | 2 | 0 |
| 3 | AMBIENTE | Puerto Madero (CABA) | `indeterminado` | 0.3 | 1 | 1 |
| 4 | COMERCIO_IRREGULAR | Monserrat (CABA) | `sin_normativa` | 0 | 0 | 0 |
| 5 | INFRAESTRUCTURA | Retiro (CABA) | `indeterminado` | 0.5 | 2 | 2 |
| 6 | TRANSITO | Avellaneda (BA) | `fundamentado` | 0.98 | 4 | 2 |
| 7 | AMBIENTE | Sarandí (Avellaneda) | `sin_normativa` | 0.2 | 1 | 0 |
| 8 | VULNERABILIDAD_SOCIAL | Wilde (Avellaneda) | `sin_normativa` | 0 | 0 | 0 |

Los reportes 4 y 8 (categorías sin corpus) dieron `sin_normativa` limpio, sin ningún fragmento recuperado — confirma el fix de V-09 con datos nuevos, no solo con la prueba manual.

**Citas de los casos con evidencia** (todas literales y temáticamente correctas):

| Reporte | Norma citada | Texto |
|---|---|---|
| 1 | Ley 451 (CABA) art. 6.1.37 | "obstrucción... en rampas para discapacitados" |
| 1 | Ley 451 (CABA) art. 6.1.52 | "estacionamiento... en rampas para discapacitados" |
| 1 | Ley 2148 (CABA) art. 7.1.9 | "Frente a los vados o rampas para personas con discapacidad" |
| 3 | Ley 210 (CABA) art. 2 inc. c) | "Higiene urbana, incluida la disposición final" |
| 5 | Ley 210 (CABA) art. 2 inc. b) | "Alumbrado público y señalamiento luminoso" |
| 5 | Ley 210 (CABA) art. 3 inc. j) | "Recibir y tramitar las quejas y reclamos..." |
| 6 | Ley 24.449 art. 49 inc. b) 3 | "Sobre la senda para peatones..." |
| 6 | Ley 24.449 art. 48 inc. i) | "La detención irregular sobre la calzada..." |

Ninguna cita cruza jurisdicción (CABA no recibe Ley 24.449, Avellaneda sí).

**`profile_attends_report`** — definición sin claves, `search_path` ya fijo:

```sql
CREATE OR REPLACE FUNCTION public.profile_attends_report(p_profile_id uuid, p_report_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from profiles p
    join agencies a        on a.id = p.agency_id
    join citizen_reports r on r.id = p_report_id
    join localities l      on l.id = r.locality_id
    where p.id = p_profile_id
      and l.subdivision_id = a.subdivision_id
      and (not exists (select 1 from agency_services x where x.agency_id = a.id)
           or exists (select 1 from agency_services x where x.agency_id = a.id and x.service_id = r.service_id))
      and (not exists (select 1 from profile_services y where y.profile_id = p.id)
           or exists (select 1 from profile_services y where y.profile_id = p.id and y.service_id = r.service_id)));
$function$
```

**Pendiente:** abrir el PR de la rama `fix/REP-2908-VERIF-v04-seed-demo` contra `staging`.

### V-05 · Migraciones y Pull Request — 🟡 Parcial

- **PR #62** (V-01/V-06/V-07/V-08/V-09/V-11): mergeado.
- **PR #63** (V-02): mergeado.
- **PR #64** (V-03): mergeado.
- **PR de V-04**: pendiente de abrir — rama `fix/REP-2908-VERIF-v04-seed-demo` ya pusheada.
- Todas las migraciones documentan el nombre de los secretos que requieren (`rag_analizar_reporte_url`, `rag_service_role_key`, `GEMINI_API_KEY`) sin ningún valor.
- Comando para regenerar embeddings: `node scripts/rag-local-dev/generate-fragment-embeddings.mjs`.
- **N-02** (por qué existe el wrapper de `pgmq`): el esquema `pgmq` no está expuesto en la API de datos de Supabase (solo `public` lo está por defecto); sin el wrapper `public.pgmq_delete_message`, el borrado de mensajes procesados fallaba silenciosamente y los reprocesaba cada minuto para siempre. Quitar el wrapper reintroduce ese bug.
- **Pendiente:** probar la reconstrucción en un entorno local (`supabase db reset` + seeds + PARTE 8) — no se armó un entorno Supabase local en esta sesión.

### V-06 · Mismo embedding — ✅ Cerrado

Sin cambios respecto a la ronda anterior: parámetros idénticos entre el script y la Edge Function, similitud de FR12 = 1.0.

### V-07 · Punta a punta — ✅ Cerrado

Sin cambios: ~15 segundos insert → análisis, evidencia correcta.

### V-08 · Reintentos y presupuesto — 🟡 Parcial

- **Máximo de intentos:** ajustado a **3** (la propuesta de Hernán).
- **Wrapper de archivado corregido:** tenía el mismo bug de `embedding_model_code` `NOT NULL` que se encontró en V-09 — un mensaje archivado por exceso de reintentos habría fallado el insert también, perdiendo el registro sin dejar rastro. Ya corregido.
- **Tarea de limpieza:** `rag-cleanup-job-run-details` (diaria, 3am, borra `cron.job_run_details` de más de 7 días).
- **Gasto en Gemini hasta hoy:** ≈ US$ 0,085 en total (47 filas con generación real, 47.694 tokens de entrada + 12.971 de salida). Verificado el precio oficial: `gemini-3.8-flash` cuesta USD 0,75/M de entrada y USD 3,75/M de salida hasta fin de 2026.
- **Costo específico de N-02:** no se encontró evidencia de reprocesamiento exitoso duplicado (cero reportes con más de un análisis persistido). No se puede descartar con certeza absoluta un llamado que haya fallado siempre al persistir durante la ventana del bug — para eso hay que revisar el line item de Gemini API en Google Cloud Billing directamente.
- **Pendiente:** la alerta de presupuesto en Google Cloud — acción de Matías en la consola, sin herramienta disponible para hacerla desde acá.

### V-09 · Casos A–F × 5 — ✅ Cerrado (con corrección aplicada, no solo diagnóstico)

Se corrieron las 35 corridas. El Caso F (comercio irregular, sin corpus) fallaba 5 de 5 citando una norma de tránsito por pura similitud léxica. **Corregido de raíz:** `match_knowledge_fragments` ahora filtra por la categoría que elige el ciudadano (usa `fragment_services`, que ya existía pero nunca se usaba para esto). Sin fragmentos para la categoría elegida, el sistema cae a `sin_normativa` sin llamar al LLM. Reverificado con dos casos reales nuevos del seed de V-04 (`COMERCIO_IRREGULAR` y `VULNERABILIDAD_SOCIAL`): ambos dieron `sin_normativa` limpio.

### V-10 · Caso A — decisión de Hernán

Sin cambios de nuestro lado.

### V-11 · Modelo y parámetros — ✅ Cerrado

```sql
-- generation_models activo: gemini-3.8-flash (coincide con el codigo real)
-- embedding_models activo: gemini-embedding-2@768
```

Parámetros de la llamada de generación: sin `temperature` explícito (default de la API), `thinkingConfig: { thinkingLevel: 'low' }`, `responseSchema` presente, sin límite explícito de tokens de salida.

Tokens promedio por análisis, agrupado por modelo y versión de prompt:

| Modelo | Prompt | Análisis | Tokens entrada prom. | Tokens salida prom. |
|---|---|---|---|---|
| — (sin generación: `sin_normativa` temprano) | — | 3 | — | — |
| `gemini-3.8-flash` | `v1` | 8 | 824 | 335 |
| `gemini-3.8-flash` | *(sin versionar, previo a V-11)* | 36 | 1.253 | 340 |

Cada análisis nuevo ya guarda `generation_model_code` y `prompt_version` — antes de V-11, `prompt_version` era siempre `null`.

### V-12 · Sin clave de Gemini en el frontend — ✅ Cerrado

Sin cambios respecto a la ronda anterior.

### V-13 · Jira — ⚪ Pendiente

Queda para Matías.

---

## 4. Preguntas sin responder de la ronda anterior

| Pregunta | Respuesta |
|---|---|
| ¿Las pruebas manuales con `curl` guardaron filas? | El análisis más antiguo en `report_ai_analysis` corresponde al reporte de prueba real de V-07 (`...101`, insertado el 14/09 23:51) — no hay ninguna fila anterior a esa que pudiera venir de una invocación manual suelta. |
| ¿Por qué se regeneró la clave de Gemini? | Sin investigar en este trabajo — lo responde Matías directamente. |

---

## 5. Lista de entrega (actualizada)

| # | Evidencia | Punto | ✔ |
|---|---|---|---|
| 1 | Consulta corregida de V-01: solo `audit_ia` | V-01 | ☑ |
| 2 | `git ls-files` en 0, repo público, datos personales, historial limpio | V-02 | ☑ |
| 3 | 17 tablas listadas, `search_path` corregido | V-03 | 🟡 (falta clasificación de Hernán + toggle de contraseñas) |
| 4 | PARTE 8, tabla de 8 análisis con citas, definición de `profile_attends_report` | V-04 | ☑ |
| 5 | 4 PR (3 mergeados, 1 pendiente de abrir) | V-05 | 🟡 |
| 6 | Modelos activos y tokens promedio | V-11 | ☑ |
| 7 | Código del despacho, máximo de intentos, tarea de limpieza, gasto en Gemini | V-08 | 🟡 (falta alerta de presupuesto) |
| 8 | 35 corridas de V-09, corrección aplicada y reverificada | V-09 | ☑ |
| 9 | Comentario en REP-2908 | V-13 | ☐ |

---

## 6. Cuándo damos por cumplido el RAG del Sprint 12

1. **Seguridad:** V-01, V-02 cerrados. V-03 falta la clasificación de las 14 tablas y el toggle de contraseñas.
2. **Reproducible:** V-04 cerrado (falta el PR). V-05 falta la reconstrucción en local.
3. **Trazable:** V-07 y V-09 cerrados. V-08 falta solo la alerta de presupuesto.
4. **Sin inventar:** confirmado en los 8 análisis demo y en las 35 corridas de V-09 (con la corrección aplicada).
5. **Controlado:** V-11 cerrado.
6. **Registrado:** V-13 pendiente.

---

**Documentos relacionados:** [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) · `REP-2908-VERIF_ronda2_hernan.md` · `REP-2908-VERIF_devolucion-a-hernan.docx` (v1.1)
