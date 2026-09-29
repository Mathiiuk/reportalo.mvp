# REP-3797 / REP-3795 — Hallazgos de la verificación con el corpus ampliado y decisiones pendientes

Para: Hernán (PO) · De: Matías · Fecha: 29/09/2026
Detalle completo de la evidencia: `docs/REP-3797_verificacion-post-corpus_reportes-prueba.md`

## 1. Resumen

- El lote de corpus quedó cargado y verificado en la base (CiudadAR): 20 fuentes, 83 fragmentos vigentes, 89 mapeos por categoría, 84 embeddings del modelo activo, 0 fragmentos sin embedding, 0 fuentes sin URL/fecha. Los 67 embeddings se generaron con `scripts/corpus-loader/embed-pending.mjs` (nuevo, ver §5).
- Se corrieron 28 reportes de prueba por el pipeline real (insert → cola → cron → función `analizar-reporte` v34 → Gemini): 10 con textos del equipo, 8 en lenguaje de ciudadano y 10 repeticiones para medir consistencia.
- **La cobertura mejoró**: Ambiente, Infraestructura y Comercio en CABA pasaron de casi vacío a `fundamentado` con citas pertinentes. Tránsito y Vulnerabilidad social sin regresiones.
- Quedan hallazgos que necesitan una decisión, separados abajo según quién puede resolverlos.

Límites de esta verificación (para no sobrevalorarla): los reportes se insertaron por SQL, no desde la app (no se probó foto, cuarentena ni pantalla de resultado); la lectura de las citas es del equipo técnico y **no es validación jurídica**; una a tres corridas por caso.

## 2. Resultados

| Área | Estado | Citas leídas |
|---|---|---|
| Vulnerabilidad social (3 casos) | `asistencia`, sin llamar a Gemini | — |
| Tránsito CABA (auto mal estacionado, camioneta sobre la vereda) | `fundamentado` | Faltas 6.1.52; 6.1.37 + 6.1.54. Correctas |
| Tránsito Avellaneda (auto sobre la vereda) | `fundamentado` | Ley 24.449 art. 49 b.3 y b.1. Correctas |
| Ambiente (CABA y Avellaneda) | `fundamentado` | Faltas 1.3.13, Ley 1854 art. 36, Ley 13.592 art. 9. Razonables |
| Comercio CABA (con categoría correcta) | `fundamentado` | Faltas 4.1.2. Correcta |
| Comercio con categoría errónea | `sin_normativa` | Abstención correcta |
| Infraestructura CABA, vereda rota por raíces | `fundamentado` | Ley 5902 art. 7, 2.º párrafo ("o por raíces de árboles"). Correcta (ver 3.1) |
| Tránsito Avellaneda, auto abandonado | `fundamentado` | Ley 24.449 art. 48 "estorbar u obstaculizar". **A revisar (ver 3.2)** |
| Comercio Avellaneda (3 textos, 3 corridas c/u) | `indeterminado` siempre | Sin cita válida (ver 3.4) |
| Alumbrado CABA | `sin_normativa` siempre | Solo Ley 210 art. 2 b (ver 3.5) |

## 3. Lo que decide Hernán (contenido jurídico y producto)

Son decisiones de fondo: el equipo técnico puede ejecutarlas, pero no debería tomarlas.

### 3.1 Ley 5902 art. 7 para "vereda rota por raíces de un árbol" — RESUELTO, corrección del equipo técnico
La primera versión de este documento decía que el art. 7 "puede referirse a destrucción por obras" y que la cita empezaba "como consecuencia de…". Era una abreviación nuestra con puntos suspensivos, no lo que guardó el modelo. **La cita real guardada en `report_ai_evidence` es completa** e incluye "o por raíces de árboles, la reparación o reconstrucción corre por cuenta y cargo de aquél". El art. 7 alcanza y el modelo citó bien. No hay nada que corregir ni en el corpus ni en la cita, y no hay truncado de citas que investigar.

### 3.2 Ley 24.449 art. 48 para "auto abandonado hace meses"
Con el texto "auto tirado, destrozado y sin patente" el sistema cita "estorbar u obstaculizar la calzada o la banquina". Abandonar un vehículo no es lo mismo que obstruir. En una primera ronda con otro texto el resultado fue `indeterminado` (el modelo decía que el corpus no regula abandono). **Pregunta:** ¿el corpus debe cubrir vehículo abandonado (norma específica) o el sistema debe abstenerse? Hoy hay riesgo de fundamentar de más.

### 3.3 Qué estado mostrarle al ciudadano cuando el validador rechaza una cita
Hoy: `indeterminado`. En comercio Avellaneda la norma recuperada (Ley 24.449 art. 48 t, "venta en zona alguna del camino") no encaja con una vereda urbana; el modelo intenta citarla, el validador lo rechaza y el resultado queda `indeterminado`. **Pregunta:** ¿ese caso debería mostrarse como `sin_normativa` (más honesto: "no hay norma cargada") o mantener `indeterminado` ("no se pudo determinar")? Cambia lo que lee el ciudadano.

### 3.4 Comercio en Avellaneda sin norma municipal
Se recuperan solo Ley 24.449 art. 48 t, LOM art. 27 incs. 1 y 6 y los canales del municipio. Ya está registrado como P-6 / P-9 / P-12 en `PENDIENTES_corpus.md` (falta el articulado de la Ord. 7180). **Pregunta:** ¿se acepta este hueco para el MVP? ¿Hay fecha para conseguir el texto (Secretaría Legal y Técnica / Juzgado de Faltas)? Mientras tanto, con la respuesta de 3.3, el ciudadano recibe `indeterminado`.

### 3.5 Alumbrado público en CABA: `sin_normativa`
Solo entra la Ley 210 art. 2 b (el Ente controla el servicio). El art. 3 j (recibe y tramita quejas y reclamos de usuarios) no aparece entre los 6 primeros recuperados, aunque en REP-3795 sí. **Pregunta:** ¿la Ley 210 (art. 2 b + 3 j) alcanza como fundamento para derivar el reclamo al Ente? Si sí, hay que lograr que el art. 3 j se recupere (ver 4.3). Si no, `sin_normativa` es correcto.

### 3.6 Vulnerabilidad social: mensaje de `asistencia`
Con 29 fragmentos nuevos de vulnerabilidad social sigue rigiendo el corte del Punto 4: se responde `asistencia` sin consultar el corpus. El mensaje actual es "derivado al área de asistencia social", que puede prometer una derivación que no existe. **Pregunta:** ¿`asistencia` sigue siendo respuesta directa, o pasa a mostrar canal y fundamento (con las normas y canales de vulnerabilidad social ya cargados: Ley 27.654, Ley 15.625, Ley 3706 y 4036 de CABA, Desarrollo Social y Niñez de Avellaneda)? Es una decisión de diseño de REP-3795 Punto 4 frente al corpus nuevo.

## 4. Lo que puede hacer el equipo técnico (decisiones acotadas)

Estos cambios son de código, sin contenido jurídico. Se proponen y se hacen en una rama aparte, con test, solo con OK de Hernán como PO (afectan lo que se guarda y cómo se valida).

### 4.1 Guardar modelo, tokens y cita rechazada cuando la validación falla (HECHO y desplegado el 29/09, función v35, rama `fix/REP-3795-observabilidad-rechazo-validacion`)
Hoy `analizar-reporte` guarda `generation_model_code`, versión de prompt y tokens **solo si la respuesta pasa la validación**. En un rechazo queda `indeterminado` con el motivo pero sin modelo (parece que no se llamó a Gemini), sin costo registrado y sin la cita que el modelo intentó. Riesgo: bajo. Beneficio: diagnóstico y control de costo.

### 4.2 Normalizar saltos de línea y espacios al validar la cita literal (CONFIRMADO el 29/09)
La validación es `fragment.content.includes(cita_textual)`. 49 de los 83 fragmentos tienen `

`. Con el cambio 4.1 desplegado se vio que el modelo cita `"Está prohibido en la vía pública:
t) instalarse o realizar venta…"` y el fragmento tiene `

`: el texto es el mismo y solo difiere el salto de línea. Por eso `b6717f77` (2 líneas) falla siempre. La corrección es comparar con saltos de línea y espacios normalizados, sin dejar de exigir el mismo texto. Riesgo: bajo si se prueba que no acepta citas parafraseadas. **Impacto en las decisiones de la §3:** parte del `indeterminado` de comercio en Avellaneda se explica por esto y no por falta de norma; conviene resolverlo antes de decidir 3.3 y 3.4, porque el resultado puede cambiar.

### 4.3 Recuperación: los canales del municipio (`cav`, `produccion-comercio-ambiente`) quedan primeros
En Avellaneda esos fragmentos (no normativos) ocupan el primer puesto por similitud y desplazan normas de fondo. **Opciones:** dejarlo así, o bajarles el peso/limitar a uno. Cambia el ranking del RAG: conviene decidirlo entre Matías e Iván antes de tocar.

## 5. Cambios ya hechos en el repositorio (sin commitear)

- `scripts/corpus-loader/embed-pending.mjs`: genera embeddings solo para fragmentos vigentes sin vector (equivalente a V-5). Necesario porque los `.md` de `corpus/normativas/` no tienen el formato del loader (front matter + bloques `## fragmento`), y el lote SQL no genera embeddings.
- `ley_210_caba_ente_regulador.md` se restauró a la versión del repo (la reescritura perdía el front matter y los 3 bloques que usa la prueba del loader REP-3774). La versión nueva quedó en `docs/Sprint14-Ampliacionrag/ley_210_caba_version_hernan_referencia.md`. **Pregunta para Hernán:** ¿esa reescritura era intencional? Si querés que reemplace la versión del loader, hay que conservar el formato.

## 6. Cómo probarlo

- **Desde la app (recomendado):** crear reportes a mano en staging con categoría y localidad, y mirar el resultado en pantalla.
- **Desde el SQL Editor**, para ver estado, motivo, fragmentos recuperados y cuáles se citaron:

```sql
select left(r.description,60) reporte, a.result_status_code estado, a.status_reason,
       e.rank, round(e.similarity::numeric,2) similitud, e.was_cited citado,
       ks.title fuente, kf.article, kf.subsection, left(e.quoted_text,120) cita
from citizen_reports r
join report_ai_analysis a on a.report_id = r.id
join report_ai_evidence e on e.analysis_id = a.id
join knowledge_fragments kf on kf.id = e.fragment_id
join knowledge_sources ks on ks.id = kf.source_id
where r.created_at >= '2026-09-29 00:12:00+00'
order by r.created_at, 1, e.rank;
```

## 7. Datos de prueba

28 reportes de prueba en CiudadAR (`user_id` a9420d51-…, creados el 29/09/2026 entre 00:12 y 00:37 UTC, sin marca en la descripción). Se borran al cerrar la revisión, con confirmación de Matías.
