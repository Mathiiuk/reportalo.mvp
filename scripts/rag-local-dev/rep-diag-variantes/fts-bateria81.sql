-- Solo lectura. Orden por ts_rank sobre knowledge_fragments.fts, por caso. Guardar el JSON en fts-ranks-bateria81.json.
-- La consulta de texto (lexemas unidos con OR) es la misma que arma match_knowledge_fragments_hibrida.
with q(caso, svc, txt) as (values
  ('B-B1-01', 'TRANSITO', 'Auto estacionado sobre la vereda, tapando la rampa y el paso peatonal de la esquina.'),
  ('B-B1-04', 'INFRAESTRUCTURA', 'Hay un bache grande y profundo en el medio de la calle que rompe las gomas de los autos.'),
  ('B-B1-07', 'AMBIENTE', 'Hay bolsas de basura acumuladas en la vereda y en la calle junto al contenedor, hace días.'),
  ('B-B1-10', 'COMERCIO_IRREGULAR', 'Puestos de venta ambulante sobre la vereda ocupando el espacio público de la zona.'),
  ('B-B1-13', 'TRANSITO', 'Auto estacionado sobre la vereda, tapando la rampa y el paso peatonal de la esquina.'),
  ('B-B1-16', 'INFRAESTRUCTURA', 'Hay un bache grande y profundo en el medio de la calle que rompe las gomas de los autos.'),
  ('B-B1-19', 'AMBIENTE', 'Hay bolsas de basura acumuladas en la vereda y en la calle junto al contenedor, hace días.'),
  ('B-B1-22', 'COMERCIO_IRREGULAR', 'Puestos de venta ambulante sobre la vereda ocupando el espacio público de la zona.'),
  ('B-B2-25', 'TRANSITO', 'auto en vereda'),
  ('B-B2-26', 'TRANSITO', 'Auto estacionado sobre la vereda'),
  ('B-B2-27', 'TRANSITO', 'Hay un auto estacionado sobre la vereda, tapando por completo la rampa para personas con discapacidad y el paso peatonal de la esquina. Pasa todos los días en horario de entrada a la escuela y la gente tiene que bajar a la calle para esquivarlo, con el riesgo que eso implica.'),
  ('B-B2-28', 'INFRAESTRUCTURA', 'bache grande'),
  ('B-B2-29', 'INFRAESTRUCTURA', 'Bache grande en el medio de la calle'),
  ('B-B2-30', 'INFRAESTRUCTURA', 'Hay un bache muy grande y profundo en el medio de la calle, con agua acumulada cuando llueve. Los autos y las motos lo esquivan de golpe y ya hubo un par de casi accidentes. Rompe las gomas y las llantas. Hace varias semanas que está así y nadie lo repara.'),
  ('B-B2-31', 'AMBIENTE', 'basura tirada'),
  ('B-B2-32', 'AMBIENTE', 'Basura acumulada en la vereda'),
  ('B-B2-33', 'AMBIENTE', 'Hay muchísimas bolsas de basura acumuladas en la vereda y en la calle, alrededor del contenedor que está desbordado. Hace varios días que no pasa el camión y ya hay olor y se juntan bichos. Afecta a todos los vecinos y a los comercios de la cuadra.'),
  ('B-B2-34', 'COMERCIO_IRREGULAR', 'venden en la calle'),
  ('B-B2-35', 'COMERCIO_IRREGULAR', 'Venta ambulante en la vereda'),
  ('B-B2-36', 'COMERCIO_IRREGULAR', 'Hay muchos puestos de venta ambulante armados sobre la vereda, ocupando todo el espacio público frente a los locales. Venden ropa y otros productos sin ningún permiso, y la gente tiene que caminar por la calle porque no queda lugar para pasar por la vereda.'),
  ('B-B2-37', 'TRANSITO', 'auto en vereda'),
  ('B-B2-38', 'TRANSITO', 'Auto estacionado sobre la vereda'),
  ('B-B2-39', 'TRANSITO', 'Hay un auto estacionado sobre la vereda, tapando por completo la rampa para personas con discapacidad y el paso peatonal de la esquina. Pasa todos los días en horario de entrada a la escuela y la gente tiene que bajar a la calle para esquivarlo, con el riesgo que eso implica.'),
  ('B-B2-40', 'INFRAESTRUCTURA', 'bache grande'),
  ('B-B2-41', 'INFRAESTRUCTURA', 'Bache grande en el medio de la calle'),
  ('B-B2-42', 'INFRAESTRUCTURA', 'Hay un bache muy grande y profundo en el medio de la calle, con agua acumulada cuando llueve. Los autos y las motos lo esquivan de golpe y ya hubo un par de casi accidentes. Rompe las gomas y las llantas. Hace varias semanas que está así y nadie lo repara.'),
  ('B-B2-43', 'AMBIENTE', 'basura tirada'),
  ('B-B2-44', 'AMBIENTE', 'Basura acumulada en la vereda'),
  ('B-B2-45', 'AMBIENTE', 'Hay muchísimas bolsas de basura acumuladas en la vereda y en la calle, alrededor del contenedor que está desbordado. Hace varios días que no pasa el camión y ya hay olor y se juntan bichos. Afecta a todos los vecinos y a los comercios de la cuadra.'),
  ('B-B2-46', 'COMERCIO_IRREGULAR', 'venden en la calle'),
  ('B-B2-47', 'COMERCIO_IRREGULAR', 'Venta ambulante en la vereda'),
  ('B-B2-48', 'COMERCIO_IRREGULAR', 'Hay muchos puestos de venta ambulante armados sobre la vereda, ocupando todo el espacio público frente a los locales. Venden ropa y otros productos sin ningún permiso, y la gente tiene que caminar por la calle porque no queda lugar para pasar por la vereda.'),
  ('B-B8-57', 'INFRAESTRUCTURA', 'Deterioro de la calzada con pozos que afectan la circulación vehicular en la zona.'),
  ('B-B8-58', 'INFRAESTRUCTURA', 'Falta de conservación y mantenimiento de la vía pública por parte del gobierno de la Ciudad.'),
  ('B-B8-59', 'INFRAESTRUCTURA', 'Reclamo para que reparen las calles que están en mal estado y no se pueden transitar bien.'),
  ('B-B8-60', 'COMERCIO_IRREGULAR', 'Ocupación del espacio público con puestos de venta sin habilitación comercial en la zona.'),
  ('B-B8-61', 'COMERCIO_IRREGULAR', 'Comercio en la vía pública sin permiso municipal ni habilitación correspondiente.'),
  ('B-B8-62', 'COMERCIO_IRREGULAR', 'Venta de mercadería en la calle sin habilitación ni controles de higiene y seguridad.'),
  ('B-B8-63', 'INFRAESTRUCTURA', 'Luminaria del alumbrado público apagada, la cuadra queda sin iluminación de noche.'),
  ('B-B8-64', 'INFRAESTRUCTURA', 'Falta de mantenimiento del servicio de alumbrado público a cargo del municipio.'),
  ('B-B8-65', 'INFRAESTRUCTURA', 'Zona sin iluminación que afecta la seguridad de peatones y vehículos por la noche.'),
  ('B-B9-68', 'AMBIENTE', 'Auto estacionado sobre la vereda, tapando la rampa y el paso peatonal de la esquina.'),
  ('B-B9-69', 'INFRAESTRUCTURA', 'La luminaria de la esquina está apagada y la cuadra queda a oscuras de noche.'),
  ('B-B11-78', 'VULNERABILIDAD_SOCIAL', 'Hay personas durmiendo en la vereda, sin abrigo ni refugio, durante la noche.'),
  ('B-B11-79', 'VULNERABILIDAD_SOCIAL', 'hay gente en la calle'),
  ('B-B11-80', 'VULNERABILIDAD_SOCIAL', 'Hay personas durmiendo en la vereda, sin abrigo ni refugio, durante la noche.'),
  ('B-B11-81', 'VULNERABILIDAD_SOCIAL', 'hay gente en la calle')
), tq as (
  select caso, svc, nullif(replace(plainto_tsquery('spanish', txt)::text, ' & ', ' | '), '') as qs from q
), hits as (
  select tq.caso, f.id, ts_rank(f.fts, tq.qs::tsquery) as r
  from tq
  join knowledge_fragments f on f.is_current and tq.qs is not null and f.fts @@ tq.qs::tsquery
  where exists (select 1 from fragment_services fs join services s on s.id = fs.service_id
                where fs.fragment_id = f.id and s.service_code = tq.svc)
)
select json_object_agg(tq.caso, coalesce(h.orden, '')) as fts_ranks
from tq left join (
  select caso, string_agg(left(id::text, 2) || right(id::text, 3), ',' order by r desc, id) as orden from hits group by caso
) h using (caso);
