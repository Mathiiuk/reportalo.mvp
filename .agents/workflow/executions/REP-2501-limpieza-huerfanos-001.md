# Registro de limpieza: REP-2501-limpieza-huerfanos-001

## Identificación
- **Tarea**: REP-2501 — limpieza de las imágenes huérfanas del bucket público `report-evidences` (proyecto Supabase `CiudadAR`, `yryuhyiujyignkdhiyua`)
- **Fecha**: 2026-09-23 / 24 (UTC)
- **Estado**: **COMPLETADO y verificado.** Queda un pendiente: repetir la limpieza con los objetos recientes (ver §5).
- **Quién**: análisis y verificación, Claude; ejecución del borrado, Matías (el clasificador de permisos bloqueó el borrado desde la sesión).

---

## 1. Por qué

`quarantine-anonymize` deja una copia protegida en `report-evidences` **antes** de que exista el reporte. Si el reporte no se crea (o el envío se reintenta), la copia queda sin
fila en `report_images`: una imagen pública sin reporte. Antes de esta limpieza había 82 objetos y solo 8 con fila. La causa de fondo de los reintentos se corrigió en H-35
(validar el borrador antes de procesar las fotos); esta limpieza elimina lo acumulado.

## 2. Clasificación previa (solo lectura)

| Categoría | Objetos | Tamaño | Decisión |
|---|---|---|---|
| Con fila en `report_images` | 8 | 28 MB | No se toca |
| Sin fila, pero su carpeta (`client_side_id`) pertenece a un reporte existente | 7 | 14 MB | **No se borra**: podrían reasociarse |
| Huérfanos de menos de 24 h | 44 | 138 MB | Se dejan (podrían estar en proceso) |
| **Huérfanos de más de 24 h, sin reporte** | **23** | **26 MB** | **Se borran** |

Criterio de «huérfano a borrar»: sin fila en `report_images` **y** carpeta que no es el `client_side_id` de ningún reporte **y** más de 24 horas de antigüedad.
Se comprobó además que las 18 carpetas afectadas contenían **solo** objetos de esa lista (0 carpetas con otros contenidos), por lo que borrar cada carpeta entera equivale a borrar los 23 objetos.

## 3. Ejecución

- Método: Storage API a través de la CLI de Supabase, una carpeta por vez:
  `supabase --experimental storage rm -r ss:///report-evidences/<carpeta> --project-ref yryuhyiujyignkdhiyua`.
- **No se borró por SQL**: eso elimina la fila pero deja el archivo en el almacenamiento.
- Dos intentos previos de Claude con `storage rm` por archivo devolvieron `deleted: []` y **no borraron nada** (confirmado en la base); el borrado recursivo fue bloqueado por el clasificador de permisos y lo ejecutó Matías.

Carpetas borradas (18) y objetos que contenían (23):

| Carpeta (`client_side_id`) | Objetos | Creado (UTC) |
|---|---|---|
| `51fbb40c-63ed-40f0-8a51-21d52d8eb762` | 1 | 09-07 |
| `c5c59066-0af7-48f7-ae2b-1e9ccf40e326` | 1 | 09-07 |
| `22e7b365-98b3-491b-a64c-7a0977b52e13` | 1 | 09-07 |
| `a31d71b5-9729-4c79-aced-c31560af1a91` | 1 | 09-07 |
| `40f37c88-c4f4-4843-9a00-bb5240965b08` | 1 | 09-08 |
| `0f30ef52-b748-4bd3-93b5-173312bc1eae` | 1 | 09-10 |
| `afed98fd-f2c2-4afe-907e-2ba99a7f8542` | 3 | 09-10 |
| `65ae8348-c64f-4b14-b148-deced691aabe` | 1 | 09-11 |
| `9f6ed0fa-f79c-43f8-b007-c15967915ca8` | 1 | 09-12 |
| `627ded8c-9e7d-4280-abfe-72a564db741e` | 1 | 09-12 |
| `e8e65a86-d669-40f5-93f3-f92174c2c33f` | 1 | 09-14 |
| `29f027ff-5634-458a-bcbf-347472c6cb90` | 1 | 09-15 |
| `a1a1f9da-a087-456d-a932-00762c55e47b` | 1 | 09-15 |
| `0b4eecc5-a16d-40ef-a80f-fecb5cbd0a9b` | 1 | 09-17 |
| `e174bf74-fddd-487f-875a-ac0066f83df4` | 2 | 09-19 |
| `19b24692-ff05-42d9-9e08-7aafc8ef0d36` | 1 | 09-20 |
| `39f44532-5a64-4d98-8e83-372b37388a20` | 2 | 09-20 |
| `f3dd5d67-af23-441d-ac88-56d5a3eca969` | 2 | 09-20 |

## 4. Verificación posterior (24/09/2026 01:29 UTC)

| Comprobación | Resultado |
|---|---|
| Objetos en `report-evidences` | **59** (antes 82) |
| Con fila en `report_images` | 8 (sin cambios) |
| Sin fila pero de un reporte existente | 7 (sin cambios) |
| Huérfanos de menos de 24 h | 44 (sin cambios) |
| **Huérfanos de más de 24 h** | **0** |
| Carpetas borradas, vistas por la Storage API (`ls`) | vacías (los archivos se eliminaron, no solo las filas) |

## 5. Pendiente

1. **Repetir la limpieza** con los 44 objetos recientes (creados el 23/09 de 19:50 a 00:37 UTC, 138 MB), con el mismo criterio, pasadas 24 horas. Son de las pruebas del día, incluida la etapa
   anterior al arreglo de H-35.
2. **Los 7 objetos de carpetas de reportes existentes** (14 MB, 16 al 19/09): decidir si se reasocian al reporte o se borran. No se tocaron.
3. **Prevención:** con H-35 el envío de la cola valida antes de procesar fotos, así que esa vía ya no genera huérfanos. Falta una purga programada de `report-evidences` (análoga a la de la cuarentena) si se quiere garantizar que no vuelvan a acumularse.
