-- =====================================================================
-- REP-3797 · Lote de ampliación del corpus normativo — Sprint 14
-- Reportalo (RAR-2026) · 28/09/2026
--
-- Qué hace:
--   * agrega 12 fuentes nuevas (8 normativas + 4 de información institucional)
--   * agrega 67 fragmentos verbatim y su mapeo a categorías (6 transacciones separadas)
--   * completa 3 fuentes que ya existían y estaban incompletas
--   * corrige 1 mapeo faltante detectado en el estado del 28/09/2026
--
-- Contra qué se escribió: docs/fuentes/basedatos/REP_estado_base_de_datos_28-09-2026.sql
--   Estado previo:    knowledge_sources=8,  knowledge_fragments=17, fragment_services=16
--   Estado esperado:  knowledge_sources=20, knowledge_fragments=84, fragment_services=89
--
-- Reglas que respeta:
--   * IDs deterministas: el lote es idempotente, se puede correr dos veces
--   * ningún id se escribe a mano: geografía y categorías se resuelven por nombre/código
--   * arco exclusivo geográfico: exactamente una de country_id/state_province_id/subdivision_id
--   * cada fragmento es copia literal de su fuente; el .md correspondiente en
--     docs/fuentes/normativas/ dice de dónde salió y cuándo se verificó
--
-- IMPORTANTE — esto NO genera embeddings.
--   fragment_embeddings queda sin filas para los 67 fragmentos nuevos, así que el RAG
--   NO los recupera por similitud hasta que corra el paso de embeddings del loader
--   (REP-3774) con el modelo activo. La consulta V-5 del final los lista.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PARTE 0.A — Guardas previas: si algo falta, el lote aborta ANTES de escribir
-- ---------------------------------------------------------------------
do $guard$
declare
  faltan text := '';
begin
  if (select count(*) from public.services
       where service_code in ('TRANSITO','INFRAESTRUCTURA','AMBIENTE',
                              'COMERCIO_IRREGULAR','VULNERABILIDAD_SOCIAL')) <> 5 then
    faltan := faltan || 'services: faltan códigos de las 5 categorías. ';
  end if;

  if not exists (select 1 from public.countries where iso_code = 'AR') then
    faltan := faltan || 'countries: falta Argentina (iso_code = AR). ';
  end if;

  if (select count(*) from public.states_provinces
       where name in ('Ciudad Autónoma de Buenos Aires','Buenos Aires')) <> 2 then
    faltan := faltan || 'states_provinces: faltan CABA y/o Buenos Aires. ';
  end if;

  if (select count(*) from public.subdivisions
       where name = 'Avellaneda' and type = 'partido') <> 1 then
    faltan := faltan || 'subdivisions: se esperaba exactamente una Avellaneda de tipo partido '
                     || '(la de Santa Fe es tipo departamento). ';
  end if;

  if not exists (select 1 from public.knowledge_sources
                  where id in ('10000000-0000-4000-8000-000000000002',
                               '10000000-0000-4000-8000-000000000006',
                               '10000000-0000-4000-8000-000000000008')) then
    faltan := faltan || 'knowledge_sources: faltan las fuentes preexistentes LOM / Ley 451 / Ley 13.927. ';
  end if;

  if not exists (select 1 from public.embedding_models where is_active) then
    faltan := faltan || 'embedding_models: no hay modelo activo (hará falta para el paso de embeddings). ';
  end if;

  if faltan <> '' then
    raise exception 'REP-3797: el entorno no cumple las precondiciones -> %', faltan;
  end if;
end
$guard$;

begin;

-- ---------------------------------------------------------------------
-- PARTE 0.B — Catálogo: un tipo de documento nuevo (aditivo, sin migración)
-- ---------------------------------------------------------------------
insert into public.document_types (code, description) values
  ('guia', 'Guía, trámite o información institucional publicada por el organismo')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- PARTE 1 — Fuentes nuevas (12)
-- ---------------------------------------------------------------------
insert into public.knowledge_sources
  (id, source_type_code, document_type_code, document_number, title, issuing_authority,
   country_id, state_province_id, subdivision_id, requires_adhesion,
   source_url, is_current, verified_at, last_amended_by)
select v.id::uuid, v.src_type, v.doc_type, v.num, v.title, v.authority,
       case when v.scope = 'AR' then c.id end,
       case when v.scope in ('CABA','BA') then sp.id end,
       case when v.scope = 'AVELLANEDA' then sub.id end,
       false, v.url, true, v.verified::timestamptz, v.amended
from (values
  ('30000000-0000-4000-8000-000000000009','corpus_legal','ley','5902',
   'Regulación de la construcción, mantenimiento, reparación y reconstrucción de las veredas',
   'Legislatura de la Ciudad Autónoma de Buenos Aires','CABA',
   'https://boletinoficial.buenosaires.gob.ar/normativaba/norma/392993','2026-09-28',null),

  ('30000000-0000-4000-8000-000000000010','corpus_legal','ley','1854',
   'Gestión Integral de Residuos Sólidos Urbanos (Basura Cero)',
   'Legislatura de la Ciudad Autónoma de Buenos Aires','CABA',
   'https://boletinoficial.buenosaires.gob.ar/normativaba/norma/81508','2026-09-28',
   'Ley N 5966/18; texto consolidado por Ley N 6764'),

  ('30000000-0000-4000-8000-000000000011','corpus_legal','ley','6101',
   'Ley Marco de Regulación de Actividades Económicas',
   'Legislatura de la Ciudad Autónoma de Buenos Aires','CABA',
   'https://boletinoficial.buenosaires.gob.ar/normativaba/norma/446784','2026-09-28',null),

  ('30000000-0000-4000-8000-000000000012','corpus_legal','ley','3706',
   'Protección y garantía integral de los derechos de las personas en situación de calle y en riesgo a la situación de calle',
   'Legislatura de la Ciudad Autónoma de Buenos Aires','CABA',
   'https://boletinoficial.buenosaires.gob.ar/normativaba/norma/165158','2026-09-28',
   'Texto consolidado por Ley N 6764; art. 5 vetado por Decreto N 42/11'),

  ('30000000-0000-4000-8000-000000000013','corpus_legal','ley','4036',
   'Protección integral de los derechos sociales',
   'Legislatura de la Ciudad Autónoma de Buenos Aires','CABA',
   'https://boletinoficial.buenosaires.gob.ar/normativaba/norma/187812','2026-09-28',null),

  ('30000000-0000-4000-8000-000000000014','corpus_legal','ley','13.592',
   'Gestión Integral de Residuos Sólidos Urbanos (Provincia de Buenos Aires)',
   'Legislatura de la Provincia de Buenos Aires','BA',
   'https://normas.gba.gob.ar/documentos/BK871coV.html','2026-09-28',
   'Leyes N 13.657 y N 15.078'),

  ('30000000-0000-4000-8000-000000000015','corpus_legal','ley','27.654',
   'Situación de calle y familias sin techo',
   'Congreso de la Nación Argentina','AR',
   'https://servicios.infoleg.gob.ar/infolegInternet/anexos/355000-359999/358622/norma.htm','2026-09-28',
   'Decreto N 373/2025 (sustituye arts. 3 y 10; deroga art. 12 inc. a)'),

  ('30000000-0000-4000-8000-000000000016','corpus_legal','ley','15.625',
   'Personas en situación de calle y en riesgo a la situación de calle (Provincia de Buenos Aires)',
   'Legislatura de la Provincia de Buenos Aires','BA',
   'https://normas.gba.gob.ar/documentos/Vr7gJrsO.html','2026-09-28',null),

  ('30000000-0000-4000-8000-000000000017','informacion','guia',null,
   'Agencia Gubernamental de Control (CABA) — competencia y canal de denuncias',
   'Gobierno de la Ciudad Autónoma de Buenos Aires','CABA',
   'https://buenosaires.gob.ar/gcaba_historico/justicia/agencia-gubernamental-de-control/denuncias','2026-09-28',null),

  ('30000000-0000-4000-8000-000000000018','informacion','guia',null,
   'Línea 108 — Buenos Aires Presente (atención social inmediata)',
   'Ministerio de Desarrollo Humano y Hábitat, Gobierno de la Ciudad Autónoma de Buenos Aires','CABA',
   'https://buenosaires.gob.ar/gcaba_historico/desarrollohumanoyhabitat/inclusion-social-y-atencion-inmediata/linea-108','2026-09-28',null),

  ('30000000-0000-4000-8000-000000000019','informacion','guia',null,
   'Municipalidad de Avellaneda — áreas competentes y canales de reclamo',
   'Municipalidad de Avellaneda','AVELLANEDA',
   'https://www.mda.gob.ar/','2026-09-28',null),

  ('30000000-0000-4000-8000-000000000020','informacion','guia',null,
   'Secretaría Nacional de Niñez, Adolescencia y Familia — autoridad de aplicación de la Ley 27.654',
   'Ministerio de Capital Humano de la Nación','AR',
   'https://www.boletinoficial.gob.ar/detalleAviso/primera/326250/20250602','2026-09-28',null)
) as v(id, src_type, doc_type, num, title, authority, scope, url, verified, amended)
cross join public.countries c
left join public.states_provinces sp
       on sp.country_id = c.id
      and sp.name = case v.scope when 'CABA' then 'Ciudad Autónoma de Buenos Aires'
                                 when 'BA'   then 'Buenos Aires' end
left join public.subdivisions sub
       on sub.name = 'Avellaneda' and sub.type = 'partido'
where c.iso_code = 'AR'
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- PARTE 2 — Fuentes ya existentes que quedan completadas
-- ---------------------------------------------------------------------

-- Ley 13.927: el texto actualizado declara modificaciones hasta la Ley 15.613,
-- que no estaba registrada en last_amended_by. Se actualiza el dato, no se reemplaza la fila.
--
-- ATENCIÓN: es el ÚNICO UPDATE del lote sobre una fila preexistente.
-- Valores anteriores, para poder deshacerlo:
--   title           = 'Ley 13.927 (Provincia de Buenos Aires)'
--   last_amended_by = NULL
--   verified_at     = '2026-09-13T00:00:00+00:00'
update public.knowledge_sources
   set title = 'Adhesión a las Leyes Nacionales de Tránsito 24.449 y 26.363 (Provincia de Buenos Aires)',
       last_amended_by = 'Leyes N 14.246, 14.331, 14.393, 14.774, 15.002, 15.078, 15.139, 15.143, 15.225, 15.321, 15.402 y 15.613',
       verified_at = '2026-09-28'::timestamptz
 where id = '10000000-0000-4000-8000-000000000008';

commit;

-- =====================================================================
-- PARTE 3 — Fragmentos: CABA
-- =====================================================================
begin;

-- ---------- Ley 5902 (CABA) — veredas · INFRAESTRUCTURA ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000009',
 'Ley 5902 (CABA) — Veredas > Título II > Capítulo I > Artículo 5 (obligaciones)','5',null,
$f$Obligaciones.- La obligación por la construcción, mantenimiento, reparación y reconstrucción de la vereda compete al propietario frentista, sin perjuicio de las eximiciones previstas en la presente.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000009',
 'Ley 5902 (CABA) — Veredas > Título II > Capítulo I > Artículo 6 (acceso vehicular)','6',null,
$f$Acceso vehicular.- En el caso del acceso vehicular, la obligación del propietario frentista establecida en el artículo precedente se extiende a la de ejecutar y mantener el rebaje del cordón y una rampa en las condiciones que determine la normativa de aplicación.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000009',
 'Ley 5902 (CABA) — Veredas > Título II > Capítulo I > Artículo 7 (eximición)','7',null,
$f$Eximición.- Se exime al propietario frentista de la obligación establecida en el artículo 5° en el supuesto de deterioros ocasionados en la vereda y/o acera por obras de apertura y/o roturas en el espacio público realizadas por empresas prestadoras de servicios públicos u otros sujetos autorizados, por sí o por terceros, en cuyo caso es aplicable la Ley 2634 o la que en un futuro la reemplace.
Si la vereda resultare destruida, parcial o totalmente, como consecuencia de obras ejecutadas por el Gobierno de la Ciudad Autónoma de Buenos Aires, por sí o por terceros, o por raíces de árboles, la reparación o reconstrucción corre por cuenta y cargo de aquél.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000009',
 'Ley 5902 (CABA) — Veredas > Título II > Capítulo I > Artículo 8 (accesibilidad)','8',null,
$f$Accesibilidad.- La construcción, mantenimiento, reparación y/o reconstrucción de cordones o franjas divisorias que bordeen la calzada, vados y rampas para personas con movilidad reducida es competencia exclusiva del Gobierno de la Ciudad Autónoma de Buenos Aires y deberá ejecutarse en concordancia con las normas relativas a la accesibilidad física para todos.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000009',
 'Ley 5902 (CABA) — Veredas > Título II > Capítulo II > Artículo 10 (intimación)','10',null,
$f$Intimación.- El Gobierno de la Ciudad Autónoma de Buenos Aires fiscaliza periódicamente el estado de conservación de las veredas y, en caso de corresponder, intima al titular, guardián del inmueble y/o a la administración del consorcio --cuando se tratase de un inmueble afectado al régimen de propiedad horizontal--, a su construcción, reparación o reconstrucción en el plazo que se determine al efecto por vía de la reglamentación.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000009',
 'Ley 5902 (CABA) — Veredas > Título II > Capítulo II > Artículo 11 (incumplimiento)','11',null,
$f$Incumplimiento.- En caso de incumplimiento por parte del propietario frentista de la obligación establecida en el artículo 5° y vencido el plazo de intimación previsto en la reglamentación, el Gobierno de la Ciudad Autónoma de Buenos Aires podrá aplicar las sanciones previstas en el Régimen de Faltas de la Ciudad de Buenos Aires y, acreditado el incumplimiento, podrá realizar la obra pertinente con cargo a quien corresponda.
La ejecución de la obra por parte del Gobierno de la Ciudad Autónoma de Buenos Aires no implica alteración del régimen de responsabilidad establecido en la presente Ley.$f$,
 'competencia') on conflict (id) do nothing;

-- ---------- Ley 1854 (CABA) — Basura Cero · AMBIENTE ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000010',
 'Ley 1854 (CABA) — Basura Cero > Capítulo III > Artículo 14 (separación en origen)','14',null,
$f$El generador de residuos sólidos urbanos debe realizar la separación en origen y adoptar las medidas tendientes a disminuir la cantidad de residuos sólidos urbanos que genere. Dicha separación debe ser de manera tal que los residuos pasibles de ser reciclados, reutilizados o reducidos queden distribuidos en diferentes recipientes o contenedores, para su recolección diferenciada y posterior clasificación y procesamiento.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000008','30000000-0000-4000-8000-000000000010',
 'Ley 1854 (CABA) — Basura Cero > Capítulo V > Artículo 16 (disposición inicial)','16',null,
$f$La disposición inicial es la acción realizada por el generador por la cual los residuos sólidos urbanos son colocados en la vía pública o en los lugares establecidos por la reglamentación de la presente. La misma será selectiva conforme lo establezca la autoridad de aplicación.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000009','30000000-0000-4000-8000-000000000010',
 'Ley 1854 (CABA) — Basura Cero > Capítulo IX > Artículo 36 (prohibición de basura a cielo abierto)','36',null,
$f$Prohíbese la descarga de basura a cielo abierto y la creación de micro basurales. Asimismo se prohíbe el vuelco en cauces de agua o el mal enterramiento de los mismos.$f$,
 'conducta_prohibida') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000010','30000000-0000-4000-8000-000000000010',
 'Ley 1854 (CABA) — Basura Cero > Capítulo XIV > Artículo 48 (autoridad de aplicación)','48',null,
$f$Es autoridad de aplicación de la presente el organismo de más alto nivel con competencia en materia ambiental que determine el Poder Ejecutivo.$f$,
 'competencia') on conflict (id) do nothing;

-- ---------- Ley 6101 (CABA) — actividades económicas · COMERCIO IRREGULAR ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000011','30000000-0000-4000-8000-000000000011',
 'Ley 6101 (CABA) — Actividades Económicas > Título I > Artículo 4 (ámbito de aplicación)','4',null,
$f$AMBITO DE APLICACIÓN. PROCEDIMIENTOS ESPECIALES. Las disposiciones de la presente ley son de aplicación a todas las actividades económicas que se desarrollen en el territorio de la Ciudad Autónoma de Buenos Aires.
La autoridad de aplicación podrá determinar cuáles serán los procedimientos especiales aplicables fijados en normas reglamentarias que continuarán vigentes, los que en su interpretación deberán ajustarse a las pautas y principios de esta Ley.
Las actividades económicas se deben ajustar a las normas de los Códigos Urbanístico, de la Edificación y demás normativa aplicable.
La presente Ley será de aplicación supletoria en las tramitaciones administrativas cuyos regímenes especiales subsistan.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000012','30000000-0000-4000-8000-000000000011',
 'Ley 6101 (CABA) — Actividades Económicas > Título I > Artículo 6 (autoridad de aplicación)','6',null,
$f$AUTORIDAD DE APLICACIÓN. La Agencia Gubernamental de Control, entidad autárquica en el ámbito del Ministerio de Justicia y Seguridad de la Ciudad Autónoma de Buenos Aires creada por Ley 2624, o el organismo que en el futuro la reemplace, será la autoridad de aplicación de la presente Ley.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000013','30000000-0000-4000-8000-000000000011',
 'Ley 6101 (CABA) — Actividades Económicas > Título III > Artículo 8 (clases de autorizaciones)','8',null,
$f$CLASES DE AUTORIZACIONES
No podrán ejercerse actividades económicas sin la clase de autorización correspondiente.
Las autorizaciones de las actividades económicas se obtendrán -con carácter general- a través de declaración responsable salvo los casos establecidos expresamente para las licencias y los permisos en esta Ley o normativa específica.
La autoridad de aplicación deberá verificar el contenido de la declaración responsable.
Las autorizaciones de las actividades económicas son:
1. DECLARACION RESPONSABLE
La declaración responsable es el documento suscrito por un ciudadano interesado y por el profesional interviniente en el que manifiestan, bajo su responsabilidad, que cumple con los requisitos establecidos por la normativa vigente para el ejercicio de una determinada actividad económica o varias en conjunto, y que dispone de la documentación que así lo acredita y se compromete a mantener su cumplimiento durante el período de su duración acompañando la documentación que así lo acredita y que será determinada por la reglamentación.
La presentación de la declaración responsable autoriza el funcionamiento de la actividad; sin perjuicio de ello, la autoridad de aplicación deberá realizar la correspondiente verificación.
2. LICENCIA DE ACTIVIDAD ECONOMICA
La autorización de la actividad económica es otorgada una vez presentada la declaración responsable del ciudadano, previa comprobación por la autoridad de aplicación del cumplimiento de las condiciones establecidas en la normativa aplicable.
Las actividades económicas no podrán ser iniciadas hasta tanto se notifique el acto administrativo que autoriza de forma expresa el inicio de la actividad.
3. PERMISO DE ACTIVIDAD ECONOMICA
La autorización de la actividad económica es otorgada mediante permiso cuando se requiere para un evento o una actividad de carácter transitorio o limitada a un breve período de tiempo en los términos que fije la autoridad de aplicación.$f$,
 'conducta_prohibida') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000014','30000000-0000-4000-8000-000000000011',
 'Ley 6101 (CABA) — Actividades Económicas > Título III > Artículo 10 (declaración responsable)','10',null,
$f$DECLARACION RESPONSABLE
Todas las actividades económicas que se desarrollen en el territorio de la Ciudad Autónoma de Buenos Aires requieren la presentación de la declaración responsable para su ejercicio.
Las actividades económicas que corresponden a las licencias requieren declaración responsable y el acto administrativo previo para su funcionamiento.$f$,
 'obligacion') on conflict (id) do nothing;

-- ---------- Ley 3706 (CABA) — situación de calle · VULNERABILIDAD SOCIAL ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000015','30000000-0000-4000-8000-000000000012',
 'Ley 3706 (CABA) — Situación de calle > Título I > Artículo 2 (definición)','2',null,
$f$Definición.
a) A los fines de la presente Ley se consideran personas en situación de calle a los hombres o mujeres adultos/as o grupo familiar, sin distinción de género u origen que habiten en la calle o espacios públicos de la Ciudad Autónoma de Buenos Aires en forma transitoria o permanente y/o que utilicen o no la red de alojamiento nocturno.
b) A los fines de la presente Ley se consideran personas en riesgo a la situación de calle a los hombres o mujeres adultos o grupo familiar, sin distinción de género u origen, que padezcan al menos una de las siguientes situaciones:
1) Que se encuentren en instituciones de las cuales egresarán en un tiempo determinado y estén en situación de vulnerabilidad habitacional.
2) Que se encuentren debidamente notificados de resolución administrativa o sentencia judicial firme de desalojo.
3) Que habiten en estructuras temporales o asentamientos, sin acceso a servicios o en condiciones de hacinamiento.$f$,
 null) on conflict (id) do nothing;

-- Art. 4: un fragmento por inciso relevante (regla de chunking de REP-2906).
-- Se cargan los incisos a), b), c) y g); los restantes (d a l) quedan sin cargar,
-- no partidos: cada uno es un chunk posible en una ronda futura.

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000016','30000000-0000-4000-8000-000000000012',
 'Ley 3706 (CABA) — Situación de calle > Título II > Artículo 4 (deberes del Estado) > inciso a)','4','a',
$f$Es deber del Estado de la Ciudad Autónoma de Buenos Aires garantizar:
a.- La promoción de acciones positivas tendientes a erradicar los prejuicios, la discriminación y las acciones violentas hacia las personas en situación de calle y en riesgo a la situación de calle;$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000065','30000000-0000-4000-8000-000000000012',
 'Ley 3706 (CABA) — Situación de calle > Título II > Artículo 4 (deberes del Estado) > inciso b)','4','b',
$f$Es deber del Estado de la Ciudad Autónoma de Buenos Aires garantizar:
b.- La remoción de obstáculos que impiden a las personas en situación de calle o en riesgo a la situación de calle la plena garantía y protección de sus derechos, así como el acceso igualitario a las oportunidades de desarrollo personal y comunitario.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000066','30000000-0000-4000-8000-000000000012',
 'Ley 3706 (CABA) — Situación de calle > Título II > Artículo 4 (deberes del Estado) > inciso c)','4','c',
$f$Es deber del Estado de la Ciudad Autónoma de Buenos Aires garantizar:
c.- La formulación e implementación de políticas públicas en materia de salud, educación, vivienda, trabajo, esparcimiento y cultura elaboradas y coordinadas intersectorial y transversalmente entre los distintos organismos del estado;$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000067','30000000-0000-4000-8000-000000000012',
 'Ley 3706 (CABA) — Situación de calle > Título II > Artículo 4 (deberes del Estado) > inciso g)','4','g',
$f$Es deber del Estado de la Ciudad Autónoma de Buenos Aires garantizar:
g.- El acceso prioritario a los programas de desintoxicación y tratamientos para condiciones asociadas al abuso de sustancias, la salud mental y las discapacidades de acuerdo a las particularidades del sujeto que solicita el servicio, en el caso de personas en situación de calle y en riesgo a la situación de calle con discapacidad y adicciones;$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000017','30000000-0000-4000-8000-000000000012',
 'Ley 3706 (CABA) — Situación de calle > Título IV > Capítulo I > Artículo 6 (acceso a servicios socioasistenciales)','6',null,
$f$Las personas en situación de calle y en riesgo a la situación de calle tienen derecho al acceso pleno a los servicios socioasistenciales que sean brindados por el Estado y por entidades privadas conveniadas con el Estado, sin distinción de origen, raza, edad, condición social, nacionalidad, género, orientación sexual, origen étnico, religión y/o situación migratoria$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000018','30000000-0000-4000-8000-000000000012',
 'Ley 3706 (CABA) — Situación de calle > Título IV > Capítulo I > Artículo 7 (continuidad de la prestación)','7',null,
$f$Todos y cada uno de los servicios socioasistenciales brindados por el Estado y por entidades privadas conveniadas con el Estado, se garantizan mediante la prestación articulada y de forma continua durante todos los días del año y las 24 horas del día.$f$,
 'obligacion') on conflict (id) do nothing;

-- ---------- Ley 4036 (CABA) — derechos sociales · VULNERABILIDAD SOCIAL ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000019','30000000-0000-4000-8000-000000000013',
 'Ley 4036 (CABA) — Derechos sociales > Definiciones > Artículo 1 (objeto)','1',null,
$f$La presente Ley tiene por objeto la protección integral de los Derechos Sociales para los ciudadanos de la Ciudad Autónoma de Buenos Aires, priorizando el acceso de aquellos en estado de vulnerabilidad social y/o emergencia a las prestaciones de las políticas sociales que brinde el Gobierno de la Ciudad de acuerdo con los principios establecidos en los artículos 17 y 18 de la Constitución de la Ciudad de Buenos Aires.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000020','30000000-0000-4000-8000-000000000013',
 'Ley 4036 (CABA) — Derechos sociales > Definiciones > Artículo 6 (vulnerabilidad social)','6',null,
$f$Vulnerabilidad Social: Entiéndase por vulnerabilidad social, a la condición social de riesgo o dificultad que inhabilita, afecta o invalida la satisfacción de las necesidades básicas de los ciudadanos.
Se considera "personas en situación de vulnerabilidad social" a aquellas que por razón de edad, género, estado físico o mental, o por circunstancias sociales, económicas, étnicas y/o culturales, encuentran dificultades para ejercer sus derechos.$f$,
 null) on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000021','30000000-0000-4000-8000-000000000013',
 'Ley 4036 (CABA) — Derechos sociales > Adultos mayores > Artículo 18','18',null,
$f$En caso de los adultos mayores a 60 años de edad en situación de vulnerabilidad social, la autoridad de aplicación deberá asegurarles el acceso a un alojamiento y a la seguridad alimentaria a tal fin podrá destinar entregas dinerarias o disponer de otro mecanismo.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000022','30000000-0000-4000-8000-000000000013',
 'Ley 4036 (CABA) — Derechos sociales > Personas con discapacidad > Artículo 23','23',null,
$f$A los efectos de esta ley se entiende por personas con discapacidad en condición de vulnerabilidad social aquellas que padeciendo alteración, total o parcial, y/o limitación funcional, permanente o transitoria, física, mental o sensorial, se hallen bajo la línea de pobreza o indigencia, y/o en estado de abandono, y/o expuestos a situaciones de violencia o maltrato, y/o a cualquier otro factor que implique su marginación y/o exclusión.$f$,
 null) on conflict (id) do nothing;

commit;

-- =====================================================================
-- PARTE 4 — Fragmentos: Provincia de Buenos Aires y Nación
-- =====================================================================
begin;

-- ---------- Ley 13.592 (PBA) — residuos sólidos urbanos · AMBIENTE ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000023','30000000-0000-4000-8000-000000000014',
 'Ley 13.592 (PBA) — GIRSU > Título I > Capítulo II > Artículo 6 (competencia de los municipios)','6',null,
$f$En cumplimiento del objetivo del Artículo 1º, y en atención a la importancia de la gestión integral de residuos sólidos urbanos, todos los Municipios Bonaerenses deben presentar a la Autoridad Ambiental Provincial un Programa de Gestión Integral de residuos sólidos urbanos conforme a los términos de la presente Ley y la Ley Nacional Nº 25.916. Dicho programa debe ser elevado en un lapso no mayor a seis (6) meses de la entrada en vigor de ésta, inclusive los comprendidos actualmente por el Decreto Ley N° 9.111/78, los que sólo están exceptuados de cumplir con lo prescripto por esta norma en lo referido a la fase de disposición final, presentación que deberá efectuar la Coordinación Ecológica Área Metropolitana Sociedad del Estado (CEAMSE).
En caso que los Municipios incumplan con la presentación del Programa Gestión Integral de residuos sólidos urbanos dentro del plazo establecido, la Autoridad Ambiental podrá determinar y establecer el programa de gestión integral de residuos sólidos urbanos que corresponda aplicar a tales Municipios.
Asimismo, la CEAMSE deberá presentar un plan de gestión referido a la disposición final de residuos para los Municipios comprendidos en el artículo 2° del Decreto-Ley 9.111/78 y aquellos que hayan suscripto o suscriban Convenios con el mismo, de conformidad con lo establecido en el artículo 67º de la Ley N° 11.723.
Estos planes deberán contemplar la existencia de circuitos informales de recolección y recuperación con el fin de incorporarlos al sistema de gestión integral.
Establécese que a partir de la aprobación de cada uno de los programas de cada Municipio, estos tendrán un plazo de cinco (5) años para que las distintas jurisdicciones alcancen una reducción del treinta por ciento (30 %) de la totalidad de los residuos con destino a la disposición final, comenzando en el primer año con una campaña de concientización, para continuar con una progresión del diez por ciento (10%) para el segundo (2°) año y efectuando obligatoriamente la separación en origen como mínimo en dos (2) fracciones de residuos, veinte por ciento (20%) para el tercer (3°) año y el treinta por ciento (30%) para el quinto (5°) año; siendo política de estado tender a profundizar en los años siguientes los porcentajes establecidos precedentemente.
Los incumplimientos al término del plazo fijado serán sancionados de acuerdo con la reglamentación de la presente.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000024','30000000-0000-4000-8000-000000000014',
 'Ley 13.592 (PBA) — GIRSU > Título I > Capítulo III > Artículo 9 (erradicación y clausura de basurales)','9',null,
$f$Los Programas de Gestión Integral de residuos sólidos urbanos que presenten los Municipios para su aprobación por parte de la Autoridad Ambiental Provincial, deben tener como objetivos erradicar la práctica del arrojo en basurales a cielo abierto e impedir el establecimiento de nuevos basurales a cielo abierto en sus respectivas jurisdicciones.
Las Autoridades Municipales quedan obligadas a clausurar dichos basurales, conforme a los principios establecidos en la Ley Nacional N° 25.675, la Ley N° 11.723 y la reglamentación de la presente. Queda prohibida la quema a cielo abierto o cualquier sistema de tratamiento no autorizado por la Autoridad Ambiental Provincial.
En caso de incumplimiento con lo establecido en los párrafos precedentes, la Autoridad Ambiental Provincial podrá ejecutar todas las fases del tratamiento conforme al Programa de Gestión presentado por el Municipio. En estos casos dichas tareas se harán con cargo al respectivo Municipio.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000025','30000000-0000-4000-8000-000000000014',
 'Ley 13.592 (PBA) — GIRSU > Título I > Capítulo IV > Artículo 17 (inspección y vigilancia)','17',null,
$f$La Provincia y los Municipios según el ámbito que corresponda, deben realizar actos de inspección y vigilancia para verificar el cumplimiento de las disposiciones de esta Ley y del Reglamento que en su consecuencia se dicte.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000026','30000000-0000-4000-8000-000000000014',
 'Ley 13.592 (PBA) — GIRSU > Título I > Capítulo I > Artículo 3 (principios) > inciso 12','3','12',
$f$Constituyen principios y conceptos básicos sobre los que se funda la política de la gestión integral de residuos sólidos urbanos:
12) La recolección y tratamiento de residuos es un servicio de carácter esencial para la comunidad, en garantía de la salubridad y la preservación del ambiente.$f$,
 null) on conflict (id) do nothing;

-- ---------- Ley 27.654 (Nación) — situación de calle · VULNERABILIDAD SOCIAL ----------
-- Art. 3 en su TEXTO VIGENTE (sustituido por el art. 1 del Decreto 373/2025).
-- El art. 10 original NO se carga: fue sustituido por el art. 2 de ese decreto.

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000027','30000000-0000-4000-8000-000000000015',
 'Ley 27.654 — Situación de calle > Capítulo I > Artículo 2 (ámbito de aplicación)','2',null,
$f$Ámbito de aplicación. Con fundamento en la Constitución Nacional y en los tratados internacionales de derechos humanos de jerarquía constitucional, las disposiciones de la presente ley son de orden público y de aplicación obligatoria en todo el territorio de la República Argentina.$f$,
 null) on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000028','30000000-0000-4000-8000-000000000015',
 'Ley 27.654 — Situación de calle > Capítulo I > Artículo 3 (autoridad de aplicación, texto según Decreto 373/2025)','3',null,
$f$Autoridad de Aplicación. La SECRETARÍA NACIONAL DE NIÑEZ, ADOLESCENCIA Y FAMILIA del MINISTERIO DE CAPITAL HUMANO será la Autoridad de Aplicación de la presente ley.
El cumplimiento de las disposiciones de la presente es responsabilidad concurrente del ESTADO NACIONAL, las Provincias y la CIUDAD AUTÓNOMA DE BUENOS AIRES, en los términos que a continuación se establecen:
La Autoridad de Aplicación actuará como órgano rector, a través de la aprobación de directrices y lineamientos generales en la materia.
Asimismo, podrá intervenir de manera subsidiaria y/o complementaria a través de la asistencia a las jurisdicciones locales cuando estas no dispongan de los recursos presupuestarios o financieros necesarios para la efectiva aplicación de la ley. En tales casos, se establecerán los correspondientes mecanismos de monitoreo y rendición de cuentas, a efectos de garantizar la adecuada utilización de los fondos transferidos y el cumplimiento de los objetivos previstos.
En concordancia con los lineamientos generales que establezca la Autoridad de Aplicación como órgano rector, las Provincias y la CIUDAD AUTÓNOMA DE BUENOS AIRES, en su condición de responsables inmediatos de la atención de las personas en situación de calle y en riesgo de situación de calle, tienen a su cargo la elaboración e implementación de las políticas públicas pertinentes, para lo cual elaborarán sus propios planes y estrategias para abordar la problemática y brindar atención directa a sus destinatarios.
A tales efectos y a los fines del cumplimiento de la presente ley, la Autoridad de Aplicación coordinará acciones entre las Provincias y la CIUDAD AUTÓNOMA DE BUENOS AIRES y los organismos del ESTADO NACIONAL que en razón de la materia resulten competentes.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000029','30000000-0000-4000-8000-000000000015',
 'Ley 27.654 — Situación de calle > Capítulo I > Artículo 4 (definiciones)','4',null,
$f$Definiciones. A los fines de la presente ley:
1. Personas en situación de calle son quienes, sin distinción de ninguna clase, sea por su condición social, género, edad, origen étnico, nacionalidad, situación migratoria, religión, estado de salud o cualquier otra, habiten en la calle o en espacios públicos en forma transitoria o permanente, utilicen o no servicios socioasistenciales o de alojamiento nocturno, públicos o privados.
2. Personas en riesgo a la situación de calle son quienes, sin distinción de ninguna clase, sea por su condición social, género, edad, origen étnico, nacionalidad, situación migratoria, religión, estado de salud o cualquier otra, estén en alguna de las siguientes situaciones:
a) Residan en establecimientos públicos o privados –sean médicos, asistenciales, penitenciarios u otros– de los cuales deban egresar por cualquier causa en un plazo determinado y no dispongan de una vivienda para el momento del egreso;
b) Se encuentren debidamente notificadas de una situación inminente de desalojo o de una resolución administrativa o sentencia judicial firme de desalojo, y no tengan recursos para procurarse una vivienda;
c) Habiten en asentamientos precarios o transitorios sin acceso a servicios públicos esenciales o en condiciones de hacinamiento que afecten su integridad psicofísica, que no califiquen como barrios populares conforme la ley 27.453.$f$,
 null) on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000030','30000000-0000-4000-8000-000000000015',
 'Ley 27.654 — Situación de calle > Capítulo II > Artículo 5 (principio general)','5',null,
$f$Principio general. La situación de calle y el riesgo a la situación de calle son estados de vulnerabilidad social extrema que implican una grave restricción para el ejercicio de los derechos consagrados en la Constitución Nacional y los tratados internacionales de derechos humanos.$f$,
 null) on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000031','30000000-0000-4000-8000-000000000015',
 'Ley 27.654 — Situación de calle > Capítulo II > Artículo 8 (acceso y uso de los espacios públicos)','8',null,
$f$Derecho al acceso y al uso de los servicios, de la infraestructura y de los espacios públicos. Las personas en situación de calle o en riesgo de situación de calle, tiene derecho al acceso y uso de los servicios, de la infraestructura y de los espacios públicos sin discriminación por su condición de vulnerabilidad. Este derecho al acceso y uso de los servicios, de la infraestructura y de los espacios públicos no puede configurarse en una acción organizada y permanente. El Estado debe procurar evitar el uso coercitivo de la fuerza pública, para ello debe agotar todas las instancias de articulación de las acciones y medidas asistenciales establecidas en los capítulos III y IV de la presente ley.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000032','30000000-0000-4000-8000-000000000015',
 'Ley 27.654 — Situación de calle > Capítulo II > Artículo 9 (acceso pleno a servicios socioasistenciales)','9',null,
$f$Derecho al acceso pleno a los servicios socioasistenciales, de salud y de apoyo para la obtención de un trabajo digno. Las personas en situación de calle y en riesgo a la situación de calle tienen derecho al acceso pleno a:
1. Los servicios socioasistenciales y de salud prestados por instituciones públicas o privadas con convenio con el Estado.
2. Los servicios de apoyo para el acceso a un trabajo digno, ya sea en relación de dependencia o de manera autónoma, en forma personal o asociada.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000033','30000000-0000-4000-8000-000000000015',
 'Ley 27.654 — Situación de calle > Capítulo III > Artículo 11 (deberes) > inciso 6','11','6',
$f$Deberes. El Estado debe garantizar a las personas en situación de calle y en riesgo a la situación de calle:
6. La creación de una red nacional de centros de integración social, de atención permanente y continua, que presten servicios socioasistenciales básicos de alojamiento, alimentación, higiene y cuidados de la salud y además desarrollen actividades de formación y ocupación adaptadas a los conocimientos y necesidades de los destinatarios.$f$,
 'obligacion') on conflict (id) do nothing;

-- ---------- Ley 15.625 (PBA) — situación de calle · VULNERABILIDAD SOCIAL ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000034','30000000-0000-4000-8000-000000000016',
 'Ley 15.625 (PBA) — Situación de calle > Artículo 1 (objeto)','1',null,
$f$Objeto. La presente Ley tiene por objeto garantizar integralmente y hacer operativos los derechos humanos de las personas en situación de calle y en riesgo a la situación de calle que se encuentren en el territorio de la provincia de Buenos Aires.$f$,
 null) on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000035','30000000-0000-4000-8000-000000000016',
 'Ley 15.625 (PBA) — Situación de calle > Artículo 3 (orden público)','3',null,
$f$Orden público. Con fundamento en la Constitución Nacional, la Constitución de la Provincia de Buenos Aires y en los tratados internacionales de derechos humanos de jerarquía constitucional, las disposiciones de la presente Ley son de orden público y de aplicación obligatoria en todo el territorio de la provincia de Buenos Aires.$f$,
 null) on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000036','30000000-0000-4000-8000-000000000016',
 'Ley 15.625 (PBA) — Situación de calle > Artículo 4 (autoridad de aplicación)','4',null,
$f$Autoridad de Aplicación. Será autoridad de aplicación de la presente Ley la Dirección de Atención a Familias en Situación de Calle de la Provincia de Buenos Aires o quien la reemplace en sus funciones en el futuro.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000037','30000000-0000-4000-8000-000000000016',
 'Ley 15.625 (PBA) — Situación de calle > Artículo 6 (dignidad personal e integridad física)','6',null,
$f$Derecho a la dignidad personal e integridad física. Las personas en situación de calle y en riesgo a la situación de calle tienen derecho a ser respetadas en su dignidad personal y en su integridad física. El Estado debe realizar acciones positivas tendientes a evitar y eliminar toda discriminación o estigmatización hacia las personas en situación de calle o en riesgo a la situación de calle, estableciendo a la vez condiciones que permitan el ejercicio de su autodeterminación y el libre desarrollo de la personalidad y de la subjetividad. En ningún caso se podrá negar atención a personas en situación de calle o en riesgo de situación de calle por falta de documento nacional de identidad u otra documentación.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000038','30000000-0000-4000-8000-000000000016',
 'Ley 15.625 (PBA) — Situación de calle > Artículo 11 (deberes) > inciso 6','11','6',
$f$Deberes. El Estado debe garantizar a las personas en situación de calle y en riesgo a la situación de calle:
6. La creación de una Red Provincial de Centros de Integración Social, de atención permanente y continua, que presten servicios socio asistenciales básicos de alojamiento, alimentación, higiene y cuidados de la salud y además desarrollen actividades de formación y ocupación adaptadas a los conocimientos y necesidades de los destinatarios.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000039','30000000-0000-4000-8000-000000000016',
 'Ley 15.625 (PBA) — Situación de calle > Artículo 14 (Sistema Provincial de Atención Telefónica)','14',null,
$f$Sistema Provincial de Atención Telefónica. Créase el Sistema de Atención Telefónica permanente, de alcance en toda la provincia de Buenos Aires, en forma articulada entre la Autoridad de Aplicación y las autoridades municipales, será de carácter gratuito para la intervención inmediata de los organismos competentes en la atención de las situaciones comprendidas en la presente Ley.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000040','30000000-0000-4000-8000-000000000016',
 'Ley 15.625 (PBA) — Situación de calle > Artículo 16 (Servicio Móvil de Atención Social)','16',null,
$f$Servicio de atención móvil. Créase el Servicio Móvil de Atención Social, destinado a brindar una respuesta inmediata a las personas en situación de calle, a través de la instalación de dispositivos móviles equipados con profesionales, operadores sociales y provistos de elementos de primera necesidad que permitirá:
a. Mejorar la capacidad de detección y diagnóstico de las poblaciones en situación de calle y/o riesgo social.
b. Llevar asistencia alimenticia, vestimenta, abrigo y contención profesional a personas en situación de calle y/o abandono.
c. Intervenir en situaciones de emergencia habitacional.
d. Brindar asistencia sanitaria a las personas en situación de calle.
e. Derivar y, en los casos en que sea necesario, trasladar a las personas atendidas a los servicios de salud pertinentes.
f. Colaborar en la atención de personas y/o familias afectadas por grandes emergencias sociales.
g. Realizar acciones de detección y diagnóstico.$f$,
 'competencia') on conflict (id) do nothing;

commit;

-- =====================================================================
-- PARTE 5 — Fragmentos sobre fuentes que YA EXISTÍAN en la base
-- =====================================================================
begin;

-- ---------- Ley 451 (CABA) — Régimen de Faltas · source_id ...006 ----------
-- Tipo de fundamento: sancion. NO se muestran al ciudadano (el producto no sanciona).
-- Texto tomado del PDF consolidado ya conservado en el repo:
--   docs/fuentes/normativas/pdf/ley_451_caba_texto_completo.pdf

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000041','10000000-0000-4000-8000-000000000006',
 'Ley 451 (CABA) — Régimen de Faltas > Artículo 1.3.13 (arrojar residuos)','1.3.13',null,
$f$Arrojar residuos. El/la que arroje residuos, desperdicios, deshechos u otros objetos a la vía pública, a partes comunes de edificios de propiedad horizontal o a predios linderos, es sancionado/a con multa de cincuenta (50) a tres mil cuatrocientas (3.400) unidades fijas.
Cuando los residuos, desperdicios, deshechos u otros objetos arrojados provengan de un establecimiento industrial o comercial el/la titular o responsable es sancionado/a con multa de cien (100) a veinte mil quinientas (20.500) unidades fijas y/o clausura del establecimiento y/o inhabilitación de hasta diez días.$f$,
 'sancion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000042','10000000-0000-4000-8000-000000000006',
 'Ley 451 (CABA) — Régimen de Faltas > Artículo 1.3.10.1 (escombros y restos de obra)','1.3.10.1',null,
$f$Arrojo, carga o descarga de escombros u otros elementos. El que arroje, cargue o descargue escombros, tierra, desechos, áridos o restos de obra en la vía pública o, en baldíos o fincas sin autorización, es sancionado con multa de mil (1.000) a seis mil quinientas (6.500) unidades fijas y/o inhabilitación.
Cuando la falta sea cometida por una empresa de transporte de este tipo de residuos, su titular o responsable es sancionado con multa de dos mil (2.000) a veinte mil (20.000) unidades fijas y/o clausura.$f$,
 'sancion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000043','10000000-0000-4000-8000-000000000006',
 'Ley 451 (CABA) — Régimen de Faltas > Artículo 1.3.2.3.4 (vuelco de elementos en sumideros)','1.3.2.3.4',null,
$f$Vertido, arrojo y/o vuelco de elementos en sumideros. El/la que vierta, arroje y/o vuelque cualquier tipo de sustancia, elemento y/o material, orgánico o inorgánico, sólido o líquido en sumideros, a excepción de aguas pluviales o superficiales, será sancionado/a con una multa de trescientas cincuenta (350) a mil trescientas (1.300) unidades fijas.
Si del vertido, arrojo y/o vuelco resultare la alteración, obstrucción y/o destrucción, en todo o en parte del sumidero, el/la responsable, será sancionado/a con una multa de un mil (1.000) a seis mil quinientas (6.500) unidades fijas.$f$,
 'sancion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000044','10000000-0000-4000-8000-000000000006',
 'Ley 451 (CABA) — Régimen de Faltas > Artículo 2.1.14 (mantenimiento de cercas y veredas)','2.1.14',null,
$f$Mantenimiento de cercas y veredas. El/la titular de un inmueble que no construyere, reparare o mantuviere en buen estado de conservación las cercas y veredas reglamentarias de los inmuebles es sancionado/a con multa de doscientas (200) a cinco mil quinientas (5.500) unidades fijas.
Cuando se tratare de un inmueble afectado al régimen de propiedad horizontal, la multa se aplica al consorcio de propietarios.$f$,
 'sancion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000045','10000000-0000-4000-8000-000000000006',
 'Ley 451 (CABA) — Régimen de Faltas > Artículo 2.1.8 (depósito de materiales en la vía pública)','2.1.8',null,
$f$Depósito de materiales en la vía pública. El/la que utilice la vía pública para depositar materiales de una obra y/o interrumpa el tránsito por la acera y/o realice cualquier actividad que signifique perjuicio y no cuente con autorización para ello es sancionado/a con multa de doscientas cincuenta (250) a dos mil quinientas (2.500) unidades fijas y/o inhabilitación.$f$,
 'sancion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000046','10000000-0000-4000-8000-000000000006',
 'Ley 451 (CABA) — Régimen de Faltas > Sección 4 > Capítulo I > Artículo 4.1.1 (ausencia de habilitación)','4.1.1',null,
$f$Ausencia de habilitación. El/la titular o responsable de un establecimiento en el que instale o ejerza actividad lucrativa sin la debida habilitación o permiso, es sancionado/a con multa de mil cuatrocientas (1.400) a trece mil setecientas (13.700) unidades fijas y clausura del establecimiento hasta tanto cuente con la debida habilitación.
Cuando la infracción es cometida en un establecimiento donde se desarrolle actividad de baile, estación de servicio, garaje, cine, teatro, centro comercial o local de gran afluencia de público, hoteles, establecimientos educativos, geriátricos, natatorios, clubes y/o cualquier actividad que requiera de habilitación previa, su titular o responsable es sancionado/a con multa de trece mil setecientas (13.700) a sesenta y ocho mil quinientas (68.500) unidades fijas y clausura del establecimiento hasta tanto cuente con la debida habilitación.
Si se tratare de un establecimiento dedicado a la comercialización de bebidas alcohólicas, las sanciones previstas en los párrafos anteriores se pueden incrementar hasta el doble.
Cuando el imputado/a comete la misma falta dentro del término de trescientos sesenta y cinco (365) días a contar desde la sanción firme en sede administrativa y/o judicial, los montos mínimo y máximo de la sanción prevista se elevan al doble y se impondrá accesoriamente clausura del establecimiento hasta tanto cuente con la debida habilitación.
Cuando el imputado/a comete tres (3) veces la misma falta dentro del término de un (1) año y seis (6) meses en alguno de los establecimientos mencionados en el párrafo segundo del presente Artículo, y las mismas cuentan con sanción firme en sede administrativa y/o judicial, no podrá solicitar habilitación para el desarrollo de la actividad por la cual fue sancionado por el término de dos (2) años debiendo dejarse constancia en el Registro de Antecedentes y comunicado a la autoridad de la Dirección General de Habilitaciones y Permisos o al organismo que en el futuro la reemplace.
Cuando el local tuviere habilitación para funcionar en otros rubros complementarios, y cometiere infracciones sobre los mismos, se impondrán las sanciones establecidas para los rubros de la actividad complementaria.
Adicionalmente, si el local tuviere además habilitación para funcionar en otros rubros, se seguirá sobre los mismos el procedimiento establecido en el Artículo 23 para dichas habilitaciones. La Autoridad de Aplicación deberá comunicar dicha circunstancia a la Dirección General de Habilitaciones y Permisos o al organismo que en el futuro la reemplace.$f$,
 'sancion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000047','10000000-0000-4000-8000-000000000006',
 'Ley 451 (CABA) — Régimen de Faltas > Sección 4 > Capítulo I > Artículo 4.1.2 (venta en la vía pública sin autorización)','4.1.2',null,
$f$Venta en la vía pública sin autorización. El/la que venda mercaderías en la vía pública sin permiso o en infracción con la autorización otorgada, es sancionado/a con multa de diez (10) a doscientas cincuenta (250) unidades fijas y decomiso de las cosas.
Cuando se trate de una empresa u organización la sanción es multa de cincuenta (50) a dos mil quinientas (2.500) unidades fijas y decomiso de las mercaderías y/o inhabilitación.$f$,
 'sancion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000048','10000000-0000-4000-8000-000000000006',
 'Ley 451 (CABA) — Régimen de Faltas > Artículo 6.1.54 (estacionamiento en áreas peatonales)','6.1.54',null,
$f$Estacionamiento en áreas peatonales. El/la conductor/a, titular o responsable de un automotor, motovehículo, acoplado o semiacoplado que estacione o se detenga en arterias peatonales o sobre las aceras de cualquier arteria u ocupando parte de ella, es sancionado/a con multa de trescientas (300) unidades fijas.$f$,
 'sancion') on conflict (id) do nothing;

-- ---------- LOM Decreto-Ley 6769/58 · Artículo 27 · source_id ...002 ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000049','10000000-0000-4000-8000-000000000002',
 'Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 27 > inciso 1','27','1',
$f$Corresponde a la función deliberativa municipal reglamentar:
1.- La radicación, habilitación y funcionamiento de los establecimientos comerciales e industriales, en la medida que no se opongan a las normas que al respecto dicte la Provincia y que atribuyan competencia a organismos provinciales.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000002',
 'Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 27 > inciso 2','27','2',
$f$Corresponde a la función deliberativa municipal reglamentar:
2.- El trazado, apertura, rectificación, construcción y conservación de calles, caminos, puentes, túneles, plazas y paseos públicos y las delineaciones y niveles en las situaciones no comprendidas en la competencia provincial.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000051','10000000-0000-4000-8000-000000000002',
 'Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 27 > inciso 6','27','6',
$f$Corresponde a la función deliberativa municipal reglamentar:
6.- La instalación y el funcionamiento de abastos, mataderos, mercados y demás lugares de acopio y concentración de productos y de animales, en la medida que no se opongan a las normas que al respecto dicte la Provincia y que atribuyan competencia a organismos provinciales.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000052','10000000-0000-4000-8000-000000000002',
 'Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 27 > inciso 8','27','8',
$f$Corresponde a la función deliberativa municipal reglamentar:
8.- Las condiciones de higiene y salubridad que deben reunir los sitios públicos, los lugares de acceso público y los baldíos.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000053','10000000-0000-4000-8000-000000000002',
 'Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 27 > inciso 17','27','17',
$f$Corresponde a la función deliberativa municipal reglamentar:
17.- La prevención y eliminación de las molestias que afecten la tranquilidad, el reposo y la comodidad de la población, en especial las de origen sonoro y lumínico, así como las trepidaciones, la contaminación ambiental y de los cursos de agua y el aseguramiento de la conservación de los recursos naturales.$f$,
 'competencia') on conflict (id) do nothing;

-- ---------- Ley 13.927 (PBA) · source_id ...008 (estaba sin fragmentos) ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000054','10000000-0000-4000-8000-000000000008',
 'Ley 13.927 (PBA) — Tránsito > Título I > Artículo 1 (adhesión)','1',null,
$f$ADHESIÓN. La Provincia de Buenos Aires adhiere, en cuanto no se opongan a las disposiciones de la presente, a las Leyes Nacionales 24.449 y 26.363, que como anexos se acompañan.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000055','10000000-0000-4000-8000-000000000008',
 'Ley 13.927 (PBA) — Tránsito > Título I > Artículo 2 (competencia)','2',null,
$f$COMPETENCIA. Se declaran autoridades de aplicación y comprobación de la presente norma, sin perjuicio de las asignaciones de competencia que el Poder Ejecutivo efectúe en la Reglamentación, a la Policía de Seguridad Vial en el ámbito de su competencia y a las Policías de Seguridad de la Provincia en los casos de flagrancia, o en los casos en que se le requiera su colaboración, a la Dirección de Vialidad, a la Dirección Provincial del Transporte, al Ministerio de Jefatura de Gabinete y Gobierno y a las Municipalidades. El Ministerio de Salud, a través de la dependencia que designe, podrá intervenir en los casos de control de conducción bajo los efectos de alcoholemia y/o estupefacientes.
En lo referente a las funciones de prevención y control de tránsito en las rutas nacionales y otros espacios del dominio público nacional sometidos a jurisdicción provincial, la Provincia de Buenos Aires, podrá celebrar convenios de colaboración con Gendarmería Nacional, la Agencia Nacional de Seguridad Vial y/o cualquier otro organismo nacional, no pudiendo interferir los mismos en la competencia provincial en esa materia, en virtud de tratarse de una facultad no delegada al Gobierno Federal.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000056','10000000-0000-4000-8000-000000000008',
 'Ley 13.927 (PBA) — Tránsito > Título I > Artículo 2 bis (objeto, incorporado por Ley 15.402)','2','bis',
$f$OBJETO. La presente Ley tiene por objeto preservar la salud, la vida y la seguridad de quienes transiten el territorio provincial; reducir la mortalidad y la morbilidad derivadas de la siniestralidad vial. Las normas que fijan las pautas de circulación y las que establecen los límites legales de alcohol en sangre y de cualquier sustancia que disminuya las condiciones para la conducción, integran las políticas públicas de seguridad vial.$f$,
 null) on conflict (id) do nothing;

commit;

-- =====================================================================
-- PARTE 6 — Fragmentos de información institucional (source_type = informacion)
-- Responden "a quién le reclamo" cuando no hay conducta prohibida clara.
-- NO reemplazan el fundamento normativo: lo completan.
-- Todo el contenido es transcripción de la página oficial del organismo.
-- =====================================================================
begin;

-- ---------- Agencia Gubernamental de Control (CABA) ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000057','30000000-0000-4000-8000-000000000017',
 'Agencia Gubernamental de Control (CABA) > Qué hace',null,'competencia',
$f$Agencia Gubernamental de Control (AGC), Gobierno de la Ciudad Autónoma de Buenos Aires: "Habilita y fiscaliza los locales comerciales de la Ciudad. Controla las obras en construcción y la higiene alimentaria en establecimientos y vía pública."
Es la autoridad de aplicación de la Ley 6101 (Ley Marco de Regulación de Actividades Económicas), según el artículo 6 de esa ley. Fue creada por la Ley 2624 y funciona en el ámbito del Ministerio de Justicia y Seguridad de la Ciudad.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000058','30000000-0000-4000-8000-000000000017',
 'Agencia Gubernamental de Control (CABA) > Cómo denunciar',null,'canal',
$f$Canal oficial de denuncias de la Agencia Gubernamental de Control de la Ciudad Autónoma de Buenos Aires, según su propia página:
"Si detecta un comercio, local u obra en construcción con irregularidades o en situación de riesgo, avísenos."
"Recuerde que también puede canalizar su denuncia telefónicamente a través de la línea 147."
"Para una correcta gestión de su denuncia complete todos los campos del formulario de Gestión Colaborativa."
"Si su aviso sobre irregularidades o situaciones de riesgo ha sido realizado en forma correcta quedará identificado mediante un número único de denuncia. Dicho número le servirá para realizar su seguimiento dentro del sistema."
Formulario web: https://gestioncolaborativa.buenosaires.gob.ar/prestaciones — Teléfono: 147 — Domicilio: Tte. Gral. Juan D. Perón 2933, Ciudad Autónoma de Buenos Aires.$f$,
 'competencia') on conflict (id) do nothing;

-- ---------- Línea 108 — Buenos Aires Presente (CABA) ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000059','30000000-0000-4000-8000-000000000018',
 'Línea 108 — Buenos Aires Presente (CABA) > Qué es y cómo se usa',null,'canal',
$f$Línea 108 de Atención Social Inmediata, Gobierno de la Ciudad Autónoma de Buenos Aires, según su página oficial:
"La Línea 108, de Atención Social Inmediata, recibe durante las 24 horas consultas y solicitudes de la comunidad sobre asistencia a personas y a familias en situación de calle o vulnerabilidad social, y se encarga de derivar los casos a equipos de profesionales del Ministerio de Desarrollo Humano y Hábitat."
"Opción 1: Destinada a toda la ciudad para que pueda informar sobre casos de personas en situación de calle."
"Opción 2: Para atención directa a personas que se encuentran en situación de calle."
"Opción 3: Servicio de información y orientación sobre adicciones."
"Opción 4: Para dar contención y asesoramiento sobre derechos de las personas embarazadas en situación de vulnerabilidad."
"Vos también podés ayudar: si ves a una persona en situación de calle, llamá al 108."
Para avisar por otra persona corresponde la opción 1. La línea atiende únicamente en la Ciudad Autónoma de Buenos Aires.$f$,
 'competencia') on conflict (id) do nothing;

-- ---------- Municipalidad de Avellaneda ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000060','30000000-0000-4000-8000-000000000019',
 'Municipalidad de Avellaneda > Secretaría de Producción, Comercio y Ambiente',null,'produccion-comercio-ambiente',
$f$Secretaría de Producción, Comercio y Ambiente de la Municipalidad de Avellaneda. Áreas comprendidas: Subsecretaría de Ambiente, Subsecretaría de Habilitaciones y Subsecretaría de Producción, Comercio y Ambiente.
Según su página oficial: "La Secretaría de Producción, Comercio y Ambiente tiene como misión principal la implementación y el desarrollo de políticas públicas concretas para el amplio espectro del sector productivo de nuestra ciudad, el cual abarca industrias, cooperativas, PyMEs, negocios de barrio, grandes cadenas comerciales y feriantes. Sus líneas de acción se basan en la verificación, la protección, la inclusión y la vinculación entre estos actores, relacionándose de distintas maneras con el ambiente."
Domicilio: San Martín 1351, Planta baja, Avellaneda. Teléfono: 6089-8332 / 6089-8311. Correo: produccioncya@mda.gob.ar.
Es el área competente en Avellaneda para habilitaciones comerciales y para ambiente. Trámite de habilitaciones comerciales: https://www.mda.gob.ar/tramites/habilitaciones-comerciales/$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000061','30000000-0000-4000-8000-000000000019',
 'Municipalidad de Avellaneda > Centro de Atención al Vecino (CAV)',null,'cav',
$f$Centro de Atención al Vecino (CAV) de la Municipalidad de Avellaneda: es el canal oficial para ingresar un reclamo municipal.
Según la guía de trámites oficial del municipio: "Por esta gestión, tiene a disposición el Centro de Atención al Vecino CAV, para ingresar un reclamo. Una vez concluida la carga del formulario, el sistema le otorgará un Nro. de Reclamo, con el que luego podrá hacer el seguimiento del mismo hasta su resolución o reiterarlo según lo considere necesario."
Plataforma web: http://reclamosweb.mda.gob.ar/ — Teléfono: 0800-122-6323 — Guía de trámites y servicios: https://tramitesweb.mda.gob.ar/ — Sede municipal y Mesa General de Entradas: Güemes 835, Planta baja, Avellaneda.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000062','30000000-0000-4000-8000-000000000019',
 'Municipalidad de Avellaneda > Secretaría de Desarrollo Social',null,'desarrollo-social',
$f$Secretaría de Desarrollo Social de la Municipalidad de Avellaneda, en el ámbito del Observatorio Social de Políticas Públicas. Áreas comprendidas: Subsecretaría de Desarrollo Social, Consejo de Mujeres, Géneros y Diversidad y Consejo de Niñez, Adolescencia y Familia.
Según su página oficial: "Área de acción territorial permanente. Trabajamos para que todos y todas tengan las mismas oportunidades de mejorar su calidad de vida. Lo hacemos con una mirada de inclusión, a través de una red integral de protección que incluye distintas estrategias de abordaje para estar cerca de los individuos, familias y organizaciones de la sociedad civil. Desde una estrategia integradora se prioriza la intervención directa en territorio y la búsqueda de soluciones a los problemas sociales detectados."
Domicilio: San Martín 1351, Piso 2 (B1870AAR), Avellaneda. Teléfono: 6089-8315. Correo: desarrollosocial@mda.gob.ar.
Programas propios declarados: Dirección de Inclusión de personas con discapacidad (Belgrano 1124, teléfonos 5533-9926 y 5533-9928), Dirección de Envión (jóvenes de 12 a 21 años en situación de vulnerabilidad) y Plan Más Vida (personas embarazadas e infancias hasta 6 años en situación de vulnerabilidad social).$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000063','30000000-0000-4000-8000-000000000019',
 'Municipalidad de Avellaneda > Consejo de Niñez, Adolescencia y Familia (guardia 24 horas)',null,'ninez-guardia',
$f$Consejo de Niñez, Adolescencia y Familia de la Municipalidad de Avellaneda, dependiente de la Secretaría de Desarrollo Social.
Domicilio: Colón 818, Avellaneda. Teléfonos: 4201-5053, 4201-1303 y 4201-4822. Guardia de 24 horas: 115 426-1618. Correo: ninezadolescenciayflia@mda.gob.ar.
Es el único canal de Avellaneda con guardia declarada de 24 horas y corresponde a las situaciones que involucran niños, niñas o adolescentes. Para personas adultas, el canal es el Centro de Atención al Vecino en horario de atención, y el área competente es la Secretaría de Desarrollo Social.$f$,
 'competencia') on conflict (id) do nothing;

-- ---------- Nación: SENAF / Ministerio de Capital Humano ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('40000000-0000-4000-8000-000000000064','30000000-0000-4000-8000-000000000020',
 'SENAF — Ministerio de Capital Humano > Rol en situación de calle',null,'rol-nacional',
$f$La Secretaría Nacional de Niñez, Adolescencia y Familia del Ministerio de Capital Humano es la Autoridad de Aplicación de la Ley 27.654, según el artículo 1 del Decreto 373/2025, que sustituyó el artículo 3 de esa ley.
El mismo decreto establece que la Nación actúa como órgano rector, mediante directrices y lineamientos generales, y que puede intervenir de manera subsidiaria y/o complementaria asistiendo a las jurisdicciones locales cuando estas no dispongan de los recursos necesarios. Las Provincias y la Ciudad Autónoma de Buenos Aires son "responsables inmediatos de la atención de las personas en situación de calle y en riesgo de situación de calle" y tienen a su cargo la atención directa.
En la práctica: un caso concreto no se deriva al Estado nacional. Se deriva al canal local. La referencia nacional fundamenta el deber, no direcciona el pedido.$f$,
 'competencia') on conflict (id) do nothing;

commit;

-- =====================================================================
-- PARTE 7 — Mapeo de fragmentos a categorías (fragment_services)
-- =====================================================================
begin;

insert into public.fragment_services (fragment_id, service_id)
select ('40000000-0000-4000-8000-0000000000' || v.n)::uuid, s.id
from (values
  -- Ley 5902 (CABA) — veredas
  ('01','INFRAESTRUCTURA'), ('02','INFRAESTRUCTURA'), ('03','INFRAESTRUCTURA'),
  ('04','INFRAESTRUCTURA'), ('05','INFRAESTRUCTURA'), ('06','INFRAESTRUCTURA'),
  -- Ley 1854 (CABA) — Basura Cero
  ('07','AMBIENTE'), ('08','AMBIENTE'), ('09','AMBIENTE'), ('10','AMBIENTE'),
  -- Ley 6101 (CABA) — actividades económicas
  ('11','COMERCIO_IRREGULAR'), ('12','COMERCIO_IRREGULAR'),
  ('13','COMERCIO_IRREGULAR'), ('14','COMERCIO_IRREGULAR'),
  -- Ley 3706 (CABA) — situación de calle (16, 65, 66 y 67 son los incisos a, b, c y g del art. 4)
  ('15','VULNERABILIDAD_SOCIAL'), ('16','VULNERABILIDAD_SOCIAL'),
  ('17','VULNERABILIDAD_SOCIAL'), ('18','VULNERABILIDAD_SOCIAL'),
  ('65','VULNERABILIDAD_SOCIAL'), ('66','VULNERABILIDAD_SOCIAL'), ('67','VULNERABILIDAD_SOCIAL'),
  -- Ley 4036 (CABA) — derechos sociales
  ('19','VULNERABILIDAD_SOCIAL'), ('20','VULNERABILIDAD_SOCIAL'),
  ('21','VULNERABILIDAD_SOCIAL'), ('22','VULNERABILIDAD_SOCIAL'),
  -- Ley 13.592 (PBA) — residuos
  ('23','AMBIENTE'), ('24','AMBIENTE'), ('25','AMBIENTE'), ('26','AMBIENTE'),
  -- Ley 27.654 (Nación) — situación de calle
  ('27','VULNERABILIDAD_SOCIAL'), ('28','VULNERABILIDAD_SOCIAL'), ('29','VULNERABILIDAD_SOCIAL'),
  ('30','VULNERABILIDAD_SOCIAL'), ('31','VULNERABILIDAD_SOCIAL'), ('32','VULNERABILIDAD_SOCIAL'),
  ('33','VULNERABILIDAD_SOCIAL'),
  -- Ley 15.625 (PBA) — situación de calle
  ('34','VULNERABILIDAD_SOCIAL'), ('35','VULNERABILIDAD_SOCIAL'), ('36','VULNERABILIDAD_SOCIAL'),
  ('37','VULNERABILIDAD_SOCIAL'), ('38','VULNERABILIDAD_SOCIAL'), ('39','VULNERABILIDAD_SOCIAL'),
  ('40','VULNERABILIDAD_SOCIAL'),
  -- Ley 451 (CABA) — sanciones
  ('41','AMBIENTE'), ('42','AMBIENTE'),
  ('43','AMBIENTE'), ('43','INFRAESTRUCTURA'),   -- sumideros: residuo y desagüe
  ('44','INFRAESTRUCTURA'), ('45','INFRAESTRUCTURA'),
  ('46','COMERCIO_IRREGULAR'), ('47','COMERCIO_IRREGULAR'),
  ('48','TRANSITO'),
  -- LOM art. 27
  ('49','COMERCIO_IRREGULAR'), ('50','INFRAESTRUCTURA'), ('51','COMERCIO_IRREGULAR'),
  ('52','AMBIENTE'), ('53','AMBIENTE'),
  -- Ley 13.927 (PBA) — tránsito
  ('54','TRANSITO'), ('55','TRANSITO'), ('56','TRANSITO'),
  -- Canales oficiales
  ('57','COMERCIO_IRREGULAR'), ('58','COMERCIO_IRREGULAR'),
  ('59','VULNERABILIDAD_SOCIAL'),
  ('60','COMERCIO_IRREGULAR'), ('60','AMBIENTE'),
  ('61','TRANSITO'), ('61','INFRAESTRUCTURA'), ('61','AMBIENTE'), ('61','COMERCIO_IRREGULAR'),
  ('62','VULNERABILIDAD_SOCIAL'), ('63','VULNERABILIDAD_SOCIAL'), ('64','VULNERABILIDAD_SOCIAL')
) as v(n, code)
join public.services s on s.service_code = v.code
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Corrección de un hueco detectado en el estado del 28/09/2026:
-- el fragmento de la Ley 24.449 art. 48 inc. t) "venta de productos en el camino"
-- existe (id b6717f77-c30e-4cca-985a-6346d741fe38) pero NO tiene fila en
-- fragment_services. Es el único fragmento de comercio irregular que ya estaba
-- cargado y el RAG no lo podía filtrar por categoría.
-- ---------------------------------------------------------------------
insert into public.fragment_services (fragment_id, service_id)
select 'b6717f77-c30e-4cca-985a-6346d741fe38', s.id
from public.services s
where s.service_code = 'COMERCIO_IRREGULAR'
  and exists (select 1 from public.knowledge_fragments
               where id = 'b6717f77-c30e-4cca-985a-6346d741fe38')
on conflict do nothing;

commit;

-- =====================================================================
-- PARTE 8 — Verificación (correr después del lote; V-5 es la más importante)
-- =====================================================================

-- V-1 · Conteos esperados
select 'knowledge_sources'   as tabla, 20 as esperado, count(*) as actual from public.knowledge_sources
union all
select 'knowledge_fragments', 84, count(*) from public.knowledge_fragments
union all
select 'fragment_services',   89, count(*) from public.fragment_services;

-- V-2 · Cobertura por categoría y jurisdicción (el antes/después que pide el ticket)
select s.service_code,
       coalesce(sp.name, sub.name, c.name) as ambito,
       ks.source_type_code,
       count(*) as fragmentos
  from public.fragment_services fs
  join public.knowledge_fragments kf on kf.id = fs.fragment_id and kf.is_current
  join public.knowledge_sources  ks on ks.id = kf.source_id and ks.is_current
  join public.services s on s.id = fs.service_id
  left join public.states_provinces sp on sp.id = ks.state_province_id
  left join public.subdivisions     sub on sub.id = ks.subdivision_id
  left join public.countries        c  on c.id  = ks.country_id
 group by 1,2,3
 order by 1,2,3;

-- V-3 · Ninguna categoría puede quedar en cero
select s.service_code, count(fs.fragment_id) as fragmentos
  from public.services s
  left join public.fragment_services fs on fs.service_id = s.id
 group by 1
 order by 2;

-- V-4 · Ningún fragmento vigente sin categoría (salvo el distractor deliberado)
select kf.id, kf.hierarchy_path
  from public.knowledge_fragments kf
  left join public.fragment_services fs on fs.fragment_id = kf.id
 where kf.is_current and fs.fragment_id is null;

-- V-5 · Fragmentos SIN embedding: éstos NO se recuperan por similitud todavía.
--       Debe quedar vacío después de correr el paso de embeddings del loader.
select kf.id, ks.title, kf.article, kf.subsection
  from public.knowledge_fragments kf
  join public.knowledge_sources ks on ks.id = kf.source_id
  left join public.fragment_embeddings fe
         on fe.fragment_id = kf.id
        and fe.model_code = (select code from public.embedding_models where is_active)
 where kf.is_current and fe.fragment_id is null
 order by ks.title, kf.article;

-- V-6 · Trazabilidad obligatoria: toda fuente con URL y fecha de verificación
select id, title from public.knowledge_sources
 where source_url is null or source_url = '' or verified_at is null;

-- V-7 · Cascada jurisdiccional: qué recupera un reporte de cada jurisdicción piloto
select l.name as localidad, count(distinct e.source_id) as fuentes_elegibles
  from public.localities l
 cross join lateral public.eligible_knowledge_sources(l.id) e
 where l.name in ('Avellaneda','Balvanera')
 group by 1;

-- =====================================================================
-- PARTE 9 — Reversión del lote
-- =====================================================================
-- El lote sólo agrega filas con ids deterministas, así que se revierte sin tocar
-- nada previo. Orden obligatorio por las claves foráneas.
-- Ejecutar SÓLO si hay que dar marcha atrás.
--
-- begin;
--   delete from public.report_ai_evidence
--    where fragment_id::text like '40000000-0000-4000-8000-%';
--   delete from public.fragment_embeddings
--    where fragment_id::text like '40000000-0000-4000-8000-%';
--   delete from public.fragment_services
--    where fragment_id::text like '40000000-0000-4000-8000-%';
--   delete from public.knowledge_fragments
--    where id::text like '40000000-0000-4000-8000-%';
--   delete from public.knowledge_sources
--    where id::text like '30000000-0000-4000-8000-%';
--   -- el dato corregido de la Ley 13.927 y el mapeo del fragmento b6717f77 se dejan:
--   -- son correcciones de datos preexistentes, no parte del lote nuevo.
-- commit;
--
-- Nota: si ya se generaron embeddings y hubo análisis de reportes usando estos
-- fragmentos, la reversión borra evidencia de esos análisis (report_ai_evidence).
-- En ese caso conviene, en lugar de borrar, marcar is_current = false en los
-- fragmentos del lote y conservar el historial:
--
--   update public.knowledge_fragments set is_current = false
--    where id::text like '40000000-0000-4000-8000-%';

