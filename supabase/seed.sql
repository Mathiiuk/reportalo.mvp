-- ==============================================================================
-- Reportalo™ — Dataset Seed Reproducible para el Esquema Oficial de Supabase
-- Tarea Jira: REP-3471 (Implementar script SQL/seed del MVP en Supabase)
-- Sprint: 10 · Versión Seed: 2.0.2
-- Idempotente: seguro para ejecutarse múltiples veces con ON CONFLICT
-- Compatible al 100% con UUIDs hexadecimales válidos (0-9, a-f)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PAÍS (Argentina - ISO Alpha-2 'AR')
-- ------------------------------------------------------------------------------
INSERT INTO public.countries (id, name, iso_code)
VALUES ('00000001-0000-0000-0000-000000000001', 'Argentina', 'AR')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    iso_code = EXCLUDED.iso_code;

-- ------------------------------------------------------------------------------
-- 2. PROVINCIAS / JURISDICCIONES (CABA & Provincia de Buenos Aires)
-- ------------------------------------------------------------------------------
INSERT INTO public.states_provinces (id, country_id, name)
VALUES 
    ('00000002-0000-0000-0000-000000000001', '00000001-0000-0000-0000-000000000001', 'Ciudad Autónoma de Buenos Aires'),
    ('00000002-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000001', 'Provincia de Buenos Aires')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    country_id = EXCLUDED.country_id;

-- ------------------------------------------------------------------------------
-- 3. SUBDIVISIONES / COMUNAS Y MUNICIPIOS
-- ------------------------------------------------------------------------------
INSERT INTO public.subdivisions (id, state_province_id, name, type)
VALUES 
    ('00000003-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000001', 'Comuna 1', 'comuna'),
    ('00000003-0000-0000-0000-000000000005', '00000002-0000-0000-0000-000000000001', 'Comuna 5', 'comuna'),
    ('00000003-0000-0000-0000-000000000013', '00000002-0000-0000-0000-000000000001', 'Comuna 13', 'comuna'),
    ('00000003-0000-0000-0000-000000000014', '00000002-0000-0000-0000-000000000001', 'Comuna 14', 'comuna'),
    ('00000003-0000-0000-0000-000000000020', '00000002-0000-0000-0000-000000000002', 'Avellaneda', 'municipio')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    state_province_id = EXCLUDED.state_province_id;

-- ------------------------------------------------------------------------------
-- 4. LOCALIDADES Y BARRIOS (CABA & AVELLANEDA)
-- ------------------------------------------------------------------------------
INSERT INTO public.localities (id, subdivision_id, name)
VALUES 
    ('00000004-0000-0000-0000-000000000001', '00000003-0000-0000-0000-000000000001', 'San Nicolás'),
    ('00000004-0000-0000-0000-000000000002', '00000003-0000-0000-0000-000000000005', 'Almagro'),
    ('00000004-0000-0000-0000-000000000003', '00000003-0000-0000-0000-000000000013', 'Belgrano'),
    ('00000004-0000-0000-0000-000000000004', '00000003-0000-0000-0000-000000000014', 'Palermo'),
    ('00000004-0000-0000-0000-000000000005', '00000003-0000-0000-0000-000000000020', 'Avellaneda Centro'),
    ('00000004-0000-0000-0000-000000000006', '00000003-0000-0000-0000-000000000020', 'Piñeyro'),
    ('00000004-0000-0000-0000-000000000007', '00000003-0000-0000-0000-000000000020', 'Crucecita'),
    ('00000004-0000-0000-0000-000000000008', '00000003-0000-0000-0000-000000000020', 'Sarandí')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    subdivision_id = EXCLUDED.subdivision_id;

-- ------------------------------------------------------------------------------
-- 5. ESTADOS DE REPORTES (report_states)
--
-- Estos son los cinco codigos REALES de produccion (proyecto CiudadAR),
-- verificados contra la base el 21/09/2026. Coinciden con docs/REP-3769_seed_y_RAG.sql,
-- que es el script que se corrio sobre el proyecto.
--
-- Antes este bloque declaraba otro juego en minuscula ('borrador', 'enviado',
-- 'en_curso', 'resuelto', 'rechazado') que nunca existio en la base. Como
-- citizen_reports.current_state_code y report_state_history.state_code tienen FK
-- contra esta tabla, ese seed no podia haber funcionado nunca contra el esquema
-- real; ademas hizo creer dos veces que el frontend estaba equivocado cuando el
-- equivocado era este archivo.
--
-- NO existe un estado 'borrador': el borrador del reporte vive en IndexedDB, en
-- el dispositivo, y recien llega a la base cuando se envia (REP-2703).
-- ------------------------------------------------------------------------------
INSERT INTO public.report_states (code, description)
VALUES
    ('RECIBIDO', 'Recibido'),
    ('EN_ANALISIS', 'En análisis'),
    ('DERIVADO', 'Derivado al organismo'),
    ('RESUELTO', 'Resuelto'),
    ('DESESTIMADO', 'Desestimado')
ON CONFLICT (code) DO UPDATE SET
    description = EXCLUDED.description;

-- ------------------------------------------------------------------------------
-- 6. SERVICIOS Y CATEGORÍAS
--
-- Las cinco categorías REALES de public.services en producción (proyecto
-- CiudadAR), verificadas contra la base el 22/09/2026. Coinciden con
-- docs/REP-3769_seed_y_RAG.sql, que es el script que se corrió sobre el proyecto.
--
-- Antes este bloque declaraba otras cuatro: 'infraestructura_vial',
-- 'infraccion_transito', 'medio_ambiente' y 'comercio_irregular'. No coincidían
-- ni en código, ni en nombre, ni en cantidad. Es el mismo desfasaje que tenía
-- report_states, y el que origina las observaciones H-03 y H-04 del handoff del
-- UJ v3.3:
--
--   H-03 · La base dice «Infraestructura», no «Infraestructura vial». El UJ v3.3
--          tiene razón; los desactualizados eran este archivo y el respaldo del
--          frontend (DEFAULT_REPORT_CATEGORIES en categoriesService.js).
--   H-04 · Producción tiene CINCO categorías: «Comercio irregular» y
--          «Vulnerabilidad social» conviven, el UJ no reemplaza una por otra.
--          Que «Vulnerabilidad social» se le muestre o no al ciudadano en M10 es
--          una decisión de producto, no de este archivo: acá se refleja la base.
--
-- El conflicto se resuelve por `service_code`, que es UNIQUE en la tabla, y no
-- por `id`. Así el seed es idempotente en cualquier entorno: en producción los
-- ids son UUID aleatorios generados por REP-3769, no los deterministas de acá.
-- ------------------------------------------------------------------------------
INSERT INTO public.services (id, service_code, service_name, group_name, description)
VALUES
    (
        '00000005-0000-0000-0000-000000000101',
        'INFRAESTRUCTURA',
        'Infraestructura',
        'Vía pública',
        'Ej.: baches, veredas rotas, calzada hundida o falta de cordón cuneta.'
    ),
    (
        '00000005-0000-0000-0000-000000000102',
        'TRANSITO',
        'Tránsito',
        'Vía pública',
        'Ej.: estacionamiento indebido, bloqueo de rampa, camiones fuera de horario.'
    ),
    (
        '00000005-0000-0000-0000-000000000103',
        'AMBIENTE',
        'Ambiente',
        'Vía pública',
        'Ej.: microbasurales, podas clandestinas, efluentes o contaminación acústica.'
    ),
    (
        '00000005-0000-0000-0000-000000000104',
        'COMERCIO_IRREGULAR',
        'Comercio irregular',
        'Vía pública',
        'Ej.: venta ambulante en la vereda, feria sin habilitación, ocupación del espacio público.'
    ),
    (
        '00000005-0000-0000-0000-000000000105',
        'VULNERABILIDAD_SOCIAL',
        'Vulnerabilidad social',
        'Asistencia social',
        'Ej.: situación de calle o personas que requieren asistencia del área social.'
    )
ON CONFLICT (service_code) DO UPDATE SET
    service_name = EXCLUDED.service_name,
    group_name = EXCLUDED.group_name,
    description = EXCLUDED.description;

-- ------------------------------------------------------------------------------
-- 7. AGENCIAS U ORGANISMOS RECEPTORES (CABA & AVELLANEDA)
-- ------------------------------------------------------------------------------
INSERT INTO public.agencies (id, name, subdivision_id)
VALUES 
    ('00000006-0000-0000-0000-000000000001', 'GCBA — Dirección General de Obras Viales', '00000003-0000-0000-0000-000000000001'),
    ('00000006-0000-0000-0000-000000000002', 'GCBA — Higiene Urbana y Residuos', '00000003-0000-0000-0000-000000000001'),
    ('00000006-0000-0000-0000-000000000003', 'GCBA — Tránsito y Seguridad Vial', '00000003-0000-0000-0000-000000000001'),
    ('00000006-0000-0000-0000-000000000004', 'Municipio de Avellaneda — Obras y Servicios Públicos', '00000003-0000-0000-0000-000000000020'),
    ('00000006-0000-0000-0000-000000000005', 'Municipio de Avellaneda — Ambiente y Arbolado', '00000003-0000-0000-0000-000000000020'),
    ('00000006-0000-0000-0000-000000000006', 'Municipio de Avellaneda — Tránsito y Transporte', '00000003-0000-0000-0000-000000000020')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    subdivision_id = EXCLUDED.subdivision_id;

-- ------------------------------------------------------------------------------
-- 8. PERFILES DE USUARIO DE PRUEBA (Sin datos personales reales)
-- ------------------------------------------------------------------------------
INSERT INTO public.profiles (id, username, full_name, avatar_url, role, agency_id)
VALUES 
    (
        '00000007-0000-0000-0000-000000000001',
        'ciudadano_demo',
        'Juan Vecino (Demo)',
        'https://api.dicebear.com/7.x/bottts/svg?seed=ciudadano',
        'ciudadano',
        null
    ),
    (
        '00000007-0000-0000-0000-000000000002',
        'operador_caba',
        'Operador GCBA Central',
        'https://api.dicebear.com/7.x/bottts/svg?seed=gcba',
        'organismo',
        '00000006-0000-0000-0000-000000000001'
    ),
    (
        '00000007-0000-0000-0000-000000000003',
        'operador_avellaneda',
        'Operador Muni Avellaneda',
        'https://api.dicebear.com/7.x/bottts/svg?seed=avellaneda',
        'organismo',
        '00000006-0000-0000-0000-000000000004'
    )
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    role = EXCLUDED.role,
    agency_id = EXCLUDED.agency_id;

-- ------------------------------------------------------------------------------
-- 9. REPORTES CIUDADANOS GEORREFERENCIADOS (CABA & AVELLANEDA)
-- ------------------------------------------------------------------------------
-- La categoría se resuelve por `service_code`, no por UUID: en producción los ids
-- de services son aleatorios (los generó REP-3769) y no los deterministas que
-- declara este archivo. Con el join, el seed funciona en cualquier entorno.
INSERT INTO public.citizen_reports (
    id,
    client_side_id,
    user_id,
    service_id,
    locality_id,
    latitud,
    longitud,
    description,
    current_state_code
)
SELECT
    v.id::uuid,
    v.client_side_id::uuid,
    v.user_id::uuid,
    s.id,
    v.locality_id::uuid,
    v.latitud::double precision,
    v.longitud::double precision,
    v.description,
    v.current_state_code
FROM (
    VALUES
        -- REP-101: Obelisco / San Nicolás (CABA)
        (
            '00000008-0000-0000-0000-000000000101',
            '00000009-0000-0000-0000-000000000101',
            '00000007-0000-0000-0000-000000000001',
            'INFRAESTRUCTURA',
            '00000004-0000-0000-0000-000000000001',
            -34.6037,
            -58.3816,
            'Bache profundo en calzada principal sobre Av. Corrientes 1050.',
            'EN_ANALISIS'
        ),
        -- REP-102: Almagro (CABA)
        (
            '00000008-0000-0000-0000-000000000102',
            '00000009-0000-0000-0000-000000000102',
            '00000007-0000-0000-0000-000000000001',
            'INFRAESTRUCTURA',
            '00000004-0000-0000-0000-000000000002',
            -34.6158,
            -58.4201,
            'Columna de alumbrado público parpadea constantemente durante la noche en Av. Medrano 420.',
            'RECIBIDO'
        ),
        -- REP-103: Belgrano (CABA)
        (
            '00000008-0000-0000-0000-000000000103',
            '00000009-0000-0000-0000-000000000103',
            '00000007-0000-0000-0000-000000000001',
            'AMBIENTE',
            '00000004-0000-0000-0000-000000000003',
            -34.5711,
            -58.4452,
            'Contenedor de residuos desbordado en Av. Cabildo 1820.',
            'RESUELTO'
        ),
        -- REP-104: Avellaneda Centro (Avellaneda)
        (
            '00000008-0000-0000-0000-000000000104',
            '00000009-0000-0000-0000-000000000104',
            '00000007-0000-0000-0000-000000000001',
            'TRANSITO',
            '00000004-0000-0000-0000-000000000005',
            -34.6624,
            -58.3662,
            'Semáforo fuera de servicio en Av. Bartolomé Mitre 650.',
            'EN_ANALISIS'
        ),
        -- REP-105: Palermo (CABA)
        (
            '00000008-0000-0000-0000-000000000105',
            '00000009-0000-0000-0000-000000000105',
            '00000007-0000-0000-0000-000000000001',
            'AMBIENTE',
            '00000004-0000-0000-0000-000000000004',
            -34.5826,
            -58.4115,
            'Árbol con ramas de gran porte caídas sobre vereda en Av. Coronel Díaz 2100.',
            'RESUELTO'
        ),
        -- REP-106: Piñeyro (Avellaneda)
        (
            '00000008-0000-0000-0000-000000000106',
            '00000009-0000-0000-0000-000000000106',
            '00000007-0000-0000-0000-000000000001',
            'AMBIENTE',
            '00000004-0000-0000-0000-000000000006',
            -34.6680,
            -58.3789,
            'Microbasural y escombros acumulados en Hipólito Yrigoyen 350.',
            'RECIBIDO'
        ),
        -- REP-107: Crucecita (Avellaneda)
        (
            '00000008-0000-0000-0000-000000000107',
            '00000009-0000-0000-0000-000000000107',
            '00000007-0000-0000-0000-000000000001',
            'TRANSITO',
            '00000004-0000-0000-0000-000000000007',
            -34.6590,
            -58.3580,
            'Bloqueo indebido de rampa de accesibilidad en Av. Belgrano 1100.',
            'EN_ANALISIS'
        ),
        -- REP-108: Sarandí (Avellaneda)
        (
            '00000008-0000-0000-0000-000000000108',
            '00000009-0000-0000-0000-000000000108',
            '00000007-0000-0000-0000-000000000001',
            'COMERCIO_IRREGULAR',
            '00000004-0000-0000-0000-000000000008',
            -34.6750,
            -58.3490,
            'Venta comercial no autorizada ocupando la vereda en Av. Mitre 2850.',
            'RECIBIDO'
        )
) AS v (
    id,
    client_side_id,
    user_id,
    service_code,
    locality_id,
    latitud,
    longitud,
    description,
    current_state_code
)
JOIN public.services s ON s.service_code = v.service_code
ON CONFLICT (id) DO UPDATE SET
    client_side_id = EXCLUDED.client_side_id,
    user_id = EXCLUDED.user_id,
    service_id = EXCLUDED.service_id,
    locality_id = EXCLUDED.locality_id,
    latitud = EXCLUDED.latitud,
    longitud = EXCLUDED.longitud,
    description = EXCLUDED.description,
    current_state_code = EXCLUDED.current_state_code,
    updated_at = now();

-- ------------------------------------------------------------------------------
-- 10. FOTOGRAFÍAS DE EVIDENCIA ASOCIADAS A REPORTES (report_images)
-- ------------------------------------------------------------------------------
INSERT INTO public.report_images (id, report_id, image_url)
VALUES 
    ('0000000a-0000-0000-0000-000000000101', '00000008-0000-0000-0000-000000000101', 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80'),
    ('0000000a-0000-0000-0000-000000000102', '00000008-0000-0000-0000-000000000102', 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=600&auto=format&fit=crop&q=80'),
    ('0000000a-0000-0000-0000-000000000103', '00000008-0000-0000-0000-000000000103', 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600&auto=format&fit=crop&q=80'),
    ('0000000a-0000-0000-0000-000000000104', '00000008-0000-0000-0000-000000000104', 'https://images.unsplash.com/photo-1525935944571-4e99237764c9?w=600&auto=format&fit=crop&q=80'),
    ('0000000a-0000-0000-0000-000000000105', '00000008-0000-0000-0000-000000000105', 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=600&auto=format&fit=crop&q=80'),
    ('0000000a-0000-0000-0000-000000000106', '00000008-0000-0000-0000-000000000106', 'https://images.unsplash.com/photo-1605600659873-d808a13e4d2a?w=600&auto=format&fit=crop&q=80'),
    ('0000000a-0000-0000-0000-000000000107', '00000008-0000-0000-0000-000000000107', 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600&auto=format&fit=crop&q=80'),
    ('0000000a-0000-0000-0000-000000000108', '00000008-0000-0000-0000-000000000108', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80')
ON CONFLICT (id) DO UPDATE SET
    report_id = EXCLUDED.report_id,
    image_url = EXCLUDED.image_url;
