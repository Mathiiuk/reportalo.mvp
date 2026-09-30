# Reportalo

*Plataforma de Auditoría Ciudadana*

## PROPUESTA · GENERACIÓN HÍBRIDA (PLANTILLA DETERMINÍSTICA + LLM) PARA EL RAG TEXTUAL

**Versión 1.0 · 28 de septiembre de 2026 · Sprint 14 · Proyecto RAR-2026**

**Autor:** Claude (asistente de Matías Krepchuk), a pedido de Matías — para llevar a planning
**Referencias:** REP-1009 (diseño original del RAG), REP-2908/REP-2908-VERIF (implementación y
hardening), REP-3778/REP-3786 (experimento de optimización de costo), REP-3790 (spike imagen →
hechos → RAG), REP-3795 (este ticket, evidencia real del 28/09), REP-3796 (visibilidad de
sanciones), REP-3799 (medición de costo)

> **Propósito.** Evaluar si conviene reemplazar, para un subconjunto acotado de casos, la
> redacción del fundamento (hoy siempre a cargo de Gemini) por una plantilla determinística
> armada a partir del fragmento recuperado. **No es una decisión tomada — es una propuesta
> para que el equipo la evalúe en planning**, con el mismo criterio que se usó para
> REP-3786 (protocolo pre-registrado antes de tocar producción).

---

## 1. Por qué surge esto

Durante las pruebas reales de REP-3795 (28/09/2026, evidencia completa en
`.agents/workflow/executions/REP-3795-run-001.md` §4 y
`docs/REP-3795_verificacion-paraphrasis-y-visibilidad-sanciones.md`) se confirmó algo que ya
insinuaba REP-3786: con `temperature: 0`, la redacción de Gemini es **mucho más consistente
pero no 100% determinística**. Un caso de control con 3 citas (Avellaneda, Ley 24.449) dio el
mismo `estado` en 3 corridas, pero varió una de las citas elegidas entre corridas. Matías
preguntó si conviene sacar a Gemini de la redacción para que la respuesta salga
**exclusivamente** del RAG (corpus propio, sin generación libre), y de paso bajar costo.

**Aclaración importante primero:** hoy Gemini **ya no tiene acceso a internet** en el paso de
generación — no hay herramienta de búsqueda web activada, solo ve el prompt con los
fragmentos que el RAG ya recuperó. La garantía de "nada de internet" ya existe. Lo que esta
propuesta evalúa es si conviene que Gemini **redacte** el texto, o si una plantilla alcanza.

## 2. Qué se propone

Un enrutamiento en dos caminos según lo que devuelva la recuperación (`match_knowledge_fragments`,
sin tocar el filtro por categoría de V-09 ni el top-k/umbral que REP-3786 ya validó mantener):

| Camino | Cuándo se usa | Cómo redacta | Costo de generación |
|---|---|---|---|
| **A · Plantilla determinística** | Un solo fragmento elegible, similitud alta (a definir el corte exacto, ej. > 0.70), sin ambigüedad de categoría | Oración fija que arma `hierarchy_path` + `cita_textual` literal del fragmento, sin LLM | Cero |
| **B · LLM (actual)** | Varios fragmentos elegibles, o similitud límite, o el caso requiere juicio (¿aplica esto al hecho descrito o no?) | `generateJustification`, `temperature: 0`, regla de precisión de REP-3795 | El de hoy |

La validación determinística de citas (`validateLlmAnalysis`) se mantiene sin cambios para
los dos caminos: toda cita, venga de plantilla o de LLM, se verifica como substring literal
del fragmento antes de aceptarse. Se agrega un campo de trazabilidad (`generation_path:
'template' | 'llm'`) a `report_ai_analysis` para poder medir cada camino por separado.

## 3. Ventajas

- **Costo:** desaparece la llamada a `generateContent` para el Camino A — se conecta directo
  con REP-3799 (medir costo de Gemini por reporte).
- **Determinismo total en el Camino A:** mismo fragmento → mismo texto, siempre. Resuelve de
  raíz lo que `temperature: 0` solo mejora.
- **Auditable de una vez:** Hernán revisa la plantilla una sola vez por tipo de fragmento, no
  tiene que confiar en que el LLM la redacte igual cada vez.
- **Latencia:** sin la llamada de generación, el Camino A responde bastante más rápido (hoy
  la generación sola tarda varios segundos).

## 4. Desventajas y riesgos

- **Pierde la síntesis de varios fragmentos** (Camino B sigue existiendo para esto, pero hay
  que definir bien el umbral que separa A de B — un umbral mal puesto manda a plantilla casos
  que en realidad necesitaban combinar normas).
- **Pierde el juicio de "¿esto aplica de verdad?" en el Camino A.** El Punto 5 de REP-3795
  (no exigir más precisión de la que pide la norma) es exactamente el tipo de juicio que hoy
  hace el LLM. Una plantilla activada solo por similitud alta puede reproducir el bug "Caso
  F" (matchear por similitud léxica sin que el hecho realmente encaje) si el corte de
  similitud no es lo bastante conservador — **hay que validarlo con evidencia real antes de
  activarlo**, mismo protocolo que REP-3786.
- **Costo de autoría no desaparece, se traslada:** alguien (Hernán) tiene que escribir/revisar
  la plantilla por cada `foundation_type_code`/patrón de fragmento, y mantenerla si el corpus
  cambia — comparable al esfuerzo de REP-3797.
- **Menos natural para el vecino** en el Camino A: una oración fija suena más robótica que una
  redactada a medida.
- **No resuelve REP-3796 por sí sola:** si el fragmento es de tipo `sancion`, la pantalla lo
  sigue ocultando pase lo que pase con quién lo redactó.

## 5. Dónde encaja la imagen (REP-3790)

El pedido de Matías incluye que la consulta combine texto del ciudadano + hechos observables
extraídos de la foto. REP-3790 (spike, cerrado con recomendación "Reformular") ya probó que
esto es viable técnicamente (normativa correcta 94%, latencia 2.03× contra un umbral de <2×,
explicada solo por la etapa de extracción) pero **no está conectado a `analizar-reporte`
todavía**. Esta propuesta no depende de REP-3790 para el Camino A/B en sí, pero si se decide
avanzar con la imagen como contexto, hay que sumarla al paso 3 (armado del texto de consulta)
antes de vectorizar, para ambos caminos por igual.

## 6. Qué se necesita antes de implementar (protocolo, no una opinión)

1. **Definir el corte de similitud** que separa Camino A de Camino B, con evidencia real
   (no una cifra a ojo) — mismo tipo de protocolo pre-registrado que usó REP-3786.
2. **Hernán** redacta/revisa al menos las plantillas para los `foundation_type_code` con más
   volumen (`conducta_prohibida` de Tránsito, que es donde hoy se concentran los casos con
   fundamento).
3. **Corrida comparativa** (estilo REP-3786, no en producción): mismos casos, Camino A vs
   Camino B vs baseline actual, midiendo precisión, costo y latencia antes de decidir.
4. **PM/PO:** decidir si esto entra en el Sprint 14 (junto con REP-3796/REP-3797/REP-3799,
   que ya lo tocan indirectamente) o se reparte al Sprint 15 — el mismo tipo de decisión que
   ya pide REP-3795 para el resto del plan.

## 7. Recomendación

Vale la pena evaluarlo **acotado al Camino A** (un solo fragmento, similitud alta, sin
ambigüedad) — es el caso donde hoy el LLM aporta menos juicio real y donde el costo/latencia
se sienten más. No reemplazar el Camino B (LLM) para casos con varios fragmentos o
ambigüedad: ahí el juicio del modelo sigue siendo necesario y reemplazarlo por reglas fijas
es un desarrollo de por sí grande, con riesgo real de reproducir bugs ya resueltos (Caso F).

Es una decisión de arquitectura con impacto en costo, mantenimiento legal y calidad de
respuesta — se lleva a planning para que el equipo la evalúe, no se implementa por cuenta
propia.
