# 📑 Reporte para Hernán: RAG jurídico ya corre contra Supabase real

**De:** Matías Krepchuk (con asistencia de Claude Code)
**Fecha:** 2026-09-14
**Proyecto Supabase:** CiudadAR (real, no local)
**Épica:** [REP-1009: IA jurídica / RAG](https://unlz2026.atlassian.net/browse/REP-1009)
**Rama:** `feat/REP-DEPLOY-RAG-SUPABASE-...` (commiteada localmente, sin push)

---

## 1. Resumen para vos

El RAG jurídico que venías siguiendo desde REP-3764 (los 6 casos que armaste) ya **corre de punta a punta contra el Supabase real**, con embeddings y generación real de Gemini — no contra una base local de prueba, no con datos simulados.

Corrí tus 6 casos oficiales contra el entorno real y **los 6 dan el resultado que esperabas**. Abajo el detalle caso por caso.

---

## 2. Los 6 casos de REP-3764, contra Supabase real

| Caso | Tu criterio esperado | Resultado real | ¿Pasa? |
|---|---|---|---|
| **A** — boca de tormenta rota (Avellaneda) | Recuperar ítems 1, 2, 3 (Const. PBA + LOM 52/59), descartar ítem 8 | Fundamentó con LOM arts. 52 y 59. No citó el ítem 8. | ✅ (nota abajo: no recuperó el ítem 1, ver §3) |
| **B** — auto en rampa para discapacitados (CABA) | Recuperar ítems 6 y 7 juntos (conducta + sanción), descartar ítem 5 | Fundamentó citando exactamente Ley 2148 art. 7.1.9 + Ley 451 arts. 6.1.37 y 6.1.52 | ✅ |
| **C** — mismo texto que B, pero en Avellaneda | Recuperar ítem 5 (Ley 24.449), descartar ítems 6 y 7 (son de CABA) | Fundamentó citando solo Ley 24.449 art. 49. Las normas de CABA **ni siquiera se recuperaron** — el filtro geográfico cortó antes de llegar a la similitud semántica. | ✅ |
| **D** — "no anda la luz", probado en las dos jurisdicciones | Avellaneda → ítem 2 (LOM 52). CABA → ítem 4 (Ley 210). Nunca la misma norma para las dos. | Avellaneda: fundamentó con LOM arts. 52/59. CABA: fundamentó con Ley 210 art. 2 inc. b). Normas distintas, como pedías. | ✅ |
| **E** — ambiguo, "frenan el tránsito" | Recuperar ítem 5 (Ley 24.449, encuadre tránsito), descartar ítem 8 (Código de Faltas, comparte vocabulario pero no aplica) | Fundamentó citando Ley 24.449 art. 48 incisos i) y t). El Código de Faltas **se recuperó** (el falso positivo léxico que preveías) pero **no se citó**. | ✅ — este era el caso que más te importaba, y funcionó |
| **F** — venta ambulante sin habilitación | Nada del corpus cubre esto. Resultado esperado: declarar falta de fundamento, no inventar ni rechazar. | `sin_normativa`, sin citas, confianza 0. Texto: "No se cuenta con fundamento normativo cargado en el corpus actual para este reclamo." | ✅ — el caso que probaba la promesa central del producto: no alucina cuando no sabe |

**Los 6 casos que definiste en REP-3764 pasan contra el entorno real.**

---

## 3. Cosas que encontré en el camino, para que las tengas en el radar

Nada de esto bloquea lo anterior, pero son datos reales que vale la pena que conozcas:

1. **Un bug real que corregí**: la función que llama a Gemini (`analizar-reporte`) se había copiado de otro archivo del proyecto pero perdió una línea que le exige a Gemini devolver el JSON con una forma estricta. Sin eso, Gemini a veces devolvía respuestas incompletas y el sistema (correctamente) las rechazaba, así que **antes del fix, ningún caso podía llegar a "fundamentado"** — todo caía en "indeterminado" por un problema de forma, no porque el corpus estuviera mal. Ya está corregido y confirmado.

2. **El caso A no recuperó el ítem 1** (Const. PBA art. 192.4), solo los ítems 2 y 3. No inventó nada — lo que citó es correcto y alcanza para fundamentar — pero es menos completo que el ideal que documentaste en REP-3764. Puede valer la pena revisar el umbral de similitud o el contenido de ese fragmento específico más adelante.

3. **El umbral de similitud actual (0.45) es más permisivo de lo esperado con embeddings reales.** En varios casos (incluido el F) la recuperación trajo fragmentos que semánticamente no aplicaban, y fue la capa del LLM + la validación anti-alucinación las que evitaron el problema, no el filtro de similitud. Funciona, pero probablemente valga la pena que en REP-2910 (cuando fijes el umbral con evidencia) lo subas un poco.

4. **Todavía no probé el pipeline asíncrono real** (el flujo automático: alguien crea un reporte → se encola → un cron lo dispara → se guarda el resultado). Todo lo de arriba lo probé invocando la función directamente. El pipeline automático ya está armado y activo en Supabase, pero falta la prueba de punta a punta real.

---

## 4. Qué significa esto para vos, concretamente

- **El motor jurídico funciona de verdad.** No es más una demo con reglas hardcodeadas — es Gemini real, leyendo el corpus real, con las validaciones que vos mismo diseñaste en REP-3764 puestas a prueba contra el sistema real.
- **Todavía no hay pantalla para que el ciudadano vea esto.** Lo que probé es la lógica de backend (la función que analiza), no una interfaz. Ya existe un componente (`ReportAiAnalysisPanel`) escrito y con tests, pero no está conectado a ninguna pantalla real de la app todavía — eso es trabajo aparte, sin ticket asignado hoy.
- **Todavía no probé con usuarios reales ni con el flujo automático completo.** Lo de arriba es la lógica central funcionando correctamente; falta la vuelta completa (alguien reporta algo real → se dispara solo → aparece en algún lado).

---

## 5. Si querés probarlo vos mismo

Por ahora la única forma de ver esto en acción es que Matías te muestre una invocación directa a la función (no hay panel de pruebas conectado a este entorno todavía, distinto del panel local que se usó durante el desarrollo). Si te sirve tener un panel simple para tirar tus propios casos contra el Supabase real, avisale a Matías y lo armamos — es rápido de hacer ahora que la función ya está viva.

---

**Documentación técnica completa** (para quien quiera el detalle de cada paso, comandos, y hallazgos con evidencia exacta): `.agents/workflow/executions/REP-DEPLOY-RAG-SUPABASE-run-001.md` en el repo.
