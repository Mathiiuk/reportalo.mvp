# Ley 13.927 (Provincia de Buenos Aires) — Adhesión a las Leyes Nacionales de Tránsito 24.449 y 26.363, arts. 1 y 2

**Fuente:** https://normas.gba.gob.ar/documentos/0YqDnfd0.html (Normas GBA — "texto actualizado")
**Estado declarado por la fuente:** "Texto actualizado con las modificaciones introducidas por las Leyes 14246, 14331, 14393, 14774, 15002, 15078, 15139, 15143, 15225, 15321, 15402 y 15613"
**Descargado:** 28/09/2026, vía Firecrawl sobre la página oficial (texto íntegro)
**Aplica a:** toda la Provincia de Buenos Aires — **incluye Avellaneda**
**Categoría:** tránsito

> **Por qué se carga.** La fuente `Ley 13.927` ya existía en la base (`knowledge_sources`, id `...008`) y sostiene la adhesión de la Provincia a la Ley 24.449 en `source_adhesions`, **pero no tenía ni un solo fragmento cargado**. Sin texto, la cadena de adhesión no se puede citar: el dictamen afirma que la 24.449 aplica en Avellaneda sin poder mostrar dónde lo dice.

## Artículo 1 — Adhesión

"**ARTÍCULO 1.-** ADHESIÓN. La Provincia de Buenos Aires adhiere, en cuanto no se opongan a las disposiciones de la presente, a las Leyes Nacionales 24.449 y 26.363, que como anexos se acompañan."

## Artículo 2 — Competencia (autoridades de aplicación y comprobación)

"**ARTÍCULO 2.-** COMPETENCIA. Se declaran autoridades de aplicación y comprobación de la presente norma, sin perjuicio de las asignaciones de competencia que el Poder Ejecutivo efectúe en la Reglamentación, a la Policía de Seguridad Vial en el ámbito de su competencia y a las Policías de Seguridad de la Provincia en los casos de flagrancia, o en los casos en que se le requiera su colaboración, a la Dirección de Vialidad, a la Dirección Provincial del Transporte, al Ministerio de Jefatura de Gabinete y Gobierno y a las Municipalidades. El Ministerio de Salud, a través de la dependencia que designe, podrá intervenir en los casos de control de conducción bajo los efectos de alcoholemia y/o estupefacientes.

En lo referente a las funciones de prevención y control de tránsito en las rutas nacionales y otros espacios del dominio público nacional sometidos a jurisdicción provincial, la Provincia de Buenos Aires, podrá celebrar convenios de colaboración con Gendarmería Nacional, la Agencia Nacional de Seguridad Vial y/o cualquier otro organismo nacional, no pudiendo interferir los mismos en la competencia provincial en esa materia, en virtud de tratarse de una facultad no delegada al Gobierno Federal."

## Artículo 2° bis — Objeto (incorporado por Ley 15.402)

"**ARTÍCULO 2° BIS.- (Articulo incorporado por Ley 15.402)** OBJETO. La presente Ley tiene por objeto preservar la salud, la vida y la seguridad de quienes transiten el territorio provincial; reducir la mortalidad y la morbilidad derivadas de la siniestralidad vial. Las normas que fijan las pautas de circulación y las que establecen los límites legales de alcohol en sangre y de cualquier sustancia que disminuya las condiciones para la conducción, integran las políticas públicas de seguridad vial."

## Notas para el corpus

- El art. 2 nombra expresamente a **las Municipalidades** entre las autoridades de aplicación y comprobación: es el respaldo normativo para derivar un reporte de tránsito de Avellaneda al municipio y no a un organismo provincial o nacional.
- La adhesión es **condicionada**: "en cuanto no se opongan a las disposiciones de la presente". Si alguna vez un artículo de la 24.449 choca con esta ley, gana la provincial. El campo `scope_note` de `source_adhesions` ya guarda esa frase.
- **Dato de verificación a actualizar:** la fuente ya cargada en la base tenía `verified_at = 13/09/2026`. El texto actualizado de hoy declara modificaciones hasta la **Ley 15.613**, que no estaba registrada en `last_amended_by`. El lote de este sprint actualiza ese campo.
- El art. 5 (texto según Ley 15.002) menciona a la **Justicia de Faltas Municipal** como órgano de juzgamiento. Útil si más adelante hace falta explicar el circuito posterior a la denuncia; no se carga en este lote porque el producto no sanciona.
