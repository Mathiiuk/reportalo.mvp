-- REP-3828 · Registro del lote de QA `REP-3828-QA-01` en visual_qa_cases.
--
-- ESCRIBE en la base (una fila por reporte del lote). Se corre UNA vez, con service_role, DESPUÉS de que los
-- casos se cargaron en la app y ANTES de leer los resultados de la verificación visual. El resultado esperado
-- (`expected`) está fijado de antemano en el guion (docs/REP-3828_Guion_casos_controlados_2_y_4_fotos.md):
-- no se completa mirando lo que devolvió el modelo.
--
-- Antes de correrlo: reemplazar cada `<RP-xxxxxxxx>` por los 8 primeros caracteres del id del reporte, tal como
-- los muestra la app (#RP-XXXXXXXX), que anotó quien cargó el caso en la planilla del guion.
-- La consulta de control (PASO 1) tiene que devolver UNA fila por caso y el número de fotos esperado.

-- PASO 1 · Control (solo lectura): ¿cada código identifica un único reporte con la cantidad de fotos del caso?
with plan(case_id, rp, fotos_esperadas) as (
  values
    ('S1-01', '<RP-xxxxxxxx>', 1), ('S1-02', '<RP-xxxxxxxx>', 1), ('S1-03', '<RP-xxxxxxxx>', 1),
    ('S1-04', '<RP-xxxxxxxx>', 1), ('S1-05', '<RP-xxxxxxxx>', 1),
    ('S2-01', '<RP-xxxxxxxx>', 2), ('S2-02', '<RP-xxxxxxxx>', 2), ('S2-03', '<RP-xxxxxxxx>', 2),
    ('S2-04', '<RP-xxxxxxxx>', 2), ('S2-05', '<RP-xxxxxxxx>', 2),
    ('S4-01', '<RP-xxxxxxxx>', 4), ('S4-02', '<RP-xxxxxxxx>', 4), ('S4-03', '<RP-xxxxxxxx>', 4),
    ('S4-04', '<RP-xxxxxxxx>', 4), ('S4-05', '<RP-xxxxxxxx>', 4)
)
select p.case_id, p.rp, p.fotos_esperadas,
       count(r.id)                                                                   as reportes_encontrados,
       max((select count(*) from public.report_images i where i.report_id = r.id))   as fotos_reales,
       max(to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'))        as creado_utc
from plan p
left join public.citizen_reports r on upper(left(r.id::text, 8)) = upper(p.rp)
group by p.case_id, p.rp, p.fotos_esperadas
order by p.case_id;

-- PASO 2 · Alta del lote (ESCRIBE). Correr solo si el PASO 1 dio una fila por caso, con
-- reportes_encontrados = 1 y fotos_reales = fotos_esperadas.
-- Todos los casos esperan `coincide`: las fotos son las del caso D8 de Hernán (basura acumulada) con la
-- categoría Ambiente, y las 4 dieron `coincide` en esa prueba.
--
-- begin;
-- insert into public.visual_qa_cases (qa_batch_id, case_id, report_id, expected, environment, notes)
-- select 'REP-3828-QA-01', p.case_id, r.id, 'coincide', 'staging',
--        'REP-3828 · ' || substring(p.case_id from 2 for 1) || ' foto(s) · cola y tiempos'
-- from (values
--     ('S1-01', '<RP-xxxxxxxx>'), ('S1-02', '<RP-xxxxxxxx>'), ('S1-03', '<RP-xxxxxxxx>'),
--     ('S1-04', '<RP-xxxxxxxx>'), ('S1-05', '<RP-xxxxxxxx>'),
--     ('S2-01', '<RP-xxxxxxxx>'), ('S2-02', '<RP-xxxxxxxx>'), ('S2-03', '<RP-xxxxxxxx>'),
--     ('S2-04', '<RP-xxxxxxxx>'), ('S2-05', '<RP-xxxxxxxx>'),
--     ('S4-01', '<RP-xxxxxxxx>'), ('S4-02', '<RP-xxxxxxxx>'), ('S4-03', '<RP-xxxxxxxx>'),
--     ('S4-04', '<RP-xxxxxxxx>'), ('S4-05', '<RP-xxxxxxxx>')
-- ) as p(case_id, rp)
-- join public.citizen_reports r on upper(left(r.id::text, 8)) = upper(p.rp)
-- on conflict (qa_batch_id, case_id) do nothing;
-- commit;
