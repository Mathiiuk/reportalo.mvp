# Reportalo

*Plataforma de Auditoría Ciudadana*

## DEVOLUCIÓN — RESPUESTA A LA VERIFICACIÓN DEL DESPLIEGUE DEL RAG (V-01 A V-13)

**Versión 1.0 · 14 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Responde a:** [REP-DEPLOY-RAG-SUPABASE_devolucion_y_verificacion.md](https://unlz2026.atlassian.net/browse/REP-2908) (Hernán, 14/09)
**Jira:** [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) · [REP-3772](https://unlz2026.atlassian.net/browse/REP-3772) · [REP-3773](https://unlz2026.atlassian.net/browse/REP-3773) · [REP-3775](https://unlz2026.atlassian.net/browse/REP-3775) · [REP-3776](https://unlz2026.atlassian.net/browse/REP-3776) · [REP-3777](https://unlz2026.atlassian.net/browse/REP-3777) · [REP-2909](https://unlz2026.atlassian.net/browse/REP-2909)

**Equipo:** Hernán Gregorini (PO · DBA) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

**Consultor Especialista:** Carlos Ruiz (auditor externo · asesoría metodológica)

> **Propósito.** Responder punto por punto a los V-01 a V-13 del documento de devolución de Hernán: qué se corrigió, con qué evidencia, y qué queda abierto todavía.

---

## 1. Resumen de estado

| ID | Tema | Prioridad | Estado |
|---|---|---|---|
| V-01 | Clave `service_role` filtrada | P1 | ✅ Cerrado |
| V-02 | Backup con datos reales fuera de Git | P1 | 🟡 Parcial |
| V-03 | Hallazgos de seguridad heredados | P1 | 🟡 Parcial |
| V-04 | Estado real de la base | P1 | 🟡 Parcial |
| V-05 | Migraciones y Pull Request | P1 | 🟡 Parcial |
| V-06 | Mismo embedding en script y Edge Function | P2 | ⚪ No iniciado |
| V-07 | Prueba de punta a punta | P1 | ✅ Cerrado |
| V-08 | Límite de reintentos y alerta de presupuesto | P1 | ⚪ No iniciado |
| V-09 | Casos A–F repetidos 5 veces | P2 | ⚪ No iniciado |
| V-10 | Caso A: Constitución PBA 192.4 | P3 | Decisión de Hernán — sin cambios de nuestro lado |
| V-11 | Modelo de generación y parámetros | P2 | ⚪ No iniciado |
| V-12 | Sin clave de Gemini en el frontend | P1 | ✅ Cerrado |
| V-13 | Registro en Jira | P2 | ⚪ Pendiente (Matías) |

---

## 2. Detalle por punto

### V-01 · Clave `service_role` filtrada — ✅ Cerrado

Confirmado el hallazgo, con un matiz: la clave no vivía en el código de una función (`pg_proc`, que es donde busca la Consulta 1 del documento original), sino en la **definición del trigger** `audit_ia` (`pg_trigger`, embebida en la llamada a `supabase_functions.http_request`). La Consulta 1 tal como está escrita no la detecta — se recomienda ampliarla para incluir `pg_get_triggerdef`.

Acciones:
- Trigger `audit_ia` desactivado sin borrar (tabla `infractions`, 0 filas — heredada, sin uso).
- Clave `service_role` rotada desde el panel de Supabase: se migró al esquema moderno de `secret keys` (`sb_secret_...`) y se deshabilitaron las claves legacy basadas en JWT.
- Secreto de Vault `rag_service_role_key` actualizado con la clave nueva.
- Verificado que el sitio en producción sigue funcionando con la clave `anon`/publishable actual.
- Verificado con V-07 que el pipeline funciona de punta a punta con la clave nueva.

### V-02 · Backup con datos reales fuera de Git — 🟡 Parcial

Confirmado: `supabase/backups/2026-09-14_pre-deploy-rag/` (commit `f17e512`) ya está pusheado **y mergeado** en `staging` — no llegamos a tiempo de avisar antes del push, como pedía el documento original.

- Revisado el contenido del backup commiteado: **no** contiene el JWT filtrado de `audit_ia` (el dump de triggers no capturó los headers completos), pero sí contiene datos reales de 44 tablas.
- Se agregó `supabase/backups/` al `.gitignore` para que no vuelva a pasar.
- **Pendiente de decisión conjunta:** si se limpia el historial de `staging` (reescritura, hay que coordinarlo con quien tenga la rama clonada) o se acepta el riesgo dado que la clave específica no viajó por ese archivo.

### V-03 · Hallazgos de seguridad que ya existían — 🟡 Parcial

Corrido el Security Advisor completo y las tres consultas pedidas:
- **0 tablas sin RLS.**
- 17 tablas con RLS habilitado sin ninguna política (deny total, no hueco) — mayoría de solo lectura server-side; falta que Hernán confirme cuáles son intencionales.
- Políticas de `report_ai_analysis`/`report_ai_evidence` correctas (criterio REP-2909 ya aplicado).

**Hallazgo nuevo, no listado en el documento original:** `dispatch_rag_analysis_queue` y `enqueue_rag_analysis` (`SECURITY DEFINER`) eran ejecutables vía `/rest/v1/rpc/...` por los roles `anon` **y** `authenticated` — cualquiera, autenticado o no, podía disparar el pipeline de análisis y generar costo real de Gemini sin pasar por un reporte real. Corregido: revocado `EXECUTE` de `PUBLIC` y de `authenticated` (el primer intento, solo sobre `anon`, no alcanzó porque el privilegio se heredaba de `PUBLIC`). Verificado que el disparo interno (trigger + cron) sigue funcionando.

Pendientes menores (`WARN`, no bloqueantes): 10 funciones sin `search_path` fijo, extensión `vector` instalada en `public` en vez de un esquema aparte, protección de contraseñas filtradas (HaveIBeenPwned) desactivada en Auth.

### V-04 · Estado real de la base — 🟡 Parcial

Corrida la PARTE 8 completa de `REP-3769_seed_y_RAG.sql`: todo `OK` salvo tres filas en `REVISAR`:

| Tabla | Esperado | Real |
|---|---|---|
| `profiles` | 6 | 5 |
| `citizen_reports` (perfil full) | 8 | 0 |
| `report_state_history` (perfil full) | 18 | 0 |

Los 5 perfiles existentes son cuentas reales del equipo (Iván, Matías, etc.), no el seed demo — confirma que el perfil `ciudadano.demo` y los 8 reportes demo nunca se recargaron después del incidente de borrado de sesiones anteriores.

- PARTE 5B/6 presentes (`report_events`, `profile_attends_report`, `mark_report_viewed`, `source_adhesions`, `generation_models`, etc.).
- Las 15 huellas md5 del corpus coinciden **exactamente** con las esperadas — texto literal intacto.
- Cascada jurisdiccional correcta: Piñeyro (BA) recibe la Ley 24.449, Retiro (CABA) no la recibe, Avellaneda (Santa Fe) no recibe nada.

**Pendiente de decisión:** si se recargan los seeds demo (dispara 8 análisis reales de Gemini, costo bajo, sirve además como evidencia adicional de V-07).

### V-05 · Migraciones y Pull Request — 🟡 Parcial

Se leyó el historial interno real de Supabase (`supabase_migrations.schema_migrations`) y se versionaron como archivos en `supabase/migrations/` con el SQL exacto y los timestamps reales de cada cambio aplicado a mano durante el despliegue original: extensiones (`pgmq`, `pg_cron`), RLS de `report_ai_analysis`/`report_ai_evidence`, secreto de Vault con la URL de la Edge Function, pipeline asíncrono completo (cola, trigger, dispatch, cron), corrección del schedule del cron, RLS de `report_images`, y las 4 correcciones de V-01/V-03.

**Hallazgo nuevo, no documentado en ningún lado hasta ahora:** el esquema `pgmq` no está expuesto en la API de datos de Supabase, así que el borrado de mensajes procesados desde la Edge Function fallaba silenciosamente (`"Invalid schema: pgmq"`) y los reprocesaba cada minuto para siempre. Ya estaba resuelto con un wrapper (`public.pgmq_delete_message`, `SECURITY DEFINER`, exclusivo de `service_role`) pero nunca se había versionado ni documentado — ya está en `supabase/migrations/20260914185641_create_pgmq_delete_wrapper.sql`.

Excluido a propósito, según el punto 2 y 3 de "Qué hacer" del documento original: los 3 backfills de embeddings (se documenta el comando `node scripts/rag-local-dev/generate-fragment-embeddings.mjs`) y el valor de la clave `rag_service_role_key`.

**Pendiente:** abrir el Pull Request. El documento original dice contra `develop`, rama que no existe en este repositorio — la base real de todo el trabajo de Sprint 12 fue siempre `staging`.

### V-06 · Mismo embedding en script y Edge Function — ⚪ No iniciado

### V-07 · Prueba de punta a punta — ✅ Cerrado

El script exacto del documento no pudo correr tal cual (no existe el perfil `ciudadano.demo`, confirmado en V-04) — se adaptó usando un perfil real del equipo, con OK explícito de Matías antes del insert.

| Paso | Resultado |
|---|---|
| Insert del reporte de prueba | 23:51:48 |
| `report_ai_analysis` creado | 23:52:03 (**~15 segundos**) |
| Cola `pgmq` | Vacía — procesado y removido |
| Resultado | `fundamentado`, `is_infraction: true`, `confidence_score: 0.98` |
| `report_ai_evidence` | 6 fragmentos recuperados, **todos de CABA** (cero de la Ley 24.449) |
| Citas | 2 citadas, ambas literales sobre rampas para personas con discapacidad — coincide con el texto del reporte |

Corrido íntegramente con la clave `service_role` **nueva** (post-rotación de V-01). El reporte de prueba queda en la base como evidencia, no se borró.

### V-08 · Límite de reintentos y alerta de presupuesto — ⚪ No iniciado

### V-09 · Casos A–F repetidos 5 veces — ⚪ No iniciado

### V-10 · Caso A, Constitución PBA 192.4 — decisión de Hernán

Sin cambios de nuestro lado — a definir en REP-3773 según indica el documento original.

### V-11 · Modelo de generación y parámetros — ⚪ No iniciado

### V-12 · Sin clave de Gemini en el frontend — ✅ Cerrado

`legalRagService.js`/`geminiClient.js` no tienen ningún import real desde páginas o componentes (solo desde tests) — quedaron huérfanos del lado cliente. Se corrió `pnpm run build` y se grepeó `dist/`: cero coincidencias de `AIza...`, `generativelanguage` o código de `geminiClient` — eliminados por tree-shaking al no ser alcanzables desde el entrypoint.

### V-13 · Registro en Jira — ⚪ Pendiente

Queda para Matías comentar en REP-2908 con el resumen de este documento — no se tocó Jira directamente en ningún momento de este trabajo.

---

## 3. Preguntas del documento original — lo que podemos responder ahora

| Pregunta de Hernán | Respuesta |
|---|---|
| ¿Se recargaron los seeds de REP-3605? | No — confirmado en V-04. Pendiente de decisión conjunta. |
| ¿`trg_enqueue_rag_analysis` se dispara solo al insertar o también al actualizar? | Solo al insertar (`after insert on citizen_reports`) — confirmado en el código versionado. |
| ¿La versión de `profile_attends_report` es la de la PARTE 5B o una propia? | Existe y responde a la firma esperada (`profile_attends_report(uuid, uuid)`); no se comparó el cuerpo de la función contra la PARTE 5B línea por línea — pendiente si hace falta ese nivel de detalle. |
| ¿Las invocaciones manuales con `curl` guardaron filas en `report_ai_analysis`? | No verificado en este trabajo — requiere revisión aparte. |
| ¿Qué pasó con la clave de Gemini regenerada? | No investigado en este trabajo — lo responde Matías directamente. |

---

## 4. Próximos pasos sugeridos

1. Decidir V-02 (historial de git) y V-04 (recarga de seeds demo) — bloquean el cierre formal de esos puntos.
2. Abrir el Pull Request de V-05 contra `staging` una vez autorizado.
3. Encarar V-08 (límite de reintentos/presupuesto) antes del cierre del Sprint 12 — es P1 y todavía no se tocó.
4. V-06, V-09, V-11 y V-13 quedan para una siguiente pasada, con prioridad P2 salvo indicación contraria.

---

**Documentos relacionados:** [REP-DEPLOY-RAG-SUPABASE_devolucion_y_verificacion.md](https://unlz2026.atlassian.net/browse/REP-2908) · [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) · [REP-2909](https://unlz2026.atlassian.net/browse/REP-2909)
