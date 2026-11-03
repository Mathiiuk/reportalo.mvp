# RAG P2 · búsqueda híbrida (REP-3860) · etapa A

Búsqueda híbrida: vectores + texto completo (`knowledge_fragments.fts`) con Reciprocal Rank Fusion, k = 60, top 8.
**Apagada.** Nada de esto cambia staging.

| Pieza | Dónde | Estado |
|---|---|---|
| Función `match_knowledge_fragments_hibrida` | `supabase/migrations/20261103000000_rep3860_busqueda_hibrida.sql` | **Sin aplicar** (Leo, REP-3860: sin migraciones nuevas mientras se compara P1 con P2) |
| Interruptor | `analizar-reporte`: `RAG_BUSQUEDA=hibrida` llama a la función nueva; cualquier otro valor, o ninguno, deja la vectorial | Sin desplegar. Por defecto, igual que hoy |
| Réplica del orden en JS | `lib.mjs` (`ordenHibrido`) | Con tests: `src/test/Rep3860BusquedaHibrida.test.js` |
| Control de 48 casos | `control.mjs`, casos de `../rep-diag-variantes/casos.json` (20 D + 20 R + 8 N) | Parte automática hecha; falta correr el SQL de la función |

## Cómo se corre el control (solo lectura)

1. `node control.mjs --sql-texto > salida/P2_texto.sql`. Correr el `SELECT` en staging y guardar `orden_texto` como
   `salida/P2_texto.json`. Es el CTE `por_texto` de la función, sin vectores.
2. `node control.mjs --runner`. Por caso: vector de la consulta (Gemini, con caché en `salida/`), RPC
   `match_knowledge_fragments` con ventana 100 (el orden vectorial de la base) y la réplica del orden híbrido.
3. `node control.mjs --sql-funcion --desde 0 --hasta 12 > salida/P2_control_funcion_1.sql` (y 12–24, 24–36, 36–48).
   Es el cuerpo de la función con el vector literal de cada caso; **no crea nada**. Se corre en el editor SQL de
   staging (unos 140 KB por parte) y se guarda el resultado como JSON: una lista de `{caso, top}`.
4. `node control.mjs --comparar salida/<resultado>.json`: `IGUAL` o `DISTINTO` por caso, con el detalle.

## Resultado al 03/11/2026 (corpus `628486fc…`, 127 vigentes)

- **Texto completo:** 48/48 casos con su orden; 11 sin ninguna coincidencia (entre ellos «ay un vache enorme en lacalle»,
  que queda igual a la vectorial, como estaba previsto).
- **Candidatos:** en los 48 casos, todo fragmento con coincidencia de texto (calculado con el filtro de la función) está
  entre los candidatos del RPC actual. Prueba un solo sentido; que los dos conjuntos sean iguales lo confirma el SQL de
  la función (paso 3).
- **Empates de distancia:** 0 en los 48. El orden vectorial de la función (distancia y después id) es el del RPC.
- **Cambia el orden del top 8** en 30 de los 48 casos, y en 26 entra al top 8 algún fragmento que con la vectorial quedaba afuera. Esto es solo el orden: si la norma esperada entra o no se mide en M1.
- **Falta:** correr las 4 partes del SQL de la función y `--comparar`. Hasta entonces el control de 48 es parcial: cubre
  candidatos, orden vectorial y orden de texto, pero no la suma RRF hecha en SQL.
- Llamadas a Gemini: 47 vectores de consulta (dos casos comparten texto). El corpus no se revectorizó.

## Volver atrás

Sacar `RAG_BUSQUEDA` (o ponerla en `vectorial`). La función, si llega a aplicarse, puede quedar: nadie la llama.
