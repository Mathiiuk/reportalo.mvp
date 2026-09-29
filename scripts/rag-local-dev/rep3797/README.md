# Pruebas del RAG tras la ampliación del corpus (REP-3797 / REP-3795)

Herramientas para **medir y reproducir** lo que hizo el motor RAG después de cargar el lote 1 y el lote 2
de corpus. Sirven a Hernán (PO) e Iván (QA) para comprobar por su cuenta los resultados del informe
`docs/REP-3797_verificacion-post-corpus_reportes-prueba.md` (§3.7 a §3.16).

> **Regla de oro:** ninguno de estos scripts escribe en la base ni en Storage. Solo leen (una RPC de
> búsqueda y algunos `SELECT`) y llaman a Gemini. Gastan cuota de Gemini, no datos.

## Qué necesitás

| Necesidad | Detalle |
|---|---|
| Node (el mismo de la app) y `npm install` hecho | Ya lo tiene quien corre la app |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta del proyecto (Project Settings → API Keys). **No va en ningún archivo ni en el repo**: cargala solo en la terminal |
| `GEMINI_API_KEY` | Clave de Gemini. Misma regla |
| `SUPABASE_URL` | La toma sola del `.env` (`VITE_SUPABASE_URL`) |

En PowerShell, parado en la raíz del proyecto:

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = "..."
$env:GEMINI_API_KEY = "..."
```

Las variables desaparecen al cerrar la terminal. Nunca pegues las claves en un chat, un ticket ni un commit.

## Los scripts, de menor a mayor costo

| Script | Qué responde | Costo aprox. |
|---|---|---|
| `retrieval-experiment.mjs` | ¿El fragmento correcto **llega** al modelo? Mide en qué puesto entra con distintos `k` y con o sin canales/procedimiento compitiendo | 8 embeddings |
| `context-embedding-experiment.mjs` | ¿Mejora la recuperación si el vector se calcula con `hierarchy_path + contenido`? (calcula en memoria, no guarda nada). Incluye una autocomprobación de la metodología | unas decenas de embeddings |
| `generation-experiment.mjs` | ¿Qué **responde** el sistema de punta a punta (recuperación + Gemini + validación) con cada variante? | 1 embedding por caso (10) + una generación por caso × variante × corrida; con `ctx-k6` suma un embedding por fragmento elegible |
| `../../corpus-loader/embed-pending.mjs` | Genera los vectores que faltan (o `--refresh-all` para recalcular). **Este sí escribe en `fragment_embeddings`**: solo lo corre quien cargue corpus | 1 embedding por fragmento |

### `generation-experiment.mjs`: variantes y filtros

Lee el prompt, el esquema y las constantes **directamente de `supabase/functions/analizar-reporte/index.ts`**
al ejecutarse, así no se desvía de la función real. Variantes disponibles: `k6`, `k8`, `k6-sin-can`,
`ctx-k6` (vectores con encabezado, en memoria), `k8-sin-can` y `k8-excepciones`.

```powershell
node scripts/rag-local-dev/rep3797/generation-experiment.mjs --check   # sin claves ni red: verifica la lectura de index.ts
$env:VARIANT = "k8,k8-sin-can"                                          # correr solo algunas variantes
$env:RUNS = "1"; $env:CASE = "luz-quemada"                              # prueba rápida: 1 corrida, un solo caso
node scripts/rag-local-dev/rep3797/generation-experiment.mjs
Remove-Item Env:VARIANT, Env:RUNS, Env:CASE -ErrorAction SilentlyContinue   # volver al modo normal
```

- Los **10 casos** están definidos en el script, con el fragmento esperado de cada uno (ids verificados contra la base).
  Para agregar un caso, sumá una entrada a `CASES` con su `expected`.
- Reintenta ante caídas transitorias de Google (429, 500, 503) con espera creciente.
- Deja el detalle en `generation-experiment-results.json` (no versionado).

## Cómo leer los resultados

- **"citó un esperado"** significa que alguna cita cae en un fragmento que definimos como correcto para ese caso.
  **No es validación jurídica.**
- Con `temperature 0` el modelo **no es totalmente determinístico**: por eso se repite cada caso 3 veces. Un caso
  que da distinto entre corridas (p. ej. *luz quemada*) es un dato, no un error del script.
- La detección de excepciones en las respuestas es **por palabras clave** (heurística). Revisá a mano la
  muestra de texto que imprime el script.
- Que un fragmento suba en el ranking **no garantiza** una mejor respuesta: el experimento de vectores con encabezado
  mejoraba la recuperación y empeoraba una respuesta. Por eso existe la prueba de generación.

## Si querés probar sin scripts (Iván)

La forma más fiel es **crear reportes de prueba en staging desde la app** (categoría y localidad a mano) y mirar el
resultado en pantalla. Para ver el detalle del análisis desde el SQL Editor (estado, motivo, fragmentos recuperados y
cuáles se citaron), usá la consulta de `docs/REP-3797_para-Hernan_hallazgos-y-decisiones.md` §6.

Casos útiles para probar a mano (texto de ciudadano, con su categoría y localidad):

| Texto | Categoría · localidad | Qué debería pasar |
|---|---|---|
| «Auto mal estacionado» | Tránsito · CABA (Puerto Madero) | `fundamentado`, cita Faltas 6.1.52 |
| «Un vecino se sube con el auto a la vereda todos los días y me tapa la entrada del garage» | Tránsito · Avellaneda | `fundamentado`, cita Ley 24.449 art. 49 b.3 **y menciona la excepción de la vereda ancha (más de 2 m, con señal)** |
| «Están tirando aceite y basura por el desagüe de la vereda» | Ambiente · CABA | `fundamentado`, menciona «a excepción de aguas pluviales o superficiales» |
| «La luz de la calle está quemada hace más de un mes…» | Infraestructura · CABA | **Caso abierto:** hoy da `indeterminado` (ver informe §3.10, §3.16) |

Los reportes de prueba se borran al cerrar la revisión (con confirmación de Matías): ver el informe.
