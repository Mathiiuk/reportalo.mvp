-- ==============================================================================
-- 04_rag_corpus_seed.sql — Corpus RAG, copiado VERBATIM de la PARTE 7 de
-- docs/REP-3769_seed_y_RAG.sql (fuente de verdad, aprobada, no editada acá).
-- Catálogos + 8 normas + 1 adhesión + 15 fragmentos verificados por Hernán
-- (REP-2906). Igual que en el script original: NO se modifica ningún texto.
-- ==============================================================================
begin;

insert into public.source_types (code, description) values
  ('corpus_legal','Normativa jurídica'),
  ('informacion','Información no normativa: trámites, guías del organismo')
on conflict (code) do nothing;

insert into public.document_types (code, description) values
  ('constitucion','Constitución'),
  ('ley','Ley'),
  ('decreto_ley','Decreto-Ley')
on conflict (code) do nothing;

insert into public.foundation_types (code, description) values
  ('obligacion','Obligación del Estado o del municipio'),
  ('conducta_prohibida','Conducta prohibida'),
  ('sancion','Sanción (no se muestra al ciudadano)'),
  ('competencia','Competencia de un organismo')
on conflict (code) do nothing;

insert into public.ai_result_statuses (code, description) values
  ('fundamentado','Hay normativa aplicable y citada'),
  ('indeterminado','Error o validación fallida: no se emite fundamento'),
  ('sin_normativa','No hay normativa cargada que sustente el reporte'),
  ('fuera_de_alcance','No corresponde a Reportalo (por ejemplo, un delito: 911)'),
  ('asistencia','Situación de asistencia social, no es una infracción (vulnerabilidad social)')
on conflict (code) do nothing;

-- text-embedding-004 fue apagado por Google el 14/01/2026: se usa gemini-embedding-2 a 768
insert into public.embedding_models (code, provider, model_name, dimensions, is_active) values
  ('gemini-embedding-2@768','google','gemini-embedding-2',768,true)
on conflict (code) do nothing;

insert into public.generation_models (code, provider, model_name, is_active) values
  ('gemini-3.8-flash','google','gemini-3.8-flash',true)
on conflict (code) do nothing;

-- Normas (8). La Ley 24.449 requiere adhesión (su art. 1): PBA adhirió (Ley 13.927), CABA no.
insert into public.knowledge_sources
  (id, source_type_code, document_type_code, document_number, title, issuing_authority,
   country_id, state_province_id, requires_adhesion, source_url, verified_at, last_amended_by)
select v.id::uuid, 'corpus_legal', v.doc_type, v.num, v.title, v.authority,
       case when v.scope = 'AR' then c.id end,
       case when v.scope <> 'AR' then sp.id end,
       v.req_adh, v.url, v.verified::timestamptz, v.amended
from (values
  ('10000000-0000-4000-8000-000000000001','constitucion',null,'Constitución de la Provincia de Buenos Aires','Provincia de Buenos Aires','Buenos Aires',false,'https://www.infoleg.gob.ar/?page_id=173','2026-09-06',null),
  ('10000000-0000-4000-8000-000000000002','decreto_ley','6769/58','Ley Orgánica de las Municipalidades','Provincia de Buenos Aires','Buenos Aires',false,'https://normas.gba.gob.ar/documentos/OVG48SW0.html','2026-09-06',null),
  ('10000000-0000-4000-8000-000000000003','ley','210','Ente Único Regulador de los Servicios Públicos','Legislatura de la Ciudad Autónoma de Buenos Aires','Ciudad Autónoma de Buenos Aires',false,'https://boletinoficial.buenosaires.gob.ar/normativaba/norma/4623','2026-09-07',null),
  ('10000000-0000-4000-8000-000000000004','ley','24.449','Ley de Tránsito','Congreso de la Nación Argentina','AR',true,'https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/818/texact.htm','2026-09-06',null),
  ('10000000-0000-4000-8000-000000000005','ley','2148','Código de Tránsito y Transporte','Legislatura de la Ciudad Autónoma de Buenos Aires','Ciudad Autónoma de Buenos Aires',false,'https://juristeca.jusbaires.gob.ar/compilacion-normativa-juristeca/ley-2148/h-tit-7/','2026-09-06',null),
  ('10000000-0000-4000-8000-000000000006','ley','451','Régimen de Faltas','Legislatura de la Ciudad Autónoma de Buenos Aires','Ciudad Autónoma de Buenos Aires',false,'https://boletinoficial.buenosaires.gob.ar/normativaba/norma/391197','2026-09-07','Ley N° 5905/17'),
  ('10000000-0000-4000-8000-000000000007','decreto_ley','8031/73','Código de Faltas de la Provincia de Buenos Aires','Provincia de Buenos Aires','Buenos Aires',false,'https://normas.gba.gob.ar/documentos/ZBOPDhkV.html','2026-09-06',null),
  ('10000000-0000-4000-8000-000000000008','ley','13.927','Ley 13.927 (Provincia de Buenos Aires)','Legislatura de la Provincia de Buenos Aires','Buenos Aires',false,'https://normas.gba.gob.ar/documentos/0YqDnfd0.html','2026-09-13',null)
) as v(id, doc_type, num, title, authority, scope, req_adh, url, verified, amended)
cross join public.countries c
left join public.states_provinces sp on sp.name = v.scope and sp.country_id = c.id
where c.iso_code = 'AR'
on conflict (id) do nothing;

-- Adhesión: la Provincia de Buenos Aires (Ley 13.927) adhiere a la Ley 24.449
insert into public.source_adhesions (source_id, adhering_source_id, scope_note, verified_at)
values ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000008',
        'en cuanto no se opongan a las disposiciones de la presente', '2026-09-13')
on conflict do nothing;

-- Fragmentos (15). Cada línea es copia literal de su fuente. Ley 451: texto consolidado oficial.

-- FR01 · fuente: constitucion_pba_arts_190_192.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 'Constitución de la Provincia de Buenos Aires > Artículo 192 > inciso 4','192','4',
$f$Son atribuciones inherentes al régimen municipal, las siguientes:
4. Tener a su cargo el ornato y salubridad, los establecimientos de beneficencia que no estén a cargo de sociedades particulares, asilos de inmigrantes que sostenga la Provincia, las cárceles locales de detenidos y la vialidad pública.$f$,
 'obligacion') on conflict (id) do nothing;

-- FR02 · fuente: LOM_decreto_ley_6769-58_arts_52_59.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',
 'Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 52','52',null,
$f$Corresponde al Concejo disponer la prestación de los servicios públicos de barrido, riego, limpieza, alumbrado, provisión de agua, obras sanitarias y desagües pluviales, inspecciones, registro de guías, transporte y todo otro tendiente a satisfacer necesidades colectivas de carácter local, siempre que su ejecución no se encuentre a cargo de la Provincia o de la Nación.
Tratándose de servicios que puedan tener vinculaciones con las leyes y planes provinciales, el Concejo deberá gestionar autorización ante el Poder Ejecutivo o proceder a convenir las coordinaciones necesarias.$f$,
 'obligacion') on conflict (id) do nothing;

-- FR03 · fuente: LOM_decreto_ley_6769-58_arts_52_59.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002',
 'Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 59','59',null,
$f$Constituyen obras públicas municipales:
a) Las concernientes a los establecimientos e instituciones municipales.
b) Las de ornato, salubridad, vivienda y urbanismo.
c) Las atinentes a servicios públicos de competencia municipal.
d) Las de infraestructura urbana, en especial las de pavimentación, repavimentación, cercos, veredas, saneamiento, agua corriente, iluminación, electrificación, provisión de gas y redes telefónicas.
Se considerará que las obras de infraestructura cuentan con declaración de utilidad pública, cuando estén incluidas expresamente en planes integrales de desarrollo urbano, aprobados por ordenanza.
Cuando se trate de obras que no estén incluidas en los planes aludidos precedentemente, sólo se podrá proceder a la pertinente declaración de Utilidad pública, mediante ordenanza debidamente fundada.$f$,
 'obligacion') on conflict (id) do nothing;

-- FR04 · fuente: ley_210_caba_ente_regulador.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000003',
 'Ley 210 (CABA) — Ente Único Regulador de los Servicios Públicos > Artículo 3 (funciones) > inciso j)','3','j',
$f$j) Recibir y tramitar las quejas y reclamos que efectúen los usuarios en sede administrativa tendiente a resolver el conflicto planteado con el prestador.$f$,
 'competencia') on conflict (id) do nothing;

-- FR05 · fuente: ley_210_caba_ente_regulador.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000003',
 'Ley 210 (CABA) — Ente Único Regulador de los Servicios Públicos > Artículo 2 (servicios comprendidos) > inciso b)','2','b',
$f$b) Alumbrado público y señalamiento luminoso$f$,
 'competencia') on conflict (id) do nothing;

-- FR06 · fuente: ley_210_caba_ente_regulador.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000003',
 'Ley 210 (CABA) — Ente Único Regulador de los Servicios Públicos > Artículo 2 (servicios comprendidos) > inciso c)','2','c',
$f$c) Higiene urbana, incluida la disposición final$f$,
 'competencia') on conflict (id) do nothing;

-- FR07 · fuente: ley_24449_arts_48_49.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000004',
 'Ley 24.449 — Ley de Tránsito > Artículo 48 (prohibiciones) > inciso i)','48','i',
$f$Está prohibido en la vía pública:
i) La detención irregular sobre la calzada, el estacionamiento sobre la banquina y la detención en ella sin ocurrir emergencia;$f$,
 'conducta_prohibida') on conflict (id) do nothing;

-- FR08 · fuente: ley_24449_arts_48_49.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000004',
 'Ley 24.449 — Ley de Tránsito > Artículo 48 (prohibiciones) > inciso t)','48','t',
$f$Está prohibido en la vía pública:
t) Estorbar u obstaculizar de cualquier forma la calzada o la banquina y hacer construcciones, instalarse o realizar venta de productos en zona alguna del camino;$f$,
 'conducta_prohibida') on conflict (id) do nothing;

-- FR09 · fuente: ley_24449_arts_48_49.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000004',
 'Ley 24.449 — Ley de Tránsito > Artículo 49 (estacionamiento) > inciso b) > 1','49','b.1',
$f$En zona urbana deben observarse las reglas siguientes:
b) No se debe estacionar ni autorizarse el mismo:
1. En todo lugar donde se pueda afectar la seguridad, visibilidad o fluidez del tránsito o se oculte la señalización;$f$,
 'conducta_prohibida') on conflict (id) do nothing;

-- FR10 · fuente: ley_24449_arts_48_49.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000004',
 'Ley 24.449 — Ley de Tránsito > Artículo 49 (estacionamiento) > inciso b) > 3','49','b.3',
$f$En zona urbana deben observarse las reglas siguientes:
b) No se debe estacionar ni autorizarse el mismo:
3. Sobre la senda para peatones o bicicletas, aceras, rieles, sobre la calzada, y en los diez metros anteriores y posteriores a la parada del transporte de pasajeros.$f$,
 'conducta_prohibida') on conflict (id) do nothing;

-- FR11 · fuente: ley_2148_caba_arts_7.1.8_7.1.9.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000005',
 'Ley 2148 (CABA) — Código de Tránsito y Transporte > Título VII > Artículo 7.1.8 (prohibiciones especiales)','7.1.8',null,
$f$En doble fila, excepto como detención previa a la maniobra de estacionamiento.$f$,
 'conducta_prohibida') on conflict (id) do nothing;

-- FR12 · fuente: ley_2148_caba_arts_7.1.8_7.1.9.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000005',
 'Ley 2148 (CABA) — Código de Tránsito y Transporte > Título VII > Artículo 7.1.9 (prohibiciones generales)','7.1.9',null,
$f$Frente a los vados o rampas para personas con discapacidad.$f$,
 'conducta_prohibida') on conflict (id) do nothing;

-- FR13 · fuente: ley_451_texto.txt
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000006',
 'Ley 451 (CABA) — Régimen de Faltas > Artículo 6.1.52 (estacionamiento o detención prohibida)','6.1.52',null,
$f$El/la conductor/a, titular o responsable de un automotor de uso particular, motovehículo, acoplado o semiacoplado que estacione o se detenga en un lugar prohibido o en forma antirreglamentaria, es sancionado/a con multa de cien (100) unidades fijas. El/la conductor/a, titular o responsable de transporte de pasajeros y/o de carga que estacione en un lugar prohibido o en forma antirreglamentaria, es sancionado/a con multa de cien (100) unidades fijas. Cuando el estacionamiento se realice en lugares reservados para servicios de emergencia, o paradas de transporte de pasajeros, entradas de vehículos, ciclovías, carriles exclusivos, corredores de Metrobus y zonas de Microcentro y Macrocentro, la multa se elevará al doble. Cuando el estacionamiento se realice en lugares reservados para vehículos de personas con discapacidad o rampas para discapacitados es sancionado/a con multa de trescientas (300) unidades fijas.$f$,
 'sancion') on conflict (id) do nothing;

-- FR14 · fuente: ley_451_texto.txt
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000006',
 'Ley 451 (CABA) — Régimen de Faltas > Artículo 6.1.37 (obstrucción de vía)','6.1.37',null,
$f$El/la conductor/a de un vehículo que cause la obstrucción de la vía transversal, ciclovías, veredas o estacionamientos reservados, es sancionado/a con multa de setenta (70) unidades fijas. Cuando la obstrucción se produzca, carriles exclusivos y/o preferenciales, METROBUS y Premetro, la multa se elevará al doble. Cuando la obstrucción se produzca en rampas para discapacitados o en lugares reservados para vehículos de personas con discapacidad es sancionado/a con multa de trescientas (300) unidades fijas.$f$,
 'sancion') on conflict (id) do nothing;

-- FR15 · fuente: codigo_faltas_decreto_ley_8031-73_indice.md
-- Distractor deliberado (REP-2906): sin categoría ni tipo de fundamento, como cualquier norma no vinculada
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000007',
 'Decreto-Ley 8031/73 — Código de Faltas de la Provincia de Buenos Aires > Índice',null,null,
$f$TÍTULO I — Del Régimen Contravencional (validez, penas, imputabilidad, reincidencia, extinción)
TÍTULO II — De las Faltas:
Cap. I: Contra la Seguridad de las Personas
Cap. II: Contra el Patrimonio
Cap. III: Contra la Moralidad Pública y las Buenas Costumbres
Cap. IV: Contra la Tranquilidad y el Orden Público
Cap. V: Contra la Autoridad
Cap. VI: Contra el Ejercicio Regular del Deporte (derogado)
Cap. VII: Contra la Fe Pública
Cap. VIII: Contra los Festejos del Carnaval
Cap. IX: De las Expresiones Utilizadas en este Título
Cap. X: Represión de los Juegos de Azar (derogado por Ley 13.470)
TÍTULO III — Órgano de la Justicia de Faltas y del Procedimiento$f$,
 null) on conflict (id) do nothing;

-- Categoría de cada fragmento (15 filas; FR15 no lleva ninguna).
-- LOM art. 52 (FR02) también en AMBIENTE: "barrido, riego, limpieza" cubre basurales y acumulación
-- de residuos (decisión del PO, 14/09/2026).
insert into public.fragment_services (fragment_id, service_id)
select v.fid::uuid, s.id
from (values
  ('20000000-0000-4000-8000-000000000001','INFRAESTRUCTURA'),
  ('20000000-0000-4000-8000-000000000002','INFRAESTRUCTURA'),
  ('20000000-0000-4000-8000-000000000002','AMBIENTE'),
  ('20000000-0000-4000-8000-000000000003','INFRAESTRUCTURA'),
  ('20000000-0000-4000-8000-000000000004','INFRAESTRUCTURA'),
  ('20000000-0000-4000-8000-000000000005','INFRAESTRUCTURA'),
  ('20000000-0000-4000-8000-000000000006','AMBIENTE'),
  ('20000000-0000-4000-8000-000000000007','TRANSITO'),
  ('20000000-0000-4000-8000-000000000008','TRANSITO'),
  ('20000000-0000-4000-8000-000000000009','TRANSITO'),
  ('20000000-0000-4000-8000-000000000010','TRANSITO'),
  ('20000000-0000-4000-8000-000000000011','TRANSITO'),
  ('20000000-0000-4000-8000-000000000012','TRANSITO'),
  ('20000000-0000-4000-8000-000000000013','TRANSITO'),
  ('20000000-0000-4000-8000-000000000014','TRANSITO')
) as v(fid, code)
join public.services s on s.service_code = v.code
on conflict do nothing;

commit;
