# REP-3798 · Lo que el PM tiene que saber antes de que esto salga

**Fecha:** 30/09/2026 · **Autor:** Matías Krepchuk (con Claude Code) · **Estado:** cambios en ramas, sin desplegar.

Este documento junta las decisiones de producto y de privacidad que se tomaron dentro de REP-3798 y que el PM debe **conocer y validar**. Lo técnico está en los commits y en `.agents/workflow/executions/`.

---

## 1. Qué cambió y en qué rama

| Rama | Qué trae | Estado |
|---|---|---|
| `fix/REP-3798-uj33-frontend-escritorio` | Bloques 11-A a 11-D del UJ v3.3, H-58 (un solo corte de escritorio a 1025 px), H-61 (`noindex` y `robots.txt`) | Subida. Revertida en `staging` (PR #121) hasta que Iván la valide. |
| `fix/REP-3801-ubicacion-sin-conexion` | Sin conexión, el reporte se guarda aunque falte la localidad | Local, sin subir |
| `fix/REP-3798-detalle-reportes-ajenos` | (a) Cualquier ciudadano ve el resumen de un reporte ajeno, sin fotos. (b) Las fotos protegen solo los rostros, no las patentes | Local, sin subir |

Orden sugerido para llevarlas a `staging`: primero la de REP-3798 (con el revert del revert), después las otras dos, que son independientes entre sí.

---

## 2. Decisión: los reportes ajenos son visibles (sin fotos)

**Qué se decidió (Matías, 30/09/2026):** cualquier ciudadano con sesión puede abrir el detalle de un reporte de otra persona y ver: número, estado, categoría, descripción y localidad. **No** ve fotos, fundamento jurídico, historial detallado ni quién lo hizo.

**Por qué hace falta que el PM lo valide:** el ticket REP-3798 pide que el PO defina la visibilidad antes de tocar el acceso a reportes ajenos. Hoy esto es decisión del líder técnico; falta que quede registrada como decisión de producto en Jira.

**Puntos a tener en cuenta:**

1. **La descripción es texto libre.** Puede contener nombres, direcciones o datos de terceros. El mapa ya la mostraba públicamente, así que no es un riesgo nuevo, pero ahora es más fácil de leer completa. Conviene considerar un aviso al escribirla ("no incluyas datos personales") o una moderación posterior.
2. **Las fotos NO son privadas a nivel de base de datos.** El cambio solo evita pedirlas y mostrarlas. La política `lectura_publica` de `report_images` sigue permitiendo que cualquiera las lea si arma la consulta a mano, y el bucket `report-evidences` entrega URLs públicas. Para que sean privadas de verdad hace falta una migración de RLS y un cambio de bucket. **No está hecho.**
3. **El "fundamento" de la IA no es público.** Se pidió considerar mostrar "la categoría y la descripción o la respuesta de la IA". La respuesta de la IA (`report_ai_analysis`) tiene una política que solo deja verla al dueño. Mostrarla a otros requiere cambiar esa política (migración) y decidir si es aceptable: el fundamento cita normativa y puede repetir datos de la descripción. **No está hecho**; hoy los ajenos ven solo categoría y descripción.
4. **Coordenadas exactas:** el detalle ajeno muestra solo la localidad. Los datos exactos siguen leyéndose vía el mapa (ya era así).
5. Si el ciudadano comparte el enlace de un reporte, quien lo abra sin sesión ve "No encontramos este reporte".

---

## 3. Decisión: las fotos protegen solo los rostros

**Qué se decidió (Matías, 30/09/2026):** el servidor pixela **únicamente rostros**. Las patentes dejan de pixelarse. Motivo: la evidencia sin patente pierde valor para el reclamo, y las fotos no se muestran en los reportes ajenos.

**Cómo está implementado:** la constante `PIXELATE_LICENSE_PLATES = false` en `supabase/functions/quarantine-anonymize/vision.ts`. Con la política apagada solo se le pide a Google Vision la detección de rostros (baja el costo y el uso de CPU). La detección de patentes sigue en el código, probada, por si se reactiva con cambiar la constante.

**Esto es un cambio de alcance de REP-3793**, cuyo criterio de aceptación pedía anonimizar rostros **y patentes**. Hay que actualizar el ticket y la matriz de QA.

### Bloqueantes antes de desplegar

- [ ] **La Edge Function no está desplegada con este cambio.** Hasta que se despliegue `quarantine-anonymize`, en staging y producción las patentes se siguen pixelando. Desplegar es una acción a decidir aparte.
- [ ] **Los textos siguen prometiendo lo contrario.** Estas pantallas dicen que se difuminan "rostros y patentes":
  - hoja de consentimiento (`ConsentSheet`), captura de foto, subida en escritorio, previsualización, pantalla "Protegiendo tus fotos", onboarding y permisos;
  - **Términos y condiciones §2.2** (`termsService`, versión `1.3`): habla de "difuminado irreversible sobre rostros y patentes vehiculares".
  Prometer algo que no se hace es un problema de consentimiento informado. **Hay que ajustar los textos antes de desplegar.** Los términos son un documento legal versionado: cambiarlos implica una nueva versión y volver a pedir aceptación. **No se tocaron**; requiere revisión del PM y de quien corresponda legalmente.
- [ ] **Impacto de privacidad:** las patentes son datos personales indirectos (identifican al titular del vehículo). En la práctica, quedan visibles en la foto que solo ve el dueño del reporte y en el bucket público (punto 2.2 de arriba). Conviene una validación legal (Ley 25.326 de protección de datos personales) antes de producción.
- [ ] **Fotos ya guardadas:** las que se subieron hasta ahora siguen con la patente pixelada. Solo cambia lo que se suba desde el despliegue.

---

## 4. Otras decisiones de esta tarea

| ID | Decisión | Quién |
|---|---|---|
| H-58 | Un solo corte de escritorio a 1025 px: teléfono y tablet ven el diseño de teléfono, escritorio desde 1025 px | Matías |
| H-61 | Los 404 y 403 siguen respondiendo HTTP 200 (es una SPA). Se agregó `noindex` y `robots.txt` para que los buscadores no los indexen | Matías |
| H-62 | Se mantiene el enlace "Para municipios" en la portada de escritorio | Matías |
| H-65 | Se mantiene la cabecera con logo y campana en todas las pestañas del teléfono (el diseño la saca; no se sigue para no esconder Notificaciones) | Matías |

Quedan abiertas, sin urgencia: H-60 (dos campanas en el DOM), H-63 (tablets en pantallas de acceso), H-64 (tres funciones de fecha corta), H-09, H-27, H-33, H-40 y H-43.

---

## 5. Estado de lo que pedía REP-3798

| Punto del ticket | Estado |
|---|---|
| Ubicación y permisos en iPhone / Safari | Reducción de fotos (REP-3800) hecha. Permisos de ubicación: sin trabajar |
| Selección de Piñeyro | Sin trabajar |
| Acceso al detalle de reportes | Hecho, con la decisión de visibilidad de la sección 2 |
| Transiciones de estado | Sin trabajar |
| Diseño desktop / scroll | Hecho (bloques 11-A a 11-D, H-58) |
| Contador de notificaciones | Sin trabajar (H-40 sigue abierta) |
| REP-3801: bloqueo de ubicación sin conexión | Hecho en código; falta reproducir en staging |
| QA independiente en staging | **Pendiente: Iván** valida desde la rama antes de pasarla a `staging` |

**Lo diferido debe quedar con motivo y ticket** (lo pide el cierre del ticket): Piñeyro, permisos de ubicación en iPhone, transiciones de estado y contador de notificaciones necesitan tickets propios o una decisión de sacarlos del lote.

---

## 6. Qué necesito del PM

1. Confirmar (y dejar en Jira) que los reportes son visibles para todos los ciudadanos con este alcance: sin fotos y con descripción.
2. Decidir si se muestra la respuesta de la IA a terceros (requiere migración de RLS).
3. Validar el cambio de "rostros y patentes" a "solo rostros" y **aprobar los nuevos textos** de consentimiento y términos antes del despliegue.
4. Decidir si las fotos deben ser privadas de verdad (migración de RLS y bucket).
5. Actualizar REP-3793 (criterio de aceptación) y su matriz de QA.
