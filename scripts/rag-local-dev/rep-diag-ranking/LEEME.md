# Diagnóstico de ranking de recuperación del RAG

Muestra, para cada caso de `casos.json`, **todos** los candidatos que devuelve la búsqueda (no solo los que pasan el
umbral), con su similitud, y marca cuáles habrían llegado a Gemini en producción. Sirve para D2, D3, D4 y D5 de la guía
técnica del Sprint 15 (`docs/Propuestas_tecnicas_Mati_RAG_Sprint15.md`, paso 4).

Es de **solo lectura**: vectoriza la consulta con Gemini y llama al RPC `match_knowledge_fragments`. No genera texto,
no escribe en la base y no imprime claves.

## Antes de correrlo
En el `.env` de la raíz (ya ignorado por git) tienen que estar:

| Variable | Para qué |
|---|---|
| `GEMINI_API_KEY` | vectorizar las frases de prueba |
| `VITE_SUPABASE_URL` | proyecto al que se consulta: **tiene que ser staging** (el script imprime el host) |
| `SUPABASE_SERVICE_ROLE_KEY` | el RPC está restringido a `service_role`; agregarla solo en tu máquina, nunca commitearla. Se obtiene en Dashboard → Project Settings → API Keys (`service_role` legacy o una *secret key* `sb_secret_…`) |

## Correrlo
```bash
node scripts/rag-local-dev/rep-diag-ranking/run.mjs
node scripts/rag-local-dev/rep-diag-ranking/run.mjs --solo D5-CABA-1 --ventana 30
```
Genera `salida/ranking-<fecha>.md` y `.json` (carpeta no versionada).

## Cómo leer el resultado
- **Top-k y umbral** se leen de `supabase/functions/analizar-reporte/index.ts`, así que siempre reflejan lo desplegado en el repo.
- Columna *Umbral* = ¿supera el corte de similitud?; columna *Top-k* = ¿entra entre los primeros N? Llega al modelo solo si cumple las dos.
- Un artículo "justo debajo del corte" → ensayar el umbral. "Sobre el corte pero fuera del top-k" → ensayar el top-k. "Muy abajo" →
  mirar vocabulario, contenido del chunk o filtros antes de tocar parámetros (guía §7.2).
- Si un caso devuelve pocos candidatos, el filtro de categoría/jurisdicción ya los recortó: es dato, no error.

## Límites
- Los textos de `casos.json` son **exploratorios**; no son los reportes originales de Hernán. Cuando los tenga, reemplazarlos o sumarlos.
- `esperado` (texto que debe figurar en la ruta del fragmento) está vacío donde todavía no se acordó con Hernán qué artículo es aceptable.
- Mide la recuperación, no la pertinencia jurídica ni lo que hace Gemini con los fragmentos.
