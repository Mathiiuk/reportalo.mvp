# REP-3795 → para corroborar (Hernán, Iván): paráfrasis del ciudadano y visibilidad de sanciones en CABA

**Pedido de Matías (28/09/2026):** verificar si lo que se ve en pantalla para los 6 reportes
de prueba de REP-3795 es correcto, hasta que Hernán mejore el corpus/RLM de CABA (REP-3797).
Este documento junta la evidencia real de la base para que Hernán e Iván lo corroboren de
forma independiente — no es una decisión tomada, es la evidencia para que la tomen ustedes.

Reportes de prueba: `citizen_reports` con `user_id` `a9420d51-aa36-4090-8d98-64f3e1538d0a`,
descripción con prefijo `[TEST REP-3795]`, creados el 28/09/2026 contra la copia
`analizar-reporte-rep3795` (ya borrada) con el código de la rama
`fix/REP-3795-inconsistencias-rag-textual`.

## Pregunta 1 · "Las respuestas parecen escritas por Gemini, no por el RAG"

**Lo que se observó:** el texto que ve el ciudadano (`citizen_feedback`) no es el texto legal
pegado tal cual, es una reescritura en lenguaje llano.

**Verificación contra la base real:**

| Reporte | `citizen_feedback` (lo que ve el ciudadano) | `cita_textual` guardada | ¿Aparece literal en el fragmento? |
|---|---|---|---|
| T-4 (control, Avellaneda) | "No está permitido estacionar un vehículo en medio de la calle, ya que la ley prohíbe obstaculizar la calzada o estacionar afectando la fluidez y seguridad del tránsito." | "Estorbar u obstaculizar de cualquier forma la calzada" | ✅ — texto exacto del art. 48 inc. t), Ley 24.449 |
| T-1/T-2/T-3 (CABA) | "El vehículo se encuentra estacionado de manera indebida..." (variantes similares) | "estacione o se detenga en un lugar prohibido o en forma antirreglamentaria" | ✅ — texto exacto del art. 6.1.52, Ley 451 CABA |

**Por qué pasa esto — es diseño original, no algo de REP-3795:** `fundamento_ciudadano`
siempre es una paráfrasis generada por el LLM (`docs/REP-1009_RAG_de_punta_a_punta.docx`,
instrucción explícita en `generateJustification`: *"fundamento_ciudadano tiene que ser
llano"*). Lo que garantiza que no sea una invención es un control aparte, determinístico y
server-side (`validateLlmAnalysis` en `analizar-reporte/index.ts`): cada `cita_textual` tiene
que ser un substring literal del `content` del fragmento recuperado — si no calza exacto, la
respuesta entera cae a `indeterminado` antes de guardarse. Se confirmó a mano contra
`knowledge_fragments` que las 4 citas usadas en los 6 reportes de prueba son literales.

**Para corroborar:** ¿este comportamiento (paráfrasis + cita literal validada aparte) es el
esperado, o el criterio del equipo cambió desde REP-1009?

## Pregunta 2 · "En algunos reportes se ve la ley citada y en otros no"

**Verificación contra la base real:**

| Reporte | Zona | Fragmento citado | `foundation_type_code` | ¿Se ve la norma en pantalla? |
|---|---|---|---|---|
| T-1, T-2, T-3 | CABA | Ley 451 art. 6.1.52 | **`sancion`** | ❌ No |
| T-4 (control) | Avellaneda | Ley 24.449 arts. 48/49 | `conducta_prohibida` | ✅ Sí |

`ReportAiAnalysisPanel.jsx` filtra explícitamente los fragmentos con
`foundation_type_code === 'sancion'` antes de mostrarlos (`citedEvidence`, línea ~130) — es
la regla CA-03 de REP-3789: nunca mostrarle una sanción/multa al ciudadano. En CABA, para
tránsito, las únicas normas cargadas que cubren "mal estacionado" en general son de tipo
sanción (Ley 451); las prohibiciones puras (Ley 2148) solo cubren doble fila y rampas
específicamente. Por eso el fundamento existe y está bien citado, pero la pantalla no
muestra ninguna norma — el vecino ve el texto llano sin la referencia.

**Esto es exactamente el Punto 2 del diagnóstico original**
(`docs/sprint14/RAG_diagnostico_puntos_rotos.docx`), ya asignado a **REP-3796** (Matías,
necesita que Hernán decida como PO si se puede mostrar el nombre del artículo de sanción sin
el monto). No es un defecto nuevo de REP-3795 ni algo que este ticket deba resolver.

**Para corroborar:**
1. ¿Confirman que el comportamiento de arriba es el esperado hasta que se resuelva REP-3796?
2. Hernán, como dueño del corpus: ¿la falta de prohibiciones puras para "mal estacionado"
   general en CABA (solo hay sanción, Ley 451) es parte de lo que cubre REP-3797?

## Evidencia cruda (para auditar sin confiar en este resumen)

```sql
select a.report_id, a.result_status_code, a.citizen_feedback, a.official_legal_foundation,
       e.fragment_id, e.quoted_text, kf.hierarchy_path, kf.foundation_type_code
from report_ai_analysis a
join report_ai_evidence e on e.analysis_id = a.id and e.was_cited = true
join knowledge_fragments kf on kf.id = e.fragment_id
where a.report_id in (
  'eb8e82af-19db-488d-b4d1-308862703daa', -- T-1
  '558f59b4-7f93-4448-92ea-9ad1ce2c9401', -- T-2
  '549dc328-2eb6-4851-a48e-5b719410edce', -- T-3
  '4cd77edf-bc66-40a7-8fe2-f2a52a99fff2'  -- T-4 (control)
);
```

Reportes visibles en la app en `/reportes/<id>` (misma cuenta que las pruebas manuales de
REP-3793): ver `.agents/workflow/executions/REP-3795-run-001.md` §4.2 para la tabla completa
de IDs y qué debería mostrar cada uno.
