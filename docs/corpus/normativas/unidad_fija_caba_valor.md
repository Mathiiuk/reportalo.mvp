# Unidad Fija (UF) de CABA — valor vigente e histórico

**Fuente:** https://www.estadisticaciudad.gob.ar/eyc/unidad-fija-uf/ (Dirección General de Estadística y Censos, GCBA)
**Consultado:** 07/09/2026
**Aplica a:** CABA — conversión de multas de la Ley 451 a pesos

## Por qué esto importa para el RAG

Las multas de la Ley 451 **no están expresadas en pesos sino en Unidades Fijas**. Un dictamen que diga "300 UF" no le sirve al ciudadano; para decir cuánto es en pesos hay que multiplicar por el valor vigente de la UF, que **cambia cada seis meses**. Esto significa que el valor de la UF **no puede vivir dentro del corpus de embeddings** (quedaría congelado y desactualizado): tiene que ser un dato consultado aparte al momento de generar el dictamen.

## Valor vigente

**$1.173,08 por UF** — vigente del **02/09/2026 al 01/03/2027**

Ejemplo aplicado: estacionar en rampa para discapacidad en CABA (Ley 451 art. 6.1.52, 300 UF) = **$351.924** al 07/09/2026.

## Historial reciente

| Valor por UF | Vigencia |
|---|---|
| $1.173,08 | 02/09/2026 – 01/03/2027 |
| $949,99 | 03/03/2026 – 01/09/2026 |
| $798,51 | 02/09/2025 – 02/03/2026 |
| $731,62 | 06/03/2025 – 01/09/2025 |
| $630,20 | 03/09/2024 – 05/03/2025 |

## Base legal

El valor lo determina el organismo cada seis meses conforme a la Ley 451 y su Decreto Reglamentario 64/22. La UF equivale al "precio promedio medido en la Ciudad de Buenos Aires de medio (1/2) litro de nafta de mayor octanaje".

## Implicancia de arquitectura (para REP-2907 / REP-2906)

Sugerido: guardar en el corpus el monto en UF (que es lo que dice la norma y es estable) y resolver la conversión a pesos en tiempo de generación del dictamen, leyendo el valor vigente de una tabla de configuración actualizable — no hardcodearlo ni embeberlo. Equivalente bonaerense pendiente de investigar (las multas de PBA se expresan en "Unidades Fijas" provinciales o en sueldos mínimos según la norma).
