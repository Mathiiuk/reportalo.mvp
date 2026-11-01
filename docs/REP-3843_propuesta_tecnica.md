# REP-3843 · Propuesta técnica: dirección aproximada con calle y altura

25/10/2026 · Matías (LT). Pedido de Leo (PM, 25/10): documentar proveedor, condiciones de uso, límites, atribución, privacidad, disponibilidad, costo y efecto sin conexión antes de elegir, y separar el resto si no entra en 1 SP. Regla de visibilidad: REP-3876 §8 (Hernán, 24/10).

## 1. Opciones evaluadas

| Opción | Qué resuelve | Problema |
| --- | --- | --- |
| Georef (datos.gob.ar) | `/ubicacion`: coordenadas → provincia, departamento, municipio. `/direcciones`: dirección escrita → coordenadas | **No da calle ni altura a partir de un punto** (informe QA del ticket) |
| Solo carga manual del vecino | Calle y altura escritas por el vecino | Más fricción en el alta; sin sugerencia, la mayoría queda vacía |
| **Geocodificación inversa con Nominatim (OSM) + corrección del vecino** | Sugiere calle (y altura cuando existe); el vecino confirma o corrige | Condiciones de uso a respetar (§2) |

**Elegida: Nominatim a través de un proxy propio (Edge Function), con sugerencia editable por el vecino.**

## 2. Nominatim: condiciones verificadas (operations.osmfoundation.org/policies/nominatim, 25/10)
- **Límite:** máximo 1 consulta por segundo. Solo se consulta cuando el vecino confirma el punto, una vez por reporte, así que el tráfico es mínimo.
- **Identificación:** User-Agent propio. El proxy manda `Reportalo-MVP (info@reportalo.com.ar)`.
- **Proxy:** la política recomienda pasar por un proxy propio y exige poder cambiar de proveedor «sin actualizar la app». El proxy lo permite: el cambio se hace en el servidor.
- **Prohibido:** autocompletado y barridos sistemáticos. No se usa ninguno de los dos.
- **Atribución:** «© OpenStreetMap contributors» junto a la dirección sugerida (ODbL).
- **Costo:** gratis. **Disponibilidad:** sin garantía, y el acceso puede retirarse. Por eso nada depende de esta respuesta para enviar (§4).
- **Privacidad:** la política pide no mandar datos personales. Al proxy le llegan solo latitud y longitud: sin identidad ni IP del vecino (consulta el servidor) y sin texto del reporte.

**Prueba real (25/10):**
- Balvanera (CABA): «Jean Jaures», **sin altura**.
- Crucecita (Avellaneda): «Avenida Bartolomé Mitre **745**».

La altura no siempre viene, así que el vecino la puede completar.

## 3. Qué se guarda y quién lo ve (regla §8)
- `citizen_reports`: `address_street`, `address_number`, `address_road_type` (`avenida` | `secundaria`, el vocabulario que ya usa `route_report`) y `address_source` (`sugerida` | `corregida`). Las coordenadas y la localidad no cambian.
- **Autor:** calle y altura (su fila, policy de dueño).
- **Tercero:** la vista pública suma **solo** `address_street`, nunca la altura (en la base, no en React).
- **Operador:** calle y altura en el detalle (REP-3749, ruta propia del panel).
- Tipo de vía: «Avenida» / «Av.» al inicio del nombre → `avenida`; si no, `secundaria`. Si el vecino borra la calle, queda vacío.

## 4. Sin conexión y fallas
- Sin conexión, o si el proxy falla o tarda más de 4 s: no hay sugerencia y el vecino puede escribir calle y altura a mano o dejarlas vacías.
- El reporte se envía y se sincroniza igual. Para todos, la falta de dirección se muestra como «Dirección no disponible».
- La dirección viaja en el borrador local (IndexedDB) junto con el resto, así que también llega en la sincronización diferida.

## 5. Borrador institucional y R-4 (criterios del ticket, según Leo)
- `prepare_organism_delivery`: la sección «Ubicación» suma «Dirección aproximada: calle altura» o «Dirección no disponible».
- `route_report`: si no le pasan tipo de vía, usa el `address_road_type` guardado. Sin tipo de vía sigue igual que hoy: no inventa un ruteo inequívoco.

## 6. Alcance y esfuerzo
Todo lo anterior (columnas, vista, proxy, sugerencia y corrección, borrador local, sincronización, borrador institucional y R-4) se estima en **~2 SP reales** contra 1 SP planificado. Como el sprint va 2 días adelantado (REP-3874 y REP-3747 cerrados el domingo, REP-3000 lista), **se hace completo en este ticket sin recortar criterios** y se registra el esfuerzo real, como pide la DoD. No hace falta un ticket de resto. Si algo se complica, el borrador institucional y R-4 (§5) son lo primero que se separa.

## 7. Fuera de alcance
Rellenar la dirección de reportes viejos (PM 25/10). Caché de respuestas: el volumen no lo justifica; si crece, se agrega en el proxy sin tocar la app.

## 8. Hallazgo al desplegar (25/10, después de aplicar)
Desde la red de **Edge Functions de Supabase**, Nominatim responde **403** a la consulta inversa, aun con User-Agent y Referer. La misma consulta desde la **base** (pg_net) responde 200. El proxy funciona y cae al respaldo sin romper nada, pero hoy **no sugiere**.

Opciones:
- **(A) Geocodificar en la base al guardar el reporte (pg_net + tarea periódica).** Mantiene la privacidad del vecino y ya está probado que funciona. No hay sugerencia antes de enviar, pero la carga manual sigue en el modal, y la dirección queda antes de que se genere el borrador (que espera al análisis). **Recomendada.**
- (B) Consultar Nominatim desde el navegador. Funciona con tráfico moderado, pero la IP del vecino llega a OSMF y se pierde poder cambiar de proveedor sin actualizar la app.
- (C) Otro proveedor con API key (Geoapify, LocationIQ, MapTiler). Requiere crear una cuenta y aceptar condiciones y costos: decisión del equipo.
