-- Solo lectura. Orden por ts_rank sobre knowledge_fragments.fts, por caso. Guardar el JSON en fts-ranks.json.
with q(caso, svc, txt) as (values
  ('D1-F9CE1F6D', 'AMBIENTE', 'Hay bolsas de basura acumuladas en la vereda y en la calle junto al contenedor, hace días.'),
  ('D2-601FB52B', 'COMERCIO_IRREGULAR', 'Puestos de venta ambulante sobre la vereda ocupando el espacio público de la zona.'),
  ('D2-D704A098', 'COMERCIO_IRREGULAR', 'venden en la calle'),
  ('D2-290AB2CD', 'COMERCIO_IRREGULAR', 'Venta ambulante en la vereda'),
  ('D2-DC9B5606', 'COMERCIO_IRREGULAR', 'Hay muchos puestos de venta ambulante armados sobre la vereda, ocupando todo el espacio público frente a los locales. Venden ropa y otros productos sin ningún permiso, y la gente tiene que caminar por la calle porque no queda lugar para pasar por la vereda.'),
  ('D2-5607226A', 'COMERCIO_IRREGULAR', 'Ocupación del espacio público con puestos de venta sin habilitación comercial en la zona.'),
  ('D2-CA3FA872', 'COMERCIO_IRREGULAR', 'Comercio en la vía pública sin permiso municipal ni habilitación correspondiente.'),
  ('D2-962801E9', 'COMERCIO_IRREGULAR', 'Venta de mercadería en la calle sin habilitación ni controles de higiene y seguridad.'),
  ('D3-2A0F15E8', 'INFRAESTRUCTURA', 'Luminaria del alumbrado público apagada, la cuadra queda sin iluminación de noche.'),
  ('D3-DE123A4A', 'INFRAESTRUCTURA', 'Falta de mantenimiento del servicio de alumbrado público a cargo del municipio.'),
  ('D3-94CC4AB0', 'INFRAESTRUCTURA', 'Zona sin iluminación que afecta la seguridad de peatones y vehículos por la noche.'),
  ('D3-6612712B', 'INFRAESTRUCTURA', 'La luminaria de la esquina está apagada y la cuadra queda a oscuras de noche.'),
  ('D4-B6F1EF66', 'INFRAESTRUCTURA', 'Hay un bache grande y profundo en el medio de la calle que rompe las gomas de los autos.'),
  ('D4-FA9DA45B', 'INFRAESTRUCTURA', 'bache grande'),
  ('D4-92747FB7', 'INFRAESTRUCTURA', 'Bache grande en el medio de la calle'),
  ('D4-7B8F39E5', 'INFRAESTRUCTURA', 'Hay un bache muy grande y profundo en el medio de la calle, con agua acumulada cuando llueve. Los autos y las motos lo esquivan de golpe y ya hubo un par de casi accidentes. Rompe las gomas y las llantas. Hace varias semanas que está así y nadie lo repara.'),
  ('D4-B80A1C3C', 'INFRAESTRUCTURA', 'Deterioro de la calzada con pozos que afectan la circulación vehicular en la zona.'),
  ('D4-BF49872B', 'INFRAESTRUCTURA', 'Falta de conservación y mantenimiento de la vía pública por parte del gobierno de la Ciudad.'),
  ('D4-163C1FAF', 'INFRAESTRUCTURA', 'Reclamo para que reparen las calles que están en mal estado y no se pueden transitar bien.'),
  ('D5-0AA4EB21', 'COMERCIO_IRREGULAR', 'venden en la calle'),
  ('R01-0DA19E56', 'TRANSITO', 'Auto estacionado sobre rampa para discapacitados'),
  ('R02-1AE04BFC', 'TRANSITO', 'Dejaron la camioneta estacionada en la vereda y no dejan pasar a la gente con el cochecito'),
  ('R03-05DBF633', 'TRANSITO', 'Auto mal estacionado en senda amarilla'),
  ('R04-6800874C', 'TRANSITO', 'Camioneta estacionada sobre parada de colectivo y en vereda pintada de amarillo'),
  ('R05-02734F06', 'TRANSITO', 'Un vecino se sube con el auto a la vereda todos los días y me tapa la entrada del garage'),
  ('R06-93307044', 'TRANSITO', 'Auto mal estacionado en la esquina, sobre la senda peatonal, bloqueando el paso de los peatones.'),
  ('R07-2733B9F1', 'TRANSITO', 'Auto estacionado sobre la vereda'),
  ('R08-22F3DF72', 'AMBIENTE', 'Hay un montón de bolsas de basura tiradas en la vereda y hace días que no las levanta nadie'),
  ('R09-04E93DB8', 'AMBIENTE', 'Basura tirada en la calle'),
  ('R10-B58FF041', 'AMBIENTE', 'Basural con ratas'),
  ('R11-197D02DB', 'AMBIENTE', 'Basural a cielo abierto en la esquina, tiran residuos todos los días'),
  ('R12-FA5C82A4', 'AMBIENTE', 'El contenedor está desbordado y hay bolsas de basura tiradas en la vereda y en la calle.'),
  ('R13-2A06E37F', 'AMBIENTE', 'asinamiento de basura en una esquina'),
  ('R14-7725A56E', 'COMERCIO_IRREGULAR', 'Un puesto vende bebidas en la vereda sin habilitación'),
  ('R15-E9F490F6', 'COMERCIO_IRREGULAR', 'gente vendiendo productos en la calle'),
  ('R16-38E92049', 'COMERCIO_IRREGULAR', 'Hay manteros vendiendo ropa en toda la vereda y no se puede ni pasar, es un desastre'),
  ('R17-2EB0D9A1', 'COMERCIO_IRREGULAR', 'Venta ambulante de ropa ocupando toda la vereda'),
  ('R18-17A35E93', 'INFRAESTRUCTURA', 'Calle rota que pueden romper autos o hacer que se caiga gente'),
  ('R19-C14AADC7', 'INFRAESTRUCTURA', 'Bache en medio de la Avenida'),
  ('R20-F1AED967', 'INFRAESTRUCTURA', 'ay un vache enorme en lacalle q me rompio la goma ayer'),
  ('N1-09AC9BE9', 'COMERCIO_IRREGULAR', 'Pozo grande en la calle que rompe las gomas'),
  ('N2-B2D2517A', 'TRANSITO', 'Contenedor desbordado con residuos'),
  ('N3-391F9218', 'TRANSITO', 'La luminaria de la esquina no funciona'),
  ('N4-FCD7999C', 'INFRAESTRUCTURA', 'Hay mucha basura acumulada en la esquina'),
  ('N5-032D6BFA', 'AMBIENTE', 'Auto estacionado sobre la vereda, tapando la rampa y el paso peatonal de la esquina.'),
  ('N6-819B1565', 'AMBIENTE', 'Gato durmiendo'),
  ('N7-89D5C0DF', 'COMERCIO_IRREGULAR', 'Están robando en el kiosco de la esquina en este momento. (QA-3815 CP19)'),
  ('N8-D4-TRANSITO', 'TRANSITO', 'Hay un bache grande y profundo en el medio de la calle que rompe las gomas de los autos.')
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
