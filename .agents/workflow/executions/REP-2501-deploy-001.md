# Registro de despliegue: REP-2501-deploy-001

## Identificación
- **Tarea**: REP-2501 — despliegue en producción (proyecto Supabase `CiudadAR`, `yryuhyiujyignkdhiyua`)
- **Código desplegado**: `staging` `2d52b1f` (PR #98 de REP-2501, luego PR #99 de REP-2204)
- **Fecha**: 2026-09-23
- **Estado**: **COMPLETADO**, con un pendiente de verificación (ver §6) y un ajuste opcional (ver §5).

---

## 1. Paso 0 — Línea base (solo lectura, 22:16 UTC)

| Elemento | Estado encontrado |
|---|---|
| `quarantine-anonymize` | versión 11, `verify_jwt: false`, sin autenticación propia |
| `quarantine-purge` | no existía |
| Política INSERT de `report_images` | solo validaba que el reporte fuera del usuario (`image_url` libre) |
| Política de subida a cuarentena | `bucket_id = 'evidence-quarantine'` (cualquier ruta) |
| Job de cron `quarantine-purge` / función `dispatch_quarantine_purge` | no existían |
| Vault | `rag_analizar_reporte_url`, `rag_service_role_key` (faltaba `quarantine_purge_url`) |
| `evidence-quarantine` | 2 objetos: foto del 07/09 (original huérfano) y foto de hoy 22:15:24 UTC |

**Hallazgo:** el frontend de REP-2501 ya estaba en producción (la foto de hoy estaba en una carpeta con id de usuario y los
logs mostraban 6 llamadas 200 a la función entre 22:15:12 y 22:15:49 UTC). La precondición de orden de la migración se cumplía.

## 2. Paso 1 — Desplegar las funciones

- Un primer intento con `deploy_edge_function` fue **bloqueado por el clasificador de permisos** del modo automático y no se
  reintentó por otra vía. Lo ejecutó Matías desde su terminal, en `D:\Proyectos\reportalo.mvp` sobre `staging`:
  `supabase functions deploy quarantine-anonymize|quarantine-purge --project-ref yryuhyiujyignkdhiyua`.
- Primer error de Matías: corrió el comando desde `C:\Users\krepc` y el CLI no encontró `supabase/functions/...`. Se corrige
  ejecutándolo dentro del repo.

Verificación en el servidor (después):

| Función | Versión | `verify_jwt` | Comprobación |
|---|---|---|---|
| `quarantine-purge` | 1 (nueva) | `true` | sin token → **401** del gateway |
| `quarantine-anonymize` | 12 (antes 11) | **`false`** (el CLI conservó el valor previo) | pedido completo sin token → **401** «Se requiere una sesión iniciada.»; con token falso → **401** |

Los 401 de `quarantine-anonymize` provienen del código nuevo (autenticación dentro de la función), lo que prueba que la versión 12
es la de REP-2501. Con la versión vieja, ese mismo pedido habría intentado descargar el archivo.

## 3. Paso 2 — Secret de Vault

`vault.create_secret(...)` creó `quarantine_purge_url` = `https://yryuhyiujyignkdhiyua.supabase.co/functions/v1/quarantine-purge`
(id `3de87a88-94e3-44a7-bee1-dc7d67822008`). Es una URL, no una clave. La clave de servicio se reutiliza de `rag_service_role_key`.

## 4. Paso 3 — Migración `20260923130000_rep2501_evidencia_anonimizada`

Aplicada con `apply_migration` (sin el `begin/commit` del archivo, porque la herramienta ya usa una transacción). Verificación:

| Chequeo | Resultado |
|---|---|
| Política `insert own report images` exige `client_side_id` y `report-evidences` | ✅ |
| Política de cuarentena exige `auth.uid()` en la carpeta | ✅ |
| Job `quarantine-purge` | ✅ `*/15 * * * *` |
| Función `dispatch_quarantine_purge` | ✅ existe |
| `anon` puede ejecutarla | ✅ no |
| `authenticated` puede ejecutarla | ✅ no |
| Secret `quarantine_purge_url` | ✅ existe |

## 5. Paso 4 — Purga de prueba

`select public.dispatch_quarantine_purge();` → respuesta de la función: **HTTP 200**, `{"success":true,"scanned":2,"removed":1}`.
Se eliminó la foto original del 07/09. Esto prueba la cadena completa: función SQL → `pg_net` → Edge Function → Storage.

Estado final de `evidence-quarantine`: 1 objeto, la foto de hoy (`147d2d9a…/temp_0a791e22…`), de menos de 1 hora, que la purga
no toca todavía.

## 6. Pendientes

1. **Verificar la purga automática**: la foto de hoy debería desaparecer sola después de las ~23:15 UTC (1 hora + próxima corrida del
   cron, cada 15 minutos). Comprobar con `select count(*) from storage.objects where bucket_id = 'evidence-quarantine'`.
   Si sigue ahí, revisar `cron.job_run_details` y `net._http_response`.
2. **Sobre esa foto**: no se sabe por qué la función vieja no la borró (hubo llamadas 200 en ese momento). Si aparecen más
   fotos huérfanas con la función nueva, investigar los logs de `quarantine-anonymize`.
3. **Opcional — `verify_jwt` en `quarantine-anonymize`**: quedó en `false`. No deja un hueco (la función valida la sesión con
   Supabase Auth antes de actuar, y se comprobó con 401), pero activarlo agrega el candado del gateway. Se hace en el Dashboard
   (Edge Functions → `quarantine-anonymize` → Details → Verify JWT) o con `[functions.quarantine-anonymize] verify_jwt = true`
   en un `supabase/config.toml`. Conviene probar un envío real después.
4. **Smoke manual** del envío completo con foto (plan de pruebas de REP-2501 §7 y §8).

## 7. Reversión
- Funciones: volver a desplegar la versión anterior de `quarantine-anonymize`; borrar `quarantine-purge` desde el Dashboard.
- Migración: recrear las dos políticas anteriores y `select cron.unschedule('quarantine-purge');`.
- Vault: `delete from vault.secrets where name = 'quarantine_purge_url';`.

## 8. Riesgos abiertos
- El difuminado real de caras y patentes sigue fuera de alcance (REP-2400).
- Los 39 objetos de `report-evidences` sin fila en `report_images` y los buckets heredados `evidencia-infracciones` /
  `infraction-images` no se tocaron: se revisan con el equipo.
