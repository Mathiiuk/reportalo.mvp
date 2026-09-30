# Ley 2148 (CABA) — Código de Tránsito y Transporte, arts. 7.1.8 y 7.1.9 **completos**

**Fuente:** https://juristeca.jusbaires.gob.ar/compilacion-normativa-juristeca/ley-2148/h-tit-7/ (JURISTECA — compilación normativa del Poder Judicial de la Ciudad)
**Descargado:** 29/09/2026, vía Firecrawl (extracción asistida por modelo sobre la página oficial de la compilación)
**Aplica a:** Ciudad Autónoma de Buenos Aires
**Categoría:** tránsito

> **Por qué existe este archivo: corrige un defecto de chunking de los fragmentos ya cargados.** En el corpus actual, los dos fragmentos de la Ley 2148 son **incisos sueltos sin el encabezado del artículo**:
>
> - el que dice "En doble fila, excepto como detención previa a la maniobra de estacionamiento" es en realidad el **inciso a) del art. 7.1.8**;
> - el que dice "Frente a los vados o rampas para personas con discapacidad" es el **inciso h) del art. 7.1.9**.
>
> Tal como están, una cita dice "Ley 2148, art. 7.1.8" y muestra una frase que, leída sola, no dice qué está prohibido ni a quién. Este archivo trae los dos artículos completos para poder recargarlos como encabezado + inciso, versionando los viejos.

> **Validación cruzada de la extracción.** El texto vino por extracción asistida por modelo, que es la vía en la que el proyecto ya se equivocó una vez atribuyendo artículos. Acá hay una verificación independiente: los dos incisos que ya estaban cargados desde otra fuente y otra ronda (a del 7.1.8 y h del 7.1.9) **coinciden palabra por palabra** con los del texto traído ahora. Eso no prueba que los demás incisos estén perfectos, pero sí confirma la numeración y el orden.

## Artículo 7.1.8 — Prohibiciones especiales

"7.1.8 – Prohibiciones especiales

Queda prohibido estacionar y detenerse con carácter general en los siguientes sitios, sin perjuicio de lo establecido en los artículos 7.1.2 y 7.1.3:

a) En doble fila, excepto como detención previa a la maniobra de estacionamiento.

b) En las esquinas, entre su vértice ideal y la línea imaginaria que resulte de prolongar la ochava así como también sobre la demarcación horizontal de sendas peatonales o líneas de pare.

c) En el interior de los túneles, pasos bajo nivel y en los puentes. Esta prohibición rige también en la zona de acceso y egreso de los mismos, hasta una distancia que en cada caso establece la Autoridad de Aplicación.

d) Sobre la demarcación de sendas peatonales o líneas de pare.

e) Sobre ciclovías."

## Artículo 7.1.9 — Prohibiciones generales (incisos relevantes)

"7.1.9 – Prohibiciones generales

Queda prohibido estacionar con carácter general en los siguientes sitios, sin perjuicio de lo establecido en los artículos 7.1.2 y 7.1.3:

a) En los pasajes cuyo ancho de calzada no supere los cuatro metros y medio (4,5m) y calles de convivencia, en toda su extensión, junto a ambas aceras.

b) A menos de cincuenta (50) metros a cada lado de los pasos ferroviarios a nivel.

c) En los sectores de parada para detención de transporte colectivo de pasajeros y taxis.

d) En aquellos lugares señalizados, según determine por norma legal el Gobierno de la Ciudad.

e) En los sectores de ingreso y egreso de vehículos a la vía pública. Esta prohibición alcanzará inclusive el estacionamiento en el tramo de la acera opuesta, frente a los mismos, cuando el ancho de la calzada resulte insuficiente para las maniobras de ingreso y egreso de vehículos. En caso de estar permitido el estacionamiento junto a la acera donde está ubicada la entrada de vehículos y también el ancho de la calzada resulte insuficiente para maniobrar, la prohibición general se amplía un metro a cada lado del ancho de la entrada.

f) Frente a las entradas de locales de espectáculos públicos, en los horarios en que se realicen funciones en ellos.

g) Frente a la entrada de los edificios donde funcionen Comisarías y Cuerpos de Bomberos. [...]

h) Frente a los vados o rampas para personas con discapacidad.

i) Sobre las sendas para ciclorodados.

[...]

k) Frente a las bocas de entrada de los subterráneos.

l) A menos de diez (10) metros a cada lado de:

1. La entrada de hospitales, sanatorios, clínicas y centros que presten servicios de salud.

2. La entrada de escuelas, colegios y facultades en horas de clase.

[...]

o) En los sectores delimitados con cartelería y/o demarcación horizontal, destinados a la operación de carga y descarga."

*(el artículo tiene incisos a) a o); se reproducen los que corresponden a casos frecuentes de reporte. Los omitidos —j), m), n) y los puntos 3 a 8 del inciso l)— están en la fuente y no se cargan, pero tampoco quedan partidos: cada uno es un chunk posible en una ronda futura.)*

## Qué se carga de acá

| Fragmento | Reemplaza a | Caso que resuelve |
|---|---|---|
| 7.1.8 encabezado + inciso a) | el fragmento suelto de doble fila | Doble fila |
| 7.1.8 encabezado + inciso b) | — | Auto en la esquina o sobre la senda peatonal |
| 7.1.8 encabezado + inciso e) | — | Auto sobre la ciclovía |
| 7.1.9 encabezado + inciso c) | — | Auto en la parada del colectivo |
| 7.1.9 encabezado + inciso e) | — | "Me tapan la entrada del garage" |
| 7.1.9 encabezado + inciso h) | el fragmento suelto de rampas | Auto frente a la rampa de accesibilidad |

Los dos fragmentos viejos **no se borran**: se marcan `is_current = false` y los nuevos los referencian por `replaces_fragment_id`, igual que se hizo en el Sprint 13 con el inciso t) del art. 48 de la Ley 24.449.

## Nota para el corpus

Antes de una publicación externa del dictamen conviene re-verificar estos dos artículos contra el texto consolidado del Boletín Oficial de la Ciudad, no contra la compilación judicial. JURISTECA es fuente oficial del Poder Judicial de CABA y sirve para trabajar, pero el texto consolidado de la norma lo publica el Ejecutivo.
