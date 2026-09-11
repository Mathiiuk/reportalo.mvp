# Correcciones requeridas — REP-2907 (para ejecutar sin ambigüedad)

Este documento es una especificación de corrección, no una discusión. Cada punto tiene: qué está mal, qué tiene que quedar, y cómo verificar que quedó bien. No requiere interpretación — si algo no está claro, es un bug de este documento, no algo a inferir.

Origen: revisión técnica del handoff de REP-2907 del 09/09/2026 (`REP-2907_revision_tecnica_handoff.md`). Bloquea REP-3767 hasta que esté resuelto.

---

## 1. Reemplazar el corpus completo — las 8 fuentes actuales están mal

El `INITIAL_LEGAL_CORPUS` en `src/services/legalRagService.js` (o donde viva la carga inicial) usa URLs que no existen o apuntan a otra norma. **Reemplazar los 8 registros por estos exactos** — no regenerar, no volver a buscar en la web, copiar tal cual:

| # | fragment_id | Norma | Ámbito | Categoría | Tipo fundamento | `source_url` (usar exactamente esta) | Texto verbatim (fuente) |
|---|---|---|---|---|---|---|---|
| 1 | FRAG-001 | Constitución PBA, art. 192 inc. 4 | Provincial — Buenos Aires | infraestructura | obligacion | `https://www.infoleg.gob.ar/?page_id=173` | `docs/fuentes/normativas/constitucion_pba_arts_190_192.md` |
| 2 | FRAG-002 | Dec-Ley 6769/58 (LOM), art. 52 | Provincial — Buenos Aires | infraestructura | obligacion | `https://normas.gba.gob.ar/documentos/OVG48SW0.html` | `docs/fuentes/normativas/LOM_decreto_ley_6769-58_arts_52_59.md` |
| 3 | FRAG-003 | Dec-Ley 6769/58 (LOM), art. 59 | Provincial — Buenos Aires | infraestructura | obligacion | `https://normas.gba.gob.ar/documentos/OVG48SW0.html` | `docs/fuentes/normativas/LOM_decreto_ley_6769-58_arts_52_59.md` |
| 4 | FRAG-004 | Ley 210 (CABA), arts. 2 y 3 | Municipal — CABA | infraestructura | competencia | `https://boletinoficial.buenosaires.gob.ar/normativaba/norma/4623` | `docs/fuentes/normativas/ley_210_caba_ente_regulador.md` |
| 5 | FRAG-005 | Ley 24.449, arts. 48 y 49 | Nacional (aplica en PBA vía Ley 13.927) | transito | conducta_prohibida | `https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/818/texact.htm` | `docs/fuentes/normativas/ley_24449_arts_48_49.md` |
| 6 | FRAG-006 | Ley 2148 (CABA), arts. 7.1.8 y 7.1.9 | Municipal — CABA | transito | conducta_prohibida | `https://juristeca.jusbaires.gob.ar/compilacion-normativa-juristeca/ley-2148/h-tit-7/` | `docs/fuentes/normativas/ley_2148_caba_arts_7.1.8_7.1.9.md` |
| 7 | FRAG-007 | Ley 451 (CABA), art. 6.1.52 | Municipal — CABA | transito | sancion | `https://boletinoficial.buenosaires.gob.ar/normativaba/norma/391197` | `docs/fuentes/normativas/ley_451_caba_art_6.1.52_y_6.1.37.md` |
| 8 | FRAG-008 | Dec-Ley 8031/73 (Código de Faltas PBA) — índice | Provincial — Buenos Aires | **ninguna — ver punto 2** | **ninguno — ver punto 2** | `https://normas.gba.gob.ar/documentos/ZBOPDhkV.html` | `docs/fuentes/normativas/codigo_faltas_decreto_ley_8031-73_indice.md` |

**El texto de cada fragmento se copia literal del archivo de la última columna** (ya está verificado contra fuente consolidada, no volver a extraer de la web).

**Verificación:** las 7 URLs únicas de la tabla tienen que devolver HTTP 200 y mostrar la norma que dicen mostrar. No basta con que no den 404 — confirmar que el contenido corresponde.

## 2. El fragmento 8 (distractor) no lleva ningún valor especial

**Prohibido:** cualquier campo `categoria: "distractor"` o `tipo_fundamento: "distractor"`, o cualquier valor de metadata que no exista también en los otros 7 fragmentos.

**Correcto:** el fragmento 8 no tiene categoría asignada (deja `categoria` vacío/null, igual que si fuera una norma real que todavía no se vinculó a ninguna categoría del catálogo) y no tiene `tipo_fundamento` (vacío/null). Tiene que pasar por el **mismo pipeline de filtrado y búsqueda por similitud** que cualquier otro fragmento — nada en su registro puede señalarlo como especial.

**Verificación:** buscar en el código la función que arma el filtro previo a la búsqueda vectorial (la que resuelve jurisdicción/categoría). Confirmar que esa función no tiene ninguna rama del tipo `if categoria == 'distractor'` ni excluye el fragmento 8 por ningún criterio que no aplique igual a los demás.

## 3. Declarar explícitamente la limitación del embedding local

En el informe de handoff (no en el código), agregar un párrafo — no opcional — que diga, en sustancia:

> El benchmark de 100% de acierto se corrió con un embedding léxico local de 64 dimensiones, hecho a medida para este spike, no con Gemini `text-embedding-004` (768 dimensiones, la opción de producción) ni con OpenAI. Es válido para probar la arquitectura (carga, filtrado jurisdiccional, estructura de recuperación) pero **no valida la calidad de recuperación semántica real**, porque el esquema se ajustó a mano contra los mismos casos con los que después se mide. No debe leerse como una cifra de precisión productiva.

**Además:** correr un caso de prueba adicional que el desarrollador no haya visto antes de escribir la lógica de similitud (un texto de reclamo nuevo, no de la lista A-F), y reportar su resultado — pase o falle — como parte de la evidencia. No hace falta que sea perfecto; hace falta que no esté hecho a medida.

## 4. Corregir el conteo de fragmentos

El informe dice "9 fragmentos vectorizables" pero lista 8. Son 8. Corregir el número en el texto, o si efectivamente hay un noveno fragmento no documentado, agregarlo a la tabla de fuentes con los mismos campos que los demás.

## 5. Pendiente para más adelante (no bloquea el cierre de este spike)

Esto no hace falta resolverlo ahora — se registra para cuando se apruebe el Control de Cambios del Modelo de Datos:

- Migrar de la tabla única `normativas` a las 5 tablas: `knowledge_sources`, `knowledge_fragments`, `source_types`, `foundation_types`, `fragment_services` (esquema completo en `REP-2906_corpus_minimo_estructura.md` §6.2).
- Seeds pendientes, con nombre exacto:
  - `states_provinces`: dos filas — Buenos Aires y CABA.
  - `services`: cinco categorías — infraestructura, transito, ambiente, comercio_irregular, vulnerabilidad_social (hoy el Modelo de Datos v3 declara solo 4; falta vulnerabilidad_social).
  - `foundation_types`: cuatro valores — obligacion, conducta_prohibida, sancion, competencia.
  - `source_types`: dos valores para empezar — corpus_legal, informacion.

## 6. Qué hace falta para volver a declarar `GO`

Los puntos 1 y 2 son bloqueantes — sin ellos, no hay evidencia válida de que el pipeline funcione como dice. El punto 3 es bloqueante para que REP-3767 pueda usar el número como dato real, no para cerrar el spike en sí. Los puntos 4 y 5 no bloquean nada, son prolijidad y registro.

Cuando 1 y 2 estén resueltos, volver a correr los 6 casos de `REP-3764_casos_esperados.md` y reportar el resultado con las URLs corregidas — si el ítem 8 sigue sin aparecer en los casos A y E, ahí sí es evidencia real de que el motor discrimina por contenido, no por metadata.
