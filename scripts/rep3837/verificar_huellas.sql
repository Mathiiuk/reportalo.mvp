-- REP-3837 parte B — Verificación después de cargar Ley 2628 y Ley 5688 (solo lectura: se puede correr cuantas veces se quiera)
--
-- Esperado: 5 filas, todas con huella_ok = true, vigente = true, categoria correcta y con_vector = true.
-- Las huellas son las que declaró Hernán (SHA-256 de los bytes UTF-8 de `content`), fragmentos_propuestos_2628_5688.json.

with esperado (clave, numero, articulo, inciso, categoria, sha256) as (
  values
    ('LEY2628-ART3-INC3',  '2628', '3',   '3',  'AMBIENTE', 'd4e4b8429a88c055952f38e995092b37562513e2df5768c3a1bb6079785f28bc'),
    ('LEY2628-ART3-INC17', '2628', '3',   '17', 'AMBIENTE', '1d346034c32a7bea29cdfee194d4fc7ef777beab27261d3d9be9354897adae0a'),
    ('LEY5688-ART506',     '5688', '506', null, 'TRANSITO', '526bda1b874b907a52d609ea9a454ac75e96ea11aaa2b49fd58880786a9c3eb7'),
    ('LEY5688-ART507',     '5688', '507', null, 'TRANSITO', 'fa8d35adaf487eee9377b47414586f32467f113525b96b5df721b0de0f32f1e2'),
    ('LEY5688-ART511',     '5688', '511', null, 'TRANSITO', 'f146ed8f9048dbd34b92e40b6ba5057eeaa38354e287901a419b689f033b31d6')
)
select
  e.clave,
  f.id as fragment_id,
  encode(sha256(convert_to(f.content, 'UTF8')), 'hex') = e.sha256 as huella_ok,
  f.is_current as vigente,
  f.foundation_type_code as tipo,
  (select string_agg(s.service_code, ',') from public.fragment_services fs join public.services s on s.id = fs.service_id
    where fs.fragment_id = f.id) = e.categoria as categoria_ok,
  exists (select 1 from public.fragment_embeddings fe join public.embedding_models m on m.code = fe.model_code
           where fe.fragment_id = f.id and m.is_active) as con_vector,
  sp.name as jurisdiccion
from esperado e
left join public.knowledge_sources ks
  on ks.document_type_code = 'ley' and ks.document_number = e.numero and ks.is_current
 and ks.state_province_id = (select id from public.states_provinces where name = 'Ciudad Autónoma de Buenos Aires')
 and ks.subdivision_id is null
left join public.states_provinces sp on sp.id = ks.state_province_id
left join public.knowledge_fragments f
  on f.source_id = ks.id and f.article = e.articulo and f.subsection is not distinct from e.inciso and f.is_current
order by e.clave;

-- Totales del corpus para anotar la versión nueva en REP-3837 (antes de la carga: 132 fragmentos / 127 vigentes / 29 fuentes)
-- Esperado después: 137 / 132 / 31, y 0 vigentes sin vector del modelo activo.
select
  (select count(*) from public.knowledge_fragments) as fragmentos,
  (select count(*) from public.knowledge_fragments where is_current) as vigentes,
  (select count(distinct source_id) from public.knowledge_fragments) as fuentes,
  (select count(*) from public.knowledge_fragments f where f.is_current and not exists (
     select 1 from public.fragment_embeddings fe join public.embedding_models m on m.code = fe.model_code
      where fe.fragment_id = f.id and m.is_active)) as vigentes_sin_vector,
  (select max(created_at) from public.knowledge_fragments) as ultimo_fragmento;
