# Implementation Plan — TASK-ID

## 1. Resumen

## 2. Repositorio inspeccionado

- Stack:
- Runtime:
- Package manager:
- Branch base:
- CI actual:

## 3. Cambios propuestos

### [MODIFY]
- `path/to/file`

### [NEW]
- `path/to/file`

### [DELETE]
- `path/to/file`

## 4. Estrategia de implementación

## 5. Migraciones / datos

## 6. Seguridad

## 7. Observabilidad

## 8. Compatibilidad / rollback

## 9. Plan de verificación

- [ ] Lint
- [ ] Typecheck
- [ ] Unit
- [ ] Integration
- [ ] E2E
- [ ] Build
- [ ] Security
- [ ] Smoke

## 10. Definition of Done

## 11. Aprobación requerida

- [ ] No requerida
- [ ] Requerida

## 12. Notas de ejecución

**14/09/2026 — V-01 (clave service_role filtrada):**
- Confirmado: el trigger heredado `audit_ia` (sobre `infractions`, 0 filas) tenia un JWT
  `service_role` en texto plano en el header `Authorization` de su llamada a
  `supabase_functions.http_request`. La consulta 1 del documento de Hernan (regex sobre
  `pg_proc.prosrc`) no lo detecta porque la clave vive en `pg_trigger`, no en el codigo de
  una funcion — hallazgo nuevo a sumar a V-01.
- Se desactivo el trigger sin borrarlo (`alter table infractions disable trigger audit_ia`),
  con OK explicito de Matias. Verificado `tgenabled = 'D'`.
- Pendiente: rotar la clave `service_role` desde el panel de Supabase (no hay tool de MCP
  para eso) y actualizar Vault/Edge Functions/Vercel si corresponde. Bloquea el cierre
  formal de V-01.

**14/09/2026 — V-02 (backup en git):**
- Confirmado: `supabase/backups/2026-09-14_pre-deploy-rag/` (commit `f17e512`) ya esta
  pusheado y mergeado en `origin/staging` — no estaba en `.gitignore`.
- Se reviso el contenido del backup commiteado: NO contiene el JWT de `audit_ia` (el dump
  de `schema_triggers.json` no capturo los headers completos), pero si contiene datos
  reales de 44 tablas (perfiles, reportes, etc.) ya expuestos en el historial de la rama
  principal. Pendiente decidir con Hernan/Leonel si se limpia el historial.

**14/09/2026 — V-03 (Security Advisor):**
- 0 tablas sin RLS. 17 tablas con RLS habilitado sin ninguna politica (deny total, no
  hueco) — mayoria de solo-lectura server-side; a confirmar con Hernan cuales son
  intencionales.
- Hallazgo nuevo no listado en el documento: `dispatch_rag_analysis_queue` y
  `enqueue_rag_analysis` (`SECURITY DEFINER`) eran ejecutables via RPC publico por `anon` y
  `authenticated` — relevante para V-08 (riesgo de disparo de costo real sin autenticarse).
  Corregido: `revoke execute ... from public` + `revoke ... from authenticated` (el REVOKE
  inicial solo sobre `anon` no alcanzo porque el privilegio se heredaba de `PUBLIC`).
  Verificado con `has_function_privilege`: `anon`/`authenticated` ya no pueden, `postgres`/
  `service_role` si. Confirmado que el trigger `trg_enqueue_rag_analysis` (habilitado) y el
  cron `rag-analysis-dispatch` (activo, cada minuto) siguen funcionando sin cambios.
- Pendientes menores (WARN, no bloqueantes): 10 funciones sin `search_path` fijo, extension
  `vector` en schema `public`, proteccion de contraseñas filtradas desactivada en Auth.

**14/09/2026 — V-04 (estado real de la base):**
- PARTE 8 corrida completa: todo `OK` salvo `profiles` (5 de 6 esperados) y
  `citizen_reports`/`report_state_history` (0 de 8 / 0 de 18) — los seeds de reportes demo
  (incluido el perfil `ciudadano.demo`) nunca se recargaron tras el incidente de borrado
  documentado en sesiones anteriores. Los 5 perfiles existentes son cuentas reales del
  equipo, no seed.
- PARTE 5B/6 presentes (`report_events`, `profile_attends_report`, `mark_report_viewed`,
  `source_adhesions`, `generation_models`, etc. — todo `true`).
- Las 15 huellas md5 del corpus coinciden exactamente con las esperadas.
- Cascada jurisdiccional correcta: Piñeyro (BA) recibe Ley 24.449 (nivel 3), Retiro (CABA)
  no la recibe, Avellaneda (Santa Fe) no recibe nada.
- Pendiente: decidir si se recargan los seeds demo (dispara 8 analisis reales de Gemini,
  bajo costo, sirve ademas como evidencia de V-07) — bloquea V-07 tal como esta escrito en
  el documento de Hernan (requiere el perfil `ciudadano.demo`).

**14/09/2026 — V-12 (clave de Gemini en el frontend):**
- `legalRagService.js`/`geminiClient.js` no tienen ningun import real desde paginas o
  componentes (solo desde tests) — quedaron huerfanos del lado cliente.
- `pnpm run build` + grep sobre `dist/`: cero coincidencias de `AIza...`, `generativelanguage`
  o codigo de `geminiClient` — eliminados por tree-shaking al no ser alcanzables desde el
  entrypoint. V-12 cerrado.

**Pendiente:** V-05 (migraciones + PR), V-06, V-07 (bloqueado por seeds demo), V-08, V-09,
V-11, V-13.

