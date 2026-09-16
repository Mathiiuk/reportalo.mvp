# Reportalo

*Plataforma de Auditoría Ciudadana*

## P-01 (REP-2908-VERIF ronda 4) — 37 corridas post-filtro por categoría

**15 de septiembre de 2026 · Proyecto RAR-2026**

**Responde a:** `REP-2908-VERIF_ronda4_hernan.md`, punto P-01.

**Contexto importante antes de leer los resultados.** El fix de V-09 (filtro por categoría vía `fragment_services`, migración `20260915140000_v09_match_knowledge_fragments_filter_by_category.sql`) existía en git desde el 15/09 a las 11:21, pero había quedado en una rama (`fix/REP-2908-VERIF-devolucion-rag-verificacion-y-remediacion-de-seguridad-v-01-a-v-13`) que nunca se mergeó a `staging` ni a la rama de trabajo actual (`fix/REP-2908-VERIF-v03-security-hardening`). Se hizo `git cherry-pick` de ese commit a la rama actual antes de correr estas pruebas. **El fix ya estaba aplicado en Supabase real** (migraciones `20260915140206`/`20260915142017`/`20260915142037` en el historial remoto), así que las 37 corridas de abajo sí corrieron contra el código con el filtro activo — el cherry-pick solo resuelve que el repo local/la rama de trabajo lo reflejen.

**Método.** Las 37 corridas llamaron a la Edge Function `analizar-reporte` desplegada en Supabase real (proyecto CiudadAR), con Gemini real (embeddings + generación), sin persistir en la base (se omitió `reportId` a propósito). Script: `scripts/rag-local-dev/run-p01-post-filtro.mjs`. Resultado crudo: `scripts/rag-local-dev/p01-post-filtro-resultados.json`.

---

## Resumen de aciertos por caso

| Caso | Jurisdicción | Categoría | Corridas | Resultado |
|---|---|---|---|---|
| A | Avellaneda | INFRAESTRUCTURA | 5 | 4/5 `fundamentado` (cita Const.PBA 192.4 + LOM 52/59, correcto); 1/5 `indeterminado` porque la validación de citas literales bloqueó una cita no literal del LLM (la salvaguarda funcionó — no llegó ninguna cita inválida) |
| B | CABA | TRANSITO | 5 | 5/5 `fundamentado`, cita solo Ley 2148 / Ley 451 (CABA). **Nunca** recuperó Ley 24.449 ✅ |
| C (control negativo) | Avellaneda | TRANSITO | 5 | 5/5 `fundamentado`, cita solo Ley 24.449 art. 49. **Nunca** recuperó normas de CABA ✅ |
| D-Av | Avellaneda | INFRAESTRUCTURA | 5 | 5/5 `fundamentado`, cita LOM art. 52/59, correcto |
| D-CABA | CABA | INFRAESTRUCTURA | 5 | 3/5 `fundamentado` + 2/5 `asistencia` (estado distinto, no es un error), todas citan Ley 210 CABA. **Nunca** recuperó Ley 24.449 ✅ |
| E | Avellaneda | TRANSITO | 5 | 5/5 `fundamentado`, cita Ley 24.449 art. 48 incisos i) y t) — **correcto**: el fragmento del inciso t) es un chunk compuesto ("obstaculizar la calzada... y venta de productos en el camino") y el LLM citó únicamente la cláusula de obstrucción, no la de venta |
| F | Avellaneda | COMERCIO_IRREGULAR | 5 | 5/5 `sin_normativa`, 0 fragmentos recuperados (no hay corpus para esa categoría). Correcto — sin llamar al LLM |
| Prueba 1 | CABA | INFRAESTRUCTURA (mal elegida) | 1 | `sin_normativa` — recuperó 2 fragmentos de Ley 210 (INFRAESTRUCTURA/CABA) pero 0 citados, sin inventar nada. Correcto, documenta el límite del filtro tal como esperaba Hernán |
| **Prueba 2** | Avellaneda | TRANSITO (mal elegida) | 1 | 🔴 **`fundamentado`, citó el art. 48 inc. t) de la Ley 24.449** ("instalarse o realizar venta de productos en zona alguna del camino") para "venta de bebidas en la vereda sin habilitación" — **reproduce exactamente el bug original del Caso F** |

---

## Verificación contra los 4 criterios de cierre de Hernán

1. **(Excluyente) Ninguna cita fuera de lo recuperado ni ninguna cita no literal en el resultado entregado.** ✅ Cumple en el sentido estricto: la única cita no literal que intentó el LLM (Caso A, corrida 2) fue bloqueada por `validateLlmAnalysis` y convertida en `indeterminado` — nunca llegó al resultado final. Pero ⚠️ ver el punto 4.
2. **C nunca recupera normas de CABA.** ✅ Cumple — los 4 fragmentos recuperados en las 5 corridas fueron siempre de Ley 24.449 (nacional).
3. **B y D-CABA nunca recuperan la Ley 24.449.** ✅ Cumple — B recuperó siempre Ley 2148/451 (CABA); D-CABA siempre Ley 210 (CABA).
4. **La prueba 2 no cita el art. 48 inc. t).** ❌ **NO cumple.** Citó el art. 48 inc. t) completo, específicamente la cláusula de venta de productos, para un caso de comercio irregular con categoría mal elegida. Reproducido 2 de 2 veces (corrida del set + una repetición manual de verificación).

**Conclusión: P-01 no puede cerrarse.** El criterio 4 es explícito y falló. El filtro por categoría (V-09) resuelve el caso en el que la categoría **correcta** no tiene corpus (Caso F, Prueba 1), pero no resuelve el caso en el que el ciudadano **elige mal la categoría** y esa categoría equivocada sí tiene un fragmento que, leído aisladamente, calza léxicamente. Esto es exactamente la advertencia que Hernán hace en la Sección 2 del documento de ronda 4 ("que una cita sea literal no garantiza que sea correcta") — y confirma que el ticket aparte que él propone (búsqueda sin filtro solo para *sugerir* categoría, nunca para citar) no alcanza para resolver esto: acá el problema no es que falte una sugerencia de categoría alternativa, es que el filtro por la categoría *elegida* (aunque esté mal) sigue permitiendo citar.

## Evidencia textual de la Prueba 2

```json
{
  "estado": "fundamentado",
  "es_infraccion": true,
  "fundamento_oficial": "Conforme al artículo 48 inciso t) de la Ley N° 24.449, se encuentra expresamente prohibido en la vía pública instalarse o realizar venta de productos en zona alguna del camino.",
  "citas": [{
    "fragment_id": "20000000-0000-4000-8000-000000000008",
    "cita_textual": "instalarse o realizar venta de productos en zona alguna del camino;"
  }]
}
```

Contenido real del fragmento (`fragment_id` `...008`, `Ley 24.449 art. 48 inciso t)`):
> "Está prohibido en la vía pública: t) Estorbar u obstaculizar de cualquier forma la calzada o la banquina y hacer construcciones, instalarse o realizar venta de productos en zona alguna del camino;"

## Propuesta para destrabar P-01 (a confirmar con Hernán)

El inciso t) es un chunk compuesto que mezcla dos conductas distintas ("obstaculizar la calzada" y "venta de productos en el camino") bajo un mismo `fragment_id`. Partirlo en dos fragmentos separados en `knowledge_fragments` permitiría, a futuro, dejar de asociar la cláusula de venta a la categoría TRANSITO en `fragment_services` (ya que "camino" en Ley 24.449 es vía rural, no vereda urbana — art. 5 inc. i) — sin tocar la cláusula de obstrucción que sí es correcta para el Caso E. Esto requiere el OK de Hernán como dueño del corpus legal (regla 2 de la Sección 2).

---

## Addendum — re-corrida ronda 5 (16 de septiembre, R5-08)

**Método.** 37 corridas nuevas contra `analizar-reporte` real en CiudadAR (sin `reportId`, sin persistir), reemplazando el Caso F por **E-sin-categoría** (`p_service_code = null`) como pide `REP-2908-VERIF_ronda5_hernan.md` R5-08 — el Código de Faltas no tiene categoría, así que Caso F ya no prueba nada sobre él una vez que existe el filtro.

| Caso | Corridas | Resultado |
|---|---|---|
| A, B, C, D-Av, D-CABA, E | 5 c/u | Mismo patrón que la corrida del 15/09: siempre `fundamentado`/`asistencia`, citas literales, sin cruce de jurisdicción (C nunca CABA; B y D-CABA nunca Ley 24.449) |
| **E-sin-categoría** (nuevo) | 5 | 5/5 `fundamentado`, cita solo Ley 24.449 art. 48 inc. t) (cláusula de obstrucción). **Nunca citó el Código de Faltas (Ley 451)** ✅ |
| Prueba 1 | 1 | `sin_normativa`, 0 citas — igual que el 15/09 ✅ |
| Prueba 2 | 1 | 🔴 **Se repite el mismo fallo**: cita el art. 48 inc. t) completo ("...instalarse o realizar venta de productos en zona alguna del camino") para "venta ambulante sin habilitación" con categoría TRANSITO mal elegida |

**Conclusión: el hallazgo del 15/09 no era un caso aislado — es reproducible 2/2 en dos corridas separadas, un día distinto.** El criterio excluyente de cierre de R5-08 sigue sin cumplirse por el mismo motivo: el inciso t) de la Ley 24.449 art. 48 mezcla dos conductas ("obstaculizar la calzada" y "venta de productos en el camino") en un solo `fragment_id`, y `fragment_services` lo tiene tageado a TRANSITO — cualquier reclamo mal categorizado como TRANSITO que hable de venta ambulante puede recuperarlo y citarlo válidamente (la cita es literal, el fragmento fue recuperado; `validateLlmAnalysis` no tiene forma de distinguir que la cláusula citada no es la que decidió el `estado`).

**No toqué el corpus.** Partir el fragmento en dos (obstrucción / venta) es un cambio de contenido jurídico, no de código — corresponde a Hernán como dueño del corpus (regla 2). Con eso resuelto, recién se puede volver a correr P-01 completo y cerrar REP-2908/REP-3772/REP-2900.

Resultado crudo de esta corrida: `scripts/rag-local-dev/p01-r5-resultados.ndjson` (no versionado, corrida directa vía `curl` contra la Edge Function con la clave `anon`).

---

## Cierre — decisión de Hernán aplicada (16/09, misma tarde)

**Hernán, en el comentario de REP-2908**: *"Mati, yo sacaria la clausula venta de transito"*.

**Aplicado** (migraciones `20260916040000_r5_08_split_ley24449_art48_t_venta_de_transito.sql` y `20260916040100_r5_08_split_fragment_embeddings.sql`, ya en CiudadAR):
- El fragmento `...008` (Ley 24.449 art. 48 inc. t)) queda solo con la cláusula de obstrucción de calzada. Sigue tageado a TRANSITO.
- Se creó un fragmento nuevo (`b6717f77-c30e-4cca-985a-6346d741fe38`) con la cláusula de venta de productos, **sin tagear a ninguna categoría** — no hay corpus de COMERCIO_IRREGULAR hoy.
- Embeddings reales regenerados para ambos con `gemini-embedding-2@768`.

**Verificación funcional** (embeddings reales de las mismas consultas de Prueba 2 y Caso E, `match_knowledge_fragments` llamado directo por SQL — no vía la Edge Function, que ya exige el token de despacho de R5-05):
- **Prueba 2** ("venta ambulante", categoría TRANSITO mal elegida): el fragmento de venta **ya no aparece** entre los recuperados — solo fragmentos de obstrucción/estacionamiento (Ley 24.449 arts. 48-i, 49). Corregido.
- **Caso E** ("discuten y frenan el tránsito", TRANSITO): sigue recuperando `...008` (cláusula de obstrucción) como primer resultado, similitud 0.92. Sin regresión.

**Incidente durante la aplicación (detectado y corregido en el momento):** la primera versión de la migración reusó un id ya existente (`20000000-0000-4000-8000-000000000015`, el índice del Código de Faltas de la Provincia de Buenos Aires) para el fragmento nuevo. El `insert` no entró por el conflicto de PK, pero el `upsert` de `fragment_embeddings` sí sobrescribió el embedding real de ese fragmento. Se detectó en la verificación posterior a la aplicación (antes de dar el hallazgo por cerrado), se restauró el embedding real de `...015` a partir de su contenido real, y el fragmento de venta se recreó con un UUID generado que no colisiona. Ver la nota completa en la cabecera de `20260916040000_r5_08_split_ley24449_art48_t_venta_de_transito.sql`.

**R5-08 queda cerrado**, sujeto a volver a correr las 35 corridas de A-E/E-sin-categoría completas contra la función real (con el token de despacho) como confirmación final antes de mover REP-2908/REP-3772/REP-2900 a Finalizada — la verificación de arriba es a nivel de recuperación (RPC), no repite el ciclo completo LLM + validación determinística de punta a punta.
