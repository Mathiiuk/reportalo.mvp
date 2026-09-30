-- =====================================================================
-- REP-3797 · LOTE 2 (complementario) del corpus normativo — Sprint 14
-- Reportalo (RAR-2026) · 29/09/2026
--
-- Se corre DESPUÉS del lote 1 (REP-3797_lote_corpus_S14.sql), ya aplicado.
-- Las guardas de la PARTE 0 lo exigen: si falta el lote 1, aborta sin escribir.
--
-- CONDICIÓN DE CIERRE: W-5 (fragmentos sin embedding) y W-6 (fragmentos con
-- retorno de carro) tienen que quedar las dos en CERO. W-1 imprime los conteos
-- esperados contra los reales.
--
-- Y una advertencia que no se puede saltear: la PARTE 8 quater cambia el texto
-- de los fragmentos que tenían \r\n. Esos embeddings hay que REGENERARLOS, no
-- alcanza con generar los faltantes — el vector viejo quedó calculado sobre un
-- texto que ya no está en la base.
--
-- Por qué existe:
--   * cierra los pendientes P-13 (Ley 5901) y P-14 (venta en el espacio público)
--   * agrega el respaldo legal del reporte ciudadano en las dos jurisdicciones
--     (Decreto-Ley 8751/77 art. 35 en PBA · Ley 1217 Anexo art. 2 en CABA)
--   * agrega las normas que faltaban para los casos que la verificación del
--     29/09/2026 mostró mal fundamentados (auto abandonado, aperturas y roturas)
--   * corrige el chunking de los DOS fragmentos preexistentes de la Ley 2148,
--     que son incisos sueltos sin el encabezado del artículo
--
-- Estado esperado:
--   antes:    knowledge_sources=20, knowledge_fragments=84, fragment_services=89
--   después:  knowledge_sources=26, knowledge_fragments=124, fragment_services=159
--   (de los 124 fragmentos, 4 quedan con is_current=false por versionado: los 2 de
--    Ley 2148 y el del art. 49 b.3 que corrige este lote, más el del inciso t) del Sprint 13)
--
-- Reglas: mismas que el lote 1. IDs deterministas (50000000-… fuentes,
-- 60000000-… fragmentos), idempotente, sin DDL destructivo, sin DELETE.
--
-- NO genera embeddings. Los 40 fragmentos nuevos no se recuperan por similitud
-- hasta correr el paso de embeddings. La consulta V-5 del lote 1 los lista.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PARTE 0 — Guardas: aborta antes de escribir si falta el lote 1
-- ---------------------------------------------------------------------
do $guard2$
declare
  faltan text := '';
begin
  if not exists (select 1 from public.document_types where code = 'guia') then
    faltan := faltan || 'document_types: falta el código guia (no se corrió el lote 1). ';
  end if;

  if (select count(*) from public.knowledge_sources
       where id::text like '30000000-0000-4000-8000-%') < 12 then
    faltan := faltan || 'knowledge_sources: no están las 12 fuentes del lote 1. ';
  end if;

  if not exists (select 1 from public.knowledge_fragments
                  where id = '20000000-0000-4000-8000-000000000011') then
    faltan := faltan || 'knowledge_fragments: falta el fragmento preexistente de Ley 2148 7.1.8. ';
  end if;

  if not exists (select 1 from public.knowledge_fragments
                  where id = '20000000-0000-4000-8000-000000000012') then
    faltan := faltan || 'knowledge_fragments: falta el fragmento preexistente de Ley 2148 7.1.9. ';
  end if;

  if faltan <> '' then
    raise exception 'REP-3797 lote 2: precondiciones no cumplidas -> %', faltan;
  end if;
end
$guard2$;

-- ---------------------------------------------------------------------
-- PARTE 1 — Fuentes nuevas (6)
-- ---------------------------------------------------------------------
begin;

insert into public.knowledge_sources
  (id, source_type_code, document_type_code, document_number, title, issuing_authority,
   country_id, state_province_id, subdivision_id, requires_adhesion,
   source_url, is_current, verified_at, last_amended_by)
select v.id::uuid, v.src_type, v.doc_type, v.num, v.title, v.authority,
       null::uuid,
       case when v.scope in ('CABA','BA') then sp.id end,
       null::uuid,
       false, v.url, true, v.verified::timestamptz, v.amended
from (values
  ('50000000-0000-4000-8000-000000000021','corpus_legal','decreto_ley','8751/77',
   'Código de Faltas Municipales (Provincia de Buenos Aires)',
   'Provincia de Buenos Aires','BA',
   'https://normas.gba.gob.ar/documentos/DxaMGF4x.html','2026-09-29',
   'T.O. Decreto N 8526/86; Leyes N 10.269 y N 11.723; Decreto N 40/07'),

  ('50000000-0000-4000-8000-000000000022','corpus_legal','ley','1217',
   'Procedimiento de Faltas de la Ciudad Autónoma de Buenos Aires',
   'Legislatura de la Ciudad Autónoma de Buenos Aires','CABA',
   'https://boletinoficial.buenosaires.gob.ar/normativaba/norma/50981','2026-09-29',null),

  ('50000000-0000-4000-8000-000000000023','corpus_legal','ley','5901',
   'Ley de Aperturas y/o Roturas en la Vía Pública',
   'Legislatura de la Ciudad Autónoma de Buenos Aires','CABA',
   'https://boletinoficialpdf.buenosaires.gob.ar/util/imagen.php?idn=391459&idf=1','2026-09-29',
   'Reglamentada por Decreto N 81/18; abroga la Ley N 2634'),

  ('50000000-0000-4000-8000-000000000024','corpus_legal','ley','1166',
   'Permisos de uso en el Espacio Público (Sección 11 del Código de Habilitaciones y Verificaciones)',
   'Legislatura de la Ciudad Autónoma de Buenos Aires','CABA',
   'https://boletinoficialpdf.buenosaires.gob.ar/util/imagen.php?idn=51720&idf=1','2026-09-29',
   'Veto parcial del parágrafo 11.1.9 por Decreto N 2.350/GCBA/03'),

  ('50000000-0000-4000-8000-000000000025','corpus_legal','ley','11.723',
   'Ley Integral del Medio Ambiente y los Recursos Naturales (Provincia de Buenos Aires)',
   'Legislatura de la Provincia de Buenos Aires','BA',
   'https://normas.gba.gob.ar/documentos/V9ONqUPx.html','2026-09-29',
   'Leyes N 13.516 y N 15.078; autoridad de aplicación: OPDS por art. 43 de la Ley N 15.164'),

  ('50000000-0000-4000-8000-000000000026','informacion','guia',null,
   'Teléfonos útiles oficiales de la Ciudad Autónoma de Buenos Aires',
   'Gobierno de la Ciudad Autónoma de Buenos Aires','CABA',
   'https://buenosaires.gob.ar/inicio/telefonos','2026-09-29',null)
) as v(id, src_type, doc_type, num, title, authority, scope, url, verified, amended)
cross join public.countries c
left join public.states_provinces sp
       on sp.country_id = c.id
      and sp.name = case v.scope when 'CABA' then 'Ciudad Autónoma de Buenos Aires'
                                 when 'BA'   then 'Buenos Aires' end
where c.iso_code = 'AR'
on conflict (id) do nothing;

commit;

-- =====================================================================
-- PARTE 2 — Fragmentos: respaldo legal del reporte ciudadano
-- =====================================================================
begin;

-- ---------- Decreto-Ley 8751/77 (PBA) — Código de Faltas Municipales ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000021',
 'Decreto-Ley 8751/77 (PBA) — Código de Faltas Municipales > Título I > Artículo 1 (ámbito)','1',null,
$f$Este código se aplicará al juzgamiento de las faltas a las normas municipales dictadas en el ejercicio del poder de policía y a las normas nacionales y provinciales cuya aplicación corresponda a las Municipalidades, salvo para las dos últimas cuando para ello se hubiera previsto un procedimiento propio.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000021',
 'Decreto-Ley 8751/77 (PBA) — Código de Faltas Municipales > Título II > Artículo 4 bis (faltas de especial gravedad, incorporado por Ley 11.723)','4','bis',
$f$Se considerarán faltas de especial gravedad aquellas que atentaren contra las condiciones ambientales y de salubridad pública, en especial las infracciones a las ordenanzas que regulan:
Inciso a): Condiciones de higiene y salubridad que deben reunir los sitios públicos, los lugares de acceso público y los terrenos baldíos.
Inciso b): Prevención y eliminación de la contaminación ambiental de los cursos y cuerpos de agua y el aseguramiento de la conservación de los recursos naturales.
Inciso c): Elaboración, transporte, expendio y consumo de productos alimentarios y las normas higiénico-sanitarias, bromatológicas y de identificación comercial.
Inciso d): Instalación y funcionamiento de abastos, mataderos, mercados y demás lugares de acopio y concentración de productos animales.
Inciso e): Radicación, habilitación y funcionamiento de establecimientos comerciales e industriales de la primera y segunda categoría de acuerdo a la Ley 11.459.$f$,
 'conducta_prohibida') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000021',
 'Decreto-Ley 8751/77 (PBA) — Código de Faltas Municipales > Título III > Artículo 18 (órgano de juzgamiento)','18',null,
$f$El juzgamiento de las faltas municipales estará a cargo de la Justicia de Faltas, cuya organización, competencia, régimen de las sanciones y procedimiento se regirán por la presente Ley.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000021',
 'Decreto-Ley 8751/77 (PBA) — Código de Faltas Municipales > Título IV > Capítulo II > Artículo 35 (acción pública y denuncia)','35',null,
$f$Toda falta da lugar a una acción pública, que puede ser promovida de oficio o por simple denuncia verbal o escrita ante la autoridad municipal o directamente ante el Juez de Faltas.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000005','50000000-0000-4000-8000-000000000021',
 'Decreto-Ley 8751/77 (PBA) — Código de Faltas Municipales > Título IV > Capítulo II > Artículo 38 (contenido del acta)','38',null,
$f$El funcionario que compruebe una infracción, labrará de inmediato un acta que contendrá los siguientes elementos:
a.- El lugar, la fecha y la hora de la comisión del hecho u omisión punible.
b.- La naturaleza y circunstancia de los mismos y las características de los elementos empleados para cometerlos.
c.- El nombre y domicilio del imputado, si hubiera sido posible determinarlo.
d.- El nombre y domicilio de los testigos que tuvieren conocimiento del hecho.
e.- Disposición legal presuntamente infringida.
f.- La firma del funcionario interviniente con aclaración del nombre y cargo.$f$,
 'competencia') on conflict (id) do nothing;

-- ---------- Ley 1217 (CABA) — Procedimiento de Faltas (artículos del ANEXO) ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000006','50000000-0000-4000-8000-000000000022',
 'Ley 1217 (CABA) — Anexo Procedimiento de Faltas > Título I > Capítulo I > Artículo 1 (competencia)','anexo-1',null,
$f$COMPETENCIA. Lo dispuesto en el presente título se aplica a todo procedimiento por el cual los organismos administrativos que controlan faltas en ejercicio del poder de policía verifiquen la comisión de una infracción contemplada en el Régimen de Faltas de la Ciudad Autónoma de Buenos Aires.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000007','50000000-0000-4000-8000-000000000022',
 'Ley 1217 (CABA) — Anexo Procedimiento de Faltas > Título I > Capítulo I > Artículo 2 (acción pública)','anexo-2',null,
$f$ACCIÓN PÚBLICA. Toda falta da lugar a una acción pública que puede ser promovida de oficio o por simple denuncia verbal o escrita ante la autoridad competente.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000008','50000000-0000-4000-8000-000000000022',
 'Ley 1217 (CABA) — Anexo Procedimiento de Faltas > Título I > Capítulo II > Artículo 3 (requisitos del acta)','anexo-3',null,
$f$REQUISITOS DEL ACTA DE INFRACCIÓN. El/la funcionario/a que compruebe la comisión de una falta debe labrar un acta que contenga:
a) Lugar, fecha y hora de la comisión de la acción u omisión que da lugar al labrado del acta.
b) Descripción de la acción u omisión del presunto infractor/a que determina el labrado del acta.
c) La norma que a juicio del/la funcionario/a se estime infringida, sin que esta mención implique la calificación definitiva de la acción u omisión que da lugar al labrado del acta.
d) Nombre, apellido y domicilio del presunto infractor/ra, si hubiese sido posible determinarlo.
e) La identificación del vehículo utilizado en caso de infracciones de tránsito.
f) Identificación de la/s persona/s que hubieran presenciado la acción u omisión que da lugar al labrado del acta o que pudieran aportar datos de interés para la comprobación de la falta.
g) Identificación, cargo y firma del funcionario/a que verificó la infracción.
h) Cuando se imponga una medida precautoria debe hacerse constar la medida impuesta, el bien sobre el cual recae y los motivos de su imposición.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000009','50000000-0000-4000-8000-000000000022',
 'Ley 1217 (CABA) — Anexo Procedimiento de Faltas > Título II > Capítulo I > Artículo 34 (particular damnificado)','anexo-34',null,
$f$PARTICULAR DAMNIFICADO. El/la particular damnificado/a por alguna falta, no es parte en el juicio ni tiene derecho a ejercer en este fuero, acciones civiles derivadas del hecho. Sin perjuicio de ello, tiene derecho a ser informado acerca del curso del proceso.$f$,
 'competencia') on conflict (id) do nothing;

commit;

-- =====================================================================
-- PARTE 3 — Fragmentos: infraestructura CABA (Ley 5901) y ambiente PBA (Ley 11.723)
-- =====================================================================
begin;

-- ---------- Ley 5901 (CABA) — Aperturas y/o roturas (artículos del ANEXO A) ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000010','50000000-0000-4000-8000-000000000023',
 'Ley 5901 (CABA) — Anexo A Aperturas y/o Roturas > Título I > Artículo 1 (obligación de cerrar)','anexo-1',null,
$f$Toda persona humana o jurídica, pública o privada, que en razón de su actividad deba realizar una o varias aperturas y/o roturas en la vía pública tiene la obligación de cerrarla/s y tiene a su cargo el costo del cierre, sin perjuicio de quien efectivamente lo ejecute, quedando comprendida en el régimen establecido por la presente.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000011','50000000-0000-4000-8000-000000000023',
 'Ley 5901 (CABA) — Anexo A Aperturas y/o Roturas > Título I > Artículo 2 (definición de vía pública)','anexo-2',null,
$f$A los efectos de esta Ley se entiende por vía pública a toda vereda, callejón, pasaje, calle, avenida, senda, plaza, parque o espacio de cualquier naturaleza afectado al dominio público o a las áreas así declaradas por el Gobierno de la Ciudad Autónoma de Buenos Aires.$f$,
 null) on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000012','50000000-0000-4000-8000-000000000023',
 'Ley 5901 (CABA) — Anexo A Aperturas y/o Roturas > Título I > Artículo 3 (autoridad de aplicación)','anexo-3',null,
$f$La Autoridad de Aplicación de la presente es el Ministerio de Ambiente y Espacio Público del Gobierno de la Ciudad Autónoma de Buenos Aires o el que en un futuro lo reemplace.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000013','50000000-0000-4000-8000-000000000023',
 'Ley 5901 (CABA) — Anexo A Aperturas y/o Roturas > Título II > Artículo 7 (permiso previo)','anexo-7',null,
$f$Las obras de aperturas y/o roturas en la vía pública requieren la obtención de un permiso especial conforme los requisitos establecidos en la presente y su reglamentación. Asimismo, la ejecución de los trabajos aludidos deben realizarse a través de un sujeto inscripto en el RPAAVP.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000014','50000000-0000-4000-8000-000000000023',
 'Ley 5901 (CABA) — Anexo A Aperturas y/o Roturas > Título V > Artículo 17 (ejecución a costa del responsable)','anexo-17',null,
$f$La Autoridad de Aplicación preverá los supuestos en los cuales ejecutará por sí las obras de cierre de las aperturas y o roturas en la vía pública a costa del solicitante del permiso. Asimismo se establecerá vía reglamentaria un sistema de recupero de costos que incluya el valor de las tareas comprendiendo materiales, mano de obra y un arancel por gastos fijos y administrativos. La Autoridad de Aplicación procederá al recupero conforme lo establezca el Código Fiscal vigente al momento de efectuarse la obra, constituyéndose en solidariamente responsables el solicitante del permiso y el eventual contratista, de acuerdo al caso.$f$,
 'competencia') on conflict (id) do nothing;

-- ---------- Ley 11.723 (PBA) — ambiente ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000015','50000000-0000-4000-8000-000000000025',
 'Ley 11.723 (PBA) — Medio Ambiente > Título II > Capítulo I > Artículo 2 (derechos de los habitantes) > inciso d)','2','d',
$f$El Estado Provincial garantiza a todos sus habitantes los siguientes derechos:
Inciso d): A solicitar a las autoridades la adopción de medidas tendientes al logro del objeto de la presente ley, y a denunciar el incumplimiento de la misma.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000016','50000000-0000-4000-8000-000000000025',
 'Ley 11.723 (PBA) — Medio Ambiente > Título II > Capítulo II > Artículo 6 (obligación de fiscalizar)','6',null,
$f$El Estado Provincial y los municipios tienen la obligación de fiscalizar las acciones antrópicas que puedan producir un menoscabo al ambiente, siendo responsables de las acciones y de las omisiones en que incurran.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000017','50000000-0000-4000-8000-000000000025',
 'Ley 11.723 (PBA) — Medio Ambiente > Título II > Capítulo IV > Artículo 34 (reclamo ante la dependencia)','34',null,
$f$Cuando a consecuencia de acciones del Estado se produzcan daños o pudiera derivarse una situación de peligro al ambiente y/o recursos naturales ubicados en territorio provincial, cualquier habitante de la Provincia podrá acudir ante la dependencia que hubiere actuado u omitido actuar, a fin de solicitar se deje sin efecto el acto y/o activar los mecanismos fiscalizadores pertinentes.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000018','50000000-0000-4000-8000-000000000025',
 'Ley 11.723 (PBA) — Medio Ambiente > Título III > Capítulo VII > Artículo 65 (los residuos son responsabilidad municipal)','65',null,
$f$La gestión de todo residuo que no esté incluido en las categorías de residuo especial, patogénico y radioactivo, será de incumbencia y responsabilidad municipal. Respecto de los Municipios alcanzados por el Decreto-Ley 9.111/78, el Poder Ejecutivo Provincial promoverá la paulatina implementación del principio establecido en este artículo, así como también de lo normado en los artículos 66° y 67° de la presente.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000019','50000000-0000-4000-8000-000000000025',
 'Ley 11.723 (PBA) — Medio Ambiente > Título III > Capítulo VIII > Artículo 69 (inspección y vigilancia)','69',null,
$f$La Provincia y los Municipios según el ámbito que corresponda, deben realizar actos de inspección y vigilancia para verificar el cumplimiento de las disposiciones de esta ley y del reglamento que en su consecuencia se dicte.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000020','50000000-0000-4000-8000-000000000025',
 'Ley 11.723 (PBA) — Medio Ambiente > Título IV > Artículo 75 (poder de policía municipal)','75',null,
$f$Todo municipio podrá verificar el cumplimiento de las normas ambientales inspeccionando y realizando constataciones a efectos de reclamar la intervención de la autoridad competente. Asimismo en caso de emergencia podrá tomar decisiones de tipo cautelar o precautorio dando inmediato aviso a la autoridad que corresponda.$f$,
 'competencia') on conflict (id) do nothing;

commit;

-- =====================================================================
-- PARTE 4 — Fragmentos: comercio irregular CABA (Ley 1166)
-- =====================================================================
begin;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000021','50000000-0000-4000-8000-000000000024',
 'Ley 1166 (CABA) — Anexo I > Sección 11 Permisos de uso en el Espacio Público > Capítulo 11.1 > 11.1.2 (prohibición)','11.1.2',null,
$f$Prohíbese la venta, comercialización o ejercicio de actividad comercial y la elaboración o expendio de productos alimenticios, en el Espacio Público de la Ciudad Autónoma de Buenos Aires, a toda persona que no tenga otorgado a su favor un permiso de uso, en los términos detallados en la presente Sección.$f$,
 'conducta_prohibida') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000022','50000000-0000-4000-8000-000000000024',
 'Ley 1166 (CABA) — Anexo I > Sección 11 > Capítulo 11.1 > 11.1.3 y 11.1.4 (otorgamiento y carácter del permiso)','11.1.4',null,
$f$11.1.3 Los permisos de uso son otorgados por el Poder Ejecutivo, delegando esta atribución en la Autoridad de Aplicación.
11.1.4 En todos los casos los permisos de uso se otorgan con carácter precario, personal e intransferible y por un plazo máximo de un (1) año, pudiendo ser renovados por un único período igual al originalmente otorgado. Vencido este, quien hubiera sido permisionario/a tendrá prioridad para el otorgamiento de un nuevo permiso de uso.
La Autoridad de Aplicación puede disponer la revocación de los permisos otorgados o la reubicación de los/as permisionarios/as por razones de oportunidad, mérito o conveniencia, sin que ello genere derecho a indemnización alguna a favor de éstos/as.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000023','50000000-0000-4000-8000-000000000024',
 'Ley 1166 (CABA) — Anexo I > Sección 11 > Capítulo 11.1 > 11.1.10 (credencial exhibida)','11.1.10',null,
$f$A los/as permisionarios/as se les entrega sin costo alguno una credencial, que contiene la nómina de personal si correspondiere. Las altas y bajas de este personal se tramitan ante la Autoridad de Aplicación del modo que la reglamentación determine. El original de dicha credencial debe ser exhibido en lugar visible y mantenerse en condiciones aptas de legibilidad.$f$,
 'obligacion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000024','50000000-0000-4000-8000-000000000024',
 'Ley 1166 (CABA) — Anexo I > Sección 11 > Capítulo 11.1 > 11.1.17 (ubicaciones prohibidas)','11.1.17',null,
$f$Los/as vendedores/as ambulantes no pueden ubicarse en la zona de seguridad de las esquinas, frente a los accesos a ferrocarriles y subterráneos, hospitales, sanatorios, institutos de enseñanza, bancos, salas de espectáculos, a 10 metros de las paradas de transporte público, ni a menos de 50 metros de locales permisionados por el Gobierno de la Ciudad Autónoma de Buenos Aires y que expendan productos de rubros similares.$f$,
 'conducta_prohibida') on conflict (id) do nothing;

commit;

-- =====================================================================
-- PARTE 5 — Fragmentos sobre fuentes preexistentes: Ley 451 y Ley 24.449
-- =====================================================================
begin;

-- ---------- Ley 451 (CABA) · source_id ...006 ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000025','10000000-0000-4000-8000-000000000006',
 'Ley 451 (CABA) — Régimen de Faltas > Artículo 1.3.31 (vehículo abandonado en la vía pública)','1.3.31',null,
$f$Vehículo abandonado en la vía pública. El/la titular del dominio o poseedor de un vehículo automotor que lo dejare abandonado en la vía pública es sancionado/a con multa de mil trescientas cincuenta (1.350) a cinco mil quinientas (5.500) unidades fijas.
En el caso de que se hallaren vehículos automotores o sus partes en lugares de dominio público en estado de deterioro y/o inmovilidad y/o abandono que impliquen un peligro para la salud o la seguridad pública o el medio ambiente, se verificará tal situación intimando en el mismo acto de verificación al titular del vehículo por un plazo de diez (10) días hábiles, transcurridos los cuales se procederá a su remolque.$f$,
 'sancion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000026','10000000-0000-4000-8000-000000000006',
 'Ley 451 (CABA) — Régimen de Faltas > Artículo 2.1.13 (aperturas y/o roturas sin permiso)','2.1.13',null,
$f$Aperturas y/o roturas. Toda persona humana o jurídica responsable de la apertura y/o rotura en la vía pública que la efectuare sin permiso es sancionada con multa de diez mil (10.000) a veinte mil (20.000) unidades fijas y/o inhabilitación.
Toda persona humana o jurídica responsable de la apertura y/o rotura en la vía pública que la efectuare con permiso vencido o excediendo los términos del permiso otorgado, es sancionada con multa de cinco mil (5.000) a siete mil quinientas (7.500) unidades fijas y/o inhabilitación.
Toda persona humana o jurídica responsable de la apertura y/o rotura en la vía pública que la efectuare omitiendo la normativa atinente a seguridad de obra en la vía pública, es sancionado/a con multa de tres mil (3.000) a treinta mil (30.000) unidades fijas y/o inhabilitación.$f$,
 'sancion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000027','10000000-0000-4000-8000-000000000006',
 'Ley 451 (CABA) — Régimen de Faltas > Artículo 2.1.15 (cierre defectuoso)','2.1.15',null,
$f$Cierre defectuoso. Toda persona física o jurídica que, en el marco de una apertura y/o rotura en la vía pública, ejecutare defectuosamente las obras de cierre, en inobservancia a las reglas del arte previstas en la normativa vigente, es sancionada con multa de tres mil (3.000) a treinta mil (30.000) unidades fijas y/o inhabilitación.$f$,
 'sancion') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000028','10000000-0000-4000-8000-000000000006',
 'Ley 451 (CABA) — Régimen de Faltas > Artículo 2.1.15.1 (construcción o reparación defectuosa de veredas)','2.1.15.1',null,
$f$Construcción y/o reparación defectuosa. El/la titular del inmueble que ejecutare defectuosamente las obras de construcción, mantenimiento, reparación y reconstrucción de veredas, por sí o a través de terceros, en inobservancia a las reglas del arte previstas en la normativa vigente, es sancionado con multa de doscientas (200) a cinco mil quinientas (5.500) unidades fijas. La presente sanción se hace extensiva a los contratistas.$f$,
 'sancion') on conflict (id) do nothing;

-- ---------- Ley 24.449 · source_id ...004 — el inciso que faltaba para "auto abandonado" ----------

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000029','10000000-0000-4000-8000-000000000004',
 'Ley 24.449 — Ley de Tránsito > Artículo 49 (estacionamiento) > inciso b) > 7','49','b.7',
$f$En zona urbana deben observarse las reglas siguientes:
b) No se debe estacionar ni autorizarse el mismo:
7. Por un período mayor de cinco días o del lapso que fije la autoridad local;$f$,
 'conducta_prohibida') on conflict (id) do nothing;

commit;

-- =====================================================================
-- PARTE 6 — Canales oficiales de CABA desde la página vigente
-- =====================================================================
begin;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000030','50000000-0000-4000-8000-000000000026',
 'Teléfonos útiles de CABA > Atención ciudadana 147',null,'147',
$f$Línea 147 de Atención Ciudadana del Gobierno de la Ciudad Autónoma de Buenos Aires, según su página oficial:
"Atención ciudadana: 147. Lunes a viernes de 7 a 21 hs. y sábados de 8 a 14 hs. Línea gratuita de Atención Ciudadana de la Ciudad. Brinda asesoramiento e información de trámites de la Ciudad."
Atención: el 147 NO atiende las 24 horas y su función declarada es asesoramiento e información de trámites. Para ingresar una denuncia con número de seguimiento, el canal es el formulario de Gestión Colaborativa: https://gestioncolaborativa.buenosaires.gob.ar/prestaciones$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000031','50000000-0000-4000-8000-000000000026',
 'Teléfonos útiles de CABA > Emergencias 103',null,'103',
$f$Línea 103 de Emergencias del Gobierno de la Ciudad Autónoma de Buenos Aires, según su página oficial:
"Emergencias: 103. Atención permanente las 24 hs. Actúa ante inundaciones, accidentes en la vía pública, derrame de sustancias tóxicas, etc."
Es el canal correspondiente cuando el hecho reportado es urgente y está en curso: una inundación por un sumidero obstruido, un accidente en la vía pública o un derrame. No reemplaza al reclamo administrativo, lo precede.$f$,
 'competencia') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000032','50000000-0000-4000-8000-000000000026',
 'Teléfonos útiles de CABA > Línea Social 108 y Niñez 102',null,'108-102',
$f$Líneas sociales del Gobierno de la Ciudad Autónoma de Buenos Aires, según su página oficial:
"Línea Social: 108. Atención permanente las 24 hs. Orientación y asesoramiento sobre programas sociales. Asesoramiento integral Programa Ciudadanía Porteña. Recepción de solicitudes para derivación de casos de personas y/o poblaciones en situación de riesgo, emergencia y/o vulnerabilidad social."
"Niñez y Adolescencia: 102. Atención permanente las 24 hs. Línea gratuita para realizar consultas y denuncias vinculadas a problemáticas de la infancia."
Para avisar por una persona adulta en situación de calle en la Ciudad corresponde el 108. Si la situación involucra a niños, niñas o adolescentes, corresponde el 102. Las dos atienden las 24 horas.$f$,
 'competencia') on conflict (id) do nothing;

commit;

-- =====================================================================
-- PARTE 7 — Corrección de chunking: Ley 2148 arts. 7.1.8 y 7.1.9
-- Los dos fragmentos preexistentes son incisos sueltos SIN el encabezado
-- del artículo. Se versionan: los viejos pasan a is_current = false y los
-- nuevos los referencian por replaces_fragment_id. NO se borra nada.
-- =====================================================================
begin;

-- Primero los reemplazos, después la baja lógica, para que el índice único
-- parcial (source_id, article, subsection) where is_current no choque:
-- los nuevos llevan subsection distinta (a, b, e / c, e, h) y los viejos null.

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code, replaces_fragment_id) values
('60000000-0000-4000-8000-000000000033','10000000-0000-4000-8000-000000000005',
 'Ley 2148 (CABA) — Código de Tránsito y Transporte > Título VII > Artículo 7.1.8 (prohibiciones especiales) > inciso a)','7.1.8','a',
$f$Prohibiciones especiales. Queda prohibido estacionar y detenerse con carácter general en los siguientes sitios, sin perjuicio de lo establecido en los artículos 7.1.2 y 7.1.3:
a) En doble fila, excepto como detención previa a la maniobra de estacionamiento.$f$,
 'conducta_prohibida','20000000-0000-4000-8000-000000000011') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000034','10000000-0000-4000-8000-000000000005',
 'Ley 2148 (CABA) — Código de Tránsito y Transporte > Título VII > Artículo 7.1.8 (prohibiciones especiales) > inciso b)','7.1.8','b',
$f$Prohibiciones especiales. Queda prohibido estacionar y detenerse con carácter general en los siguientes sitios, sin perjuicio de lo establecido en los artículos 7.1.2 y 7.1.3:
b) En las esquinas, entre su vértice ideal y la línea imaginaria que resulte de prolongar la ochava así como también sobre la demarcación horizontal de sendas peatonales o líneas de pare.$f$,
 'conducta_prohibida') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000035','10000000-0000-4000-8000-000000000005',
 'Ley 2148 (CABA) — Código de Tránsito y Transporte > Título VII > Artículo 7.1.8 (prohibiciones especiales) > inciso e)','7.1.8','e',
$f$Prohibiciones especiales. Queda prohibido estacionar y detenerse con carácter general en los siguientes sitios, sin perjuicio de lo establecido en los artículos 7.1.2 y 7.1.3:
e) Sobre ciclovías.$f$,
 'conducta_prohibida') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000036','10000000-0000-4000-8000-000000000005',
 'Ley 2148 (CABA) — Código de Tránsito y Transporte > Título VII > Artículo 7.1.9 (prohibiciones generales) > inciso c)','7.1.9','c',
$f$Prohibiciones generales. Queda prohibido estacionar con carácter general en los siguientes sitios, sin perjuicio de lo establecido en los artículos 7.1.2 y 7.1.3:
c) En los sectores de parada para detención de transporte colectivo de pasajeros y taxis.$f$,
 'conducta_prohibida') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000037','10000000-0000-4000-8000-000000000005',
 'Ley 2148 (CABA) — Código de Tránsito y Transporte > Título VII > Artículo 7.1.9 (prohibiciones generales) > inciso e)','7.1.9','e',
$f$Prohibiciones generales. Queda prohibido estacionar con carácter general en los siguientes sitios, sin perjuicio de lo establecido en los artículos 7.1.2 y 7.1.3:
e) En los sectores de ingreso y egreso de vehículos a la vía pública. Esta prohibición alcanzará inclusive el estacionamiento en el tramo de la acera opuesta, frente a los mismos, cuando el ancho de la calzada resulte insuficiente para las maniobras de ingreso y egreso de vehículos. En caso de estar permitido el estacionamiento junto a la acera donde está ubicada la entrada de vehículos y también el ancho de la calzada resulte insuficiente para maniobrar, la prohibición general se amplía un metro a cada lado del ancho de la entrada.$f$,
 'conducta_prohibida') on conflict (id) do nothing;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code, replaces_fragment_id) values
('60000000-0000-4000-8000-000000000038','10000000-0000-4000-8000-000000000005',
 'Ley 2148 (CABA) — Código de Tránsito y Transporte > Título VII > Artículo 7.1.9 (prohibiciones generales) > inciso h)','7.1.9','h',
$f$Prohibiciones generales. Queda prohibido estacionar con carácter general en los siguientes sitios, sin perjuicio de lo establecido en los artículos 7.1.2 y 7.1.3:
h) Frente a los vados o rampas para personas con discapacidad.$f$,
 'conducta_prohibida','20000000-0000-4000-8000-000000000012') on conflict (id) do nothing;

-- Baja lógica de los dos fragmentos superados. No se borran: quedan como historial,
-- igual que el inciso t) del art. 48 de la Ley 24.449 en el Sprint 13.
update public.knowledge_fragments
   set is_current = false,
       hierarchy_path = hierarchy_path || ' [SUPERADO — inciso sin encabezado, ver reemplazo]'
 where id in ('20000000-0000-4000-8000-000000000011',
              '20000000-0000-4000-8000-000000000012')
   and is_current;

commit;

-- =====================================================================
-- PARTE 8 — Mapeo a categorías
-- =====================================================================
begin;

insert into public.fragment_services (fragment_id, service_id)
select ('60000000-0000-4000-8000-0000000000' || v.n)::uuid, s.id
from (values
  -- Decreto-Ley 8751/77: el régimen de faltas municipales aplica a las cuatro
  -- categorías con conducta; vulnerabilidad social no es una falta.
  ('01','TRANSITO'), ('01','INFRAESTRUCTURA'), ('01','AMBIENTE'), ('01','COMERCIO_IRREGULAR'),
  ('02','AMBIENTE'), ('02','COMERCIO_IRREGULAR'),
  ('03','TRANSITO'), ('03','INFRAESTRUCTURA'), ('03','AMBIENTE'), ('03','COMERCIO_IRREGULAR'),
  ('04','TRANSITO'), ('04','INFRAESTRUCTURA'), ('04','AMBIENTE'), ('04','COMERCIO_IRREGULAR'),
  ('05','TRANSITO'), ('05','INFRAESTRUCTURA'), ('05','AMBIENTE'), ('05','COMERCIO_IRREGULAR'),
  -- Ley 1217 (CABA): ídem
  ('06','TRANSITO'), ('06','INFRAESTRUCTURA'), ('06','AMBIENTE'), ('06','COMERCIO_IRREGULAR'),
  ('07','TRANSITO'), ('07','INFRAESTRUCTURA'), ('07','AMBIENTE'), ('07','COMERCIO_IRREGULAR'),
  ('08','TRANSITO'), ('08','INFRAESTRUCTURA'), ('08','AMBIENTE'), ('08','COMERCIO_IRREGULAR'),
  ('09','TRANSITO'), ('09','INFRAESTRUCTURA'), ('09','AMBIENTE'), ('09','COMERCIO_IRREGULAR'),
  -- Ley 5901 (CABA) — aperturas y roturas
  ('10','INFRAESTRUCTURA'), ('11','INFRAESTRUCTURA'), ('12','INFRAESTRUCTURA'),
  ('13','INFRAESTRUCTURA'), ('14','INFRAESTRUCTURA'),
  -- Ley 11.723 (PBA) — ambiente
  ('15','AMBIENTE'), ('16','AMBIENTE'), ('17','AMBIENTE'),
  ('18','AMBIENTE'), ('19','AMBIENTE'), ('20','AMBIENTE'),
  -- Ley 1166 (CABA) — permisos en el espacio público
  ('21','COMERCIO_IRREGULAR'), ('22','COMERCIO_IRREGULAR'),
  ('23','COMERCIO_IRREGULAR'), ('24','COMERCIO_IRREGULAR'),
  -- Ley 451 (CABA)
  ('25','TRANSITO'), ('25','AMBIENTE'),   -- vehículo abandonado: peligro para salud/ambiente
  ('26','INFRAESTRUCTURA'), ('27','INFRAESTRUCTURA'), ('28','INFRAESTRUCTURA'),
  -- Ley 24.449 art. 49 inc. b.7
  ('29','TRANSITO'),
  -- Canales oficiales de CABA
  ('30','TRANSITO'), ('30','INFRAESTRUCTURA'), ('30','AMBIENTE'), ('30','COMERCIO_IRREGULAR'),
  ('31','INFRAESTRUCTURA'), ('31','AMBIENTE'),
  ('32','VULNERABILIDAD_SOCIAL'),
  -- Ley 2148 (CABA) — reemplazos con encabezado
  ('33','TRANSITO'), ('34','TRANSITO'), ('35','TRANSITO'),
  ('36','TRANSITO'), ('37','TRANSITO'), ('38','TRANSITO')
) as v(n, code)
join public.services s on s.service_code = v.code
on conflict do nothing;

commit;

-- =====================================================================
-- PARTE 8 bis — CORRECCIÓN de una decisión del lote 1
--
-- El lote 1 mapeó a COMERCIO_IRREGULAR el fragmento b6717f77 de la Ley 24.449
-- art. 48 inc. t) ("instalarse o realizar venta de productos en zona alguna del
-- camino"), que estaba cargado sin categoría. La verificación del 29/09/2026
-- mostró que el sistema lo recuperaba para un puesto de venta en una VEREDA de
-- Avellaneda, donde no encaja.
--
-- Motivo verificado: el art. 5 de la Ley 24.449 define "i) Camino: una vía rural
-- de circulación". El inciso t) del art. 48 habla de caminos rurales. Aplicarlo a
-- una vereda urbana es forzar la norma, y el mapeo a comercio irregular fue un
-- error de criterio del lote 1, no del modelo.
--
-- Corrección: el fragmento se mapea a TRANSITO (su materia real) y se quita de
-- COMERCIO_IRREGULAR. Además se carga la definición del art. 5 inc. i) para que
-- el límite de alcance quede citable y el modelo pueda verlo.
--
-- ES EL ÚNICO DELETE DE LOS DOS LOTES. Borra una sola fila de fragment_services
-- y no toca ningún fragmento ni fuente.
-- =====================================================================
begin;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('60000000-0000-4000-8000-000000000039','10000000-0000-4000-8000-000000000004',
 'Ley 24.449 — Ley de Tránsito > Artículo 5 (definiciones) > incisos h), i) y z)','5','h-i-z',
$f$A los efectos de esta ley se entiende por:
h) Calzada: la zona de la vía destinada sólo a la circulación de vehículos;
i) Camino: una vía rural de circulación;
z) Zona de camino: todo espacio afectado a la vía de circulación y sus instalaciones anexas, comprendido entre las propiedades frentistas;$f$,
 null) on conflict (id) do nothing;

insert into public.fragment_services (fragment_id, service_id)
select '60000000-0000-4000-8000-000000000039', s.id
  from public.services s where s.service_code = 'TRANSITO'
on conflict do nothing;

-- El fragmento del inciso t) pasa a tránsito, que es su materia
insert into public.fragment_services (fragment_id, service_id)
select 'b6717f77-c30e-4cca-985a-6346d741fe38', s.id
  from public.services s
 where s.service_code = 'TRANSITO'
   and exists (select 1 from public.knowledge_fragments
                where id = 'b6717f77-c30e-4cca-985a-6346d741fe38')
on conflict do nothing;

-- y se quita de comercio irregular
delete from public.fragment_services
 where fragment_id = 'b6717f77-c30e-4cca-985a-6346d741fe38'
   and service_id = (select id from public.services where service_code = 'COMERCIO_IRREGULAR');

commit;

-- =====================================================================
-- PARTE 8 ter — Ley 24.449 art. 49 inc. b) apartado 3: el fragmento cargado
-- está CORTADO y la parte que falta cambia el sentido.
--
-- Hallazgo del 29/09/2026, al verificar el texto de InfoLEG contra la base a
-- pedido de la sección C del pedido de Matías. El fragmento 20000000-…0010 trae
-- sólo la primera oración del apartado 3. El texto vigente sigue: el apartado
-- fue sustituido por el art. 5 de la Ley 25.965 (B.O. 21/12/2004) y agrega que
-- SE PUEDE AUTORIZAR a estacionar en la parte externa de la vereda cuando su
-- ancho sea mayor a 2,00 metros.
--
-- O sea: citando sólo la primera oración, el dictamen afirma una prohibición
-- más amplia que la de la norma. Es el mismo problema de chunking de la Ley 2148,
-- pero con consecuencia jurídica, no sólo de legibilidad.
-- =====================================================================
begin;

insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code, replaces_fragment_id) values
('60000000-0000-4000-8000-000000000040','10000000-0000-4000-8000-000000000004',
 'Ley 24.449 — Ley de Tránsito > Artículo 49 (estacionamiento) > inciso b) > apartado 3 (texto según Ley 25.965)','49','b.3',
$f$En zona urbana deben observarse las reglas siguientes:
b) No se debe estacionar ni autorizarse el mismo:
3. Sobre la senda para peatones o bicicletas, aceras, rieles, sobre la calzada, y en los diez metros anteriores y posteriores a la parada del transporte de pasajeros.
Tampoco se admite la detención voluntaria. No obstante se puede autorizar, señal mediante, a estacionar en la parte externa de la vereda cuando su ancho sea mayor a 2,00 metros y la intensidad de tráfico peatonal así lo permita.$f$,
 'conducta_prohibida','20000000-0000-4000-8000-000000000010') on conflict (id) do nothing;

insert into public.fragment_services (fragment_id, service_id)
select '60000000-0000-4000-8000-000000000040', s.id
  from public.services s where s.service_code = 'TRANSITO'
on conflict do nothing;

update public.knowledge_fragments
   set is_current = false,
       hierarchy_path = hierarchy_path || ' [SUPERADO — apartado incompleto, ver reemplazo]'
 where id = '20000000-0000-4000-8000-000000000010'
   and is_current;

commit;

-- =====================================================================
-- PARTE 8 quater — Normalización del retorno de carro (pedido B.2)
--
-- El lote llega sin un solo \r y aun así la base terminó con \r\n: entra por el
-- camino de carga (editor, cliente o loader). Esta transacción lo deja resuelto
-- de forma idempotente, corra el lote desde donde corra.
--
-- IMPORTANTE: los fragmentos cuyo texto cambia acá necesitan que se REGENEREN
-- sus embeddings. No alcanza con generar los faltantes: el vector viejo quedó
-- calculado sobre un texto que ya no es el que está guardado.
-- =====================================================================
begin;

update public.knowledge_fragments
   set content = replace(content, chr(13) || chr(10), chr(10))
 where content like '%' || chr(13) || '%';

commit;

-- =====================================================================
-- PARTE 9 — Verificación
-- =====================================================================

-- W-1 · Conteos esperados
select 'knowledge_sources'   as tabla, 26  as esperado, count(*) as actual from public.knowledge_sources
union all
select 'knowledge_fragments (total)', 124, count(*) from public.knowledge_fragments
union all
select 'knowledge_fragments (vigentes)', 120, count(*) from public.knowledge_fragments where is_current
union all
select 'fragment_services',  159, count(*) from public.fragment_services;

-- W-2 · Los tres fragmentos superados por versionado, con su reemplazo
select viejo.id as fragmento_superado,
       viejo.article,
       viejo.is_current,
       nuevo.id as reemplazo,
       nuevo.subsection
  from public.knowledge_fragments viejo
  left join public.knowledge_fragments nuevo on nuevo.replaces_fragment_id = viejo.id
 where viejo.is_current = false
 order by viejo.article;

-- W-3 · Cobertura por categoría y ámbito, sólo fragmentos vigentes
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

-- W-4 · Ningún fragmento vigente sin categoría (salvo el distractor 8031/73)
select kf.id, kf.hierarchy_path
  from public.knowledge_fragments kf
  left join public.fragment_services fs on fs.fragment_id = kf.id
 where kf.is_current and fs.fragment_id is null;

-- W-5 · Fragmentos sin embedding del modelo activo. Debe quedar VACÍO
--        después de correr el paso de embeddings.
select kf.id, ks.title, kf.article, kf.subsection
  from public.knowledge_fragments kf
  join public.knowledge_sources ks on ks.id = kf.source_id
  left join public.fragment_embeddings fe
         on fe.fragment_id = kf.id
        and fe.model_code = (select code from public.embedding_models where is_active)
 where kf.is_current and fe.fragment_id is null
 order by ks.title, kf.article;

-- W-6 · Higiene del texto: ningún fragmento debe tener retorno de carro.
--        Si esto devuelve filas, el texto guardado NO es idéntico a la fuente
--        oficial y la validación por cita literal va a fallar. Ver el informe
--        de respuesta a la verificación del 29/09/2026.
select count(*) as fragmentos_con_retorno_de_carro
  from public.knowledge_fragments
 where content like '%' || chr(13) || '%';

-- W-7 · Las cinco categorías con conteo mayor que cero
select s.service_code, count(fs.fragment_id) as fragmentos
  from public.services s
  left join public.fragment_services fs on fs.service_id = s.id
  left join public.knowledge_fragments kf on kf.id = fs.fragment_id and kf.is_current
 group by 1
 order by 2;

-- =====================================================================
-- PARTE 10 — Reversión del lote 2
-- =====================================================================
-- begin;
--   -- restituir los dos fragmentos de Ley 2148 al estado anterior
--   update public.knowledge_fragments
--      set is_current = true,
--          hierarchy_path = replace(hierarchy_path, ' [SUPERADO — inciso sin encabezado, ver reemplazo]', '')
--    where id in ('20000000-0000-4000-8000-000000000011',
--                 '20000000-0000-4000-8000-000000000012');
--
--   delete from public.report_ai_evidence   where fragment_id::text like '60000000-0000-4000-8000-%';
--   delete from public.fragment_embeddings  where fragment_id::text like '60000000-0000-4000-8000-%';
--   delete from public.fragment_services    where fragment_id::text like '60000000-0000-4000-8000-%';
--   delete from public.knowledge_fragments  where id::text like '60000000-0000-4000-8000-%';
--   delete from public.knowledge_sources    where id::text like '50000000-0000-4000-8000-%';
-- commit;
--
-- Igual que en el lote 1: si ya hubo análisis usando estos fragmentos, conviene
-- marcar is_current = false en lugar de borrar, para no perder report_ai_evidence.

-- =====================================================================
-- PARTE 11 — INTERRUPTOR OPCIONAL: desmapear los fragmentos de procedimiento
--
-- Responde al riesgo de ranking de la sección D del pedido del 29/09/2026.
-- NO se ejecuta con el lote: queda listo para cuando la medición lo justifique.
--
-- Son 8 fragmentos genéricos —el procedimiento de faltas de cada jurisdicción—
-- mapeados hoy a las cuatro categorías con conducta. Si la medición muestra que
-- ocupan lugares de los 6 recuperados y desplazan normas de fondo, correr esto:
-- los saca del filtro por categoría, quedan en el corpus como texto citable y
-- pasan a usarse como texto fijo del dictamen según la jurisdicción.
--
-- Qué NO hay que hacer: borrarlos. Son el respaldo legal del reporte y tienen
-- que poder citarse.
--
-- begin;
--   delete from public.fragment_services
--    where fragment_id in (
--      -- Decreto-Ley 8751/77 (Avellaneda): arts. 1, 18, 35 y 38
--      '60000000-0000-4000-8000-000000000001',
--      '60000000-0000-4000-8000-000000000003',
--      '60000000-0000-4000-8000-000000000004',
--      '60000000-0000-4000-8000-000000000005',
--      -- Ley 1217 Anexo (CABA): arts. 1, 2, 3 y 34
--      '60000000-0000-4000-8000-000000000006',
--      '60000000-0000-4000-8000-000000000007',
--      '60000000-0000-4000-8000-000000000008',
--      '60000000-0000-4000-8000-000000000009'
--    );
-- commit;
--
-- Nota: el art. 4 bis del Decreto-Ley 8751/77 (fragmento …02) NO entra en este
-- interruptor. No es procedimiento: dice qué materias son faltas de especial
-- gravedad, y es fundamento de fondo para ambiente y comercio irregular.
--
-- Después de correrlo, W-4 va a listar esos 8 fragmentos como "vigentes sin
-- categoría", igual que el distractor del Código de Faltas 8031/73. Es esperado.
