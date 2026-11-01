# REP-3000 · Datos de prueba para la bandeja del organismo

**Por qué hace falta:** la bandeja solo recibe reportes con borrador generado (reglas v1.0 §3). El borrador sale `borrador_generado` solo si se conoce la **prestación**, y la app todavía no se la pregunta al vecino. Los reportes reales salen `pendiente_sin_canal` y se quedan En análisis (verificado el 25/10: 60 de 60). Para QA se cargan reportes nuevos y se les genera la entrega con una prestación del catálogo. Sin migración de históricos (PM 25/10).

## Pasos
1. Iván crea reportes nuevos desde la app con su cuenta de ciudadano:
   - (a) CABA, cualquier comuna (por ejemplo Caballito); (b) Avellaneda (por ejemplo Sarandí);
   - (c) uno de vulnerabilidad social, (d) uno fuera de alcance (delito), (e) uno en Lanús, que quedan como control.
2. Esperar a que termine el análisis (estado «En revisión» en «Mis reportes»). Al guardarse el análisis, la base ya intenta la entrega sola. Sin prestación, el reporte queda En análisis: es lo esperado.
3. En el SQL Editor de staging, para (a) y (b), con el código `#RP-XXXXXXXX` que muestra la app:

```sql
-- change_report_state reconoce como «sistema» solo a service_role
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select r.id, public.deliver_report_to_test_inbox(r.id, 'vehiculo_mal_estacionado') as resultado
  from public.citizen_reports r
 where upper(substr(r.id::text, 1, 8)) = 'XXXXXXXX';   -- los 8 caracteres del código
```

   Resultado esperado: `delivered`. Otros valores posibles:
   - `pendiente_sin_canal`: no se identificó la prestación.
   - `excluido_fuera_de_alcance` / `excluido_asistencia`: el análisis lo deja afuera.
   - `no_en_analisis`: el análisis todavía no terminó, o el reporte ya fue entregado.
   - `sin_organismo_de_prueba`: la jurisdicción está fuera del piloto, como Lanús.
4. Para (c), (d) y (e) se puede correr lo mismo y comprobar que **no** devuelven `delivered`.
5. Verificar: el operador de CABA ve (a) en `/panel` y no ve (b); el de Avellaneda, al revés. El vecino ve su reporte en «Derivado» con el motivo de entrega interna.

## Prestaciones útiles del catálogo
`vehiculo_mal_estacionado` funciona en CABA y en Avellaneda (verificado). Para otras, ver `public.service_attribute_values` con `attribute_code = 'prestacion'`.

## Para volver atrás
Un reporte de prueba entregado queda en DERIVADO con su historial (append-only). No se revierte: se crea otro reporte.
