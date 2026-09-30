# Pendientes del corpus legal — estado al 07/09/2026 (segunda ronda de descarga)

Registro vivo de lo que falta y de lo que ya se descartó como vía muerta, para que la próxima ronda no repita búsquedas.

## Resueltos

| Ref. | Pendiente original | Cómo se resolvió |
|---|---|---|
| P-1 | Marco legal de CABA para alumbrado y desagües | Ley 210 — Ente Único Regulador. Ver `ley_210_caba_ente_regulador.md`. La figura no es "obligación del municipio" como en PBA sino "ente que controla al prestador y tramita reclamos" |
| P-2 | Confirmar texto de Constitución PBA arts. 190/192 | Descargado. Art. 192 inc. 4 dice textualmente "la vialidad pública". Ver `constitucion_pba_arts_190_192.md` |
| P-3 | Boletín Oficial de Avellaneda posterior a 2020 | **Resuelto por otra vía.** El sitio del municipio (`mda.gob.ar`) está roto, pero **SIBOM tiene Avellaneda al día**: `sibom.slyt.gba.gob.ar/cities/6` — boletín 136º publicado el 02/09/2026, 135º el 10/08/2026, 134º el 28/07/2026. **La fuente viva de ordenanzas de Avellaneda es SIBOM, no el sitio municipal** |
| P-5 | Artículo exacto de Ley 451 con la multa de tránsito en CABA | Art. **6.1.52** (100 UF general / 300 UF rampas) y **6.1.37** (obstrucción). Ver `ley_451_caba_art_6.1.52_y_6.1.37.md` |
| P-7 | ¿Hay modificación del 6.1.52 posterior a Ley 5905 (2017)? | **No la hay.** El texto consolidado oficial cierra la cadena en "Conf. Ley N° 5905/17, BOCBA N° 5273 del 13/12/2017". Verificado sobre el PDF completo |

## Parcialmente resuelto

| Ref. | Estado |
|---|---|
| **P-6** | **La Ordenanza 7180 de Avellaneda quedó identificada: es el Código Municipal de Faltas** del partido, vigente "y sus modificatorias" (una sería la Ord. 8768). Confirmado por dos fuentes oficiales del propio municipio. **Pero su texto articulado no está en línea**: es anterior a la digitalización (SIBOM tiene Avellaneda desde ~2017). Ver `avellaneda_ordenanza_7180_codigo_faltas.md`. **La vía que queda es institucional, no web**: pedirlo a la Secretaría Legal y Técnica o al Juzgado de Faltas del municipio |

## Abiertos

| Ref. | Qué falta | Impacto |
|---|---|---|
| P-8 | Equivalente bonaerense de la Unidad Fija (cómo se expresan los montos de multa en Avellaneda). Nota: la Ord. 27235 de Avellaneda ya usa "UF", así que probablemente exista una unidad municipal propia | Medio — necesario para dar montos en pesos en Avellaneda |
| P-9 | Comercio irregular en Avellaneda (habilitaciones comerciales). Solo ubicadas las páginas de trámites en `mda.gob.ar`, sin articulado | Medio — categoría del MVP sin corpus |
| P-10 | Ordenanza 30945 de Avellaneda (actividades comerciales en zona de reserva ambiental). Ubicada en SIBOM, no descargada | Bajo — caso de nicho |
| P-11 | Ambiente en CABA: no se investigó el marco de higiene urbana más allá de la mención en Ley 210 art. 2 inc. c) | Medio |

## Herramienta nueva disponible

`tools/extraer_pdf.py` — extractor de texto de PDF que usa **solo la librería estándar de Python** (no hubo que instalar nada). Uso:

```
python tools/extraer_pdf.py archivo.pdf salida.txt
```

Funcionó con el PDF consolidado de la Ley 451 (688.000 caracteres). El texto sale fragmentado palabra por palabra: para leerlo conviene reagrupar con `re.sub(r'\s+', ' ', texto)`.

**Limitación conocida:** no sirve con PDF que usan fuentes CID con CMap propia — ahí devuelve símbolos sin sentido. Es lo que pasa con los boletines de SIBOM (`sibom_boletin_4592.pdf`). Para esos, usar la versión HTML del boletín: `sibom.slyt.gba.gob.ar/bulletins/<id>/contents/<id>`.

## Vías muertas comprobadas (no reintentar igual)

- `mda.gob.ar` — certificado SSL inválido, no se puede leer automáticamente. **Usar SIBOM en su lugar** (`sibom.slyt.gba.gob.ar/cities/6` para Avellaneda).
- `ciudadyderechos.org.ar` — protocolo SSL obsoleto, sitio inaccesible.
- `ligadelconsorcista.org` — HTTP 403 a la lectura automatizada.
- PDF de boletines de SIBOM — fuentes CID, extracción ilegible. Usar las páginas HTML `/contents/`.
- Buscar "Ordenanza 7180" sin acotar municipio — devuelve las 7180 de Nueve de Julio, Coronel Suárez, Pinamar, Campana, Moreno, Saavedra, Puan y Dolores.
- Páginas muy largas de JURISTECA y del Boletín Oficial de CABA — la lectura automática se trunca antes de llegar a las secciones finales. Para Ley 451, usar el PDF consolidado ya descargado en `pdf/`.

## Nota sobre el buscador de SIBOM

Los resultados de búsqueda de SIBOM aparecen indexados con **URLs de spam** (consultas inyectadas con texto sobre venta de tarjetas de crédito). Es contenido basura que alguien metió en el buscador público del sitio del gobierno provincial; no afecta los boletines en sí, pero conviene no seguir esos enlaces ni confiar en resultados que los incluyan.


---

# Actualización — 28/09/2026 (REP-3797, Sprint 14)

Ronda de ampliación del corpus a las cinco categorías. Lo que sigue **reemplaza** el estado de los pendientes que menciona.

## Resueltos en esta ronda

| Ref. | Pendiente | Cómo se resolvió |
|---|---|---|
| P-9 | Comercio irregular en Avellaneda | **Resuelto por norma de rango superior.** LOM art. 27 incs. 1 y 6: la habilitación y el funcionamiento de establecimientos comerciales y de mercados es materia municipal. Organismo: Subsecretaría de Habilitaciones, dentro de la Secretaría de Producción, Comercio y Ambiente. Ver `LOM_decreto_ley_6769-58_art_27.md` y `canales_oficiales_derivacion.md`. Sigue faltando el articulado municipal propio (Ord. 7180 y las de habilitaciones) |
| P-11 | Ambiente en CABA más allá de la Ley 210 art. 2 inc. c) | **Resuelto.** Ley 1854 (Basura Cero): art. 14 separación en origen, art. 16 disposición inicial y art. 36 prohibición de basura a cielo abierto y micro basurales. Ver `ley_1854_caba_basura_cero.md` |
| — | Comercio irregular en CABA (no estaba ni registrado como pendiente) | **Resuelto.** Ley 6101 art. 8: "No podrán ejercerse actividades económicas sin la clase de autorización correspondiente". Organismo: Agencia Gubernamental de Control (art. 6). Sanciones: Ley 451 arts. 4.1.1 y 4.1.2 |
| — | Vulnerabilidad social en las dos jurisdicciones | **Resuelto.** Nacional: Ley 27.654 (orden público en todo el país, con art. 3 sustituido por el Decreto 373/2025). CABA: Leyes 3706 y 4036. Provincia de Buenos Aires: **Ley 15.625**, sancionada el 27/08/2026, que deroga la 13.956 |
| — | Infraestructura en CABA: quién repara la vereda | **Resuelto.** Ley 5902: la obligación es del propietario frentista (art. 5), con eximiciones (art. 7) y competencia exclusiva del GCBA para vados y rampas (art. 8) |
| — | `mda.gob.ar` registrado como vía muerta por SSL | **Ya no lo es.** Al 28/09/2026 el sitio de la Municipalidad de Avellaneda responde correctamente por HTTPS y fue la fuente de todos los datos institucionales de Avellaneda de esta ronda |

## Nuevos pendientes

| Ref. | Qué falta | Impacto |
|---|---|---|
| P-12 | Ordenanzas propias de Avellaneda (higiene urbana, residuos, habilitaciones, Ord. 7180). La entrada correcta es `sibom.slyt.gba.gob.ar/cities/6`; el buscador general de SIBOM devuelve normas de otros partidos y hace perder tiempo | Medio — hoy Avellaneda se funda en normativa provincial, que es válida pero menos específica |
| P-13 | Articulado de la **Ley 5901** (CABA, aperturas y roturas en la vía pública). El Anexo I está sólo en la separata PDF del BOCBA N° 5274 y `documentosboletinoficial.buenosaires.gob.ar` devuelve `ERR_EMPTY_RESPONSE` a la lectura automatizada | Medio — es el fundamento de "la vereda la rompió una empresa de servicios", caso al que remite la Ley 5902 art. 7 |
| P-14 | Código de Habilitaciones y Verificaciones de CABA (Ordenanza 34.421), en particular el régimen de permisos de venta en la vía pública | Bajo — la Ley 6101 ya da la obligación general y la Ley 451 art. 4.1.2 la sanción |
| P-15 | Número del Sistema Provincial de Atención Telefónica creado por la Ley 15.625 art. 14, y la reglamentación de esa ley | Medio — sin ese dato, un caso de vulnerabilidad social en Avellaneda se deriva al canal municipal, que no tiene guardia 24 h para personas adultas |
| P-16 | Leyes ambientales de respaldo a las que remite la Ley 13.592: Ley 11.723 (PBA), 25.675 y 25.916 (nacionales) | Bajo — ampliación, no hueco de cobertura |

## Vías muertas nuevas

- `documentosboletinoficial.buenosaires.gob.ar` (separatas PDF del BOCBA) — `ERR_EMPTY_RESPONSE`.
- `cijur.mpba.gov.ar` — HTTP 403 a la lectura automatizada. Para leyes provinciales usar `normas.gba.gob.ar`, que sí responde y trae el texto actualizado.
- **`avellaneda.gob.ar` no es Avellaneda de Buenos Aires**, es Avellaneda de Santa Fe. El dominio del partido bonaerense es `mda.gob.ar`.

## Nota de método que conviene no perder

El **Decreto nacional 373/2025** cita en sus considerandos a la Ley 13.956 de la Provincia de Buenos Aires como norma vigente. No lo está: la Ley 15.625 la derogó por completo. Una norma que habla de otra **no acredita la vigencia de esa otra**. La vigencia se verifica siempre en la fuente oficial de la jurisdicción que la dictó.
