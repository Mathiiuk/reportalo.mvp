# REP-2800 · Resolver el organismo receptor por prestación y jurisdicción

**Fecha:** 14/10/2026 · **Responsable:** Matías · **Estado:** implementado y probado en Postgres local; **migración y carga NO aplicadas en staging**
**Entrada:** matriz aprobada en REP-2806 v1.2 (Confluence) · **Alimenta:** REP-2801, REP-2805, REP-2809, REP-2810

## Qué hace

Dado un reporte (o una localidad + prestación), devuelve **a qué organismo y por qué canal** se propone derivarlo. Es **determinístico**: no consulta al RAG, a un LLM ni a Internet, y **no envía nada** (el MVP trabaja en «solo borrador», decisión del PO del 14/10). El organismo sale siempre del catálogo aprobado, nunca del análisis.

## Qué entra y qué queda para el Sprint 17

| Entra en REP-2800 | Queda para el Sprint 17 (como pidió el PO) |
|---|---|
| Migración de esquema, motor de routing, `report_routing` | Vocabulario (`service_keywords`) y el puente al RAG |
| Prestaciones de la matriz v1.2 (**37**), organismos, canales y `agency_services` | Las 107 prestaciones completas del SUACI (faltan los 4 CSV) |
| Contrato JSON, fixtures y verificación | Vínculos norma ↔ prestación (`fragment_services`), partición del art. 26 |
| | Leyes 2628 y 5688 en el corpus |

El script de carga trae los datos **de la matriz** (no de los CSV, que no llegaron). Cuando lleguen, se suman filas a `c_prest` y `c_ruta` y se vuelve a correr (es idempotente).

## Archivos

| Archivo | Para qué |
|---|---|
| `supabase/migrations/20261014150000_rep2800_resolver_organismo_receptor.sql` | Columnas nuevas, tabla `report_routing`, funciones. **Se corre a mano en staging** |
| `supabase/catalogo/rep2800_carga_catalogo_destinos.sql` | Carga idempotente del catálogo (se corre **después** de la migración) |
| `supabase/tests/rep2800_verificacion_routing.sql` | Verificación (T-1..T-7, I-1..I-6, negativos, seguridad). Siempre termina en excepción: no deja nada |

## Cambios de esquema

- `agencies`: `name` deja de ser único solo → único por `(name, subdivision_id)`. Los organismos de toda la Ciudad se cargan **una fila por comuna** (opción A del PO; no toca el RLS por subdivisión).
- `agency_contacts`: `label`, `source_url`, `verified_at`, `is_approved`, `is_emergency`, `test_value`. Un canal **sin aprobar o sin verificar nunca se devuelve**.
- `agency_services`: `attribute_value_id` (prestación), `route_role` (`principal` / `urgencia` / `general`), `road_scope` (`secundaria` / `avenida`), `channel_detail`. La PK `(agency_id, service_id)` pasa a un índice único que incluye la prestación.
- `report_routing` (nueva): un registro por reporte con versión de catálogo, entrada, criterio y resultado. RLS: lectura para el autor y quien atiende; nadie escribe desde el cliente.
- `agency_contacts` **sigue sin políticas** (solo servidor). Las funciones son `SECURITY DEFINER` y solo devuelven canales aprobados.

## Cómo se usa

```sql
-- Pura, sin efectos (fixtures de QA, pantalla de propuesta):
select public.resolve_report_destination(:locality_id, :prestacion_key, :urgente, :tipo_via);
-- Resuelve y registra para un reporte (autor, quien atiende, o servidor). Repetible:
select public.route_report(:report_id, :prestacion_key, :urgente, :tipo_via);
```

- `prestacion_key`: la clave del atributo `prestacion` (p. ej. `bache_calle`). Si no viene en `route_report`, se toma de `infraction_attribute_responses`. **El selector de prestación todavía no existe en el front**: hasta entonces el llamador la pasa por parámetro; sin prestación aplica R-2.
- `urgente`: lo informa el llamador (no se infiere del texto). Solo tiene efecto si la prestación habilita un canal de guardia.
- `tipo_via`: `secundaria` | `avenida` | nulo. No hay dato geográfico de jerarquía vial; si falta, un bache queda `no_resuelto` con los dos candidatos.
- Jurisdicción: localidad → subdivisión → provincia. **Avellaneda de Santa Fe cae en `FUERA_DEL_PILOTO`** (es el homónimo de la matriz).

## Contrato de salida

Respeta el de la sección 8 de REP-2806 y le suma campos de trazabilidad.

| Campo | Valores |
|---|---|
| `jurisdiccion` | `CABA` · `AVELLANEDA` · `FUERA_DEL_PILOTO` |
| `organismo_verificado` | `{id, nombre, organismo_padre}` · **nulo** si no hay destino o no se resolvió |
| `canal_verificado` / `canales_alternativos` | `{tipo: web\|telefono\|email\|whatsapp\|tramite, valor, etiqueta, principal, urgencia}` |
| `candidatos` | Lista ordenada de `(organismo, canal, fuente)`. En `no_resuelto` están **todos**, sin elegir |
| `fuente` | `{url, verificado_el}` del canal elegido |
| `criterio` / `regla` | `regla_inequivoca` R-1 · `precedencia_urgencia` R-4 · `precedencia_legal` R-4 · `no_resuelto` R-4 · `sin_destino` R-2/R-5 |
| `sin_destino_verificado` | `true` ⇒ no se asigna destinatario ni se dispara nada |
| `motivo` | Texto corto cuando el criterio es `no_resuelto` o `sin_destino` |
| `falta` | Lista con `receptor`, `contacto` y/o `fundamento` (tres condiciones distintas) |
| `accion` | `preparar_borrador` · `informar_canal` (vulnerabilidad social) · `ninguna` |
| `requiere_envio` | **Siempre `false`** en esta versión; `modo_entrega = borrador` |
| `canal_prueba` | Dirección de prueba asociada al contacto. **Solo la ve el servidor** y nunca reemplaza al canal verificado |
| `catalog_version` | `REP-2806 v1.2`. Se sube a mano en `routing_catalog_version()` cada vez que se recarga la matriz |

`route_report` agrega `report_id` y `fundamento_status` (informativo, si `get_report_legal_foundation` existe). **El fundamento no cambia el receptor ni la clasificación del RAG** (D4: «sin infracción acreditada» no es «sin organismo»).

## Casos para QA (los corre `rep2800_verificacion_routing.sql`)

Entrada = `(localidad, prestación, urgente, tipo_via)`.

**REP-2809 · tránsito en CABA**

| Caso | Entrada | Esperado |
|---|---|---|
| T-1 | Balvanera · `vehiculo_mal_estacionado` | DG del Cuerpo de Agentes de Tránsito (padre: Secretaría de Tránsito) · BA Colaborativa › Denuncia vial · `regla_inequivoca` |
| T-2 | Almagro · `vehiculo_obstruyendo_garaje` | Ídem |
| T-3 | Boedo · `vehiculo_abandonado` | Ídem |
| T-4 | San Nicolás · `semaforo_reparacion` | Secretaría de Tránsito · BA Colaborativa › Tránsito y Transporte |
| T-5 | Avellaneda (Santa Fe) · `bache_calle` | `FUERA_DEL_PILOTO` · `sin_destino` · sin organismo ni canal |
| T-6 | Flores · `calle_anegada` · urgente | `precedencia_urgencia` · primero 103, alternativa BA Colaborativa › Pluviales |
| T-7 | Flores · `bache_calle` · sin vía | `no_resuelto` · candidatos: Comuna 7 y Ministerio de Espacio Público |
| D4 | Flores · `bache_calle` · `secundaria` / `avenida` | Comuna 7 / Ministerio de Espacio Público · `precedencia_legal` |

**REP-2810 · infraestructura en Avellaneda**

| Caso | Entrada | Esperado |
|---|---|---|
| I-1 | Villa Domínico · `luminaria_apagada_noche` | Dirección de Alumbrado, Sistemas Eléctricos y Vía Pública · CAV · alternativa 4207-9802 |
| I-2 | Piñeyro · `bache_calle` | Subsecretaría de Obras Públicas · CAV |
| I-3 | Crucecita · `vereda_reparacion` | Subsecretaría de Obras Públicas · CAV |
| I-4 | Wilde · `semaforo_reparacion` | Dirección de Alumbrado… · CAV |
| I-5 | Gerli · `sumidero_destape` · urgente | `precedencia_urgencia` · primero Defensa Civil 103 / 0800-333-3218, después Obras Públicas |
| I-6 | Wilde · sin prestación | Municipalidad de Avellaneda · CAV · `sin_destino_verificado = true` |

**Negativos y regresión** (también en el script): canal no aprobado → `sin_destino` con `falta = [contacto]`; prestación sin organismo → `falta = [receptor]`; catálogo vacío → sin organismo ni canal; **R-8** (ninguna respuesta de Avellaneda lleva canales de CABA y viceversa, para 12 prestaciones); misma entrada dos veces → mismo resultado y una sola fila en `report_routing`; un tercero recibe `null`.

## Cómo se verificó

Postgres 16 local con un esquema de reemplazo de las tablas de staging (misma estructura y nombres): migración, carga y verificación completas, **y vueltas a correr** para comprobar idempotencia (163 organismos, 230 canales, 863 asignaciones, sin cambios en la segunda pasada). La verificación termina en excepción y no deja filas.

**No se probó en staging.** Falta: correr migración y carga allí, y repetir la verificación (en una transacción que se revierte).

## Pasos para aplicar en staging

1. Correr la migración `20261014150000_rep2800_resolver_organismo_receptor.sql`.
2. Correr `supabase/catalogo/rep2800_carga_catalogo_destinos.sql`.
3. Correr `supabase/tests/rep2800_verificacion_routing.sql` y confirmar el mensaje `REP-2800 OK`.
4. Avisar a Iván: build/versión `REP-2806 v1.2` para REP-2809 y REP-2810.

## Decisiones y pendientes

- **Datos de prueba del seed** (`…— Comuna 1`, `Secretaría de Servicios Públicos — Avellaneda`): no se tocan. No tienen asignaciones ni canales aprobados, así que el routing los ignora. Hay perfiles y análisis que los referencian; limpiarlos queda a criterio del LT.
- **Dirección de prueba (REP-2801):** la columna `agency_contacts.test_value` existe pero **no se carga ninguna**. Iván ofreció `reportalo-qa@proton.me`; falta decidir quién la carga y a qué contactos.
- **Gmail de Avellaneda:** se muestran como válidos (decisión del PO); como `requiere_envio = false` y el modo es borrador, no sale nada.
- **Canal formal TAD** («Denuncia de irregularidades en la vía pública»): no se cargó (la matriz lo asocia a otro organismo, la Secretaría Legal y Técnica). Se puede sumar como canal alternativo.
- **Subtarea REP-3742:** no aparece en Jira; confirmar número.
- **Selector de prestación y dato de vía** en el front: fuera de este ticket; el contrato ya los espera como parámetros.
