-- =====================================================================
-- RAG-S15 · LOTE 3 del corpus normativo — Sprint 15 (D2, D3, D4 y Código de Faltas 8031/73)
-- Reportalo (RAR-2026) · 13/10/2026
--
-- Origen: devolución de Hernán Gregorini del 08/10/2026 (docs/Entrega_Matias_RAG_Sprint15/,
-- sección 3 y corpus/Corpus_propuesta_lote_S15_para_generador.md). El TEXTO de cada artículo sale
-- de ese archivo sin retranscribir (extraído por script) y es extracción asistida por IA:
-- HAY QUE CONTRASTARLO CON LA PÁGINA OFICIAL ANTES DE APLICAR (ver "Verificación" en el informe).
--
-- Se corre DESPUÉS de los lotes 1 y 2 (Sprint 14), ya aplicados. La PARTE 0 lo exige.
--
-- Qué hace:
--   * agrega 3 fuentes: Ordenanza Fiscal 31321 de Avellaneda, Ley 1777 (CABA) y Ley 6684 (CABA)
--   * agrega 8 fragmentos (un artículo = un fragmento, siempre completo):
--       Ord. Fiscal 31321 arts. 132, 231, 233, 235 · Ley 1777 arts. 10 y 11
--       Ley 6684 art. 26 (texto según Ley 6.851, 20 incisos) · Decreto-Ley 8031/73 art. 49
--   * agrega 'ordenanza' al catálogo document_types (taxonomía abierta, esquema cerrado)
--   * DESPUBLICA (is_current = false, sin borrar) el fragmento del ÍNDICE del Código de Faltas 8031/73
--
-- Estado esperado:
--   antes:    knowledge_sources=26, knowledge_fragments=124 (120 vigentes), fragment_services=159
--   después:  knowledge_sources=29, knowledge_fragments=132 (127 vigentes), fragment_services=169
--
-- Reglas: mismas que los lotes 1 y 2. IDs deterministas (70000000-… fuentes, 80000000-… fragmentos),
-- idempotente (ON CONFLICT DO NOTHING), transacciones separadas, sin DDL destructivo, sin DELETE.
--
-- NO genera embeddings. Los 8 fragmentos nuevos NO se recuperan hasta correr el paso de embeddings
-- (scripts/corpus-loader/embed-pending.mjs). La consulta W-5 los lista y tiene que quedar VACÍA.
-- Si se mide el RAG antes de ese paso, el resultado es el de hoy y la conclusión equivocada sería
-- "el corpus no alcanza".
-- =====================================================================

-- ---------------------------------------------------------------------
-- PARTE 0 — Guardas: aborta antes de escribir si falta algo
-- ---------------------------------------------------------------------
do $guard3$
declare
  faltan text := '';
begin
  if (select count(*) from public.knowledge_sources
       where id::text like '50000000-0000-4000-8000-%') < 6 then
    faltan := faltan || 'knowledge_sources: no están las 6 fuentes del lote 2. ';
  end if;

  if not exists (select 1 from public.knowledge_sources
                  where id = '10000000-0000-4000-8000-000000000007') then
    faltan := faltan || 'knowledge_sources: falta el Código de Faltas 8031/73 (fuente preexistente). ';
  end if;

  if not exists (select 1 from public.knowledge_fragments
                  where id = '20000000-0000-4000-8000-000000000015') then
    faltan := faltan || 'knowledge_fragments: falta el fragmento del índice del Código de Faltas. ';
  end if;

  if (select count(*) from public.services
       where service_code in ('INFRAESTRUCTURA','COMERCIO_IRREGULAR')) < 2 then
    faltan := faltan || 'services: faltan INFRAESTRUCTURA o COMERCIO_IRREGULAR. ';
  end if;

  if (select count(*) from public.foundation_types
       where code in ('competencia','obligacion','sancion','conducta_prohibida')) < 4 then
    faltan := faltan || 'foundation_types: falta alguno de competencia/obligacion/sancion/conducta_prohibida. ';
  end if;

  if not exists (select 1 from public.subdivisions sd
                   join public.states_provinces sp on sp.id = sd.state_province_id
                  where sd.name = 'Avellaneda' and sd.type = 'partido' and sp.name = 'Buenos Aires') then
    faltan := faltan || 'subdivisions: no está el partido de Avellaneda (Buenos Aires). ';
  end if;

  if faltan <> '' then
    raise exception 'RAG-S15 lote 3: precondiciones no cumplidas -> %', faltan;
  end if;
end
$guard3$;

-- ---------------------------------------------------------------------
-- PARTE 1 — Catálogo y fuentes nuevas (3)
-- ---------------------------------------------------------------------
begin;

insert into public.document_types (code, description) values
  ('ordenanza', 'Ordenanza municipal')
on conflict (code) do nothing;

-- Ordenanza Fiscal de Avellaneda: ámbito = partido de Avellaneda (subdivision), igual que el
-- canal 30000000-…0019. Sin provincia ni país: el cascade la resuelve por la subdivisión.
insert into public.knowledge_sources
  (id, source_type_code, document_type_code, document_number, title, issuing_authority,
   country_id, state_province_id, subdivision_id, requires_adhesion,
   source_url, is_current, verified_at, last_amended_by)
select '70000000-0000-4000-8000-000000000031'::uuid, 'corpus_legal', 'ordenanza', '31321',
       'Ordenanza Fiscal del Partido de Avellaneda — ejercicio 2026',
       'Honorable Concejo Deliberante de Avellaneda',
       null::uuid, null::uuid, sd.id, false,
       'https://sibom.slyt.gba.gob.ar/bulletins/13987/contents/2317189', true,
       '2026-10-08'::timestamptz, null
  from public.subdivisions sd
  join public.states_provinces sp on sp.id = sd.state_province_id
 where sd.name = 'Avellaneda' and sd.type = 'partido' and sp.name = 'Buenos Aires'
on conflict (id) do nothing;

insert into public.knowledge_sources
  (id, source_type_code, document_type_code, document_number, title, issuing_authority,
   country_id, state_province_id, subdivision_id, requires_adhesion,
   source_url, is_current, verified_at, last_amended_by)
select v.id::uuid, 'corpus_legal', 'ley', v.num, v.title, 'Legislatura de la Ciudad Autónoma de Buenos Aires',
       null::uuid, sp.id, null::uuid, false, v.url, true, '2026-10-08'::timestamptz, v.amended
  from (values
    ('70000000-0000-4000-8000-000000000032','1777','Ley Orgánica de Comunas',
     'https://boletinoficial.buenosaires.gob.ar/normativaba/norma/77544', null),
    ('70000000-0000-4000-8000-000000000033','6684','Ley de Ministerios de la Ciudad Autónoma de Buenos Aires',
     'https://boletinoficial.buenosaires.gob.ar/normativaba/norma/700848',
     'Ley 6.851 (art. 9° sustituye el art. 26); texto actualizado al 23/12/2025')
  ) as v(id, num, title, url, amended)
  cross join public.states_provinces sp
 where sp.name = 'Ciudad Autónoma de Buenos Aires'
on conflict (id) do nothing;

commit;

-- =====================================================================
-- PARTE 2 — Fragmentos (8). Un fragmento = un artículo completo.
-- Los textos incluyen el encabezado del artículo tal como lo trae la fuente.
-- =====================================================================
begin;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('80000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000031',
 'Ordenanza Fiscal 31321 (Avellaneda) — Ejercicio 2026 > Artículo 132 (Tasa por Servicios Generales)','132',null,
$f$Artículo 132º- Por la prestación de los servicios, tareas y actividades municipales referidas a alumbrado en espacios públicos, señalización, mantenimiento, realizaciones, barrido, limpieza y conservación de la vía pública se abonará la tasa que fija este Título, de acuerdo con los valores que establezca la Ordenanza Impositiva.

El presente tributo municipal recae sobre los bienes inmuebles ubicados en el Partido de Avellaneda.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('80000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000031',
 'Ordenanza Fiscal 31321 (Avellaneda) — Ejercicio 2026 > Artículo 231 (derechos por ocupación y uso del espacio público)','231',null,
$f$Artículo 231º- Por los conceptos que a continuación se detallan se abonarán los Derechos o Contribuciones a los que se refiere este Título:

a) La ocupación y/o uso del espacio aéreo, subsuelo, o espacios públicos por las prestatarias de servicios públicos y/o todos aquellos grandes usuarios (GU) que por su característica de consumo celebran contratos de compraventa de energía y potencia eléctrica en el Mercado Eléctrico Mayorista (MEM) con los generadores y/o distribuidores, con cables, cañerías, cámaras u otras instalaciones o tendidos.

b) La ocupación y/o uso del espacio aéreo, subsuelo, o espacios públicos por particulares o entidades no comprendidas en el punto anterior con instalaciones de cualquier clase, incluyendo poliductos, gasoductos o similares, en las condiciones que le permitan las respectivas ordenanzas anuales.

c) La ocupación y/o uso de la acera o demás espacios públicos con mesas, sillas, kioscos e instalaciones análogas, ferias o puestos.

d) La ocupación y/o uso de espacios públicos con la finalidad publicitaria por parte de complejos comerciales de amplia escala, en las condiciones que le permitan las respectivas ordenanzas anuales, y por parte de concesionarias de carteleras u otras modalidades publicitarias para las que se ocupen o utilicen espacios públicos.

e) La ocupación y/o uso del espacio aéreo, subsuelo, o espacios públicos por las personas humanas o ideales por cualquier causa que fuera no comprendida en los incisos anteriores.

f) El uso de espacio público para producciones audiovisuales.

g) Ocupación del espacio público.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('80000000-0000-4000-8000-000000000003','70000000-0000-4000-8000-000000000031',
 'Ordenanza Fiscal 31321 (Avellaneda) — Ejercicio 2026 > Artículo 233 (permiso de ocupación como requisito previo)','233',null,
$f$Artículo 233º- Será requisito previo a la realización del hecho imponible la obtención del permiso de ocupación que se tramitará ante el organismo municipal que determine el Departamento Ejecutivo en la reglamentación. Dichos permisos se extenderán por un período no mayor a un (1) año, pudiendo ser renovado por igual plazo.

Dichos permisos se otorgarán previo pago de los Derechos que establece este Título.

La obtención de los permisos y su renovación constituyen deberes formales que deben cumplimentar los contribuyentes de este tributo.

Con respecto al tributo uso de espacio público para producciones audiovisuales el permiso será solicitado ante la Autoridad de aplicación quien será la encargada de emitirlo en el uso de sus facultades.

El Departamento Ejecutivo queda facultado a reglamentar las formas y modalidades de pago de estos Derechos en el caso de permisos otorgados por tiempo determinado o transitorio.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('80000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000031',
 'Ordenanza Fiscal 31321 (Avellaneda) — Ejercicio 2026 > Artículo 235 (renovación de permisos, revocación y ocupación sin permiso)','235',null,
$f$Artículo 235º- La renovación de los permisos se llevará a cabo a la finalización del mismo y previo pago de los derechos.

Los que hayan registrado moras en los pagos de los derechos no podrán ocupar su espacio automáticamente.

Esta renovación estará sujeta a la aprobación de la Autoridad de Aplicación, la que también podrá revocar anticipadamente los permisos otorgados toda vez que concurran los supuestos del párrafo anterior o por razones de interés público, sin derecho a indemnización alguna.

Asimismo, toda vez que se detecte la ocupación del espacio aéreo, subsuelo y espacios públicos sin el permiso correspondiente, la Autoridad u Organismo de Aplicación podrá liquidar, determinar y perseguir el pago de los derechos que corresponda, así como aplicar el resto de las sanciones que prescribe esta Ordenanza Fiscal, sin perjuicio de las que correspondan de acuerdo a lo establecido en la Ordenanza Nº7.180. El pago de los Derechos efectuado con causa en estas situaciones no exime de la obligación de obtención de los permisos correspondientes.

También constituirá causal de aplicación de las sanciones establecidas en la presente Ordenanza Fiscal la mora en el pago de los Derechos por ocupación permanente o la falta o falsedad de la declaración que se exija para la liquidación y determinación de este tributo, en los casos comprendidos en el artículo anterior.$f$,
 'sancion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('80000000-0000-4000-8000-000000000005','70000000-0000-4000-8000-000000000032',
 'Ley 1777 (CABA) — Ley Orgánica de Comunas > Artículo 10 (competencias exclusivas)','10',null,
$f$Artículo 10 - Competencias exclusivas. Las Comunas tienen a su cargo en forma exclusiva:

a) La planificación, ejecución y control de los trabajos de mantenimiento urbano de las vías secundarias y otras de menor jerarquía, según normativa vigente.

b) La planificación, ejecución y control de los trabajos de mantenimiento de los espacios verdes, de conformidad con la Ley de Presupuesto.

c) La elaboración participativa de su programa de acción y anteproyecto de presupuesto anual, su ejecución y la administración de su patrimonio.

d) La iniciativa legislativa y la presentación de proyectos de decretos al Poder Ejecutivo.

e) En general, llevar adelante toda acción que contribuya al mejoramiento de la calidad de vida de sus habitantes y al desarrollo local, en tanto no implique menoscabo de la ciudad en su conjunto y/o de las demás jurisdicciones Comunales.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('80000000-0000-4000-8000-000000000006','70000000-0000-4000-8000-000000000032',
 'Ley 1777 (CABA) — Ley Orgánica de Comunas > Artículo 11 (competencias concurrentes)','11',null,
$f$Artículo 11 - Competencias concurrentes. Las Comunas tienen a su cargo en forma concurrente con el Poder Ejecutivo:

a) La participación en la planificación, prestación y control de los servicios.

b) La decisión, contratación y ejecución de obras públicas, proyectos y planes de impacto Comunal, así como la implementación de programas locales de rehabilitación y desarrollo urbano.

c) La fiscalización y el ejercicio del poder de policía, de las normas sobre usos de los espacios públicos, suelo y las materias que resulten de los convenios que se celebren a tal efecto, a través de órganos con dependencia administrativa y sede en la Comuna.

d) La evaluación de demandas y necesidades sociales en su ámbito territorial.

e) La participación en la formulación y ejecución de programas de desarrollo y promoción de derechos que, desarrollados por el Poder Ejecutivo, tengan incidencia en su ámbito territorial.

f) La gestión de actividades en materia de políticas sociales y proyectos comunitarios que pueda desarrollar con su propio presupuesto, complementarias de las que correspondan al Gobierno de la Ciudad.

g) La implementación de un adecuado método de resolución de conflictos mediante el sistema de mediación comunitaria, con participación de equipos multidisciplinarios.

h) El desarrollo de acciones de promoción, asistencia y asesoramiento a entidades vecinales no gubernamentales, sociedades de fomento, asociaciones cooperadoras, de consumidores y usuarios, clubes barriales y otras asociaciones civiles sin fines de lucro que actúen en el ámbito de la Comuna.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('80000000-0000-4000-8000-000000000007','70000000-0000-4000-8000-000000000033',
 'Ley 6684 (CABA) — Ley de Ministerios (texto según Ley 6.851) > Artículo 26 (Ministerio de Espacio Público e Higiene Urbana)','26',null,
$f$Artículo 26.- Corresponde al Ministerio de Espacio Público e Higiene Urbana asistir al Jefe de Gobierno en todo lo inherente a sus competencias, de acuerdo a los objetivos que se enuncian a continuación:

1. Diseñar e implementar las políticas tendientes a la mejora, mantenimiento, incremento y puesta en valor del espacio público, en coordinación con la Secretaría de Gobierno y Vínculo Ciudadano.

2. Planificar y administrar las políticas de protección e incremento de los espacios públicos de acceso libre y gratuito que garanticen su uso común.

3. Diseñar e implementar los planes y proyectos de obra pública para la conservación, integración y puesta en valor del paisaje urbano, del entorno urbano y de los centros comerciales a cielo abierto, en coordinación con las áreas competentes.

4. Implementar las acciones para la ubicación y preservación de monumentos, fuentes, obras de arte y demás elementos del patrimonio local que conforman el paisaje urbano, en coordinación con las áreas competentes.

5. Elaborar e implementar los proyectos de obra pública para el cuidado y recuperación del medioambiente y la promoción de la sustentabilidad, en coordinación con la Vicejefatura de Gobierno.

6. Entender en lo relativo al ordenamiento del espacio público, planificando estrategias y diseñando e implementando políticas en relación con el mismo, en coordinación con las áreas competentes.

7. Diseñar e implementar las políticas relativas al mobiliario urbano.

8. Planificar e implementar las políticas y programas para la supervisión, mantenimiento y optimización del alumbrado público.

9. Planificar y administrar los programas y proyectos destinados al mantenimiento, conservación y renovación edilicia patrimonial.

10. Diseñar e implementar las políticas para la conservación e incremento de los espacios verdes, áreas forestadas y parquizadas, parques naturales y zonas de reserva ecológicas y para la preservación de su diversidad biológica en coordinación con las Comunas, la Secretaría de Gobierno y Vínculo Ciudadano y la Vicejefatura de Gobierno.

11. Diseñar e implementar las políticas y programas para la administración y control del uso del subsuelo.

12. Diseñar e instrumentar los sistemas necesarios para la obtención de información georeferenciada y datos de interés sobre el espacio público.

13. Entender en lo relativo al uso del espacio público y regular, coordinar y supervisar su uso por parte de terceros, en coordinación con las áreas competentes.

14. Diseñar e implementar las políticas de regulación y control de ferias y mercados.

15. Regular, controlar y administrar el sistema de la red pluvial, incluidos los lagos y lagunas, y las tareas de saneamiento e higiene urbana, a través de las tareas de limpieza y control de plagas.

16. Regular, controlar y administrar los servicios de higiene urbana y el tratamiento, recuperación, reciclaje y disposición de los residuos.

17. Entender en el diseño de las políticas tendientes a mantener el espacio público por aplicación de la Ley 1777 en coordinación con la Secretaría de Gobierno y Vínculo Ciudadano.

18. Entender en las acciones para el cumplimiento de lo establecido en la Ley 1777, en coordinación con la Secretaría de Gobierno y Vínculo Ciudadano.

19. Formular e implementar nuevas tecnologías para el tratamiento de residuos, en coordinación con la Vicejefatura de Gobierno.

20. Ejecutar la limpieza y recolección diferenciada de residuos en el borde costero del Riachuelo y Río de la Plata, en coordinación con las áreas competentes.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('80000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000007',
 'Decreto-Ley 8031/73 (PBA) — Código de Faltas de la Provincia de Buenos Aires > Título II > Capítulo I > Artículo 49 (pozos, obstrucción de la vía pública y alumbrado público sin autorización)','49',null,
$f$ARTÍCULO 49- (Dec-Ley 9321/79) Será reprimido con multa entre el cincuenta (50) y el cien (100) por ciento del haber mensual del Agente de Seguridad (Agrupamiento Comando) de la Policía de la Provincia de Buenos Aires:

a.- El que abriere pozos, excavaciones, obstruyere con materiales o escombros o cruzare con cuerdas o alambres o cualquier otro objeto, un camino o paraje de tránsito público sin autorización municipal.

b.- El que, sin autorización municipal, apagare el alumbrado público, abriere o cerrare llave de agua corriente o boca de incendio.

c.- El que colocase o suspendiese cosas que, cayendo o pudiendo caer en lugar de tránsito público o privado, pusiesen en peligro la seguridad de las personas.

d.- El que descuide la demolición o reparación de construcciones que amenacen ruina, con peligro para la seguridad de las personas.$f$,
 'conducta_prohibida') on conflict (id) do nothing;

commit;

-- =====================================================================
-- PARTE 3 — Mapeo a categorías (10 filas)
--   Ordenanza Fiscal: 132 -> INFRAESTRUCTURA · 231/233/235 -> COMERCIO_IRREGULAR
--   Ley 1777: art. 10 -> INFRAESTRUCTURA · art. 11 -> INFRAESTRUCTURA y COMERCIO_IRREGULAR
--   Ley 6684 art. 26 -> INFRAESTRUCTURA y COMERCIO_IRREGULAR (AMBIENTE por el inc. 16 queda FUERA:
--     decisión pendiente de Hernán; ver informe)
--   Decreto-Ley 8031/73 art. 49 -> INFRAESTRUCTURA (NO a comercio ni a vulnerabilidad social)
-- =====================================================================
begin;

insert into public.fragment_services (fragment_id, service_id)
select ('80000000-0000-4000-8000-0000000000' || v.n)::uuid, s.id
from (values
  ('01','INFRAESTRUCTURA'),
  ('02','COMERCIO_IRREGULAR'),
  ('03','COMERCIO_IRREGULAR'),
  ('04','COMERCIO_IRREGULAR'),
  ('05','INFRAESTRUCTURA'),
  ('06','INFRAESTRUCTURA'),
  ('06','COMERCIO_IRREGULAR'),
  ('07','INFRAESTRUCTURA'),
  ('07','COMERCIO_IRREGULAR'),
  ('08','INFRAESTRUCTURA')
) as v(n, code)
join public.services s on s.service_code = v.code
on conflict do nothing;

commit;

-- =====================================================================
-- PARTE 4 — Despublicar el ÍNDICE del Código de Faltas 8031/73 (versionado, sin borrar)
--   Es un índice de 657 caracteres, sin categoría: no es una norma. REP-2908 ya había recomendado
--   despublicarlo. Sale de la recuperación (los RPC filtran is_current) pero queda en la base.
--   Si hubo análisis que lo citaron, report_ai_evidence sigue apuntando a la fila.
-- =====================================================================
begin;

update public.knowledge_fragments
   set is_current = false
 where id = '20000000-0000-4000-8000-000000000015'
   and is_current;

commit;

-- =====================================================================
-- PARTE 5 — Verificación
-- =====================================================================

-- W-1 · Conteos esperados
select 'knowledge_sources' as tabla, 29 as esperado, count(*) as actual from public.knowledge_sources
union all
select 'knowledge_fragments (total)', 132, count(*) from public.knowledge_fragments
union all
select 'knowledge_fragments (vigentes)', 127, count(*) from public.knowledge_fragments where is_current
union all
select 'fragment_services', 169, count(*) from public.fragment_services;

-- W-2 · Los 8 fragmentos nuevos con sus categorías
select kf.id, kf.article, left(kf.hierarchy_path, 90) as ruta, kf.foundation_type_code,
       length(kf.content) as largo,
       (select string_agg(s.service_code, ',' order by s.service_code)
          from public.fragment_services fs join public.services s on s.id = fs.service_id
         where fs.fragment_id = kf.id) as categorias
  from public.knowledge_fragments kf
 where kf.id::text like '80000000-0000-4000-8000-%'
 order by kf.id;

-- W-3 · El índice del Código de Faltas quedó despublicado (is_current = false) y el art. 49 vigente
select kf.id, kf.article, kf.is_current, left(kf.hierarchy_path, 100) as ruta
  from public.knowledge_fragments kf
 where kf.source_id = '10000000-0000-4000-8000-000000000007'
 order by kf.article nulls first;

-- W-4 · Ningún fragmento vigente sin categoría (tras el lote debe quedar VACÍO: el índice ya no es vigente)
select kf.id, kf.hierarchy_path
  from public.knowledge_fragments kf
  left join public.fragment_services fs on fs.fragment_id = kf.id
 where kf.is_current and fs.fragment_id is null;

-- W-5 · Fragmentos vigentes sin embedding del modelo activo. Debe quedar VACÍO tras correr el paso de embeddings.
select kf.id, ks.title, kf.article, kf.subsection
  from public.knowledge_fragments kf
  join public.knowledge_sources ks on ks.id = kf.source_id
  left join public.fragment_embeddings fe
         on fe.fragment_id = kf.id
        and fe.model_code = (select code from public.embedding_models where is_active)
 where kf.is_current and fe.fragment_id is null
 order by ks.title, kf.article;

-- W-6 · Higiene del texto: ningún fragmento debe tener retorno de carro (debe dar 0)
select count(*) as fragmentos_con_retorno_de_carro
  from public.knowledge_fragments
 where content like '%' || chr(13) || '%';

-- W-7 · Cobertura por categoría y ámbito (solo vigentes)
select s.service_code,
       coalesce(sub.name, sp.name, c.name) as ambito,
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

-- W-8 · La Ordenanza Fiscal tiene que ser elegible para Avellaneda y NO para CABA.
--        (si la función eligible_knowledge_sources no existe en el entorno, saltear)
-- select * from public.eligible_knowledge_sources('<locality_id de Gerli — Avellaneda>');

-- =====================================================================
-- PARTE 6 — Reversión del lote 3
-- =====================================================================
-- Si NO hubo análisis con estos fragmentos:
-- begin;
--   update public.knowledge_fragments set is_current = true
--    where id = '20000000-0000-4000-8000-000000000015';        -- reponer el índice
--   delete from public.report_ai_evidence  where fragment_id::text like '80000000-0000-4000-8000-%';
--   delete from public.fragment_embeddings where fragment_id::text like '80000000-0000-4000-8000-%';
--   delete from public.fragment_services   where fragment_id::text like '80000000-0000-4000-8000-%';
--   delete from public.knowledge_fragments where id::text like '80000000-0000-4000-8000-%';
--   delete from public.knowledge_sources   where id::text like '70000000-0000-4000-8000-%';
--   -- document_types 'ordenanza' se deja (catálogo abierto, sin efecto)
-- commit;
--
-- Si YA hubo análisis que usaron estos fragmentos: NO borrar (se pierde report_ai_evidence).
--   update public.knowledge_fragments set is_current = false where id::text like '80000000-0000-4000-8000-%';
--   update public.knowledge_fragments set is_current = true  where id = '20000000-0000-4000-8000-000000000015';
