# REP-3793 · Despliegue y QA de la anonimización real

Herramientas y procedimiento para cerrar [REP-3793](https://unlz2026.atlassian.net/browse/REP-3793) con evidencia real.
La regla de Done del ticket es **código + despliegue + prueba E2E + evidencia de QA**: nada de esto se da por cumplido
hasta completar la sección 3.

| Archivo | Para qué |
|---|---|
| `spike-cpu/index.ts` | Bloque 0: Edge Function de prueba (solo en el proyecto descartable) |
| `spike-cpu/resultados-2026-09-26.txt` | Mediciones crudas del Bloque 0 |
| `proteger-foto.ts` | Corre el **mismo** pipeline de la función sobre una foto local y deja antes/después |
| `fotos/` | Fotos de la matriz de QA (no se versionan) |

## 1. Bloque 0 · Resultado del spike de CPU (26/09/2026)

Función `rep3793-spike-cpu` en el proyecto descartable `xuosgrkyhqlpgqgxdwtd`, 4 corridas por tamaño, 4 zonas
pixeladas, JPEG 85. Fotos sintéticas con ruido (peor caso para el códec).

| Lado mayor | Abrir | Pixelar | Guardar | Total en la función | Resultado |
|---|---|---|---|---|---|
| 1280 px | 77–197 ms | 3–8 ms | 50–126 ms | 130–331 ms | ✅ 4/4 |
| **1600 px** | 116–210 ms | 7–8 ms | 77–122 ms | **200–341 ms** | ✅ 4/4 |
| 1920 px | 172–426 ms | 5–11 ms | 109–276 ms | 288–714 ms | ✅ 4/4 |
| 4032 px (celular sin reducir) | 735–856 ms | 13–15 ms | 477–697 ms | 1244–1572 ms | ❌ 2/4 `546 WORKER_RESOURCE_LIMIT` |

**Decisión del gate:** entra en la Edge Function, se sigue con ImageScript. El cliente reduce a **1600 px** (margen de ~6×
sobre el límite de 2 s de CPU) y el servidor rechaza más de **2048 px** antes de abrir la foto.

## 2. Despliegue (lo corre Matías, en este orden)

> ⚠️ **El orden importa.** La función nueva rechaza fotos de más de 2048 px, y el frontend publicado hoy **no las achica**.
> Si la función se despliega primero, todos los reportes con foto de celular fallan hasta que llegue el frontend nuevo.

1. **Secreto:** `GOOGLE_VISION_API_KEY` es una clave propia (empieza con `AIza`), restringida a Cloud Vision API.
   En `supabase secrets list --project-ref yryuhyiujyignkdhiyua` su digest tiene que ser **distinto** del de `GEMINI_API_KEY`.
2. **Frontend primero:** merge del PR a `staging` → Vercel publica. Si producción (`main`) usa el mismo Supabase, también
   tiene que tener este frontend antes del paso 3.
3. **Función:** desde la raíz del repo, en la rama ya mergeada:
   ```powershell
   supabase functions deploy quarantine-anonymize --project-ref yryuhyiujyignkdhiyua
   ```
   El CLI conserva `verify_jwt: false`, que es lo esperado: la función valida la sesión por su cuenta (REP-2501).
4. **Humo:** un reporte con foto desde staging. En los logs de la función tiene que aparecer una línea
   `{"event":"evidence_protected",...}` con `"emulated":false`. Si aparece `evidence_fail_safe`, su `reason` dice por qué.

**Vuelta atrás:** `git checkout <commit anterior> -- supabase/functions/quarantine-anonymize` y volver a desplegar. El
frontend nuevo funciona con la función vieja: solo achica las fotos.

## 3. Matriz de QA y evidencia para el cierre

Cada caso deja su evidencia en el ticket (capturas, archivos o enlace). Iván registra el resultado.

| # | Caso | Cómo | Evidencia esperada |
|---|---|---|---|
| Q1 | Un rostro | Reporte con una persona de frente | Foto guardada con la cara pixelada; log con `faces: 1` y zona coherente |
| Q2 | Varios rostros | 3 o más personas | Todas pixeladas; `faces` = cantidad visible |
| Q3 | Rostro de perfil o lejos | Persona chica en la foto | Pixelada, o anotar el falso negativo (no bloquea, se reporta) |
| Q4 | Patente cercana | Auto con patente legible | Patente pixelada, **auto visible** |
| Q5 | Patente lejana | Auto a 10 m o más | Pixelada, o anotar el falso negativo |
| Q6 | Sin datos sensibles | Bache, luminaria | `faces: 0, plates: 0`; la foto se guarda igual (re-codificada) |
| Q7 | Nocturna o baja calidad | Poca luz | Resultado según lo que Vision detecte; anotar |
| Q8 | Vision caído | Ver 3.2 | App muestra «No pudimos proteger tu foto»; nada nuevo en `report-evidences` |
| Q9 | Offline + Vision caído | Ver 3.2 | El reporte sigue en Pendientes con su foto |
| Q10 | Metadatos | Descargar la foto guardada de Q1 | `exiftool -a -G1 foto.jpg` sin GPS, marca ni modelo |

### 3.1 Antes/después y coordenadas (Q1–Q7)

Hace falta [Deno](https://deno.com) (`irm https://deno.land/install.ps1 | iex` en PowerShell). Con la foto original en
`scripts/rep3793/fotos/` (máximo 2048 px de lado; si es más grande, achicala antes):

```powershell
$sec = Read-Host "Clave Vision" -AsSecureString
$env:GOOGLE_VISION_API_KEY = [System.Net.NetworkCredential]::new("", $sec).Password
deno run -A scripts/rep3793/proteger-foto.ts scripts/rep3793/fotos/q1-un-rostro.jpg
```

Deja `q1-un-rostro.protegida.jpg` (lo mismo que guardaría el servidor), `q1-un-rostro.zonas.jpg` (con los recuadros
dibujados para revisar las coordenadas) y `q1-un-rostro.resultado.json`. Para el ticket sirve la captura de
`.zonas.jpg` al lado de la protegida. **No adjuntes la original si tiene personas o patentes reales.**

La persistencia se comprueba en la app: el detalle del reporte muestra la foto guardada. Tiene que verse pixelada igual
que `.protegida.jpg`.

### 3.2 Fail-safe con Vision caído (Q8, Q9)

Mientras dura la prueba, **nadie puede adjuntar fotos**: hacela en un horario sin uso y con aviso al equipo.

1. `supabase secrets unset GOOGLE_VISION_API_KEY --project-ref yryuhyiujyignkdhiyua`
2. **Q8:** enviar un reporte con foto desde staging → captura de la pantalla «No pudimos proteger tu foto» con
   *Reintentar protección* y *Cambiar foto*. En los logs: `evidence_fail_safe` con `reason: vision_not_configured`.
   En Storage, `report-evidences/<client_side_id>/` no tiene archivos nuevos.
3. **Q9:** DevTools → Network → Offline, crear un reporte con foto (queda en Pendientes), volver a Online → sigue en
   Pendientes con el motivo guardado. Captura.
4. Volver a cargar la clave (`supabase secrets set`, como en el paso 1 de la sección 2) y reintentar el pendiente de Q9:
   ahora se envía con la foto pixelada.

### 3.3 Consultas útiles

Logs de la función (Dashboard → Edge Functions → quarantine-anonymize → Logs), buscando `evidence_protected` o
`evidence_fail_safe`. La línea trae el `clientSideId`, el tamaño, las zonas y el tiempo; nunca la foto ni la clave.
