# REP-2801 · Generar el reporte estructurado para el organismo y registrar su entrega

**Fecha:** 15/10/2026 · **Responsable:** Matías · **Estado:** implementado y probado en Postgres local; **migración NO aplicada en staging**
**Usa:** REP-2800 (destino), REP-2902 (fundamento), REP-2805 (plantilla v0.6, de Iván) · **Condiciona:** REP-2502 (estados)

## Qué hace

Arma el mensaje que iría al organismo y lo **registra con su estado real**. En el MVP la entrega es **solo borrador** (decisión del PO, 14/10): no sale ningún correo a ningún organismo, y nunca se marca «enviado» por haber generado un borrador.

```sql
-- Autor del reporte, quien lo atiende o el servidor. Repetible.
select public.prepare_organism_delivery(:report_id, :prestacion_key, :urgente, :tipo_via);
```

Devuelve `estado`, `es_borrador`, `enviado` (siempre `false`), `motivo`, `asunto`, `cuerpo_texto` y `payload` (estructurado), más `entrega_id` y `repetido`. El servidor recibe además `destinatario_prueba` (ver más abajo).

## Estados de la entrega (`report_outreach_logs.delivery_status`)

| Estado | Cuándo |
|---|---|
| `borrador_generado` | Hay destino aprobado, la descripción está limpia y el mensaje está listo. **No se envió** |
| `pendiente_sin_canal` | Sin prestación identificada, sin organismo o canal aprobado, fuera del piloto, o caso sin resolver (calle sin tipo de vía). Lleva el motivo |
| `pendiente_revision` | La descripción trae lenguaje ofensivo, un correo, un teléfono o un enlace: se retiene y la revisa una persona |
| `comunicado` | Vulnerabilidad social: se informa el canal al vecino (108, Desarrollo Social, 102, Consejo de Niñez); no se deriva |
| `enviado` / `fallido` | Reservados para el envío real. **`enviado` exige `sent_at` y `external_reference`** (lo impone la base) |

## Qué lleva el mensaje (decisiones del PO en REP-2805)

| Campo | Regla |
|---|---|
| Identidad del vecino | **Nunca.** Ni usuario, ni id de usuario |
| Ubicación | Coordenadas, localidad, subdivisión, provincia y enlace al mapa |
| Descripción | Textual **solo si pasa el filtro**; si no, `[retenida: necesita revisión]` y estado `pendiente_revision` |
| Evidencia | Referencias a las fotos **anonimizadas** del propio reporte (ruta del bucket, no URL). Máximo **4**. El adjunto real lo arma quien envíe, con el servidor |
| Destino | El de REP-2800, con su fuente y fecha. Nunca lo elige el RAG |
| Fundamento | Norma, artículo, cita textual y fuente (opción C). **El resumen técnico de la IA no viaja.** Sin fundamento verificado, se dice y no se cita nada |
| Estado informado | «Borrador preparado para X. Todavía no fue notificado.» «Resuelto» no se informa nunca |
| Aviso | Borrador no enviado + fundamento preliminar generado con IA, no es una decisión administrativa |

## Reintentos (escenario 3)

La clave de idempotencia sale del reporte, el destino, la descripción, las fotos, el fundamento y la versión de plantilla/catálogo. La misma operación devuelve el mismo registro (`repetido = true`) sin crear otro. Una entrada distinta (por ejemplo, otra descripción) crea un registro nuevo y **conserva el anterior**.

## Dirección de prueba

`agency_contacts.test_value` (de REP-2800) guarda la dirección de prueba asociada al contacto. **Solo la ve el servidor** (`destinatario_prueba`), nunca reemplaza al canal verificado y **no se guarda** en el registro de entregas. **No se cargó ninguna**: falta decidir cuál (Iván propuso `reportalo-qa@proton.me`).

## Corrección de REP-2800 incluida

`route_report` guardaba la dirección de prueba si la primera llamada era del servidor, y después se la devolvía a cualquiera. Ahora lo que se guarda y se devuelve nunca la lleva. No tenía efecto hoy (no hay direcciones de prueba cargadas).

## Archivos

| Archivo | Para qué |
|---|---|
| `supabase/migrations/20261015120000_rep2801_entrega_borrador_al_organismo.sql` | Columnas y restricciones de `report_outreach_logs`, filtro de descripción, `prepare_organism_delivery`, corrección de `route_report` |
| `supabase/tests/rep2801_verificacion_entrega.sql` | Verificación (termina en excepción y no deja nada) |

## Verificación

Postgres 16 local con un esquema de reemplazo de staging (el fundamento es un doble): migración, carga del catálogo de REP-2800 y verificación de REP-2801, **y vueltas a correr** de la migración y de la verificación de REP-2800 (sigue pasando). Cubre los 3 escenarios del ticket, el filtro de descripción (ofensivo, correo, teléfono, enlace, y que una dirección con altura **no** se marque), vulnerabilidad social, fuera del piloto, canal no aprobado, la dirección de prueba, el acceso de un tercero (recibe `null`) y la regla de «enviado».

**No se probó en staging.** Falta aplicar la migración y repetir la verificación allí (con el fundamento real).

## Lo que queda abierto

- **Hoy casi ningún reporte tiene prestación elegida** (el selector no existe en la app), así que los borradores salen `pendiente_sin_canal` por «prestación no identificada». El destino se puede probar pasando la prestación por parámetro.
- **El envío real** (proveedor de correo, remitente, adjunto de la foto, HTML con logo incrustado) no se hizo: el PO pidió solo borrador. Los límites de peso de adjuntos se definen con el envío.
- **El estado del reporte no se cambia** al generar el borrador. `DERIVADO` queda para una entrega confirmada, y espera la respuesta de Hernán a H-2 (REP-2502).
- **Calle y altura:** el reporte guarda solo coordenadas y localidad (hallazgo de Iván); el mensaje no puede traer dirección. Pendiente el bug que registre el PM.
- **Lista de palabras:** es corta y revisable (`description_review_flags`). Si Hernán la quiere más amplia, se edita la función.
