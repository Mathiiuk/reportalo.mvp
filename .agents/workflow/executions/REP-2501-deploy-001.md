# Registro de despliegue: REP-2501-deploy-001

## Identificación
- **Tarea**: REP-2501 — despliegue en producción (proyecto Supabase `CiudadAR`, `yryuhyiujyignkdhiyua`)
- **Código desplegado**: `staging` `2d52b1f` (PR #98 de REP-2501, luego PR #99 de REP-2204)
- **Fecha**: 2026-09-23
- **Estado**: **DETENIDO en el paso 1.** No se modificó nada en producción. El paso 0 (línea base) es solo lectura.

---

## 1. Paso 0 — Línea base (solo lectura, 22:16 UTC)

| Elemento | Estado encontrado |
|---|---|
| `quarantine-anonymize` | versión 11, `verify_jwt: false`, sin autenticación propia |
| `quarantine-purge` | no existe |
| Política INSERT de `report_images` | solo valida que el reporte sea del usuario (`image_url` libre) |
| Política de subida a cuarentena | `bucket_id = 'evidence-quarantine'` (cualquier ruta) |
| Job de cron `quarantine-purge` | no existe (jobs: `rag-analysis-dispatch`, `rag-cleanup-job-run-details`) |
| Función `dispatch_quarantine_purge` | no existe |
| Vault | `rag_analizar_reporte_url`, `rag_service_role_key` (falta `quarantine_purge_url`) |
| `evidence-quarantine` | 2 objetos: una foto del 07/09 (original huérfano) y una de hoy 22:15:24 UTC, en proceso |

### Hallazgo: el frontend nuevo ya está en producción
La foto de hoy está en una carpeta con id de usuario (`147d2d9a…/temp_…`) y los logs muestran 6 llamadas 200 a
`quarantine-anonymize` entre 22:15:12 y 22:15:49 UTC. Es decir, alguien estaba usando la app con el frontend de REP-2501
y la función vieja las aceptó. Con eso se cumple la precondición de orden de la migración (frontend antes que políticas).
Esa foto **no** es un huérfano: la función la borra al terminar, y la purga programada solo toca lo de más de 1 hora.

## 2. Paso 1 — Desplegar `quarantine-anonymize` (`verify_jwt: true`) — BLOQUEADO

Se intentó con `deploy_edge_function` (archivos `index.ts` y `exif.ts`, idénticos a `staging`). El clasificador de
permisos del modo automático rechazó la llamada. No se reintentó por otra vía. Para ejecutarlo hace falta que Matías lo
autorice o lo corra él.

### Comandos para correrlo a mano (Supabase CLI, desde la raíz del repo, en `staging`)
```bash
supabase functions deploy quarantine-anonymize --project-ref yryuhyiujyignkdhiyua
supabase functions deploy quarantine-purge --project-ref yryuhyiujyignkdhiyua
```
No hay `supabase/config.toml`, así que el CLI usa `verify_jwt` activado por defecto. Verificación posterior: en el
Dashboard (Edge Functions) las dos deben figurar con «Verify JWT» activado, y una llamada sin token debe devolver 401.

## 3. Pasos pendientes, en orden

| Paso | Acción | Verificación |
|---|---|---|
| 2 | Crear el secret de Vault `quarantine_purge_url` con `https://yryuhyiujyignkdhiyua.supabase.co/functions/v1/quarantine-purge` | `select name from vault.decrypted_secrets where name = 'quarantine_purge_url'` |
| 3 | Aplicar `supabase/migrations/20260923130000_rep2501_evidencia_anonimizada.sql` | política de `report_images` con `client_side_id`; política de cuarentena con `auth.uid()`; job `quarantine-purge` en `cron.job` |
| 4 | Ejecutar la purga una vez (`select public.dispatch_quarantine_purge();`) y confirmar que borra la foto del 07/09 | `select count(*) from storage.objects where bucket_id = 'evidence-quarantine'` sin la foto vieja; `net._http_response` con 200 |

El paso 4 también prueba de punta a punta la cadena cron → `pg_net` → función → Storage.

## 4. Reversión
- Funciones: volver a desplegar la versión anterior (versión 11 de `quarantine-anonymize`, con `verify_jwt: false`).
- Migración: recrear las dos políticas anteriores y `select cron.unschedule('quarantine-purge');`.
- Vault: `delete from vault.secrets where name = 'quarantine_purge_url';`.

## 5. Riesgos abiertos
- Mientras el paso 1 no se ejecute, `quarantine-anonymize` sigue aceptando pedidos sin sesión.
- Desplegar la función mientras alguien sube fotos puede cortar una subida en curso (ventana de segundos).
- El difuminado real de caras y patentes sigue fuera de alcance (REP-2400).
