# Reportalo

*Plataforma de Auditoría Ciudadana*

## VERIFICACIÓN DEL RAG — CIERRE DE LA QUINTA RONDA

**Versión 1.0 · 16 de septiembre de 2026 · Proyecto RAR-2026**

**Responde a:** `REP-2908-VERIF_ronda5_hernan.md` (Hernán, 16/09) y a su comentario en REP-2908 ("Mati, yo sacaria la clausula venta de transito").

**Jira:** [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) · [REP-3772](https://unlz2026.atlassian.net/browse/REP-3772) · [REP-2900](https://unlz2026.atlassian.net/browse/REP-2900) · [REP-2901](https://unlz2026.atlassian.net/browse/REP-2901) · [REP-2909](https://unlz2026.atlassian.net/browse/REP-2909) · [REP-3775](https://unlz2026.atlassian.net/browse/REP-3775) · [REP-3776](https://unlz2026.atlassian.net/browse/REP-3776) · [REP-3777](https://unlz2026.atlassian.net/browse/REP-3777) · [REP-2405](https://unlz2026.atlassian.net/browse/REP-2405) · [REP-2500](https://unlz2026.atlassian.net/browse/REP-2500)

**Rama:** `fix/REP-2908-VERIF-v03-security-hardening` (pendiente de PR y merge a `staging` — ver sección 6).

**Equipo:** Hernán Gregorini (PO · DBA) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

---

## 0. Resumen ejecutivo

Se cerraron los 13 puntos de la ronda 5. Los cambios de privacidad (R5-02 a R5-04, R5-11), de seguridad de la función (R5-05, R5-06) y de despliegue (R5-07) **ya están aplicados y verificados en CiudadAR real**, no solo en código. El hallazgo de la Prueba 2 de P-01 (R5-08) se resolvió con la decisión de Hernán y se volvió a correr de punta a punta: **37 de 37 corridas pasan los 4 criterios de cierre, sin excepción**.

Quedan tres cosas fuera de mi alcance, todas del lado de Matías/Hernán, detalladas en la sección 6.

---

## 1. Privacidad — R5-02, R5-03, R5-04 (aplicado en CiudadAR)

**Lo que había:** cualquier visitante sin sesión podía leer, reemplazar y borrar fotos sin anonimizar en `evidence-quarantine`; subir evidencia directo a `report-evidences` sin pasar por anonimización; asociar cualquier imagen a cualquier reporte; y crear reportes a nombre de otro usuario (con el costo de Gemini que eso dispara).

**Lo que se aplicó** (migraciones `20260916030000` a `20260916030200`):
- `evidence-quarantine`: solo `INSERT` para `authenticated` (sin `upsert`); leer/mover/borrar queda exclusivo de `quarantine-anonymize` con la clave de servicio.
- `report-evidences`: se sacaron las políticas de escritura pública; solo queda la lectura pública.
- `report_images.insert_publico`: eliminada (ningún código del repositorio la usa).
- `citizen_reports.insert_publico` → `insert own report`: exige sesión y que `user_id = auth.uid()`.

**Verificado:**
- Consulta de políticas post-aplicación contra CiudadAR: coincide exactamente con lo esperado (sin políticas de escritura pública en `evidence-quarantine`/`report-evidences`, sin `insert_publico` en `report_images`/`citizen_reports`).
- Confirmé, antes de aplicar, que el frontend ya desplegado manda `user_id` de la sesión real (no un valor arbitrario) — no rompe la creación de reportes.
- Saqué el `upsert: true` del cliente en `quarantinePipelineService.js` (el `path` ya es único por `clientSideId` + timestamp, nunca colisiona).

**Pendiente:** la lectura pública de `citizen_reports` (expone `user_id` junto a coordenadas) sigue **[DECISIÓN HERNÁN]**, no se tocó.

---

## 2. Seguridad de la función `analizar-reporte` — R5-05, R5-06 (desplegado, versión 16)

**Lo que había:** la función solo exigía un JWT de sesión válido y tomaba `description`/`category`/`localityId` del cuerpo del pedido tal cual venían — cualquier usuario logueado podía generarle un análisis con texto inventado. Además, el guardado no era atómico (dos inserts separados) y, al superar los reintentos, un error en el insert de cierre podía abortar toda la corrida de despacho.

**Lo que se aplicó:**
- La función exige el header `x-rag-dispatch-token` (secret `RAG_DISPATCH_TOKEN` en Edge Functions / `rag_dispatch_token` en Vault, mismo valor, cargado por Matías — nunca pasó por mí).
- Lee `description`/`locality_id`/categoría del reporte **desde la base**, con la clave de servicio; lo que venga en el body para esos campos se ignora.
- `persist_rag_analysis` (RPC nuevo): un solo insert transaccional de análisis + evidencia, con `on conflict (report_id) do nothing`.
- `dispatch_rag_analysis_queue`: cada mensaje de la cola queda aislado en su propio bloque de excepción — un mensaje que falla no bloquea a los demás.

**Verificado contra CiudadAR:**
- Llamada sin el token → `403 {"error":"No autorizado."}`, confirmado con `curl` real.
- Corrida del despacho (`select public.dispatch_rag_analysis_queue()`) sin error después del deploy — el cron sigue activo cada 1 minuto.
- Prueba de falla controlada (mensaje con `reportId` inexistente, 4 intentos): se archivó sin bloquear el resto de la cola.

---

## 3. Otros permisos — R5-11 (aplicado)

`match_knowledge_fragments` quedaba ejecutable por `anon` y `authenticated` pese al contrato de "solo el servidor" (confirmado con la consulta C5 de la ronda 5). Se revocó para esos dos roles y se otorgó a `service_role`.

---

## 4. El hallazgo de P-01 y su cierre — R5-08

### 4.1 Qué se encontró

Al re-correr las 37 pruebas de P-01 con el filtro por categoría (V-09) ya activo, **la Prueba 2 seguía fallando**: un reclamo de "venta ambulante sin habilitación", mal categorizado como TRANSITO, citaba válidamente el art. 48 inc. t) de la Ley 24.449 — porque ese inciso mezclaba en un solo fragmento dos conductas distintas ("obstaculizar la calzada", correcto para TRANSITO, y "venta de productos en el camino", el distractor). La cita era literal, así que la validación anti-alucinación no la bloqueaba.

Reproducido dos veces, en corridas independientes, un día distinto cada una.

### 4.2 La decisión de Hernán

> *"Mati, yo sacaria la clausula venta de transito"*

### 4.3 Qué se aplicó

- El fragmento original (`...008`) quedó solo con la cláusula de obstrucción — sigue tageado a TRANSITO.
- Se creó un fragmento nuevo (`b6717f77-c30e-4cca-985a-6346d741fe38`) con la cláusula de venta de productos, **sin ninguna categoría asociada** (no hay corpus de COMERCIO_IRREGULAR hoy).
- Embeddings reales regenerados para ambos fragmentos (`gemini-embedding-2@768`).

**Un incidente en el camino, autocorregido:** la primera versión de la migración reusó un `id` que ya pertenecía a otro fragmento real (el índice del Código de Faltas de la Provincia de Buenos Aires). El `insert` del fragmento nuevo no entró por la restricción de clave primaria, pero el `upsert` de embeddings sí sobrescribió por un momento el embedding real de ese otro fragmento. Lo detecté en la verificación posterior a aplicar el cambio (antes de dar nada por cerrado), lo restauré desde su contenido real, y recreé el fragmento de venta con un UUID que no colisiona. Documentado en el encabezado de `supabase/migrations/20260916040000_r5_08_split_ley24449_art48_t_venta_de_transito.sql`, por transparencia.

### 4.4 Verificación final — 37 corridas completas

Corridas de punta a punta (embeddings reales + `match_knowledge_fragments` real vía SQL + `generateContent` real de Gemini + `validateLlmAnalysis` real — misma lógica exacta de `analizar-reporte/index.ts`, reproducida en un script local porque la función desplegada ya exige el token de despacho de R5-05 y no lo tengo):

| Caso | Corridas | Resultado | Fragmentos citados |
|---|---|---|---|
| A (Avellaneda, INFRAESTRUCTURA) | 5/5 `fundamentado` | Const.PBA 192.4 + LOM 52/59 |
| B (CABA, TRANSITO) | 5/5 `fundamentado` | Solo Ley 2148/451 (CABA) |
| C (Avellaneda, TRANSITO) | 5/5 `fundamentado` | Solo Ley 24.449 art. 49 |
| D-Av (Avellaneda, INFRAESTRUCTURA) | 5/5 `fundamentado` | LOM 52/59 |
| D-CABA (CABA, INFRAESTRUCTURA) | 4/5 `fundamentado` + 1/5 `asistencia` | Solo Ley 210 (CABA) |
| E (Avellaneda, TRANSITO) | 5/5 `fundamentado` | Solo art. 48 inc. i) |
| E-sin-categoría (nuevo) | 5/5 `fundamentado` | Solo art. 48 inc. i) — nunca el Código de Faltas ni la cláusula de venta |
| Prueba 1 (categoría mal elegida) | 1/1 `sin_normativa` | Ninguna |
| **Prueba 2 (categoría mal elegida)** | 1/1 **`sin_normativa`** | **Ninguna — ya no inventa nada** |

**Los 4 criterios de cierre de Hernán, verificados sobre las 37 corridas:**

| # | Criterio | Resultado |
|---|---|---|
| 1 | (Excluyente) Ninguna cita fuera de lo recuperado ni no literal | ✅ 0/37 `indeterminado` por validación fallida |
| 2 | C nunca recupera/cita normas de CABA | ✅ |
| 3 | B y D-CABA nunca recuperan/citan la Ley 24.449 | ✅ |
| 4 | La Prueba 2 no cita el art. 48 inc. t) | ✅ |

**R5-08 cerrado sin condiciones.** Evidencia completa y script reproducible en [`docs/REP-2908-VERIF_P01-corridas-post-filtro.md`](REP-2908-VERIF_P01-corridas-post-filtro.md) y `scripts/rag-local-dev/p01-r5-final/`.

---

## 5. Reproducibilidad — R5-09 (aplicado)

- Se reconciliaron las migraciones locales con `supabase_migrations.schema_migrations` de CiudadAR: 3 archivos renombrados a su versión real, la de V-08 partida en las dos versiones reales aplicadas, y se creó el archivo faltante de la política de `states_provinces` (aplicada a mano el 16/09, sin archivo hasta ahora).
- Se reescribió la sección 4 de [`docs/GUIA-REPLICACION-Y-CONTINUIDAD-DEL-SISTEMA.md`](GUIA-REPLICACION-Y-CONTINUIDAD-DEL-SISTEMA.md): marca `schema.sql`/`seed.sql`/`rag_normativas.sql` como históricos, documenta el orden real (migraciones → corpus → embeddings → secrets → deploy de funciones), y lista los nombres de los 5 secrets. Los 13 links que apuntaban a `file:///d:/...` (solo la máquina de Matías) ahora apuntan al repositorio en GitHub.

Durante el proceso descubrí que mi rama estaba ~150 commits desactualizada de `staging` (P-04, P-02, P-06 y P-08 ya se habían mergeado por otras ramas sin que yo lo supiera). Mergeé `origin/staging`, resolví 3 duplicados de migraciones con el mismo contenido y distinto nombre, y los 186 tests siguen en verde.

---

## 6. Lo que queda — no lo puedo cerrar yo

| Punto | Qué falta | De quién |
|---|---|---|
| **R5-10** | Activar "Leaked Password Protection" (Authentication → Providers → Email → Password, en el dashboard de Supabase — puede no estar disponible según el plan) y captura del monto de la alerta de presupuesto | Matías (panel, no tengo acceso) |
| **PR + merge** | La rama `fix/REP-2908-VERIF-v03-security-hardening` está lista y pusheada; falta abrir el PR contra `staging` y mergearlo. Los cambios de Supabase ya están en CiudadAR — este PR es sobre todo para que el fix de `upsert:true` en el frontend llegue a Vercel | Matías |
| **R5-12** | Lista de 40 IDs de reportes de prueba ya entregada (ronda anterior); 2 de ellos (`cd012356-fe75-4ba6-967b-6c6f45d88a59`, `7949dba0-69ad-4a78-8383-8725cd92b2d4`) no calzan con el patrón de seed — decidir si se investigan | Hernán |
| **R5-13 (P-09 a P-12)** | Comentario en Jira, evidencia de V-06, aviso al equipo por los correos publicados, `audit_ia` | Coordinación de equipo, no depende de código |

---

## 7. Lista de entrega

| # | Punto | Evidencia | Estado |
|---|---|---|---|
| 1 | R5-01 | C1 a C9, tres `grep`, panel (parcial) | ✅ |
| 2 | R5-02 | Migración `20260916030000`, verificación de políticas post-aplicación | ✅ |
| 3 | R5-03 | Migración `20260916030100` | ✅ |
| 4 | R5-04 | Migración `20260916030200`, precondición verificada | ✅ |
| 5 | R5-05 | Función v16 desplegada, `403` confirmado sin token | ✅ |
| 6 | R5-06 | `persist_rag_analysis` + despacho no bloqueante, prueba de falla controlada | ✅ |
| 7 | R5-07 | Desplegado, cron activo sin error | ✅ |
| 8 | R5-08 | 37/37 corridas, 4/4 criterios de Hernán | ✅ |
| 9 | R5-09 | Migraciones reconciliadas, guía reescrita | ✅ |
| 10 | R5-10 | — | ⏳ Matías (panel) |
| 11 | R5-11 | Revoke aplicado y verificado | ✅ |
| 12 | R5-12 | Lista entregada | ✅ (decisión pendiente) |
| 13 | R5-13 | Solo lo de código (constante de modelo anotada) | 🟡 parcial |

**Con el PR mergeado y R5-10 resuelto (o documentado como no aplicable por plan), el RAG queda cerrado según el criterio de la sección 10 de `REP-2908-VERIF_ronda5_hernan.md`.**

---

**Documentos relacionados:** `REP-2908-VERIF_ronda5_hernan.md` · [`REP-2908-VERIF_P01-corridas-post-filtro.md`](REP-2908-VERIF_P01-corridas-post-filtro.md) · [`GUIA-REPLICACION-Y-CONTINUIDAD-DEL-SISTEMA.md`](GUIA-REPLICACION-Y-CONTINUIDAD-DEL-SISTEMA.md)
