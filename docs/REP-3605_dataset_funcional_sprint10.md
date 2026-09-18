# Reportalo

*Plataforma de Auditoría Ciudadana*

## DATASET FUNCIONAL Y CASOS ESPERADOS — SPRINT 10

**Versión 1.2 · 3 de septiembre de 2026 · Etapa de Construcción · Proyecto RAR-2026**

**Jira:** [REP-3605](https://unlz2026.atlassian.net/browse/REP-3605) (tarea · épica [REP-1005](https://unlz2026.atlassian.net/browse/REP-1005)) · implementa [REP-3471](https://unlz2026.atlassian.net/browse/REP-3471)
**Confluence:** espacio `Reportalo` · Backend y almacenamiento / Dataset de prueba

**Equipo:** Hernán Gregorini (PO / Autor) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

**Consultor Especialista:** Carlos Ruiz (auditor externo · asesoría metodológica)

> **Propósito.** Este documento define el contenido funcional exacto del dataset ficticio que soporta la demo y las pruebas del Sprint 10, y los resultados esperados que se derivan de él. Matías lo implementa como script reproducible en [REP-3471](https://unlz2026.atlassian.net/browse/REP-3471) sin tener que decidir contenido funcional; Iván reutiliza los casos esperados en [REP-3440](https://unlz2026.atlassian.net/browse/REP-3440), [REP-3600](https://unlz2026.atlassian.net/browse/REP-3600), [REP-3601](https://unlz2026.atlassian.net/browse/REP-3601) y [REP-3602](https://unlz2026.atlassian.net/browse/REP-3602). El seed es soporte del incremento, no una funcionalidad adicional.

---

## 1. Qué tiene que sostener este dataset

El Sprint Goal vigente, según el [Sprint Planning — Sprint 10](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/103219201):

> Permitir que un ciudadano autenticado llegue al mapa, utilice su ubicación, inicie un nuevo reporte y adjunte la primera evidencia fotográfica, extendiendo el recorrido funcional del Sprint 9 y dejando preparada la interfaz técnica hacia la futura persistencia offline sin ampliar innecesariamente el alcance del MVP.

El dataset existe únicamente para que ese recorrido sea demostrable en staging. Todo lo que no lo sirva queda fuera.

> **Actualización del 03/09/2026.** La replanificación de Jira del 02/09 movió a sprints posteriores todas las historias que dibujan reportes sobre el mapa. [REP-2600](https://unlz2026.atlassian.net/browse/REP-2600) cerró como **cascarón del mapa**, no como mapa con marcadores. En consecuencia, la tabla de abajo distingue qué consume el dataset **ahora** y qué lo consume más adelante — ver el corte en dos tramos de §3.1.

| Historia / tarea que consume el dataset | Sprint | Qué necesita del seed |
|---|---|---|
| [REP-2200](https://unlz2026.atlassian.net/browse/REP-2200) — iniciar un nuevo reporte | 10 · **Finalizada** | Catálogo de categorías cargado para que el flujo tenga qué ofrecer |
| [REP-2201](https://unlz2026.atlassian.net/browse/REP-2201) — capturar primera evidencia | 10 · **Finalizada** | Nada del seed: la evidencia capturada **no se persiste** en Sprint 10 |
| [REP-2300](https://unlz2026.atlassian.net/browse/REP-2300) / [REP-2302](https://unlz2026.atlassian.net/browse/REP-2302) — ubicación | 10 · **Finalizada** | Un centro de mapa por defecto para cuando no hay ubicación |
| [REP-2600](https://unlz2026.atlassian.net/browse/REP-2600) — `/mapa` como home | 10 · **Finalizada** | Solo el estado vacío: la home cerró sin marcadores |
| [REP-3603](https://unlz2026.atlassian.net/browse/REP-3603) / [REP-3607](https://unlz2026.atlassian.net/browse/REP-3607) — T&C consultivo | 10 | Usuarios con aceptación vigente y usuario sin aceptación |
| [REP-2202](https://unlz2026.atlassian.net/browse/REP-2202) — **seleccionar categoría de reporte** | **12** | Catálogo `services` completo, con los elementos de cada categoría definidos (§8.2) |
| [REP-2301](https://unlz2026.atlassian.net/browse/REP-2301) — confirmar ubicación antes de enviar | **12** | Árbol geográfico completo para resolver `locality_id` |
| [REP-2500](https://unlz2026.atlassian.net/browse/REP-2500) / [REP-2501](https://unlz2026.atlassian.net/browse/REP-2501) — conservar reporte y evidencia | **12** | `report_states` sembrado antes del primer INSERT real |
| [REP-2502](https://unlz2026.atlassian.net/browse/REP-2502) — manejar estados de reporte | **15** | Diccionario de estados de §7 |
| [REP-3752](https://unlz2026.atlassian.net/browse/REP-3752) — **visualizar reportes como marcadores** | **18** | Los 8 reportes geolocalizados de §9 |
| [REP-2601](https://unlz2026.atlassian.net/browse/REP-2601) — ver estado de reportes en mapa | **18** | Reportes con estados variados |
| [REP-2602](https://unlz2026.atlassian.net/browse/REP-2602) — filtrar reportes por categoría | **19** | Reportes distribuidos entre categorías |
| [REP-3747](https://unlz2026.atlassian.net/browse/REP-3747) / [REP-3749](https://unlz2026.atlassian.net/browse/REP-3749) — panel de organismo | **20** | Perfiles de organismo y aislamiento jurisdiccional |

---

## 2. Qué queda explícitamente fuera del dataset

> **Criterio de acotación.** Esta sección es la evidencia de cumplimiento del primer criterio de aceptación de REP-3605 — *"el dataset está acotado al Sprint Goal y no agrega funcionalidades laterales"* — y del principio de alcance como ancla fijado en el Planning §2.

| Tabla del Modelo de Datos v3 | Filas en el seed | Por qué |
|---|---|---|
| `normativas` | **0** | El RAG está fuera del Sprint 10; el corpus arranca en Sprint 11 ([REP-2906](https://unlz2026.atlassian.net/browse/REP-2906)) |
| `report_ai_analysis` | **0** | El análisis jurídico es asíncrono y no existe todavía |
| `report_learning_corpus` | **0** | Fuera del MVP por decisión ya registrada |
| `infraction_attribute_responses` | **0** | Los atributos dinámicos los extrae la IA; no hay IA en este sprint |
| `service_attribute_values` | **0** | Ninguna pantalla del Sprint 10 consume listas cerradas |
| `report_outreach_logs` | **0** | No hay derivación a organismos hasta Sprint 15 |

También queda fuera del dataset, por estar fuera del Sprint Goal (Planning §11): el mapa público sin autenticación, el panel de organismos, `/perfil`, `/reportes` y `/faq` — estas tres diferidas a Sprint 14 en la replanificación del 30/08.

> **La geografía completa no es una excepción a este criterio.** Cargar las 15 comunas, los 48 barrios y las localidades de Avellaneda (§4) es catálogo de referencia del alcance piloto ya comprometido —CABA y Avellaneda—, no funcionalidad nueva: no agrega pantallas, endpoints, consumo de APIs ni costo operativo. La restricción de REP-3605 apunta a *"catálogos innecesarios fuera del MVP"*, y la geografía del piloto está dentro del MVP por definición. Los catálogos que sí se evitan son los seis de la tabla de arriba.

---

## 3. Perfiles de regeneración

El seed se entrega en dos perfiles. Es lo que permite cubrir el requisito de *"al menos un estado con datos y un estado vacío"* sin inventar una pantalla adicional.

| Perfil | Qué carga | Para qué |
|---|---|---|
| `full` | Todo lo definido en este documento | Demo del Sprint Review y grueso del QA |
| `empty` | Solo catálogos: geografía, organismos, perfiles, servicios y estados. **Cero** `citizen_reports`, `report_images` y `report_state_history` | Estado vacío del mapa (CE-S10-03) |

Ambos perfiles deben ser **idempotentes**: correrlos dos veces seguidas no duplica filas ni falla. Los identificadores son fijos, no aleatorios, para que QA pueda referenciarlos entre corridas.

### 3.1 Corte en dos tramos — qué es urgente y qué no

La replanificación del 02/09 separó en el tiempo las dos mitades del dataset. Conviene que REP-3471 refleje esa separación en vez de cargar todo a ciegas.

| Tramo | Contenido | Cuándo se necesita | Prioridad |
|---|---|---|---|
| **A — Catálogos** | Geografía (§4), organismos (§5), perfiles (§6), estados (§7), servicios y sus elementos (§8) | **Ya.** Es lo que Matías pidió en la reunión del 02/09 —*"cargar las categorías"*—, lo que consume [REP-2202](https://unlz2026.atlassian.net/browse/REP-2202) en Sprint 12 y lo que destraba la observación O-07 del contrato `create_report` | **Alta** — REP-3471 cierra el 04/09 |
| **B — Reportes de demostración** | Los 8 reportes (§9), sus imágenes y su historial (§10) | Su consumidor real es [REP-3752](https://unlz2026.atlassian.net/browse/REP-3752), **Sprint 18**. En Sprint 10 no hay ninguna pantalla que los dibuje | **Baja** — puede cargarse igual, no molesta, pero no es lo que traba a nadie |

**Recomendación:** que REP-3471 cargue el tramo A completo y deje el tramo B como bloque separado del script, activable por parámetro. Cargar B igual no tiene costo y permite probar el mapa en cuanto REP-3752 arranque; lo que no corresponde es que el tramo A quede demorado esperando definiciones del tramo B.

---

## 4. Dimensión geográfica

> **Decisión del PO (02/09/2026): la geografía del piloto se carga completa.** No se siembra un recorte de conveniencia. La Ciudad Autónoma de Buenos Aires entra con sus 15 comunas y sus 48 barrios; Avellaneda entra con todas sus localidades. El fundamento es que `locality_id` es la clave del filtro jurisdiccional del RLS y del futuro filtro del RAG: cualquier reporte que se cargue en el área piloto —hoy en la demo, mañana en producción— debe resolver contra una localidad real, sin migraciones ni altas manuales posteriores. Es catálogo de referencia del alcance comprometido, no funcionalidad lateral.

**`countries`** — 1 fila

| `name` | `iso_code` |
|---|---|
| Argentina | AR |

**`states_provinces`** — 3 filas

| Ref. | `name` | País |
|---|---|---|
| PRV-01 | Ciudad Autónoma de Buenos Aires | Argentina |
| PRV-02 | Buenos Aires | Argentina |
| PRV-03 | Santa Fe | Argentina |

### 4.1 Subdivisiones — 17 filas

| Ref. | `name` | `type` | Provincia |
|---|---|---|---|
| SUB-01 a SUB-15 | Comuna 1 … Comuna 15 | comuna | PRV-01 |
| SUB-16 | Avellaneda | partido | PRV-02 |
| SUB-17 | Avellaneda | departamento | PRV-03 |

`SUB-17` existe únicamente para dejar verificada la **colisión toponímica** —Avellaneda de Buenos Aires frente a Avellaneda de Santa Fe—, caso de prueba declarado en el [Modelo de Datos v3](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/90406917) §12. No recibe reportes ni organismo.

### 4.2 Localidades de CABA — los 48 barrios

Padrón oficial: los 48 barrios agrupados en las 15 comunas de la Ciudad. Es un registro cerrado y citable, por lo que se carga íntegro sin margen de interpretación.

| Comuna | Barrios | Cant. |
|---|---|---|
| Comuna 1 | Retiro · San Nicolás · Puerto Madero · San Telmo · Monserrat · Constitución | 6 |
| Comuna 2 | Recoleta | 1 |
| Comuna 3 | Balvanera · San Cristóbal | 2 |
| Comuna 4 | La Boca · Barracas · Parque Patricios · Nueva Pompeya | 4 |
| Comuna 5 | Almagro · Boedo | 2 |
| Comuna 6 | Caballito | 1 |
| Comuna 7 | Flores · Parque Chacabuco | 2 |
| Comuna 8 | Villa Soldati · Villa Riachuelo · Villa Lugano | 3 |
| Comuna 9 | Liniers · Mataderos · Parque Avellaneda | 3 |
| Comuna 10 | Villa Real · Monte Castro · Versalles · Floresta · Vélez Sarsfield · Villa Luro | 6 |
| Comuna 11 | Villa General Mitre · Villa Devoto · Villa del Parque · Villa Santa Rita | 4 |
| Comuna 12 | Coghlan · Saavedra · Villa Urquiza · Villa Pueyrredón | 4 |
| Comuna 13 | Núñez · Belgrano · Colegiales | 3 |
| Comuna 14 | Palermo | 1 |
| Comuna 15 | Chacarita · Villa Crespo · La Paternal · Villa Ortúzar · Agronomía · Parque Chas | 6 |
| **Total** | | **48** |

> **Ortografía:** los nombres se cargan tal como figuran arriba, con tildes. `Monserrat` va sin "t" intermedia y `Núñez`, `Sarandí` y `Vélez Sarsfield` con sus acentos. La restricción `UNIQUE(subdivision_id, name)` es sensible a estas diferencias y una variante ortográfica genera un duplicado silencioso.

### 4.3 Localidades del partido de Avellaneda — 8 filas

| `name` | Nota |
|---|---|
| Avellaneda | Cabecera del partido |
| Crucecita | Frecuentemente contabilizada dentro de la cabecera — confirmar contra la fuente oficial |
| Dock Sud | |
| Gerli | Se extiende también sobre el partido de Lanús; en el seed se carga solo bajo Avellaneda |
| Piñeyro | |
| Sarandí | |
| Villa Domínico | |
| Wilde | |

> **A confirmar antes de ejecutar el seed.** A diferencia del padrón de CABA, la nómina de localidades de Avellaneda debe validarse contra la fuente oficial del municipio o el listado de INDEC. Los dos puntos a resolver son si **Crucecita** se cuenta como localidad propia o como parte de la cabecera, y cómo se trata **Gerli**, que es compartida con Lanús. Son 8 filas o 7 según cómo se resuelva el primero.

### 4.4 Barrios de Avellaneda — por qué no están

Pediste barrios también para Avellaneda. No se cargan, por dos motivos distintos y ambos bloqueantes:

**No hay padrón oficial.** CABA tiene sus 48 barrios fijados normativamente. Avellaneda no tiene un instrumento equivalente que fije un listado cerrado de barrios: las denominaciones que circulan —Villa Tranquila, Isla Maciel, Villa Corina y demás— son de uso corriente, con límites variables entre fuentes. Sembrar una lista armada por aproximación introduciría datos de referencia no verificables en la tabla que gobierna el filtro jurisdiccional. Se necesita una ordenanza municipal o el portal de datos abiertos de Avellaneda como fuente citable.

**No hay nivel disponible en el modelo.** El árbol tiene cuatro niveles: país → provincia → subdivisión → localidad. En CABA el nivel hoja ya lo ocupa el barrio (subdivisión = comuna). Para que Avellaneda tuviera barrios habría que subir sus localidades a `subdivisions` —y ahí se rompe el aislamiento multi-tenant, porque `agencies.subdivision_id` es el límite jurisdiccional del organismo y el de Avellaneda cubre el partido entero, no una localidad. Ver observación **O-7** en §12.

**Recomendación:** dejar la localidad como nivel hoja de Avellaneda para el MVP. Si el barrio resulta necesario para el mapa de calor, se resuelve con una tabla `neighborhoods` colgada de `localities` —quinto nivel opcional, nulo para CABA— y eso requiere ADR y Solicitud de Cambio, no un ajuste de seed.

### 4.5 Resumen de volumen

| Tabla | Filas |
|---|---|
| `countries` | 1 |
| `states_provinces` | 3 |
| `subdivisions` | 17 |
| `localities` | **57** (48 barrios de CABA + 8 localidades de Avellaneda + 1 de Santa Fe) |

---

## 5. Organismos

Dos organismos, uno por subdivisión con reportes. La geografía se carga completa (§4), pero los organismos **no**: sembrar 15 organismos porque existen 15 comunas agregaría filas que ninguna pantalla del Sprint 10 consume. Con dos alcanza para probar el aislamiento jurisdiccional del RLS, y el árbol de derivación por categoría corresponde al routing de Sprint 15.

**`agencies`**

| Ref. | `name` | Subdivisión |
|---|---|---|
| AG-01 | Dirección General de Fiscalización — Comuna 1 | SUB-01 · Comuna 1 |
| AG-02 | Secretaría de Servicios Públicos — Avellaneda | SUB-16 · Avellaneda (partido) |

> **Consecuencia de poblar CABA completa.** Con las 15 comunas cargadas queda expuesto un límite del modelo: `agencies.subdivision_id` admite **una sola** subdivisión, de modo que un organismo de alcance ciudad —por ejemplo una dirección general del GCBA con competencia sobre las 15 comunas— **no es representable hoy**. O se replica el organismo quince veces, o se agrega una relación N:N entre organismo y subdivisión. No afecta al Sprint 10, donde AG-01 cubre solo Comuna 1. Ver observación **O-6** en §12.

**`agency_subscriptions`** — una fila por organismo, `plan_type = 'piloto'`, `is_active = true`. Se cargan para dejar ejercitada la relación 1:1; ninguna pantalla del Sprint 10 las consume.

**`agency_contacts`** — un contacto primario por organismo, `contact_channel = 'email'`, `is_primary = true`, con dirección `contacto@ag01.reportalo.test` y `contacto@ag02.reportalo.test`.

---

## 6. Usuarios y roles

Seis perfiles. Cada uno existe por un motivo verificable; no hay usuarios de relleno.

> **Dominio de correo.** Todas las direcciones usan el TLD reservado `.test` (RFC 2606), que no es enrutable en Internet. Garantiza que ningún correo del seed pueda alcanzar a una persona real.

| Ref. | `username` | Correo | `role` | `agency_id` | T&C | Por qué está |
|---|---|---|---|---|---|---|
| USR-01 | ciudadano.demo | ciudadano.demo@reportalo.test | ciudadano | — | **Aceptados**, v1.0 | Usuario principal de la demo; dueño de 4 reportes |
| USR-02 | ciudadano.vecino | ciudadano.vecino@reportalo.test | ciudadano | — | **Aceptados**, v1.0 | Dueño de los otros 4; prueba que el mapa muestra reportes ajenos |
| USR-03 | ciudadano.consulta | ciudadano.consulta@reportalo.test | ciudadano | — | **Sin aceptar** | Modo consultivo de [REP-3603](https://unlz2026.atlassian.net/browse/REP-3603): navega sin aceptar, se le exige al publicar |
| USR-04 | oficial.caba | oficial.caba@reportalo.test | organismo | AG-01 | n/a | RLS jurisdiccional — debe ver 5 reportes |
| USR-05 | oficial.avellaneda | oficial.avellaneda@reportalo.test | organismo | AG-02 | n/a | RLS jurisdiccional — debe ver 3 reportes, nunca los de CABA |
| USR-06 | admin.reportalo | admin.reportalo@reportalo.test | admin | — | n/a | Verificación del seed y visibilidad global |

**Notas de implementación para REP-3471:**

- Cada perfil requiere previamente su usuario en **Supabase Auth**; `profiles.id` se ata a ese identificador. El script debe crear ambos, no solo la fila de `profiles`.
- La aceptación de términos se persiste con `accepted_at` + `terms_version` según lo ya implementado en [REP-3532](https://unlz2026.atlassian.net/browse/REP-3532) y [REP-3544](https://unlz2026.atlassian.net/browse/REP-3544). **Matías confirma el nombre exacto de la columna o estructura** — ver observación O-3 en §12.
- `terms_version = '1.0'` y `accepted_at` con fecha fija (no `now()`) para que el seed sea reproducible.

---

## 7. Diccionario de estados

> **Decisión funcional de este documento.** El diccionario de `report_states` no estaba definido y circulaban tres listas incompatibles: la del Panel de Organismo ([REP-3105](https://unlz2026.atlassian.net/browse/REP-3105)), la del Plan de Calidad v2 y la mención sin contenido del Modelo de Datos v3. Se unifica en un solo ciclo, con el criterio de que **cada estado debe leerse igual desde la app ciudadana y desde el monitor del organismo**. Cierra la observación O-05 del [Checklist de Modelo de Datos QA](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/65765377).

| `code` | `description` | Qué entiende el ciudadano | Qué entiende el organismo |
|---|---|---|---|
| `RECIBIDO` | Recibido | Mi reporte llegó a la plataforma | Entrada nueva, sin tomar |
| `EN_ANALISIS` | En análisis | Están analizando mi reporte | En clasificación / revisión |
| `DERIVADO` | Derivado al organismo | Fue enviado al organismo competente | Asignado a mi bandeja |
| `RESUELTO` | Resuelto | Se resolvió | Cerrado con resolución |
| `DESESTIMADO` | Desestimado | No se constató un incumplimiento | Descartado con motivo |

**Dos aclaraciones que evitan que vuelvan a divergir:**

- **`DESESTIMADO`, no `RECHAZADO`.** Del lado del ciudadano, "rechazado" se lee como una sanción sobre él. Lo que se desestima es el hecho reportado, no la persona que reporta.
- **"Vencido" no es un estado.** El Panel de Organismo lo muestra como badge, pero es un cálculo de SLA sobre `report_state_history`, no una fila de `report_states`. No se siembra.
- **"Pendiente de envío" tampoco es un estado.** La reunión del 02/09 definió que la interfaz debe mostrar categoría, foto y descripción de los reportes en espera de conexión. Ese es un estado **del cliente**: el reporte todavía no existe en la base, así que no puede tener una fila en `report_states`. Vive en la cola local de IndexedDB que implementa [REP-2703](https://unlz2026.atlassian.net/browse/REP-2703) en Sprint 11, con la marca `PENDING_SYNC`. Sembrarlo como estado del servidor rompería la semántica de `RECIBIDO`, que significa precisamente *"llegó a la plataforma"*.

---

## 8. Catálogo de servicios (Open311)

**`services`**

| Ref. | `service_code` | `service_name` | `group_name` | Organismo destino de referencia |
|---|---|---|---|---|
| SRV-01 | `TRANSITO` | Tránsito | Vía pública | Autoridad de tránsito municipal |
| SRV-02 | `INFRAESTRUCTURA` | Infraestructura | Vía pública | Área de obras o servicios públicos |
| SRV-03 | `AMBIENTE` | Ambiente | Vía pública | Autoridad ambiental |
| SRV-04 | `COMERCIO_IRREGULAR` | Comercio irregular | Vía pública | Área de habilitaciones o control comercial |
| SRV-05 | `VULNERABILIDAD_SOCIAL` | Vulnerabilidad social | Asistencia social | Ministerio de Capital Humano |

La columna de organismo destino es **referencial**, para orientar el diseño; el routing efectivo se construye en Sprint 15 y no forma parte del seed.

**`service_attributes`** — una sola fila, para dejar demostrado el mecanismo dinámico sin construir un catálogo que nada consume:

| `service_id` | `attribute_code` | `data_type` | `required` |
|---|---|---|---|
| SRV-01 | `patente` | string | false |

### 8.1 Vulnerabilidad social — condición de incorporación

> **Advertencia de alcance.** El [Acta de Inicio v3](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/23167009) §4 ubica esta categoría en **Versión 2**, fuera del MVP, con este fundamento textual: *"requiere un protocolo de manejo de datos más sensible que el de infraestructura"*. Incorporarla al alcance del MVP es una decisión del PO que, según la regla de [REP-3606](https://unlz2026.atlassian.net/browse/REP-3606) y el Planning §12, **exige registrar el trade-off**: qué trabajo sale, cuántos SP desplaza, qué efecto tiene en horas y costo, y qué valor imprescindible agrega. Mientras ese registro no exista, la categoría queda en el seed como catálogo con un caso de demostración, no como funcionalidad comprometida.

**Restricción de evidencia — no negociable si la categoría avanza.** Las otras cuatro categorías reportan un objeto o una condición física. Esta reporta una **situación en la que hay personas**, y eso choca de frente con el diseño de anonimización: no se puede difuminar al sujeto del reporte si el sujeto *es* el reporte. La regla que debe acompañar a la categoría:

1. La evidencia documenta el **lugar y la situación**, nunca a una persona identificable.
2. Ninguna imagen con rostros, rasgos distintivos o elementos identificatorios de una persona se admite en esta categoría.
3. El destino es **asistencial** (Ministerio de Capital Humano), no fiscalizador: no genera acta ni sanción.
4. El texto de interfaz no puede tipificar a la persona. Se describe una situación que requiere asistencia.

**Alternativa si la decisión se revisa.** La categoría `COMERCIO_IRREGULAR` arrastra un reparo del mismo orden: tipifica al sujeto ("actividad sin habilitación") en lugar del hecho. Redefinirla como `ESPACIO_PUBLICO` —obstrucción indebida de la vía pública: vallados, mercadería, mesas, materiales de obra, contenedores— conserva la ruta de derivación y el hecho reportable sin señalar a quien ejerce el comercio. Queda registrado como oportunidad de mejora; requiere Solicitud de Cambio porque [REP-2205](https://unlz2026.atlassian.net/browse/REP-2205) está cerrada y la categoría figura en el [Plan de Alcance](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/37552129).

### 8.2 Qué entra en cada categoría

> **Origen.** La reunión del 02/09 dejó como acción del grupo *"investigar o hacer un sprint para definir qué elementos corresponden específicamente a cada categoría"*, y resolvió el primer caso en el momento: **las veredas rotas van a Infraestructura**. Sin esta tabla, [REP-2202](https://unlz2026.atlassian.net/browse/REP-2202) —*Seleccionar categoría de reporte*, Sprint 12, Iván— no tiene contra qué diseñar la pantalla, y la clasificación jurídica de Sprint 13 no tiene contra qué entrenar. Es un borrador para que el equipo lo cierre, no una definición cerrada.

| Categoría | Qué entra |
|---|---|
| **Tránsito** | Vehículo mal estacionado · sobre rampa de accesibilidad · sobre senda peatonal · en doble fila · obstruyendo salida de garaje o de emergencia · vehículo abandonado en la vía pública · camión en vía no habilitada · obstrucción de la circulación |
| **Infraestructura** | Bache o hundimiento de calzada · **vereda rota, levantada o faltante** · luminaria apagada o dañada · semáforo fuera de servicio · señalización vial faltante o ilegible · mobiliario urbano dañado (bancos, cestos, paradas de colectivo) · rejilla o sumidero roto o sin tapa |
| **Ambiente** | Microbasural · vuelco de residuos · contenedor desbordado o roto · quema de residuos a cielo abierto · vertido de líquidos a la vía pública · restos de poda o arbolado caído sin retirar |
| **Comercio irregular** | Ocupación del espacio público con mercadería, mesas o estructuras · venta en la vía pública sin habilitación · cartelería o publicidad no autorizada que obstruye la circulación |
| **Vulnerabilidad social** | Situación que requiere abordaje asistencial, documentada por lugar y no por persona. Sujeta a la condición de §8.1 y a su restricción de evidencia |

**Reglas de desempate — los casos que se prestan a confusión:**

| Situación | Categoría | Fundamento |
|---|---|---|
| Vereda rota | **Infraestructura** | Decisión del equipo, 02/09. No es Tránsito aunque afecte la circulación peatonal |
| Vehículo abandonado que acumula residuos | **Tránsito** | Manda el hecho principal —el vehículo en la vía pública—, no el efecto secundario |
| Contenedor que obstruye la calzada o una rampa | **Tránsito** | Manda la obstrucción; si el contenedor está bien ubicado pero desbordado, es Ambiente |
| Restos de poda sobre la calzada | **Ambiente** | El residuo es el hecho; si el árbol caído corta la circulación, se reporta como Infraestructura |
| Luminaria rota por un choque | **Infraestructura** | Se reporta el daño observable, no su causa |

**Qué no entra en ninguna categoría.** El [Acta de Inicio v3](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/23167009) §4 excluye expresamente los hechos delictivos —amenazas, situaciones de peligro inmediato— que se redirigen a 911 y 134 sin quedar almacenados. La pantalla de selección de categoría debe contemplar esa salida.

**Pendiente para el spike del equipo:** si cada categoría necesita un nivel de subtipo persistido —lo que implicaría filas en `service_attributes` y `service_attribute_values`— o si alcanza con la categoría más la descripción libre. Hoy el dataset asume lo segundo, que es lo mínimo que sostiene el MVP. La decisión impacta directamente en el diseño de REP-2202.

---

## 9. Reportes ciudadanos

Ocho reportes geolocalizados — dentro del rango de 5 a 10 que fija REP-3605. Cubren las cinco categorías, los cinco estados y las dos jurisdicciones con organismo.

| Ref. | Categoría | Localidad | `latitud` | `longitud` | Estado | Autor | Descripción |
|---|---|---|---|---|---|---|---|
| RPT-01 | `TRANSITO` | Comuna 1 · Retiro | -34.5920 | -58.3745 | `RECIBIDO` | USR-01 | Vehículo estacionado sobre rampa de acceso peatonal, Av. del Libertador al 400 |
| RPT-02 | `INFRAESTRUCTURA` | Comuna 1 · San Nicolás | -34.6045 | -58.3800 | `EN_ANALISIS` | USR-01 | Bache profundo sobre calzada con riesgo para motos, Av. Corrientes al 1200 |
| RPT-03 | `AMBIENTE` | Comuna 1 · Puerto Madero | -34.6110 | -58.3655 | `DERIVADO` | USR-02 | Acumulación de residuos voluminosos en cantero, Juana Manso al 800 |
| RPT-04 | `COMERCIO_IRREGULAR` | Comuna 1 · Monserrat | -34.6085 | -58.3735 | `RESUELTO` | USR-02 | Mercadería sobre la vereda que obstruye el paso peatonal, Av. de Mayo al 900 |
| RPT-05 | `INFRAESTRUCTURA` | Comuna 1 · Retiro | -34.5955 | -58.3735 | `DESESTIMADO` | USR-01 | Luminaria apagada en Plaza San Martín — no se constató la falla en la verificación |
| RPT-06 | `TRANSITO` | Avellaneda · Avellaneda (cabecera) | -34.6635 | -58.3670 | `RECIBIDO` | USR-02 | Camión de carga detenido sobre senda peatonal, Av. Mitre al 700 |
| RPT-07 | `AMBIENTE` | Avellaneda · Sarandí | -34.6870 | -58.3435 | `EN_ANALISIS` | USR-01 | Microbasural en esquina con quema de residuos |
| RPT-08 | `VULNERABILIDAD_SOCIAL` | Avellaneda · Wilde | -34.7050 | -58.3175 | `DERIVADO` | USR-02 | Refugio improvisado bajo estructura vial que requiere abordaje asistencial — evidencia sin personas identificables |

**Distribución resultante — es la que verifica el QA:**

| Corte | Resultado |
|---|---|
| Por categoría | Tránsito 2 · Infraestructura 2 · Ambiente 2 · Comercio irregular 1 · Vulnerabilidad social 1 |
| Por estado | `RECIBIDO` 2 · `EN_ANALISIS` 2 · `DERIVADO` 2 · `RESUELTO` 1 · `DESESTIMADO` 1 |
| Por autor | USR-01: RPT-01, 02, 05, 07 (4) · USR-02: RPT-03, 04, 06, 08 (4) |
| Por jurisdicción | Comuna 1: 5 · Avellaneda (partido): 3 · las otras 14 comunas y Santa Fe: 0 |

**Notas de implementación:**

- Las coordenadas son aproximadas a nivel de cuadra y están elegidas para que los marcadores no se superpongan en un mismo nivel de zoom. No pretenden precisión catastral.
- `client_side_id`: un UUID **fijo** por reporte, definido en el script. No generar aleatorios — rompería la idempotencia y la reproducibilidad exigidas por REP-3471.
- `current_state_code` debe coincidir con el último registro de `report_state_history` de ese reporte.
- Las descripciones son ficticias y no refieren a hechos, personas, vehículos ni comercios reales.

---

## 10. Evidencia asociada

**`report_images`** — nueve filas. Todos los reportes llevan una imagen; RPT-02 lleva dos, para dejar verificada la cardinalidad 1:N que introdujo el Modelo de Datos v3.

| Reporte | Imágenes |
|---|---|
| RPT-02 | 2 |
| Resto (RPT-01, 03, 04, 05, 06, 07, 08) | 1 cada uno |

**Convención de rutas:** `seed-assets/{service_code}_{nn}.jpg` en un bucket público de Supabase Storage llamado `seed-assets`.

**Origen de las imágenes:** sintéticas o genéricas, sin personas, sin patentes legibles, sin frentes de comercios identificables. No se admite ninguna fotografía tomada de un caso real. Para `VULNERABILIDAD_SOCIAL` rige además la restricción de §8.1.

> **El seed no participa del flujo de captura.** [REP-2201](https://unlz2026.atlassian.net/browse/REP-2201) y [REP-3602](https://unlz2026.atlassian.net/browse/REP-3602) establecen que en Sprint 10 la evidencia capturada por el usuario **no se persiste ni se envía al backend**. Estas nueve filas son datos de demostración preexistentes, no el resultado del flujo de captura. El bucket `seed-assets` no es el destino de las fotos que tome el usuario.

**`report_state_history`** — 18 filas. Cada reporte abre con `RECIBIDO` y suma una fila por transición hasta su estado actual:

| Reporte | Trayectoria sembrada | Filas |
|---|---|---|
| RPT-01 | `RECIBIDO` | 1 |
| RPT-02 | `RECIBIDO` → `EN_ANALISIS` | 2 |
| RPT-03 | `RECIBIDO` → `EN_ANALISIS` → `DERIVADO` | 3 |
| RPT-04 | `RECIBIDO` → `EN_ANALISIS` → `DERIVADO` → `RESUELTO` | 4 |
| RPT-05 | `RECIBIDO` → `DESESTIMADO` | 2 |
| RPT-06 | `RECIBIDO` | 1 |
| RPT-07 | `RECIBIDO` → `EN_ANALISIS` | 2 |
| RPT-08 | `RECIBIDO` → `EN_ANALISIS` → `DERIVADO` | 3 |

`changed_by` es el autor en la fila de apertura y el oficial de la jurisdicción correspondiente en las transiciones posteriores. `changed_at` con fechas fijas y crecientes, distribuidas en los quince días previos, para que el orden cronológico sea verificable.

---

## 11. Casos esperados

Veinte casos, agrupados por la tarea de QA que los consume. Iván los toma como base; no reemplazan su diseño de pruebas, le dan el resultado esperado ya definido.

### 11.1 Mapa — [REP-2600](https://unlz2026.atlassian.net/browse/REP-2600) / QA [REP-3601](https://unlz2026.atlassian.net/browse/REP-3601)

> **Vigencia tras la replanificación del 02/09.** REP-2600 cerró como cascarón del mapa, sin marcadores. De los cuatro casos de abajo, en Sprint 10 sólo son ejecutables **CE-S10-03** (estado vacío) y **CE-S10-04** (responsive). **CE-S10-01 y CE-S10-02 pasan a validarse con [REP-3752](https://unlz2026.atlassian.net/browse/REP-3752) en Sprint 18**, que es la historia que dibuja los reportes sobre el mapa. Se conservan escritos acá para no reescribirlos entonces.

| Caso | Precondición | Acción | Resultado esperado |
|---|---|---|---|
| **CE-S10-01** | Seed `full`, sesión de USR-01 | Ingresar a `/mapa` | Se muestran **8 marcadores**; las 5 categorías son visualmente distinguibles entre sí |
| **CE-S10-02** | CE-S10-01 | Seleccionar un marcador | Se identifica al menos **categoría y estado** del reporte |
| **CE-S10-03** | Seed `empty`, sesión de USR-01 | Ingresar a `/mapa` | Estado vacío comprensible; **el CTA Nuevo reporte sigue visible y operativo** |
| **CE-S10-04** | Seed `full` | Repetir CE-S10-01 en mobile y en desktop | El mapa y los marcadores se comportan correctamente en ambos |

### 11.2 Geolocalización — [REP-2300](https://unlz2026.atlassian.net/browse/REP-2300) / [REP-2302](https://unlz2026.atlassian.net/browse/REP-2302) / QA [REP-3600](https://unlz2026.atlassian.net/browse/REP-3600)

> **Decisión funcional de este documento:** cuando no hay ubicación disponible, el mapa se centra en **-34.6037, -58.3816 (Obelisco, CABA) con zoom 13** y muestra un aviso no bloqueante. Se define acá porque sin un centro por defecto los casos negativos no tienen resultado esperado verificable. Cierra parcialmente las observaciones O-2 y O-3 de la [Preparación de casos QA de geolocalización](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/90079243).

| Caso | Precondición | Acción | Resultado esperado |
|---|---|---|---|
| **CE-S10-05** | Permiso de ubicación concedido | Ingresar a `/mapa` | El mapa se centra o contextualiza con la ubicación del dispositivo |
| **CE-S10-06** | Permiso **denegado** | Ingresar a `/mapa` | Centro por defecto, aviso no bloqueante, mapa plenamente utilizable; los 8 marcadores siguen visibles |
| **CE-S10-07** | Ubicación no disponible o timeout de la API | Ingresar a `/mapa` | Mismo comportamiento que CE-S10-06; el Journey **nunca** queda bloqueado de forma irreversible |
| **CE-S10-08** | Ubicación válida **fuera** de CABA y Avellaneda | Ingresar a `/mapa` | El mapa se muestra igual y los reportes del seed siguen siendo visibles; no se produce error ni pantalla vacía |

### 11.3 Inicio de reporte — [REP-2200](https://unlz2026.atlassian.net/browse/REP-2200) / QA [REP-3440](https://unlz2026.atlassian.net/browse/REP-3440)

| Caso | Precondición | Acción | Resultado esperado |
|---|---|---|---|
| **CE-S10-09** | Seed `full` y seed `empty` | Observar `/mapa` | El CTA **Nuevo reporte** está visible en ambos escenarios |
| **CE-S10-10** | Sesión de USR-01 | Pulsar Nuevo reporte y volver a `/mapa` sin completar | El flujo abre y se reconoce como iniciado; al volver **no queda ningún dato incompleto persistido** |
| **CE-S10-11** | Flujo de nuevo reporte abierto | Consultar la selección de categoría | Se ofrecen las **5 categorías** del seed, con su nombre legible |

### 11.4 Primera evidencia — [REP-2201](https://unlz2026.atlassian.net/browse/REP-2201) / QA [REP-3602](https://unlz2026.atlassian.net/browse/REP-3602)

| Caso | Precondición | Acción | Resultado esperado |
|---|---|---|---|
| **CE-S10-12** | Flujo de reporte abierto en mobile | Capturar o seleccionar una imagen | Se muestra estado de **evidencia cargada** |
| **CE-S10-13** | CE-S10-12 en curso | Cancelar la captura | Se vuelve al flujo sin perderlo y sin evidencia asociada |
| **CE-S10-14** | Flujo abierto | Seleccionar un archivo de tipo no admitido | Error comprensible; el flujo no se rompe |
| **CE-S10-15** | Después de CE-S10-12 | Consultar `report_images` en la base | **Sigue habiendo exactamente 9 filas.** La captura del Sprint 10 no persiste evidencia en el backend |

### 11.5 Términos y consentimiento — [REP-3603](https://unlz2026.atlassian.net/browse/REP-3603) / [REP-3607](https://unlz2026.atlassian.net/browse/REP-3607)

| Caso | Precondición | Acción | Resultado esperado |
|---|---|---|---|
| **CE-S10-16** | Sesión de **USR-03** (sin aceptación) | Ingresar y recorrer `/mapa` | Navega sin ninguna interrupción por T&C — modo consultivo |
| **CE-S10-17** | Sesión de USR-03 | Intentar publicar contenido o evidencia | Se presenta una aceptación simple con acceso a los términos completos; sin aceptar, la publicación no se completa |
| **CE-S10-18** | Sesión de **USR-01** (aceptación vigente v1.0) | Consultar los términos | Se muestran de forma informativa, **sin volver a pedir aceptación** y sin alterar el consentimiento registrado |

### 11.6 Aislamiento por jurisdicción — transversal

| Caso | Precondición | Acción | Resultado esperado |
|---|---|---|---|
| **CE-S10-19** | Sesión de **USR-05** (oficial de Avellaneda) | Consultar reportes | Devuelve **3** reportes (RPT-06, 07, 08). **Ninguno** de Comuna 1, ni siquiera consultando por identificador directo |
| **CE-S10-20** | Sesión de USR-01 | Consultar los reportes propios | Devuelve exactamente **4** (RPT-01, 02, 05, 07) |

---

## 12. Observaciones abiertas

Once puntos que este documento detecta pero no resuelve, porque exceden la definición funcional del dataset. O-6 a O-8 aparecieron al poblar la geografía completa del piloto; O-9 a O-11 salieron del cruce entre la reunión del 02/09 y la replanificación de Jira de esa misma noche.

| Ref. | Observación | A quién corresponde |
|---|---|---|
| **O-1** | La categoría `VULNERABILIDAD_SOCIAL` está diferida a Versión 2 en el Acta de Inicio v3. Incorporarla al MVP requiere el trade-off registrado de REP-3606 — ver §8.1 | PO, con registro en Control de Cambios |
| **O-2** | El Modelo de Datos v3 **no documenta** las columnas de consentimiento (`accepted_at`, `terms_version`) que ya están implementadas por REP-3532 y REP-3544. El DER quedó atrás de la implementación, contra la recomendación del Consultor de mantenerlo alineado con HUs reales | LT + PO, al re-versionar el modelo |
| **O-3** | Como consecuencia de O-2, el nombre exacto de la columna o estructura de consentimiento no está documentado. REP-3471 debe confirmarlo contra la base antes de sembrar USR-01 a USR-03 | Matías, dentro de REP-3471 |
| **O-4** | El informe UX del mapa ([REP-3103](https://unlz2026.atlassian.net/browse/REP-3103), junio) define color de pin por **subtipo** —vehículo, rampa, bache, luminaria, basura— mientras el modelo tipifica por **categoría** Open311. Son dos taxonomías distintas; hay que definir cuál gobierna el color del marcador antes de implementar REP-2600 | UX + LT |
| **O-5** | [REP-2014](https://unlz2026.atlassian.net/browse/REP-2014) figura en el Sprint 10 en Jira pero no aparece en los 28 SP comprometidos del Sprint Planning, donde Hernán registra 3 SP y no 4. Inconsistencia de tablero a resolver en el checklist de cierre | PM, vía [REP-3596](https://unlz2026.atlassian.net/browse/REP-3596) |
| **O-6** | `agencies.subdivision_id` admite una sola subdivisión. Con CABA poblada completa, un organismo con competencia sobre las 15 comunas no es representable sin replicarlo quince veces. Requiere decidir entre replicación o relación N:N organismo↔subdivisión | LT + PO, antes del routing de Sprint 15 |
| **O-7** | El árbol geográfico tiene cuatro niveles y en CABA el nivel hoja ya lo ocupa el barrio. No hay lugar para barrios de Avellaneda sin subir sus localidades a `subdivisions`, lo que rompería el límite jurisdiccional del RLS. Si el barrio se vuelve necesario, la salida es una tabla `neighborhoods` colgada de `localities`, con ADR y Solicitud de Cambio | LT + PO |
| **O-8** | La nómina de localidades de Avellaneda debe validarse contra fuente oficial: si Crucecita es localidad propia o parte de la cabecera, y cómo se trata Gerli, compartida con Lanús. Son 8 filas o 7 según se resuelva | PO, antes de que REP-3471 ejecute |
| **O-9** | [REP-2600](https://unlz2026.atlassian.net/browse/REP-2600) se cerró como Finalizada el 02/09 con [REP-3471](https://unlz2026.atlassian.net/browse/REP-3471) todavía en "Por hacer". El mapa quedó Done sin que existiera el dataset que su criterio de aceptación mencionaba —*"se muestran reportes disponibles del ambiente de prueba"*—, porque los marcadores se desplazaron a REP-3752. Conviene dejarlo registrado en el Sprint Review para que la trazabilidad del cierre sea legible | PM + PO, en el cierre del 04/09 |
| **O-10** | El desplazamiento de marcadores, filtros y mapa de calor a los Sprints 18 y 19 empuja funcionalidad central del producto contra el límite de entrega. El Sprint Planning §13 fija que el MVP debe cerrar en Sprint 19, con Sprint 20 como absorción y Sprint 21 como buffer. Un mapa que recién muestra reportes en Sprint 18 deja un margen muy fino | PM + PO, en el rebaseline del roadmap |
| **O-11** | Falta la tarea Jira que recoja la acción del grupo del 02/09 —*"investigar qué elementos corresponden a cada categoría"*—. El borrador de §8.2 la anticipa, pero necesita issue propia porque es insumo directo de [REP-2202](https://unlz2026.atlassian.net/browse/REP-2202) en Sprint 12 y de la clasificación jurídica posterior | PO, al refinar Sprint 11 |

Las observaciones O-1 y O-2 del contrato `create_report` ([REP-3436](https://unlz2026.atlassian.net/browse/REP-3436)) —modo síncrono o asíncrono de la anonimización, y unificación de la tabla de evidencias— **no bloquean este dataset**, porque Sprint 10 no persiste evidencia capturada. Sí siguen bloqueando el formulario completo de Sprint 12. En cambio, la observación O-07 de ese mismo documento —*"semillas mínimas no cargadas"*— queda resuelta en cuanto REP-3471 ejecute este dataset.

---

## 13. Criterios de aceptación de REP-3605 — verificación

| Criterio | Dónde se cumple |
|---|---|
| El dataset está acotado al Sprint Goal y no agrega funcionalidades laterales | §1 lista qué historia consume cada pieza; §2 enumera las seis tablas que quedan en cero |
| Mati puede implementar el seed sin decidir contenido funcional | §4 a §10 dan filas concretas, identificadores fijos, coordenadas, estados, autores y trayectorias completas |
| Iván puede reutilizar los casos esperados en QA | §11 entrega 20 casos con precondición, acción y resultado esperado, ya mapeados a REP-3440, REP-3600, REP-3601 y REP-3602 |

---

## 14. Nota de versión

**v1.2 — 3 de septiembre de 2026**

Origen: reunión del 02/09/2026 (`docs/fuentes/minuta02092026.docx`) y replanificación de Jira ejecutada esa misma noche, verificada por consulta directa al tablero el 03/09.

| Qué cambió | Por qué |
|---|---|
| §1 remapea cada pieza del dataset a la historia que la consume **y a su sprint real** | REP-2600 cerró como cascarón del mapa; los marcadores son REP-3752 y están en Sprint 18. El dataset perdió su consumidor principal en Sprint 10 |
| Nueva §3.1 — el dataset se parte en **tramo A (catálogos)** y **tramo B (reportes de demostración)** | El tramo A es lo que Matías pidió el 02/09 y lo que consume REP-2202 en Sprint 12; el tramo B no lo espera nadie hasta Sprint 18. REP-3471 cierra el 04/09 y no debe trabarse esperando lo que no urge |
| Nueva §8.2 — **qué entra en cada categoría**, con reglas de desempate | Acción del grupo del 02/09. Incluye la decisión ya tomada en esa reunión: vereda rota va a Infraestructura. Es insumo directo de REP-2202 |
| §7 incorpora que **"Pendiente de envío" no es una fila de `report_states`** | La reunión definió esa vista; es estado del cliente en la cola de IndexedDB (REP-2703, Sprint 11). Sembrarlo en el servidor rompería la semántica de `RECIBIDO` |
| §11.1 aclara qué casos del mapa siguen siendo ejecutables en Sprint 10 | CE-S10-01 y CE-S10-02 pasan a REP-3752 / Sprint 18; sólo quedan vigentes el estado vacío y el responsive |
| Nuevas observaciones **O-9**, **O-10** y **O-11** | REP-2600 cerró sin el seed que mencionaba su criterio de aceptación; los marcadores en Sprint 18 aprietan el gate de producto; y falta la issue Jira que recoja la investigación de categorías |

Se confirman sin cambios, por decisión de la reunión del 02/09: **PostGIS queda fuera del alcance** (coherente con ADR-002 y con la ubicación como lat/lng), **el mapa exige inicio de sesión** —el rol "vecino observador" sin login se descartó por carga de tráfico y queda como oportunidad de mejora—, y **los términos se muestran una sola vez** salvo cambio de versión, que es lo que ya modela el perfil USR-03.

---

**v1.1 — 2 de septiembre de 2026**

| Qué cambió | Por qué |
|---|---|
| La dimensión geográfica pasa de 8 localidades a **57**: las 15 comunas de CABA con sus 48 barrios y las localidades del partido de Avellaneda (§4) | Decisión del PO: la geografía del área piloto se carga completa, no recortada. `locality_id` gobierna el filtro jurisdiccional del RLS y del futuro RAG; cualquier reporte del piloto debe resolver contra una localidad real sin altas manuales posteriores |
| Se documenta por qué **no** se cargan barrios de Avellaneda (§4.4) | No existe padrón oficial equivalente al de CABA, y el modelo no tiene un quinto nivel disponible sin romper el límite jurisdiccional del organismo |
| §2 incorpora la justificación de por qué la geografía completa no contradice el criterio de acotación | Anticipa la objeción de control de alcance: es catálogo del MVP comprometido, no funcionalidad nueva |
| Nuevas observaciones **O-6**, **O-7** y **O-8** | Poblar el árbol completo expuso el límite N:1 de `agencies.subdivision_id`, la falta de nivel para barrios y la nómina de Avellaneda pendiente de validar |
| Organismos siguen en 2 y reportes en 8 | La geografía crece; el resto del dataset no. Sembrar 15 organismos por existir 15 comunas agregaría filas que ninguna pantalla del Sprint 10 consume |

No se modifican los casos esperados de §11: los ocho reportes conservan sus coordenadas, estados y autores, y siguen concentrados en Comuna 1 y Avellaneda.

Esta versión **no toca líneas base** de alcance, tiempo ni costo, por lo que no requiere registro en Control de Cambios. Sí lo requieren, si avanzan, la incorporación de `VULNERABILIDAD_SOCIAL` al MVP (§8.1 · O-1) y el eventual quinto nivel geográfico (O-7).

---

**Documentos relacionados:** [Sprint Planning — Sprint 10](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/103219201) · [Minuta 29/08 — Feedback Sprint Review 9](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/102858772) · [Modelo de Datos v3](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/90406917) · [Acta de Inicio v3](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/23167009) · [Plan de Alcance](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/37552129) · [Políticas de Acceso por Rol (REP-2508)](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/90734595) · [Checklist de Modelo de Datos QA (REP-3434)](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/65765377) · [Preparación de casos QA de geolocalización (REP-3439)](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/90079243) · [Revisión del contrato create_report (REP-3436)](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/89227273)
