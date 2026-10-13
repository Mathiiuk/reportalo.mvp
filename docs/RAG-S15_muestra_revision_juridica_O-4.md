# Muestra para la revisión jurídica (O-4) · 14 fundamentos reales

**Fecha:** 13/10/2026 · **De:** Matías Krepchuk · **Para:** Hernán Gregorini (PO) · **Con copia a:** Leonel Nuñez
**Qué es:** pedido 6 de tu LEEME (`Entrega_Matias_RAG_Sprint15`, sección 8). Son los 14 reportes de la muestra que sugeriste, con **el texto real que hoy guarda la base de staging** (lectura del 13/10/2026), sin retocar.

> **Para leer primero.**
> - Todos estos análisis se hicieron con el **prompt v3** y con el corpus **anterior al lote 3**, porque son de la batería del 07/10. No reflejan la v5 ni las normas nuevas: sirven para revisar el contenido que ya vio un ciudadano.
> - Como dijiste: *una cita existente y un JSON válido no prueban que el artículo sea pertinente*. La revisión es sobre el contenido.
> - Cada cita pasó la validación automática (el texto citado aparece literal en el fragmento y el fragmento corresponde a la jurisdicción). **No se validó** la pertinencia jurídica: eso es lo que revisás vos.
> - Los textos de `Fundamento para el ciudadano` y `Fundamento oficial` son los de la base. Las comillas tipográficas y los saltos de línea de las citas están tal cual.

## Qué mirar en cada uno (sugerencia de checklist)

1. ¿La norma citada es **aplicable al hecho** descrito (no solo de la jurisdicción correcta)?
2. ¿El fundamento **afirma de más**? (infracción acreditada, obligación absoluta, una sanción)
3. ¿Recoge las **excepciones o salvedades** del artículo citado?
4. ¿Falta alguna norma **más pertinente** de la lista de aceptables de la sección 5 de tu LEEME?
5. ¿El texto para el ciudadano es **llano** y no menciona montos ni sanciones?

## Resumen

| # | Reporte | Categoría · zona | Texto del reclamo | Estado | ¿Infracción? | Normas citadas |
|---|---|---|---|---|---|---|
| 1 | #RP-325C374A | Tránsito · CABA (Flores) | Auto estacionado sobre la vereda, tapando la rampa y el paso peatonal de la esquina. | fundamentado | sí | Ley 451 arts. 6.1.37, 6.1.52, 6.1.54 · Ley 2148 arts. 7.1.8 b) y 7.1.9 h) |
| 2 | #RP-4B08D2A7 | Tránsito · CABA (Flores) | auto en vereda | fundamentado | sí | Ley 451 arts. 6.1.54 y 6.1.37 |
| 3 | #RP-420F6269 | Tránsito · Avellaneda (Gerli) | Auto estacionado sobre la vereda, tapando la rampa y el paso peatonal de la esquina. | fundamentado | sí | Ley 24.449 art. 49 b) ap. 3 y ap. 1 |
| 4 | #RP-EC62188D | Tránsito · Avellaneda (Gerli) | auto en vereda | fundamentado | sí | Ley 24.449 art. 49 b) ap. 3 |
| 5 | #RP-C35021EB | Ambiente · CABA (Flores) | Hay bolsas de basura acumuladas en la vereda y en la calle junto al contenedor, hace días. | fundamentado | sí | Ley 1854 art. 36 · Ley 451 art. 1.3.13 |
| 6 | #RP-11FA2B6B | Ambiente · CABA (Flores) | basura tirada | fundamentado | sí | Ley 1854 art. 36 · Ley 451 art. 1.3.13 |
| 7 | #RP-F9CE1F6D | Ambiente · Avellaneda (Gerli) | Hay bolsas de basura acumuladas en la vereda y en la calle junto al contenedor, hace días. | fundamentado | sí | Ley 13.592 art. 3 inc. 12 · DL 8751/77 art. 4 bis |
| 8 | #RP-B48F6351 | Ambiente · Avellaneda (Gerli) | basura tirada | fundamentado | sí | Ley 13.592 art. 3 inc. 12 · Ley 11.723 art. 65 · DL 6769/58 art. 27 inc. 8 |
| 9 | #RP-E9762392 | Comercio irregular · CABA (Flores) | Puestos de venta ambulante sobre la vereda ocupando el espacio público de la zona. | fundamentado | sí | Ley 451 art. 4.1.2 · Ley 1166 Anexo I 11.1.2 |
| 10 | #RP-83F61446 | Comercio irregular · CABA (Flores) | Venta ambulante en la vereda | fundamentado | sí | Ley 451 art. 4.1.2 · Ley 1166 Anexo I 11.1.2 |
| 11 | #RP-962801E9 | Comercio irregular · Avellaneda (Gerli) | Venta de mercadería en la calle sin habilitación ni controles de higiene y seguridad. | fundamentado | sí | DL 8751/77 art. 4 bis (inc. a y c) |
| 12 | #RP-7D5660F7 | Infraestructura · Avellaneda (Gerli) | Hay un bache grande y profundo en el medio de la calle que rompe las gomas de los autos. | fundamentado | **no** | DL 6769/58 arts. 27 inc. 2 y 59 · canal CAV Avellaneda |
| 13 | #RP-282CFD99 | Infraestructura · Avellaneda (Gerli) | bache grande | fundamentado | **no** | DL 6769/58 arts. 27 inc. 2 y 59 |
| 14 | #RP-94CC4AB0 | Infraestructura · Avellaneda (Gerli) | Zona sin iluminación que afecta la seguridad de peatones y vehículos por la noche. | fundamentado | **no** | DL 6769/58 arts. 52 y 59 |

**Para tener en cuenta al leer:**
- Los casos 11 a 14 son los de **Avellaneda que hoy se apoyan en la Ley Orgánica de las Municipalidades y el Código de Faltas Municipal**, sin la Ordenanza Fiscal 31321 (que recién entró al corpus con el lote 3).
- El caso 11 (#RP-962801E9) fundamenta la falta de habilitación con el art. 4 bis del DL 8751/77 y **no** con el permiso previo de la Ordenanza Fiscal; el contenido se apoya en higiene y bromatología, no en el permiso de ocupación del espacio público. Es el tipo de caso donde conviene tu criterio.
- Los casos 12 a 14 salen con `es_infracción = no` (servicio municipal), como pediste para D3.

---

## Detalle

### 1 · #RP-325C374A · Tránsito · CABA (Flores)
**Reclamo:** Auto estacionado sobre la vereda, tapando la rampa y el paso peatonal de la esquina.
**Estado:** fundamentado · **Infracción:** sí · **Prompt:** v3

**Fundamento para el ciudadano:** No está permitido estacionar sobre la vereda ni obstruir las rampas para personas con discapacidad o el paso peatonal en las esquinas.

**Fundamento oficial:** El hecho constituye infracción al artículo 7.1.8 inc. b) y 7.1.9 inc. h) del Código de Tránsito y Transporte (Ley 2148), así como a los artículos 6.1.37, 6.1.52 y 6.1.54 del Régimen de Faltas (Ley 451), los cuales prohíben estacionar en esquinas, frente a vados o rampas para personas con discapacidad, sobre aceras y obstruir veredas o rampas destinadas a personas con discapacidad.

**Citas:**
- *Ley 451 (CABA) — Régimen de Faltas > Artículo 6.1.37 (obstrucción de vía):* «El/la conductor/a de un vehículo que cause la obstrucción de la vía transversal, ciclovías, veredas o estacionamientos reservados, es sancionado/a con multa de setenta (70) unidades fijas. Cuando la obstrucción se produzca, carriles exclusivos y/o preferenciales, METROBUS y Premetro, la multa se elevará al doble. Cuando la obstrucción se produzca en rampas para discapacitados o en lugares reservados para vehículos de personas con discapacidad es sancionado/a con multa de trescientas (300) unidades fijas.»
- *Ley 2148 (CABA) — Código de Tránsito y Transporte > Título VII > Artículo 7.1.8 (prohibiciones especiales) > inciso b):* «En las esquinas, entre su vértice ideal y la línea imaginaria que resulte de prolongar la ochava así como también sobre la demarcación horizontal de sendas peatonales o líneas de pare.»
- *Ley 451 (CABA) — Régimen de Faltas > Artículo 6.1.54 (estacionamiento en áreas peatonales):* «El/la conductor/a, titular o responsable de un automotor, motovehículo, acoplado o semiacoplado que estacione o se detenga en arterias peatonales o sobre las aceras de cualquier arteria u ocupando parte de ella, es sancionado/a con multa de trescientas (300) unidades fijas.»
- *Ley 2148 (CABA) — Código de Tránsito y Transporte > Título VII > Artículo 7.1.9 (prohibiciones generales) > inciso h):* «Frente a los vados o rampas para personas con discapacidad.»
- *Ley 451 (CABA) — Régimen de Faltas > Artículo 6.1.52 (estacionamiento o detención prohibida):* «Cuando el estacionamiento se realice en lugares reservados para vehículos de personas con discapacidad o rampas para discapacitados es sancionado/a con multa de trescientas (300) unidades fijas.»

### 2 · #RP-4B08D2A7 · Tránsito · CABA (Flores)
**Reclamo:** auto en vereda
**Estado:** fundamentado · **Infracción:** sí · **Prompt:** v3

**Fundamento para el ciudadano:** Está prohibido estacionar o detener vehículos sobre las veredas o aceras, así como causar su obstrucción.

**Fundamento oficial:** La conducta vulnera lo dispuesto en el artículo 6.1.54 de la Ley 451 de la Ciudad Autónoma de Buenos Aires, que tipifica como infracción estacionar o detener un automotor sobre las aceras de cualquier arteria u ocupando parte de ellas, así como el artículo 6.1.37 del mismo cuerpo normativo respecto de la obstrucción de veredas.

**Citas:**
- *Ley 451 (CABA) — Régimen de Faltas > Artículo 6.1.54 (estacionamiento en áreas peatonales):* «El/la conductor/a, titular o responsable de un automotor, motovehículo, acoplado o semiacoplado que estacione o se detenga en arterias peatonales o sobre las aceras de cualquier arteria u ocupando parte de ella»
- *Ley 451 (CABA) — Régimen de Faltas > Artículo 6.1.37 (obstrucción de vía):* «El/la conductor/a de un vehículo que cause la obstrucción de la vía transversal, ciclovías, veredas o estacionamientos reservados»

### 3 · #RP-420F6269 · Tránsito · Avellaneda (Gerli)
**Reclamo:** Auto estacionado sobre la vereda, tapando la rampa y el paso peatonal de la esquina.
**Estado:** fundamentado · **Infracción:** sí · **Prompt:** v3

**Fundamento para el ciudadano:** No está permitido estacionar sobre veredas ni sobre sendas para peatones. La única excepción es que exista una señal expresa que lo permita en la parte externa de la vereda, siempre que esta mida más de 2 metros de ancho y el flujo de peatones lo posibilite. Además, está prohibido estacionar en sitios donde se comprometa la seguridad, visibilidad o fluidez de la circulación.

**Fundamento oficial:** La conducta vulnera lo dispuesto en el art. 49, inc. b), ap. 3 de la Ley 24.449, que prohíbe estacionar o detenerse voluntariamente sobre sendas peatonales y aceras, contemplando como salvedad la autorización expresa mediante señalización en la parte externa de veredas superiores a 2,00 metros y según la intensidad peatonal. Asimismo, transgrede el art. 49, inc. b), ap. 1 de la misma ley, en cuanto prohíbe el estacionamiento en lugares donde se afecte la seguridad, visibilidad o fluidez del tránsito.

**Citas:**
- *Ley 24.449 — Ley de Tránsito > Artículo 49 (estacionamiento) > inciso b) > apartado 3 (texto según Ley 25.965):* «3. Sobre la senda para peatones o bicicletas, aceras, rieles, sobre la calzada, y en los diez metros anteriores y posteriores a la parada del transporte de pasajeros. Tampoco se admite la detención voluntaria. No obstante se puede autorizar, señal mediante, a estacionar en la parte externa de la vereda cuando su ancho sea mayor a 2,00 metros y la intensidad de tráfico peatonal así lo permita.»
- *Ley 24.449 — Ley de Tránsito > Artículo 49 (estacionamiento) > inciso b) > 1:* «1. En todo lugar donde se pueda afectar la seguridad, visibilidad o fluidez del tránsito o se oculte la señalización;»

### 4 · #RP-EC62188D · Tránsito · Avellaneda (Gerli)
**Reclamo:** auto en vereda
**Estado:** fundamentado · **Infracción:** sí · **Prompt:** v3

**Fundamento para el ciudadano:** No está permitido estacionar vehículos sobre las aceras ni detenerse en ellas de forma voluntaria. No obstante, la normativa contempla que se puede autorizar mediante señalización estacionar en la parte externa de la vereda si mide más de 2 metros y el flujo peatonal lo permite.

**Fundamento oficial:** Conforme al artículo 49, inciso b), apartado 3 de la Ley 24.449, en zona urbana no se debe estacionar ni autorizarse el estacionamiento sobre aceras, ni se admite la detención voluntaria. La norma contiene la salvedad de que 'se puede autorizar, señal mediante, a estacionar en la parte externa de la vereda cuando su ancho sea mayor a 2,00 metros y la intensidad de tráfico peatonal así lo permita'.

**Citas:**
- *Ley 24.449 — Ley de Tránsito > Artículo 49 (estacionamiento) > inciso b) > apartado 3 (texto según Ley 25.965):* «No se debe estacionar ni autorizarse el mismo: 3. Sobre la senda para peatones o bicicletas, aceras, rieles, sobre la calzada, y en los diez metros anteriores y posteriores a la parada del transporte de pasajeros. Tampoco se admite la detención voluntaria. No obstante se puede autorizar, señal mediante, a estacionar en la parte externa de la vereda cuando su ancho sea mayor a 2,00 metros y la intensidad de tráfico peatonal así lo permita.»

### 5 · #RP-C35021EB · Ambiente · CABA (Flores)
**Reclamo:** Hay bolsas de basura acumuladas en la vereda y en la calle junto al contenedor, hace días.
**Estado:** fundamentado · **Infracción:** sí · **Prompt:** v3

**Fundamento para el ciudadano:** La normativa de la Ciudad prohíbe expresamente arrojar residuos o desperdicios a la vía pública, así como la descarga de basura a cielo abierto y la generación de microbasurales.

**Fundamento oficial:** El hecho reportado constituye una infracción conforme al artículo 1.3.13 de la Ley 451, que tipifica el arrojo de residuos, desperdicios o desechos a la vía pública, y vulnera asimismo el artículo 36 de la Ley 1854, que prohíbe la descarga de basura a cielo abierto y la creación de micro basurales.

**Citas:**
- *Ley 1854 (CABA) — Basura Cero > Capítulo IX > Artículo 36 (prohibición de basura a cielo abierto):* «Prohíbese la descarga de basura a cielo abierto y la creación de micro basurales.»
- *Ley 451 (CABA) — Régimen de Faltas > Artículo 1.3.13 (arrojar residuos):* «El/la que arroje residuos, desperdicios, deshechos u otros objetos a la vía pública»

### 6 · #RP-11FA2B6B · Ambiente · CABA (Flores)
**Reclamo:** basura tirada
**Estado:** fundamentado · **Infracción:** sí · **Prompt:** v3

**Fundamento para el ciudadano:** No está permitido tirar basura, residuos o desperdicios en la vía pública ni formar basurales a cielo abierto.

**Fundamento oficial:** El hecho configura una infracción conforme al artículo 1.3.13 de la Ley 451 de la Ciudad Autónoma de Buenos Aires, que sanciona a quien arroje residuos, desperdicios, deshechos u otros objetos a la vía pública, en concordancia con el artículo 36 de la Ley 1854, que prohíbe la descarga de basura a cielo abierto y la creación de micro basurales.

**Citas:**
- *Ley 1854 (CABA) — Basura Cero > Capítulo IX > Artículo 36 (prohibición de basura a cielo abierto):* «Prohíbese la descarga de basura a cielo abierto y la creación de micro basurales.»
- *Ley 451 (CABA) — Régimen de Faltas > Artículo 1.3.13 (arrojar residuos):* «El/la que arroje residuos, desperdicios, deshechos u otros objetos a la vía pública, a partes comunes de edificios de propiedad horizontal o a predios linderos»

### 7 · #RP-F9CE1F6D · Ambiente · Avellaneda (Gerli)
**Reclamo:** Hay bolsas de basura acumuladas en la vereda y en la calle junto al contenedor, hace días.
**Estado:** fundamentado · **Infracción:** sí · **Prompt:** v3

**Fundamento para el ciudadano:** La acumulación de basura en la vereda y en la calle afecta las condiciones de higiene y salubridad de los espacios públicos, las cuales deben ser preservadas y cuya recolección constituye un servicio esencial para la comunidad.

**Fundamento oficial:** El hecho descripto vulnera las condiciones de salubridad e higiene exigibles en la vía pública. De acuerdo con el art. 4 bis inc. a) del Decreto-Ley 8751/77, se consideran faltas de especial gravedad las infracciones a las ordenanzas relativas a las condiciones de higiene y salubridad de los sitios públicos; asimismo, la Ley 13.592 (art. 3 inc. 12) consagra que la recolección de residuos es un servicio esencial para garantizar la salubridad y la preservación ambiental, recayendo su gestión en la órbita municipal (art. 65, Ley 11.723).

**Citas:**
- *Ley 13.592 (PBA) — GIRSU > Título I > Capítulo I > Artículo 3 (principios) > inciso 12:* «La recolección y tratamiento de residuos es un servicio de carácter esencial para la comunidad, en garantía de la salubridad y la preservación del ambiente.»
- *Decreto-Ley 8751/77 (PBA) — Código de Faltas Municipales > Título II > Artículo 4 bis (faltas de especial gravedad, incorporado por Ley 11.723):* «Condiciones de higiene y salubridad que deben reunir los sitios públicos, los lugares de acceso público y los terrenos baldíos.»

> **Observación para tu revisión:** el fundamento oficial menciona el art. 65 de la Ley 11.723, pero ese artículo **no está entre las citas** de este reporte (solo figuran la Ley 13.592 y el DL 8751/77). Es una mención en el texto sin cita que la respalde.

### 8 · #RP-B48F6351 · Ambiente · Avellaneda (Gerli)
**Reclamo:** basura tirada
**Estado:** fundamentado · **Infracción:** sí · **Prompt:** v3

**Fundamento para el ciudadano:** La presencia de basura acumulada o arrojada en la vía pública compromete la higiene y la salubridad del entorno. La recolección de los residuos es un servicio esencial para la comunidad y una responsabilidad del ámbito municipal para proteger el ambiente y evitar focos de contaminación.

**Fundamento oficial:** Conforme al art. 3 inc. 12 de la Ley 13.592 de la Provincia de Buenos Aires, la recolección y tratamiento de residuos sólidos urbanos constituye un servicio esencial para garantizar la salubridad y la preservación ambiental. Asimismo, el art. 65 de la Ley 11.723 establece que la gestión de todo residuo no categorizado como especial, patogénico o radioactivo resulta de incumbencia y responsabilidad municipal, complementado por la obligación del Municipio de fiscalizar acciones u omisiones que menoscaben el ambiente (art. 6 de la Ley 11.723) y de reglar las condiciones de higiene y salubridad de los sitios públicos (art. 27 inc. 8 del Decreto-Ley 6769/58).

**Citas:**
- *Ley 13.592 (PBA) — GIRSU > Título I > Capítulo I > Artículo 3 (principios) > inciso 12:* «La recolección y tratamiento de residuos es un servicio de carácter esencial para la comunidad, en garantía de la salubridad y la preservación del ambiente.»
- *Ley 11.723 (PBA) — Medio Ambiente > Título III > Capítulo VII > Artículo 65 (los residuos son responsabilidad municipal):* «La gestión de todo residuo que no esté incluido en las categorías de residuo especial, patogénico y radioactivo, será de incumbencia y responsabilidad municipal.»
- *Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 27 > inciso 8:* «Las condiciones de higiene y salubridad que deben reunir los sitios públicos, los lugares de acceso público y los baldíos.»

> **Observación para tu revisión:** el fundamento oficial menciona el **art. 6 de la Ley 11.723** (fiscalización municipal) pero ese artículo **no figura entre las citas**. Además el texto afirma `infracción = sí` apoyándose en normas de **competencia y servicio** (arts. 3 inc. 12, 65 y 27 inc. 8), no en una norma que tipifique la conducta.

### 9 · #RP-E9762392 · Comercio irregular · CABA (Flores)
**Reclamo:** Puestos de venta ambulante sobre la vereda ocupando el espacio público de la zona.
**Estado:** fundamentado · **Infracción:** sí · **Prompt:** v3

**Fundamento para el ciudadano:** La normativa de la Ciudad prohíbe realizar venta, comercialización o cualquier actividad comercial en el espacio público a toda persona que no cuente con un permiso de uso otorgado a su favor.

**Fundamento oficial:** Conforme al artículo 11.1.2 del Anexo I de la Ley 1166 de la CABA, se encuentra prohibida la venta, comercialización o ejercicio de actividad comercial en el Espacio Público a quien no cuente con un permiso de uso otorgado en los términos de dicha norma. Asimismo, el artículo 4.1.2 de la Ley 451 tipifica y sanciona la venta de mercaderías en la vía pública sin permiso o en infracción con la autorización otorgada.

**Citas:**
- *Ley 451 (CABA) — Régimen de Faltas > Sección 4 > Capítulo I > Artículo 4.1.2 (venta en la vía pública sin autorización):* «El/la que venda mercaderías en la vía pública sin permiso o en infracción con la autorización otorgada, es sancionado/a»
- *Ley 1166 (CABA) — Anexo I > Sección 11 Permisos de uso en el Espacio Público > Capítulo 11.1 > 11.1.2 (prohibición):* «Prohíbese la venta, comercialización o ejercicio de actividad comercial y la elaboración o expendio de productos alimenticios, en el Espacio Público de la Ciudad Autónoma de Buenos Aires, a toda persona que no tenga otorgado a su favor un permiso de uso, en los términos detallados en la presente Sección.»

> **Observación para tu revisión:** el reclamo no dice si hay permiso, pero el fundamento afirma `infracción = sí` sin la salvedad del permiso. La **regla D5 (prompt v5)** se agregó justamente para esto; este análisis es anterior a ella.

### 10 · #RP-83F61446 · Comercio irregular · CABA (Flores)
**Reclamo:** Venta ambulante en la vereda
**Estado:** fundamentado · **Infracción:** sí · **Prompt:** v3

**Fundamento para el ciudadano:** La actividad comercial o venta de mercaderías en el espacio público y la vía pública está prohibida para cualquier persona que no cuente con un permiso de uso otorgado a su favor.

**Fundamento oficial:** Conforme al punto 11.1.2 del Anexo I de la Ley 1166, se encuentra prohibida la venta, comercialización o ejercicio de actividad comercial en el Espacio Público de la Ciudad Autónoma de Buenos Aires a toda persona que no posea un permiso de uso otorgado a su favor. Asimismo, el artículo 4.1.2 de la Ley 451 tipifica y sanciona la venta de mercaderías en la vía pública sin contar con el debido permiso o en infracción a la autorización conferida.

**Citas:**
- *Ley 451 (CABA) — Régimen de Faltas > Sección 4 > Capítulo I > Artículo 4.1.2 (venta en la vía pública sin autorización):* «El/la que venda mercaderías en la vía pública sin permiso o en infracción con la autorización otorgada»
- *Ley 1166 (CABA) — Anexo I > Sección 11 Permisos de uso en el Espacio Público > Capítulo 11.1 > 11.1.2 (prohibición):* «Prohíbese la venta, comercialización o ejercicio de actividad comercial y la elaboración o expendio de productos alimenticios, en el Espacio Público de la Ciudad Autónoma de Buenos Aires, a toda persona que no tenga otorgado a su favor un permiso de uso, en los términos detallados en la presente Sección.»

> **Observación para tu revisión:** mismo punto que el caso 9 (sin salvedad del permiso).

### 11 · #RP-962801E9 · Comercio irregular · Avellaneda (Gerli)
**Reclamo:** Venta de mercadería en la calle sin habilitación ni controles de higiene y seguridad.
**Estado:** fundamentado · **Infracción:** sí · **Prompt:** v3

**Fundamento para el ciudadano:** La realización de actividades comerciales sin la debida habilitación y sin cumplir con las normas de higiene y salubridad en la vía pública vulnera las regulaciones locales, considerándose faltas que atentan contra la salubridad y el control de la actividad comercial.

**Fundamento oficial:** El hecho denunciado encuadra en las faltas de especial gravedad tipificadas en el artículo 4 bis del Decreto-Ley 8751/77, que comprende las infracciones a las ordenanzas reguladoras de las 'Condiciones de higiene y salubridad que deben reunir los sitios públicos, los lugares de acceso público' (inciso a) y las 'normas higiénico-sanitarias, bromatológicas y de identificación comercial' (inciso c), así como la falta de habilitación de conformidad con las facultades regulatorias municipales.

**Citas:**
- *Decreto-Ley 8751/77 (PBA) — Código de Faltas Municipales > Título II > Artículo 4 bis (faltas de especial gravedad, incorporado por Ley 11.723):* «Inciso c): Elaboración, transporte, expendio y consumo de productos alimentarios y las normas higiénico-sanitarias, bromatológicas y de identificación comercial.»

> **Observación para tu revisión:** el fundamento oficial menciona el **inciso a)** del art. 4 bis, pero la **única cita** es el inciso c). Y la parte «falta de habilitación» se apoya en «facultades regulatorias municipales» sin una cita específica.

### 12 · #RP-7D5660F7 · Infraestructura · Avellaneda (Gerli)
**Reclamo:** Hay un bache grande y profundo en el medio de la calle que rompe las gomas de los autos.
**Estado:** fundamentado · **Infracción:** no · **Prompt:** v3

**Fundamento para el ciudadano:** El municipio tiene la responsabilidad de reglamentar y atender la conservación de las calles y las obras de infraestructura vial como la pavimentación y repavimentación, en las situaciones que no correspondan a la provincia. Podés ingresar este reclamo ante el Centro de Atención al Vecino (CAV) para obtener un número de seguimiento.

**Fundamento oficial:** Conforme al art. 27 inc. 2 del Decreto-Ley 6769/58 (Ley Orgánica de las Municipalidades), compete a la función municipal reglamentar la conservación de calles en situaciones no comprendidas en la órbita provincial, catalogándose las tareas de pavimentación y repavimentación como obras públicas de infraestructura urbana bajo el art. 59 inc. d del mismo cuerpo normativo. La vía administrativa de canalización se encuentra reglada a través del Centro de Atención al Vecino (CAV).

**Citas:**
- *Municipalidad de Avellaneda > Centro de Atención al Vecino (CAV):* «Centro de Atención al Vecino (CAV) de la Municipalidad de Avellaneda: es el canal oficial para ingresar un reclamo municipal.»
- *Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 27 > inciso 2:* «El trazado, apertura, rectificación, construcción y conservación de calles, caminos, puentes, túneles, plazas y paseos públicos y las delineaciones y niveles en las situaciones no comprendidas en la competencia provincial.»
- *Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 59:* «Las de infraestructura urbana, en especial las de pavimentación, repavimentación, cercos, veredas, saneamiento, agua corriente, iluminación, electrificación, provisión de gas y redes telefónicas.»

### 13 · #RP-282CFD99 · Infraestructura · Avellaneda (Gerli)
**Reclamo:** bache grande
**Estado:** fundamentado · **Infracción:** no · **Prompt:** v3

**Fundamento para el ciudadano:** El municipio tiene a su cargo la conservación y pavimentación de las calles, consideradas obras públicas y servicios de infraestructura urbana. No obstante, esto rige en las situaciones que no correspondan a la competencia provincial.

**Fundamento oficial:** Conforme al Decreto-Ley 6769/58, corresponde a la función municipal reglamentar la conservación de calles en situaciones no comprendidas en la competencia provincial (art. 27 inc. 2). Asimismo, el art. 59 inc. d califica a las obras de pavimentación y repavimentación como obras públicas municipales de infraestructura urbana.

**Citas:**
- *Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 27 > inciso 2:* «El trazado, apertura, rectificación, construcción y conservación de calles, caminos, puentes, túneles, plazas y paseos públicos y las delineaciones y niveles en las situaciones no comprendidas en la competencia provincial.»
- *Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 59:* «Las de infraestructura urbana, en especial las de pavimentación, repavimentación, cercos, veredas, saneamiento, agua corriente, iluminación, electrificación, provisión de gas y redes telefónicas.»

### 14 · #RP-94CC4AB0 · Infraestructura · Avellaneda (Gerli)
**Reclamo:** Zona sin iluminación que afecta la seguridad de peatones y vehículos por la noche.
**Estado:** fundamentado · **Infracción:** no · **Prompt:** v3

**Fundamento para el ciudadano:** La prestación del servicio público de alumbrado y las obras de infraestructura urbana de iluminación corresponden al ámbito municipal para atender las necesidades de la comunidad, siempre que su ejecución no se encuentre a cargo de la Provincia o de la Nación.

**Fundamento oficial:** Conforme al artículo 52 del Decreto-Ley 6769/58, corresponde al Concejo disponer la prestación de los servicios públicos de alumbrado tendientes a satisfacer necesidades colectivas locales, siempre que su ejecución no se encuentre a cargo de la Provincia o de la Nación. Asimismo, el artículo 59 inciso d) del mismo cuerpo legal califica como obras públicas municipales a las de infraestructura urbana, en especial las de iluminación.

**Citas:**
- *Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 52:* «Corresponde al Concejo disponer la prestación de los servicios públicos de barrido, riego, limpieza, alumbrado, provisión de agua, obras sanitarias y desagües pluviales, inspecciones, registro de guías, transporte y todo otro tendiente a satisfacer necesidades colectivas de carácter local, siempre que su ejecución no se encuentre a cargo de la Provincia o de la Nación.»
- *Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 59:* «Las de infraestructura urbana, en especial las de pavimentación, repavimentación, cercos, veredas, saneamiento, agua corriente, iluminación, electrificación, provisión de gas y redes telefónicas.»

---

## Lo que encontré al armar la muestra (para que lo veas antes de revisar)

1. **Menciones sin cita (casos 7 y 8).** El fundamento oficial nombra artículos (Ley 11.723 art. 65 en el caso 7; Ley 11.723 art. 6 en el caso 8) que no están entre las citas validadas. La validación automática solo comprueba las citas, no las menciones dentro del texto. Es un punto a decidir: ¿se exige que todo artículo mencionado esté citado?
2. **Comercio en CABA sin salvedad del permiso (casos 9 y 10).** Anteriores a la regla D5. Con la v5 el mismo caso pasa a «fundamentado con salvedad».
3. **Caso 11:** la cita (inciso c) y el texto (incisos a y c) no coinciden; la falta de habilitación no tiene cita propia.
4. **Caso 8:** `infracción = sí` apoyado en normas de competencia/servicio.
5. **Casos 12 a 14:** coinciden con el criterio que fijaste para D3: servicio municipal, sin «infracción acreditada».

## Qué necesito de vos

Tu dictamen por caso (**correcto / correcto con observaciones / incorrecto**) y, en los dos últimos, qué norma debería haberse citado. Con eso se arma el número de aciertos jurídicos de la muestra.
