# RAG P0 · Línea base M1/M2 (REP-3859)

Extiende los runners existentes `rep-diag-variantes` (M1) y `rep-diag-generacion` (M2) con un modo `--p0`, como pide el ticket ("no construir runner nuevo"). Este módulo (`p0/`) tiene solo lo común: el esquema JSON acordado con Iván, las métricas, el validador fiel a producción y el acceso de solo lectura.

## Antes de correr

1. **Set congelado.** Hace falta `casos-referencia-v1.json` de REP-3858, congelado por Iván y aprobado por Hernán. **No se corre la medición definitiva sobre el borrador `v0`** (Leo, 20/10). Para probar el circuito con otro set, usar `--prueba`: la salida queda marcada y no vale para la puerta.
2. **Nada cambia durante P0–P2:** ni corpus, ni prompt, ni búsqueda, ni configuración de staging. Cada corrida guarda la huella del corpus. Si no coincide con la de [`docs/rag/RAG-P0_version-motor.md`](../../../docs/rag/RAG-P0_version-motor.md), la corrida no es comparable.
3. **`.env` de la raíz** con `GEMINI_API_KEY`, `VITE_SUPABASE_URL` (staging) y `SUPABASE_SERVICE_ROLE_KEY`. No se imprimen. El modo P0 **no escribe en la base**: el cliente REST rechaza cualquier escritura.

## Cómo se corre

```bash
# 1) Validar el set y estimar llamadas, sin red ni .env
node scripts/rag-local-dev/rep-diag-variantes/run.mjs  --p0 --set <ruta>/casos-referencia-v1.json --dry-run
node scripts/rag-local-dev/rep-diag-generacion/run.mjs --p0 --set <ruta>/casos-referencia-v1.json --dry-run

# 2) M1 y M2 (3 repeticiones por defecto)
node scripts/rag-local-dev/rep-diag-variantes/run.mjs  --p0 --set <ruta>/casos-referencia-v1.json --despliegue "analizar-reporte v44"
node scripts/rag-local-dev/rep-diag-generacion/run.mjs --p0 --set <ruta>/casos-referencia-v1.json --despliegue "analizar-reporte v44"
```

| Flag | Para qué |
|---|---|
| `--set` | Set de casos (obligatorio) |
| `--repeticiones N` | Por defecto **3** (ticket) |
| `--despliegue "…"` | Versión desplegada de `analizar-reporte`. No se puede leer con la clave de servicio, así que se declara. Hoy: v44 |
| `--dry-run` | Valida el set y estima llamadas. No usa red |
| `--prueba` | Marca la corrida como prueba (`prueba: true` y `_PRUEBA` en el nombre) |
| `--env <ruta>` | Otro `.env` |

## Qué mide cada uno

**M1** (`rep-diag-variantes --p0`): la recuperación de producción tal cual.
- Vectoriza la consulta en cada repetición (sin caché) y llama a `match_knowledge_fragments` con **ventana 100**, misma categoría y localidad.
- `candidatos[]` trae `fragment_id`, `posicion`, `similitud`, `en_top8`, `supera_umbral`, `entregado` (top-k y umbral: lo que le llega al modelo) y `esperado`.
- Por fila: posición de la primera norma esperada, esperados en el top 8 y entregados, y `reciprocal_rank`.
- Resumen: MRR, cobertura en el top 8 y cobertura de entregados.

**M2** (`rep-diag-generacion --p0`): reproduce `analizar-reporte` paso a paso, **sin persistir**.
- `VULNERABILIDAD_SOCIAL` termina en `asistencia` sin llamar al modelo.
- Si ningún fragmento supera el umbral, termina en `sin_normativa` sin modelo.
- Si hay fragmentos, genera con el prompt, el esquema y la configuración **leídos del fuente** y valida con la réplica fiel de `validateLlmAnalysis` + `validateOrganismoSugerido`.
- Por fila: `estado` (el final, el que guardaría producción), `estado_modelo`, `citas[]` (`fragment_id`, `articulo`, `pasa_validador`, `esperada_n1`), `citas_verificadas`, `citas_excluidas`, `rechazo_validador`, `motivo`, `cita_esperada_n1`, `input_tokens`, `output_tokens` (candidatos + razonamiento, como producción) y `latencia_ms`.

**Común a los dos** (esquema `rag-p0/v1`):
- Un archivo por corrida: `salida/RAG-P0_M1_<fecha>.json` y `salida/RAG-P0_M2_<fecha>.json`.
- Encabezado `motor`: commit del código, despliegue, prompt, modelos, top-k, umbral, temperatura y huella del corpus. También `set_version` y `inicio_utc`.
- `resultados[]` con una fila por caso y repetición, cada una con `caso_id`, `repeticion`, `fecha_utc` y `pendiente_po`.
- El resumen trae `todos` y `computables`. **`computables` excluye los `pendiente_po`**, que se miden pero no cuentan para la puerta (Leo, 20/10).

## Formato del set

Se aceptan los campos del borrador `v0` de Iván:
- **Por caso:** `id`, `descripcion`, `categoria`, y la localidad como `localidad_id`, o como `localidad` (nombre) + `provincia`.
- **Normas esperadas:** `n1`/`n2`, como lista de ids de fragmento o de objetos `{ fragment_id }`.
- **Opcionales:** `zona`, `universo` y `pendiente_po`.
- **En la raíz:** `set_version`.

Si falta algo, el runner se corta y lista los errores antes de llamar a nada. Si la v1 cambia los nombres, se ajusta `normalizarSet`.

## Costo

Con 3 repeticiones, M1 hace casos × 3 vectorizaciones. M2 hace hasta (casos fuera de vulnerabilidad social) × 3 generaciones con `gemini-3.8-flash`; los casos sin fragmentos sobre el umbral no llaman al modelo. `--dry-run` imprime la cuenta exacta.
