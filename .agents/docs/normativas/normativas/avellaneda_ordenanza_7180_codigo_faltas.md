# Ordenanza 7180 (Avellaneda) — Código Municipal de Faltas — IDENTIFICADA, texto no disponible en línea

**Consultado:** 07/09/2026
**Aplica a:** Avellaneda (Buenos Aires)
**Uso en el corpus:** es la **capa sancionatoria municipal** de Avellaneda — el equivalente funcional de la Ley 451 en CABA.

## Qué es (confirmado)

La **Ordenanza Nº 7180 es el Código Municipal de Faltas de Avellaneda**, y sigue vigente "y sus modificatorias".

Confirmación en dos fuentes oficiales independientes, ambas de la propia Municipalidad de Avellaneda publicadas en SIBOM (repositorio oficial de boletines municipales de la Provincia):

1. **Decreto Nº 1261 de Avellaneda, 29/05/2020** — declara servicio esencial al Juzgado Municipal de Faltas Nº 1. En sus considerandos: *"ante la constatación de conductas tipificadas en el **Código Municipal de Faltas (Ordenanza Nº 7180)**"*.
   Fuente: `https://sibom.slyt.gba.gob.ar/bulletins/3723/contents/1456668`

2. **Ordenanza Fiscal de Avellaneda** (Ord. 28451/2018 para el ejercicio 2019, y su equivalente 29166 para 2021) — remite a *"...Código de Faltas Municipales y las del **Régimen de Penalidades –Ordenanza Nº 7180 y sus modificatorias–**, sin perjuicio de la responsabilidad penal que le [corresponda]..."*.
   Fuentes: `https://sibom.slyt.gba.gob.ar/bulletins/1666/contents/1271279` y `https://www.mda.gob.ar/wp-content/uploads/2020/01/avellaneda_48-4.pdf`

**Modificatoria conocida:** Ordenanza 8768 (mencionada en una fuente secundaria como modificatoria de la 7180; no verificada).

**Órgano de aplicación:** Juzgados Municipales de Faltas de Avellaneda — Juzgado Nº 1 en Av. Güemes 835, 1° piso; Juzgados Nº 2, 3 y 4 en Cnel. Brandsen 2270, Sarandí. Dato útil para poblar `agencies` / `agency_contacts`.

## Qué falta y por qué

**El texto articulado de la Ordenanza 7180 no está disponible en línea.** Es una ordenanza antigua (número bajo) que precede a la digitalización: SIBOM tiene boletines de Avellaneda recién desde ~2017, y el sitio propio del municipio (`mda.gob.ar`) publica desde 2017 y además está con el certificado SSL roto. Las búsquedas por "Ordenanza 7180" devuelven ordenanzas homónimas de otros municipios (Nueve de Julio, Coronel Suárez, Pinamar, Campana, Moreno, Saavedra, Puan, Dolores) — es un número muy reutilizado.

Lo que sí se puede rastrear en SIBOM son las **modificatorias posteriores a 2017**, no el texto base.

## Impacto en el proyecto — para evaluar en REP-3767

Sin el articulado de la 7180, el corpus de Avellaneda puede fundamentar **la obligación incumplida** (Constitución PBA art. 192 inc. 4, Decreto-Ley 6769/58 arts. 52 y 59) y **la conducta prohibida** en tránsito (Ley 24.449 arts. 48-49), pero **no la sanción aplicable**.

CABA, en cambio, tiene la cadena completa: conducta (Ley 2148) + sanción con monto (Ley 451) + valor de la UF actualizado.

Para un piloto que es *CABA y Avellaneda*, esto genera una **asimetría de calidad del dictamen** entre las dos jurisdicciones. Opciones a considerar:

1. Pedir el texto de la 7180 al municipio por vía institucional (Secretaría Legal y Técnica / Juzgado de Faltas) — es información pública.
2. Acotar el alcance del dictamen en Avellaneda a la obligación y el organismo competente, sin prometer el monto de la multa.
3. Aceptar la asimetría y documentarla como limitación conocida del MVP.

Es una decisión de producto, no técnica.
