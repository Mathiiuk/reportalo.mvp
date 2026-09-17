# Reportalo

*Plataforma de Auditoría Ciudadana*

## VERIFICACIÓN DEL RAG — CIERRE DE LA SEXTA RONDA

**Versión 1.0 · 17 de septiembre de 2026 · Proyecto RAR-2026**

**Responde a:** `REP-2908-VERIF_ronda6_hernan.md` (Hernán, 17/09)

**Jira:** [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) · [REP-3772](https://unlz2026.atlassian.net/browse/REP-3772) · [REP-2900](https://unlz2026.atlassian.net/browse/REP-2900) · [REP-3777](https://unlz2026.atlassian.net/browse/REP-3777) · [REP-2405](https://unlz2026.atlassian.net/browse/REP-2405) · [REP-2500](https://unlz2026.atlassian.net/browse/REP-2500) · [REP-3775](https://unlz2026.atlassian.net/browse/REP-3775)

**Equipo:** Hernán Gregorini (PO · DBA) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

---

## 0. Resumen ejecutivo

Los 4 puntos que cierran la ronda según tu propio criterio (sección 5: *"la ronda queda cerrada cuando U-1, C-1, C-2 y C-3 están completos"*) están terminados y verificados contra CiudadAR real. En el camino encontramos y corregimos un incidente de producción real (el token de despacho dejó de funcionar) que no estaba pedido en la ronda, pero que bloqueaba todo el pipeline.

C-5, C-6 (ya resuelto) y el backup cifrado quedan como pendientes declarados para el Sprint 13, tal como permite la sección 5.

---

## 1. U-1 · Subida de fotos en producción — CERRADO

El PR se mergeó (#76) y se desplegó en Vercel. Matías envió un reporte real desde `https://reportalo-staging.vercel.app/`, logueado.

**Reporte:** `b4ce2866-8882-4c60-90bf-33e3cca891dc` · creado `2026-09-17 12:56:32`

**Evidencia:**
- Foto real subida y anonimizada: `report-evidences/0b4eecc5-a16d-40ef-a80f-fecb5cbd0a9b/1789649782111_sanitized.jpg` (110 354 bytes), creada `12:56:22` — 10 segundos antes del reporte, consistente con el flujo cuarentena → anonimización → evidencia pública → reporte.
- Análisis generado con éxito: `result_status_code = fundamentado`, `prompt_version = v1`, `generation_model_code = gemini-3.8-flash`, `input_tokens = 1042`, `output_tokens = 263`.

**Nota:** la columna `report_images` del reporte da 0 — es el gap ya conocido (ADR-013, ningún código escribe esa tabla hoy, ver R5-03), no un problema de esta subida. La foto sí llegó y se anonimizó correctamente al bucket público.

**El fix de `upsert:true` funciona en producción real, confirmado con datos, no solo con la política SQL.**

---

## 2. C-1 · Versionado correcto de la separación del art. 48 inc. t) — CERRADO

Tenías razón: la migración original editó `...008` en el lugar en vez de tratarlo como inmutable. Se corrigió:

| Fragmento | Contenido | Vigente | Reemplaza a |
|---|---|---|---|
| `...008` | Texto literal original completo, restaurado | No | — |
| `...016` (nuevo) | Cláusula de obstrucción | Sí | `...008` |
| `b6717f77-...` | Cláusula de venta | Sí | `...008` |

**Verificación (paso 3 de tu documento):**
- `es_literal = true` para ambos fragmentos nuevos, comparado contra el texto original completo.
- Similitud del embedding restaurado de `...015` (Código de Faltas) contra el guardado: **1.0**.
- `match_knowledge_fragments` ya devuelve `...016` en vez de `...008` (verificado por SQL directo y, ahora, también en las 9 corridas reales de C-2 — ver abajo).

**Una corrección sobre la corrección:** tu literal `original` usaba `\n`; el resto del corpus usa `\r\n`. Se normalizó a `\r\n` para consistencia — el contenido es idéntico, el `md5` no va a coincidir con uno calculado asumiendo `\n`.

**Un hallazgo adicional que corregimos nosotros mismos:** el primer intento de `...016` tenía el texto cortado con punto y coma ("...construcciones;") en vez de coma ("...construcciones,") — no era substring literal exacto del original (que sigue con ", instalarse..."). Se corrigió antes de dar el punto por cerrado.

Detalle completo, incluida la nota sobre el incidente del `id` repetido (Q-4), en `supabase/migrations/20260917010000_c1_version_art48_t_split_correctly.sql`.

---

## 3. C-2 · Corridas con la función desplegada y regla de `asistencia` — CERRADO

### 3.1 La regla nueva

Agregada a `validateLlmAnalysis` (y a su espejo testeable en `src/services/validateLlmAnalysis.js`, con 7 tests unitarios): si `estado = 'asistencia'` y la categoría del reporte no es `VULNERABILIDAD_SOCIAL`, el resultado cae a `indeterminado` con motivo. Desplegada en la función v17.

### 3.2 Las 9 corridas — por el camino real

Tenías razón en el fondo: las 37 corridas anteriores usaban un script que *replica* la lógica de `analizar-reporte`, no la función desplegada. Esta vez insertamos 9 reportes reales en CiudadAR (trigger → cola → `dispatch_rag_analysis_queue` → función con token → `persist_rag_analysis`), sin atajos.

**En el camino encontramos un incidente de producción real:** las primeras 9 corridas fallaron con `403` — el token en Vault y el de Edge Functions no coincidían. Nunca se había probado el camino *exitoso* del despacho desde el 16/9 (solo se había probado que fallara sin token), así que este problema existía desde entonces sin que nadie lo notara. Matías regeneró el token y lo cargó en ambos lados; confirmado con `net._http_response` pasando de `403` a `200`. **Esto también confirma que R5-06 (aislamiento de fallas por mensaje) funciona correctamente bajo una falla real**: los 9 mensajes agotaron sus 3 reintentos y se archivaron con `indeterminado` sin bloquear nada más, exactamente como está diseñado.

**Resultado de las 9 corridas reales, ya con el token funcionando:**

| Caso | Reporte real | Estado | Fragmentos citados |
|---|---|---|---|
| A | `449c1398-...` | `fundamentado` | Const.PBA 192.4 + LOM 52/59 |
| B | `df4084b3-...` | `fundamentado` | Solo Ley 2148/451 (CABA) |
| C | `4fd01ca7-...` | `fundamentado` | Solo Ley 24.449 art. 49 |
| D-Av | `6900f00a-...` | `fundamentado` | LOM 52/59 |
| D-CABA | `ec55350f-...` | `fundamentado` | Solo Ley 210 (CABA) — **sin `asistencia`** |
| E | `e3f59591-...` | `fundamentado` | `...016` (la cláusula versionada correctamente) |
| E-sin-categoría | `a68998a4-...` | `fundamentado` | `...016` — nunca el Código de Faltas |
| Prueba 1 | `b2cc399f-...` | `sin_normativa` | Ninguna |
| Prueba 2 | `6e2f9d59-...` | `sin_normativa` | Ninguna |

`prompt_version = v1` en las 9. `diff` entre el script local y `index.ts`: el script local nunca tuvo el chequeo de token ni leía el reporte de la base (tomaba los fragmentos ya recuperados como parámetro) — son las mismas dos diferencias que ya estaban documentadas como motivo de por qué había que repetir esto por el camino real.

**Se cierra:** las 9 corridas dan el mismo resultado que el script (mismos estados, mismas citas), ninguna cita quedó fuera de lo recuperado ni no literal, y D-CABA no tuvo ningún `asistencia` en esta corrida (la regla nueva no llegó a ejercitarse porque no volvió a salir, pero queda desplegada y con test).

Los 9 reportes de prueba (y los 9 fallidos anteriores, ya borrados) fueron creados por mí como usuario Matías, marcados `C2-` en la descripción para identificarlos — **no se borraron los 9 exitosos**, quedan como evidencia; decidí solo si los mantenés o los marcás para limpieza.

---

## 4. C-3 · Evidencias de privacidad — CERRADO

Los 3 comandos sin sesión, corridos contra CiudadAR real:

1. **Listar cuarentena:** `[]` con `HTTP 200` (lista vacía — cumple el criterio de cierre, que acepta "fallan o devuelven vacío").
2. **Subir a `report-evidences`:** `403 {"message":"new row violates row-level security policy"}`.
3. **Insertar en `citizen_reports`:** `401 {"code":"42501", "message":"new row violates row-level security policy..."}`.

**C8:** sigue en 1 objeto viejo del 7/9, sin tocar — no se borra sin tu OK.

---

## 5. Lo que queda pendiente (declarado, no bloqueante)

| Punto | Estado |
|---|---|
| C-5 (reconstrucción en el descartable) | No arrancado — es un trabajo grande aparte (corpus completo, secrets, deploy de funciones en un proyecto nuevo). El proyecto descartable sigue activo. |
| C-6 (PR, revisión, despliegue) | ✅ Hecho — PR #76 mergeado y desplegado. |
| Backup cifrado (4.2) | Comandos armados y entregados a Matías; pendiente de que él lo corra localmente (necesita su login de Supabase CLI, que no manejo yo). |
| Documentos en Drive (4.1) | En curso — Matías está dando acceso a la carpeta. |

---

## 6. Preguntas Q-1 a Q-12

| # | Respuesta |
|---|---|
| Q-1 | Directo en CiudadAR vía MCP de Supabase (`apply_migration`/`execute_sql`), no por editor SQL manual ni CLI local. Con el OK explícito de Matías en el chat antes de cada tanda. |
| Q-2 | Por código, no por prueba en vivo en su momento: `NewReportPage.jsx` pasa `userId: user?.id`, con `user` desde `useAuth()` (el hook de sesión real). No hay un segundo camino de sync offline con otro origen de `user_id`. |
| Q-3 | Hoy `...016` tiene `article='48'`, `subsection='t.obstruccion'`; `b6717f77` tiene `subsection='t.venta'`. Se evitó el índice único `(source_id, article, subsection)` usando un `subsection` distinto al de `...008` (`t`) en cada caso — nunca colisionaron entre sí. |
| Q-4 | Texto exacto: el índice completo del Código de Faltas de la Pcia. de Bs. As. (el contenido real, leído de la base antes del incidente). Mismos parámetros de siempre (`gemini-embedding-2`, 768d). No hubo análisis reales entre que se pisó y se restauró — se corrigió en la misma sesión, antes de que corriera ningún dispatch contra ese fragmento; la similitud 1.0 confirma que el contenido nunca cambió. |
| Q-5 | Sin cambios de prompt, umbral (0.45) ni top-k (6). No hay una causa determinística identificada para que A cite Const.PBA 192.4 en 5/5 ahora — es variabilidad de muestreo del LLM, ya documentada en ronda 4. Queda abierto si querés que se investigue más. |
| Q-6 | Igualdad simple (`!==`). Si falta `RAG_DISPATCH_TOKEN`, `dispatchToken` es `''` y `!dispatchToken` es `true` → 403 siempre. Confirmado en producción: Vault y Edge Functions tenían valores que no coincidían desde el 16/9 (nunca se había ejercitado el camino exitoso); resincronizados hoy, con evidencia de `403→200`. |
| Q-7 | `persist_rag_analysis` es `language plpgsql`, **sin** `security definer`. Permisos: revocado de `public`/`anon`/`authenticated`, otorgado solo a `service_role`. |
| Q-8 | En la prueba de falla controlada original: 4 intentos hasta archivarse; el mensaje válido encolado después se procesó en el mismo ciclo de despacho. |
| Q-9 | `false` — la columna es `NOT NULL` (confirmado con C6); tanto `dispatch_rag_analysis_queue` como `persist_rag_analysis` usan `coalesce(..., false)`. |
| Q-10 | `add_rag_dispatch_retry_limit_and_cleanup`, `v09_match_knowledge_fragments_filter_by_category` y `v03_fix_function_search_path` — mismo contenido byte a byte que `supabase_migrations.schema_migrations.statements` de CiudadAR, solo cambiaba la versión/nombre del archivo local. Se renombraron, no se recrearon. |
| Q-11 | Sí, `reportalo-p08-verificacion-descartable` sigue activo. |
| Q-12 | `7949dba0-...` (16/09, rol ciudadano, 1 imagen, `sin_normativa`) y `cd012356-...` (15/09, rol ciudadano, 1 imagen, `fundamentado`, descripción "REP-2500 verificacion end-to-end" — parece una prueba manual de otra sesión, no un ciudadano real). No se tocaron. |

---

## 7. Lista de entrega

| # | Qué | ✔ |
|---|---|---|
| 1 | U-1: reporte con foto en producción, evidencia | ✅ |
| 2 | U-2: captura de la alerta de presupuesto | ☐ (Matías, panel) |
| 3 | C-1: estado antes/después, `es_literal`, similitud `...015` | ✅ |
| 4 | C-2: regla de `asistencia` + test, 9 corridas reales, `diff`, `prompt_version` | ✅ |
| 5 | C-3: 3 comandos sin sesión y C8 | ✅ |
| 6 | C-5: reconstrucción en descartable | ☐ pendiente Sprint 13 |
| 7 | C-6: PR y despliegue | ✅ |
| 8 | Preguntas Q-1 a Q-12 | ✅ |
| 9 | Documentos en Drive | 🟡 en curso |
| 10 | Backup cifrado | ☐ pendiente (Matías, local) |

**U-1, C-1, C-2 y C-3 completos — la ronda queda cerrada según tu propio criterio de la sección 5.**

---

**Documentos relacionados:** `REP-2908-VERIF_ronda6_hernan.md` · [`REP-2908-VERIF_devolucion-cierre-ronda5.md`](REP-2908-VERIF_devolucion-cierre-ronda5.md) · [`REP-2908-VERIF_P01-corridas-post-filtro.md`](REP-2908-VERIF_P01-corridas-post-filtro.md)
