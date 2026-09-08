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
