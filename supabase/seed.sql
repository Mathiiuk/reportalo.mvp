-- ==============================================================================
-- Reportalo™ — Dataset Seed Reproducible para el Esquema Oficial de Supabase
-- Tarea Jira: REP-3471 (Implementar script SQL/seed del MVP en Supabase)
-- Sprint: 10 · Versión Seed: 2.0.1
-- Idempotente: seguro para ejecutarse múltiples veces con ON CONFLICT
-- Compatible al 100% con las tablas existentes en tu base de datos Supabase
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PAÍS (Argentina - ISO Alpha-2 'AR')
-- ------------------------------------------------------------------------------
INSERT INTO public.countries (id, name, iso_code)
VALUES ('c0000000-0000-0000-0000-000000000001', 'Argentina', 'AR')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    iso_code = EXCLUDED.iso_code;

-- ------------------------------------------------------------------------------
-- 2. PROVINCIAS / JURISDICCIONES (CABA & Provincia de Buenos Aires)
-- ------------------------------------------------------------------------------
INSERT INTO public.states_provinces (id, country_id, name)
VALUES 
    ('s0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Ciudad Autónoma de Buenos Aires'),
    ('s0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Provincia de Buenos Aires')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    country_id = EXCLUDED.country_id;

-- ------------------------------------------------------------------------------
-- 3. SUBDIVISIONES / COMUNAS Y MUNICIPIOS
-- ------------------------------------------------------------------------------
INSERT INTO public.subdivisions (id, state_province_id, name, type)
VALUES 
    ('d0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'Comuna 1', 'comuna'),
    ('d0000000-0000-0000-0000-000000000005', 's0000000-0000-0000-0000-000000000001', 'Comuna 5', 'comuna'),
    ('d0000000-0000-0000-0000-000000000013', 's0000000-0000-0000-0000-000000000001', 'Comuna 13', 'comuna'),
    ('d0000000-0000-0000-0000-000000000014', 's0000000-0000-0000-0000-000000000001', 'Comuna 14', 'comuna'),
    ('d0000000-0000-0000-0000-000000000020', 's0000000-0000-0000-0000-000000000002', 'Avellaneda', 'municipio')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    state_province_id = EXCLUDED.state_province_id;

-- ------------------------------------------------------------------------------
-- 4. LOCALIDADES Y BARRIOS (CABA & AVELLANEDA)
-- ------------------------------------------------------------------------------
INSERT INTO public.localities (id, subdivision_id, name)
VALUES 
    ('l0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'San Nicolás'),
    ('l0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000005', 'Almagro'),
    ('l0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000013', 'Belgrano'),
    ('l0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000014', 'Palermo'),
    ('l0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000020', 'Avellaneda Centro'),
    ('l0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000020', 'Piñeyro'),
    ('l0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000020', 'Crucecita'),
    ('l0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000020', 'Sarandí')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    subdivision_id = EXCLUDED.subdivision_id;

-- ------------------------------------------------------------------------------
-- 5. ESTADOS DE REPORTES (report_states)
-- ------------------------------------------------------------------------------
INSERT INTO public.report_states (code, description)
VALUES 
    ('borrador', 'Borrador inicial guardado localmente'),
    ('enviado', 'Reporte enviado y recibido por el sistema'),
    ('en_curso', 'En curso de resolución / Cuadrilla asignada'),
    ('resuelto', 'Incidente resuelto satisfactoriamente'),
    ('rechazado', 'Rechazado por no corresponder a la jurisdicción')
ON CONFLICT (code) DO UPDATE SET
    description = EXCLUDED.description;

-- ------------------------------------------------------------------------------
-- 6. SERVICIOS Y CATEGORÍAS (User Journey v2)
-- ------------------------------------------------------------------------------
INSERT INTO public.services (id, service_code, service_name, group_name, description)
VALUES 
    (
        '00000000-0000-0000-0000-000000000101',
        'infraestructura_vial',
        'Infraestructura vial',
        'Vía Pública',
        'Ej.: baches, veredas rotas, calzada hundida o falta de cordón cuneta.'
    ),
    (
        '00000000-0000-0000-0000-000000000102',
        'infraccion_transito',
        'Infracción de tránsito',
        'Tránsito y Transporte',
        'Ej.: estacionamiento indebido, bloqueo de rampa, camiones fuera de horario.'
    ),
    (
        '00000000-0000-0000-0000-000000000103',
        'medio_ambiente',
        'Medio ambiente',
        'Higiene y Espacios Verdes',
        'Ej.: microbasurales, podas clandestinas, efluentes o contaminación acústica.'
    ),
    (
        '00000000-0000-0000-0000-000000000104',
        'comercio_irregular',
        'Comercio irregular',
        'Espacio Público',
        'Ej.: venta ambulante en la vereda, feria sin habilitación, ocupación del espacio público.'
    )
ON CONFLICT (id) DO UPDATE SET
    service_code = EXCLUDED.service_code,
    service_name = EXCLUDED.service_name,
    group_name = EXCLUDED.group_name,
    description = EXCLUDED.description;

-- ------------------------------------------------------------------------------
-- 7. AGENCIAS U ORGANISMOS RECEPTORES (CABA & AVELLANEDA)
-- ------------------------------------------------------------------------------
INSERT INTO public.agencies (id, name, subdivision_id)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'GCBA — Dirección General de Obras Viales', 'd0000000-0000-0000-0000-000000000001'),
    ('a0000000-0000-0000-0000-000000000002', 'GCBA — Higiene Urbana y Residuos', 'd0000000-0000-0000-0000-000000000001'),
    ('a0000000-0000-0000-0000-000000000003', 'GCBA — Tránsito y Seguridad Vial', 'd0000000-0000-0000-0000-000000000001'),
    ('a0000000-0000-0000-0000-000000000004', 'Municipio de Avellaneda — Obras y Servicios Públicos', 'd0000000-0000-0000-0000-000000000020'),
    ('a0000000-0000-0000-0000-000000000005', 'Municipio de Avellaneda — Ambiente y Arbolado', 'd0000000-0000-0000-0000-000000000020'),
    ('a0000000-0000-0000-0000-000000000006', 'Municipio de Avellaneda — Tránsito y Transporte', 'd0000000-0000-0000-0000-000000000020')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    subdivision_id = EXCLUDED.subdivision_id;

-- ------------------------------------------------------------------------------
-- 8. PERFILES DE USUARIO DE PRUEBA (Sin datos personales reales)
-- ------------------------------------------------------------------------------
INSERT INTO public.profiles (id, username, full_name, avatar_url, role, agency_id)
VALUES 
    (
        '00000000-0000-0000-0000-000000000001',
        'ciudadano_demo',
        'Juan Vecino (Demo)',
        'https://api.dicebear.com/7.x/bottts/svg?seed=ciudadano',
        'ciudadano',
        null
    ),
    (
        '00000000-0000-0000-0000-000000000002',
        'operador_caba',
        'Operador GCBA Central',
        'https://api.dicebear.com/7.x/bottts/svg?seed=gcba',
        'organismo',
        'a0000000-0000-0000-0000-000000000001'
    ),
    (
        '00000000-0000-0000-0000-000000000003',
        'operador_avellaneda',
        'Operador Muni Avellaneda',
        'https://api.dicebear.com/7.x/bottts/svg?seed=avellaneda',
        'organismo',
        'a0000000-0000-0000-0000-000000000004'
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
VALUES 
    -- REP-101: Obelisco / San Nicolás (CABA)
    (
        'r0000000-0000-0000-0000-000000000101',
        'f0000000-0000-0000-0000-000000000101',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000101',
        'l0000000-0000-0000-0000-000000000001',
        -34.6037,
        -58.3816,
        'Bache profundo en calzada principal sobre Av. Corrientes 1050.',
        'en_curso'
    ),
    -- REP-102: Almagro (CABA)
    (
        'r0000000-0000-0000-0000-000000000102',
        'f0000000-0000-0000-0000-000000000102',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000101',
        'l0000000-0000-0000-0000-000000000002',
        -34.6158,
        -58.4201,
        'Columna de alumbrado público parpadea constantemente durante la noche en Av. Medrano 420.',
        'enviado'
    ),
    -- REP-103: Belgrano (CABA)
    (
        'r0000000-0000-0000-0000-000000000103',
        'f0000000-0000-0000-0000-000000000103',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000103',
        'l0000000-0000-0000-0000-000000000003',
        -34.5711,
        -58.4452,
        'Contenedor de residuos desbordado en Av. Cabildo 1820.',
        'resuelto'
    ),
    -- REP-104: Avellaneda Centro (Avellaneda)
    (
        'r0000000-0000-0000-0000-000000000104',
        'f0000000-0000-0000-0000-000000000104',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000102',
        'l0000000-0000-0000-0000-000000000005',
        -34.6624,
        -58.3662,
        'Semáforo fuera de servicio en Av. Bartolomé Mitre 650.',
        'en_curso'
    ),
    -- REP-105: Palermo (CABA)
    (
        'r0000000-0000-0000-0000-000000000105',
        'f0000000-0000-0000-0000-000000000105',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000103',
        'l0000000-0000-0000-0000-000000000004',
        -34.5826,
        -58.4115,
        'Árbol con ramas de gran porte caídas sobre vereda en Av. Coronel Díaz 2100.',
        'resuelto'
    ),
    -- REP-106: Piñeyro (Avellaneda)
    (
        'r0000000-0000-0000-0000-000000000106',
        'f0000000-0000-0000-0000-000000000106',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000103',
        'l0000000-0000-0000-0000-000000000006',
        -34.6680,
        -58.3789,
        'Microbasural y escombros acumulados en Hipólito Yrigoyen 350.',
        'enviado'
    ),
    -- REP-107: Crucecita (Avellaneda)
    (
        'r0000000-0000-0000-0000-000000000107',
        'f0000000-0000-0000-0000-000000000107',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000102',
        'l0000000-0000-0000-0000-000000000007',
        -34.6590,
        -58.3580,
        'Bloqueo indebido de rampa de accesibilidad en Av. Belgrano 1100.',
        'en_curso'
    ),
    -- REP-108: Sarandí (Avellaneda)
    (
        'r0000000-0000-0000-0000-000000000108',
        'f0000000-0000-0000-0000-000000000108',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000104',
        'l0000000-0000-0000-0000-000000000008',
        -34.6750,
        -58.3490,
        'Venta comercial no autorizada ocupando la vereda en Av. Mitre 2850.',
        'enviado'
    )
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
    ('e0000000-0000-0000-0000-000000000101', 'r0000000-0000-0000-0000-000000000101', 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80'),
    ('e0000000-0000-0000-0000-000000000102', 'r0000000-0000-0000-0000-000000000102', 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=600&auto=format&fit=crop&q=80'),
    ('e0000000-0000-0000-0000-000000000103', 'r0000000-0000-0000-0000-000000000103', 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600&auto=format&fit=crop&q=80'),
    ('e0000000-0000-0000-0000-000000000104', 'r0000000-0000-0000-0000-000000000104', 'https://images.unsplash.com/photo-1525935944571-4e99237764c9?w=600&auto=format&fit=crop&q=80'),
    ('e0000000-0000-0000-0000-000000000105', 'r0000000-0000-0000-0000-000000000105', 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=600&auto=format&fit=crop&q=80'),
    ('e0000000-0000-0000-0000-000000000106', 'r0000000-0000-0000-0000-000000000106', 'https://images.unsplash.com/photo-1605600659873-d808a13e4d2a?w=600&auto=format&fit=crop&q=80'),
    ('e0000000-0000-0000-0000-000000000107', 'r0000000-0000-0000-0000-000000000107', 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600&auto=format&fit=crop&q=80'),
    ('e0000000-0000-0000-0000-000000000108', 'r0000000-0000-0000-0000-000000000108', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80')
ON CONFLICT (id) DO UPDATE SET
    report_id = EXCLUDED.report_id,
    image_url = EXCLUDED.image_url;
