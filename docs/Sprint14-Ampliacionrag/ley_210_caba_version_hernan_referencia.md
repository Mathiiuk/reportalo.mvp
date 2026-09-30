# Ley 210 (CABA) — Ente Único Regulador de los Servicios Públicos — Arts. 1°, 2° y 3°

**Fuente:** https://boletinoficial.buenosaires.gob.ar/normativaba/norma/4623
**Descargado:** 07/09/2026, vía WebFetch (extracción asistida por IA)
**Aplica a:** CABA exclusivamente
**Uso en el corpus:** **resuelve el pendiente P-1** — es el marco de CABA para reclamos de alumbrado público, higiene urbana y conservación vial. Además identifica al **organismo competente** al que derivar el reclamo.

## Artículo 1° — Definición

"El Ente Unico Regulador de Servicios Públicos creado por el artículo 138 de la Constitución de la Ciudad e instituido en el ámbito del Poder Ejecutivo, es una persona jurídica, autárquica, con independencia funcional y legitimación procesal."

## Artículo 2° — Objeto

"El Ente ejerce el control, seguimiento y resguardo de la calidad de los servicios públicos prestados por la administración central o descentralizada o por terceros, así como el seguimiento de los servicios cuya fiscalización realice la Ciudad de Buenos Aires en forma concurrente con otras jurisdicciones, para la defensa y protección de los derechos de sus usuarios y consumidores, de la competencia y del medio ambiente..."

Servicios públicos comprendidos:

- a) Transporte público de pasajeros
- **b) Alumbrado público y señalamiento luminoso**
- **c) Higiene urbana, incluida la disposición final**
- d) Control de estacionamiento por concesión
- **e) Conservación y mantenimiento vial por peaje**
- f) Transporte, tratamiento, almacenamiento y disposición final de residuos patológicos y peligrosos
- g) Televisión por cable o de transmisión de datos
- h) Servicios públicos que se presten en el ámbito de la Ciudad cuya prestación exceda el territorio de la misma

## Artículo 3° — Funciones (inciso clave)

**"j) Recibir y tramitar las quejas y reclamos que efectúen los usuarios en sede administrativa tendiente a resolver el conflicto planteado con el prestador."**

Otras funciones: verificar cumplimiento normativo, controlar prestadores en seguridad/higiene/calidad, informar y asesorar usuarios, ejercer jurisdicción administrativa, aplicar sanciones por violaciones, velar por la protección ambiental.

## Diferencia estructural con Avellaneda — importante para el diseño del corpus

En **Avellaneda/PBA**, el reclamo de infraestructura se funda en que el **municipio tiene la obligación directa** de prestar el servicio (Constitución PBA art. 192 inc. 4 + Decreto-Ley 6769/58 arts. 52 y 59).

En **CABA**, la figura es distinta: los servicios los prestan concesionarios y existe un **ente regulador que recibe y tramita los reclamos de usuarios** (Ley 210 art. 3 inc. j). El fundamento no es "el municipio debe arreglarlo" sino "el Ente debe controlar la calidad del servicio y tramitar tu queja".

**Consecuencia para el RAG:** para el mismo reclamo ciudadano ("no anda la luz de la calle"), el dictamen tiene que citar normas de naturaleza distinta y derivar a organismos distintos según la jurisdicción. Es un buen caso de prueba adicional para REP-3764 (ver casos propuestos actualizados).

**Referencia operativa complementaria:** el Ente publica los servicios que controla en `https://entedelaciudad.gov.ar/` (Higiene Urbana, Alumbrado Público, Semáforos, Autopistas, entre otros) — útil para poblar `agencies` / `agency_contacts` en el modelo de datos, no para el corpus normativo.
