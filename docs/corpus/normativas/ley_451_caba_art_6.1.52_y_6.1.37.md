# Ley 451 (CABA) — Régimen de Faltas — Arts. 6.1.52 y 6.1.37 (texto según Ley 5905)

**Fuente primaria:** texto consolidado oficial en PDF del Ministerio Público Fiscal de CABA, descargado a `pdf/ley_451_caba_texto_completo.pdf` y extraído con `tools/extraer_pdf.py` → `pdf/ley_451_texto.txt`
**Fuente secundaria (coincide):** https://boletinoficial.buenosaires.gob.ar/normativaba/norma/391197 (Ley 5905, arts. 1° y 2°)
**Descargado:** 07/09/2026 · **Verificado contra el texto consolidado el 07/09/2026**
**Ley 5905 — sanción:** 23/11/2017 · **publicación:** 13/12/2017
**Aplica a:** CABA exclusivamente
**Uso en el corpus:** norma de **sanción** de tránsito en CABA. Complementa a Ley 2148 (norma de conducta). Un dictamen de CABA sobre estacionamiento indebido necesita las dos.

> **Resuelve el pendiente P-5** del documento `REP-2906_investigacion_corpus_legal.md`. El artículo es el **6.1.52**, no "art. 12 de la Ley 2148" como sugería una extracción anterior errónea.

## Artículo 6.1.52 — Estacionamiento o detención prohibida (texto según Ley 5905, art. 2°)

"El/la conductor/a, titular o responsable de un automotor de uso particular, motovehículo, acoplado o semiacoplado que estacione o se detenga en un lugar prohibido o en forma antirreglamentaria, es sancionado/a con multa de cien (100) unidades fijas. El/la conductor/a, titular o responsable de transporte de pasajeros y/o de carga que estacione en un lugar prohibido o en forma antirreglamentaria, es sancionado/a con multa de cien (100) unidades fijas. Cuando el estacionamiento se realice en lugares reservados para servicios de emergencia, o paradas de transporte de pasajeros, entradas de vehículos, ciclovías, carriles exclusivos, corredores de Metrobus y zonas de Microcentro y Macrocentro, la multa se elevará al doble. Cuando el estacionamiento se realice en lugares reservados para vehículos de personas con necesidades especiales o rampas para discapacitados es sancionado/a con multa de trescientas (300) unidades fijas."

## Artículo 6.1.37 — Obstrucción (texto según Ley 5905, art. 1°)

"El/la conductor/a de un vehículo que cause la obstrucción de la vía transversal, ciclovías, veredas o estacionamientos reservados, es sancionado/a con multa de setenta (70) unidades fijas. Cuando la obstrucción se produzca en carriles exclusivos y/o preferenciales, METROBUS y Premetro, la multa se elevará al doble. Cuando la obstrucción se produzca en rampas para discapacitados o en lugares reservados para vehículos de personas con necesidades especiales es sancionado/a con multa de trescientas (300) unidades fijas."

## Notas críticas para el corpus

1. **Doble fila no tiene artículo propio en Ley 451.** Se encuadra como "estacione o se detenga en un lugar prohibido o en forma antirreglamentaria" (6.1.52, primer párrafo, 100 UF), tomando la conducta prohibida del art. 7.1.8 de la Ley 2148. El RAG tiene que hacer ese puente entre las dos leyes — es un buen caso de prueba de razonamiento, no solo de recuperación.

2. **Rampa: dos artículos distintos según la conducta.** Si el auto *estaciona* en la rampa → 6.1.52 (300 UF). Si *obstruye* la rampa sin estacionar (p. ej. detenido, o sobresaliendo) → 6.1.37 (300 UF). Ambos dan 300 UF, pero el encuadre correcto cambia. Si el RAG cita solo uno de los dos siempre, no está discriminando la conducta.

3. **Versiones superseded — NO usar.** Circulan textos viejos del 6.1.52 con montos distintos: la versión de Ley 4071 (2011) decía "doscientas (200) unidades fijas" y otra decía "de doscientas (200) a un mil (1.000) unidades fijas". **Ambas están desactualizadas.**

4. **Vigencia CONFIRMADA (resuelve P-7).** El texto consolidado oficial cierra el art. 6.1.52 con esta cadena de modificaciones: *"Conf. Ley N° 3390/09 · Ley N° 4071/11 · Ley N° 4811/13 · **Ley N° 5905/17, BOCBA N° 5273 del 13/12/2017**"*. La Ley 5905 es la **última** modificación: no hay nada posterior. Lo mismo para el 6.1.37.

5. **Diferencia de redacción entre el BO y el texto consolidado.** El texto consolidado dice *"lugares reservados para vehículos de **personas con discapacidad**"*, mientras que la publicación original de la Ley 5905 decía *"personas con necesidades especiales"*. Es una actualización de terminología, sin cambio de sentido ni de monto. **Para el corpus usar la redacción del texto consolidado.**

## Artículo 6.1.54 — Estacionamiento en áreas peatonales (bonus del texto consolidado)

"El/la conductor/a, titular o responsable de un automotor, motovehículo, acoplado o semiacoplado que estacione o se detenga en arterias peatonales o **sobre las aceras** de cualquier arteria u ocupando parte de ella, es sancionado/a con multa de trescientas (300) unidades fijas."

*Conf. Ley N° 3390/09 · Ley N° 4811/13 · Ley N° 5905/17.*

Relevante para el reclamo frecuente de **"auto estacionado sobre la vereda"**, que no estaba cubierto por los dos artículos anteriores.

## Verificación adicional realizada sobre el texto completo

Se buscó la expresión **"doble fila"** en el texto consolidado íntegro de la Ley 451: **no aparece en ningún artículo**. Esto confirma —ya no por inferencia sino por verificación— que la doble fila en CABA se sanciona por el encuadre genérico del 6.1.52 ("lugar prohibido o en forma antirreglamentaria") tomando la prohibición del art. 7.1.8 de la Ley 2148.
