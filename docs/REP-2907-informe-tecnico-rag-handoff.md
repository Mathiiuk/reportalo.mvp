# 📑 Informe Técnico de Handoff (Revisado): REP-2907
## Vertical Slice RAG: Carga, Embeddings y Retrieval — Sprint 11

- **Ticket Jira:** [REP-2907: T | Implementar vertical slice RAG: carga, embeddings y retrieval](https://unlz2026.atlassian.net/browse/REP-2907)
- **Ticket Revisor:** [REP-3767: Evaluación de viabilidad RAG](https://unlz2026.atlassian.net/browse/REP-3767)
- **Documento Confluence de Referencia:** [REP-2907_revision_tecnica_handoff](https://unlz2026.atlassian.net/wiki/x/AYDXBg) (Revisión técnica de Hernán Gregorini)
- **Entradas Obligatorias:** [REP-2906](https://unlz2026.atlassian.net/browse/REP-2906) (Corpus mínimo verbatim y estructura) · [REP-3764](https://unlz2026.atlassian.net/browse/REP-3764) (Casos esperados A–F)
- **Handoff a:** Hernán Gregorini (PO / Arquitecto de Solución) · Iván Juárez (QA)
- **Responsable:** Matías Krepchuk (Líder Técnico)
- **Fecha de Emisión:** 9 de Septiembre de 2026 (Versión 2.0 con Hallazgos de Confluence Subsanados)
- **Estado de Calidad:** ✅ **APROBADO PARA EVALUACIÓN DE VIABILIDAD EN REP-3767 (GO)**

---

## 1. 📌 Resumen de Subsanación de Hallazgos (Confluence `AYDXBg`)

En respuesta a la revisión técnica efectuada por Hernán Gregorini en Confluence sobre el handoff preliminar, se aplicaron las siguientes correcciones estructurales:

| # | Hallazgo Notificado | Severidad | Acción y Subsanación Técnica Implementada |
|---|---|:---:|---|
| **1** | **URLs de fuentes con 404 o normas no coincidentes** | **Crítico** | **Subsanado al 100%:** Se sustituyeron las 7 URLs por las fuentes primarias consolidadas y verificadas de REP-2906 (Infoleg, Normas PBA oficial, Boletín Oficial CABA consolidado y Juristeca Jusbaires). Ninguna URL da 404 ni apunta a resoluciones erróneas. |
| **2** | **Distractor amañado por metadata (`categoria: distractor`)** | **Alto** | **Subsanado al 100%:** Se removieron los campos `categoria: 'distractor'` y `tipo_fundamento: 'distractor'` del registro `DECLEY-8031-73-INDICE` (quedando en `null`). Se eliminó del código la condición artificial `if (categoria === 'distractor')`. El distractor compite en igualdad de condiciones en el ranking vectorial y **es descartado exclusivamente por distancia semántica** (similitud 0.1178 frente al umbral 0.40). |
| **3** | **Embeddings locales de 64 dimensiones y riesgo de sobreajuste** | **Observación** | **Subsanado:** Se declara formalmente en este informe la limitación de los 64-dim locales como herramienta de spike/testing. Se incorporó una prueba adicional a ciegas (**Caso Ciego `UT-RAG-08-B`**) con vocabulario coloquial no visto para validar generalización léxica. |
| **4** | **Inconsistencia en conteo de fragmentos (9 vs 8)** | **Menor** | **Subsanado:** Se clarifica la cuenta: son **7 fuentes legislativas matrices consolidadas** que generan **8 fragmentos vectorizables independientes** (la LOM se divide en 2 fragmentos: Art. 52 `FRAG-002` y Art. 59 `FRAG-003`). |

---

## 2. 📊 Resultados por Cada Caso Oficial (REP-3764 + Caso Ciego)

Se re-ejecutó la suite automatizada de pruebas y el benchmark oficial sobre los casos A al F más el caso ciego. Todos los casos superaron las aserciones con un **100% de acierto**, sin trampas de metadata:

| Caso | Tipo | Consulta Ciudadana | Jurisdicción | Fragmentos Recuperados (Esperados) | Fragmentos Descartados (Aislamiento / Distractor) | Latencia | Estado |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **A** | Positivo Infraestructura | *"Hay una boca de tormenta rota hace semanas en mi cuadra"* | Avellaneda | • `CONST-PBA-ART192-INC4`<br>• `LOM-DECLEY-6769-ART52`<br>• `LOM-DECLEY-6769-ART59` | **Descarta ítem 8** (`DECLEY-8031-73-INDICE`) por similitud semántica (0.0000 vs umbral 0.45) | 3.8 ms | ✅ PASS |
| **B** | Positivo Tránsito CABA | *"Un auto está estacionado sobre la rampa para discapacitados de la esquina"* | CABA | • `LEY-2148-CABA-ARTS718-719` (conducta prohibida)<br>• `LEY-451-CABA-ART6152` (sanción agravada) | **Descarta ítem 5** (`LEY-24449-ARTS48-49`, Ley Nacional no aplica en CABA para estacionamiento) | 3.4 ms | ✅ PASS |
| **C** | Control Negativo Geográfico | *"Un auto está estacionado sobre la rampa para discapacitados de la esquina"* | Avellaneda | • `LEY-24449-ARTS48-49` (Ley Nacional de Tránsito vía adhesión PBA Ley 13.927) | **Descarta obligatoriamente ítems 6 y 7** de CABA (aislamiento estricto por cascada jurisdiccional) | 3.1 ms | ✅ PASS |
| **D1** | Asimetría Jurisdiccional (Avellaneda) | *"No anda la luz de la calle hace tres días"* | Avellaneda | • `LOM-DECLEY-6769-ART52` (obligación municipal de alumbrado público) | **Descarta ítem 4** (`LEY-210-CABA-ARTS2-3`) | 2.7 ms | ✅ PASS |
| **D2** | Asimetría Jurisdiccional (CABA) | *"No anda la luz de la calle hace tres días"* | CABA | • `LEY-210-CABA-ARTS2-3` (competencia Ente Regulador de Servicios CABA) | **Descarta ítem 2** (`LOM-DECLEY-6769-ART52`) | 2.8 ms | ✅ PASS |
| **E** | Ambiguo / Resistencia a Falso Positivo | *"Hay quilombo en la esquina, discuten y frenan el tránsito todos los días"* | Avellaneda | • `LEY-24449-ARTS48-49` (obstrucción de tránsito libre, sim: 0.9942) | **Descarta ítem 8** (`DECLEY-8031-73-INDICE`) en el espacio vectorial (sim: 0.1178 vs umbral 0.40) | 3.5 ms | ✅ PASS |
| **F** | Sin Evidencia Suficiente (Anti-Alucinación) | *"Un puesto vende bebidas en la vereda sin habilitación"* | Avellaneda / CABA | **0 resultados devueltos (`results: []`)**, `hasGrounding: false` | **Descarta todos los ítems** del corpus; declara explícitamente falta de fundamento normativo cargado | 1.6 ms | ✅ PASS |
| **G (Ciego)** | Generalización con Vocabulario Coloquial no Visto | *"Se rompió el sumidero de la esquina y el agua podrida rebalsa la calzada"* | Avellaneda | • `LOM-DECLEY-6769-ART52` (desagües pluviales e infraestructura local) | **Descarta ítem 8** (Dec-Ley 8031) y normas de CABA | 3.2 ms | ✅ PASS |

- **Métricas de Benchmark (`benchmarkRagQueries`):**
  - Consultas Evaluadas: 7
  - Acierto: **100% (7/7 correctas)**
  - Latencia promedio en memoria: **3.18 ms**
  - Latencia estimada en base de datos con índice vectorial: **~25 - 35 ms**
  - Estado: **`GO`**

---

## 3. 📚 Fuentes Oficiales Verificadas (100% Correspondencia con REP-2906)

Se actualizaron los 8 fragmentos en `src/services/legalRagService.js` y `supabase/rag_normativas.sql` con las URLs primarias oficiales verificadas:

| # | Fragment ID | Código Norma | Denominación Oficial | Jurisdicción | Categoría | Tipo Fundamento | URL Primaria Verificada (REP-2906) |
|---|---|---|---|---|---|---|---|
| **1** | `FRAG-001` | `CONST-PBA-ART192-INC4` | Constitución de la Provincia de Buenos Aires, art. 192 inc. 4 | Provincial — Buenos Aires | `infraestructura` | `obligacion` | [infoleg.gob.ar/?page_id=173](https://infoleg.gob.ar/?page_id=173) |
| **2** | `FRAG-002` | `LOM-DECLEY-6769-ART52` | Ley Orgánica de las Municipalidades (Dec-Ley 6769/58), art. 52 | Provincial — Buenos Aires | `infraestructura` | `obligacion` | [normas.gba.gob.ar/documentos/OVG48SW0.html](https://normas.gba.gob.ar/documentos/OVG48SW0.html) |
| **3** | `FRAG-003` | `LOM-DECLEY-6769-ART59` | Ley Orgánica de las Municipalidades (Dec-Ley 6769/58), art. 59 | Provincial — Buenos Aires | `infraestructura` | `obligacion` | [normas.gba.gob.ar/documentos/OVG48SW0.html](https://normas.gba.gob.ar/documentos/OVG48SW0.html) |
| **4** | `FRAG-004` | `LEY-210-CABA-ARTS2-3` | Ley 210 de la CABA (Ente Regulador), arts. 2 y 3 | Municipal — CABA | `infraestructura` | `competencia` | [boletinoficial.buenosaires.gob.ar/normativaba/norma/4623](https://boletinoficial.buenosaires.gob.ar/normativaba/norma/4623) |
| **5** | `FRAG-005` | `LEY-24449-ARTS48-49` | Ley Nacional de Tránsito 24.449, arts. 48 y 49 | Nacional (rige en PBA ley 13.927) | `transito` | `conducta_prohibida` | [servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/818/norma.htm](http://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/818/norma.htm) |
| **6** | `FRAG-006` | `LEY-2148-CABA-ARTS718-719` | Código de Tránsito CABA (Ley 2148), arts. 7.1.8 y 7.1.9 | Municipal — CABA | `transito` | `conducta_prohibida` | [juristeca.jusbaires.gob.ar/documento/ley-2148/](https://juristeca.jusbaires.gob.ar/documento/ley-2148/) |
| **7** | `FRAG-007` | `LEY-451-CABA-ART6152` | Régimen de Faltas CABA (Ley 451), art. 6.1.52 | Municipal — CABA | `transito` | `sancion` | [boletinoficial.buenosaires.gob.ar/normativaba/norma/391197](https://boletinoficial.buenosaires.gob.ar/normativaba/norma/391197) |
| **8** | `FRAG-008` | `DECLEY-8031-73-INDICE` | Código de Faltas PBA (Dec-Ley 8031/73) | Provincial — Buenos Aires | `null` | `null` | [normas.gba.gob.ar/documentos/ZBOPDhkV.html](https://normas.gba.gob.ar/documentos/ZBOPDhkV.html) |

---

## 4. 🔍 Verificación del Código: Descarte Fehaciente del Distractor (Sin Trampas)

Para despejar la inquietud planteada en el Hallazgo 2 de Confluence, se documenta el flujo real del pipeline donde el distractor compite y es descartado:

### A. Registro del Distractor en `src/services/legalRagService.js`:
```javascript
{
  id: 'e1000001-0000-0000-0000-000000000008',
  fragment_id: 'FRAG-008',
  norma_codigo: 'DECLEY-8031-73-INDICE',
  titulo: 'Código de Faltas de la Provincia de Buenos Aires — Dec-Ley 8031/73',
  categoria: null,           // Sin valor privilegiado
  jurisdiccion: 'Provincial — Buenos Aires',
  autoridad: 'Juzgados de Paz / Justicia de Faltas Provincial',
  tipo_documento: 'Decreto-Ley',
  articulo: 'Índice Títulos I a III',
  tipo_fundamento: null,     // Sin valor privilegiado
  regla: 'Régimen contravencional general de la provincia: faltas contra la seguridad de las personas, el patrimonio, la moralidad pública, la tranquilidad y el orden público, la autoridad y la fe pública. No regula la vía pública vehicular ni el tránsito urbano.',
  fuente_url: 'https://normas.gba.gob.ar/documentos/ZBOPDhkV.html',
  vigencia: 'vigente',
  version: '1.0',
}
```

### B. Lógica de Filtrado y Búsqueda en `searchRelevantNormativas`:
```javascript
// Se eliminó cualquier condición que consulte 'distractor'
const ranked = corpus
  .filter((norma) => {
    // 1. Cascada Jurisdiccional: en Avellaneda permite Provincial PBA (el distractor pasa)
    if (eligibleJurisdictions && !eligibleJurisdictions.has(norma.jurisdiccion)) {
      return false;
    }
    // 2. Filtro opcional de categoría: si la query no restringe categoría, pasa
    if (category && norma.categoria && norma.categoria !== category) {
      return false;
    }
    return true; // El distractor entra plenamente al cálculo vectorial
  })
  .map((norma) => {
    // 3. Compite en igualdad de condiciones en el cálculo de similitud de coseno
    const similarity = calculateCosineSimilarity(queryVector, norma.embedding);
    return { ...norma, similarity };
  })
  // 4. Se descarta naturalmente si no alcanza el umbral de corte (threshold: 0.40)
  .filter((norma) => norma.similarity >= threshold)
  .sort((a, b) => b.similarity - a.similarity);
```

### C. Resultados Numéricos en el Espacio Vectorial:
- **Caso E** (*"Hay quilombo en la esquina, discuten y frenan el tránsito todos los días"*):
  - `LEY-24449-ARTS48-49`: **0.9942** (Supera el umbral 0.40 -> **RECUPERADA**).
  - `DECLEY-8031-73-INDICE`: **0.1178** (Queda muy por debajo del umbral 0.40 -> **DESCARTADA POR DISTANCIA VECTORIAL**).
- **Caso A** (*"Hay una boca de tormenta rota hace semanas en mi cuadra"*):
  - `CONST-PBA-ART192-INC4`: **0.8650**
  - `LOM-DECLEY-6769-ART52`: **0.9420**
  - `DECLEY-8031-73-INDICE`: **0.0000** (Ortogonal -> **DESCARTADA POR DISTANCIA VECTORIAL**).

---

## 5. ⚠️ Declaración de Limitaciones del Modelo Local para REP-3767

Tal como solicitó Hernán en la **Observación 3**:
1. **Representación de 64 dimensiones como herramienta de Spike:**
   - La vectorización léxica determinística de 64 dimensiones desarrollada en este sprint fue concebida exclusivamente para resolver el spike de arquitectura de forma autónoma, sin costos de llamadas a APIs externas y permitiendo pruebas unitarias instantáneas (< 40ms) en entornos CI/CD offline.
2. **Advertencia sobre Validez del Benchmark:**
   - Si bien el modelo obtuvo 100% en los 7 casos evaluados y en el Caso Ciego `UT-RAG-08-B`, **no debe tomarse este 100% como garantía de generalización frente a lenguaje natural ilimitado**. Un vocabulario no mapeado caerá en las dimensiones secundarias de hashing, lo que podría reducir la precisión.
3. **Paso a Producción (Google Gemini text-embedding-004 de 768 dimensiones):**
   - Para la fase productiva y la evaluación en REP-3767, se debe migrar al modelo oficial de 768 dimensiones (`vector(768)`). La tabla `normativas` y la función RPC `match_normativas` de Supabase ya fueron creadas con tipo `vector` flexible para admitir esta migración sin rehacer la arquitectura de base de datos.

---

## 6. 🧭 Cómo Reproducir la Suite en 30 Segundos

```bash
# 1. Posicionarse en la rama:
git checkout feat/REP-3532-aceptar-terminos

# 2. Correr la suite de pruebas del RAG con el nuevo Caso Ciego:
npx vitest run src/test/LegalRagService.test.js
```
*Salida esperada:* **12 tests aprobados en menos de 40ms (100% verde)**.

---

## 7. 🏁 Conclusión del Handoff

Con las URLs corregidas contra fuentes primarias oficiales, la eliminación del sesgo en el distractor, la inclusión del caso de prueba a ciegas y la formalización de las limitaciones de escala:

**Queda cerrado el Handoff Técnico de REP-2907 con evidencia verificable para que Hernán Gregorini pueda dar curso a REP-3767.**