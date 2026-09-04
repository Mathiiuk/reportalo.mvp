-- ==============================================================================
-- Reportalo™ — Dataset Seed Reproducible para Supabase
-- Tarea Jira: REP-3471 (Implementar script SQL/seed del MVP en Supabase)
-- Sprint: 10 · Versión Seed: 1.0.0
-- Idempotente: seguro para ejecutarse múltiples veces con ON CONFLICT
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PERFILES FICTICIOS DE PRUEBA (Sin datos personales reales)
-- ------------------------------------------------------------------------------
INSERT INTO public.profiles (id, email, full_name, avatar_url, role, phone)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'ciudadano.demo@reportalo.ar', 'Juan Vecino (Demo)', 'https://api.dicebear.com/7.x/bottts/svg?seed=ciudadano', 'ciudadano', '+54 11 5555-0101'),
    ('00000000-0000-0000-0000-000000000002', 'operador.caba@reportalo.ar', 'Operador GCBA Central', 'https://api.dicebear.com/7.x/bottts/svg?seed=gcba', 'organismo', '+54 11 5555-0102'),
    ('00000000-0000-0000-0000-000000000003', 'operador.avellaneda@reportalo.ar', 'Operador Muni Avellaneda', 'https://api.dicebear.com/7.x/bottts/svg?seed=avellaneda', 'organismo', '+54 11 5555-0103')
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    updated_at = timezone('utc'::text, now());

-- ------------------------------------------------------------------------------
-- 2. CATEGORÍAS OFICIALES DE REPORTES (User Journey v2)
-- ------------------------------------------------------------------------------
INSERT INTO public.report_categories (id, name, icon, color, bg_light, border_color, example, sort_order, is_active)
VALUES
    (
        'infraestructura_vial',
        'Infraestructura vial',
        'construction',
        '#1E6FCB',
        '#EEF5FC',
        '#CFE4FA',
        'Ej.: baches, veredas rotas, calzada hundida o falta de cordón cuneta.',
        1,
        true
    ),
    (
        'infraccion_transito',
        'Infracción de tránsito',
        'local_shipping',
        '#F78E35',
        '#FFF6E9',
        '#FCE2B6',
        'Ej.: estacionamiento indebido, bloqueo de rampa, camiones fuera de horario.',
        2,
        true
    ),
    (
        'medio_ambiente',
        'Medio ambiente',
        'eco',
        '#2E9E6B',
        '#E3F5EC',
        '#C3EBD7',
        'Ej.: microbasurales, podas clandestinas, efluentes o contaminación acústica.',
        3,
        true
    ),
    (
        'comercio_irregular',
        'Comercio irregular',
        'storefront',
        '#7C5CD6',
        '#F4F0FD',
        '#DED4F5',
        'Ej.: venta ambulante en la vereda, feria sin habilitación, ocupación del espacio público.',
        4,
        true
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    bg_light = EXCLUDED.bg_light,
    border_color = EXCLUDED.border_color,
    example = EXCLUDED.example,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

-- ------------------------------------------------------------------------------
-- 3. ORGANISMOS RECEPTORES (CABA & AVELLANEDA)
-- ------------------------------------------------------------------------------
INSERT INTO public.organismos (id, name, jurisdiction, area, contact_email, phone, status)
VALUES
    (
        'gcba_vialidad',
        'GCBA — Dirección General de Obras Viales',
        'CABA',
        'Vialidad y Calzadas',
        'reclamos.vialidad@buenosaires.gob.ar',
        '147',
        'active'
    ),
    (
        'gcba_higiene',
        'GCBA — Ministerio de Espacio Público e Higiene Urbana',
        'CABA',
        'Residuos y Limpieza Urbana',
        'higiene.urbana@buenosaires.gob.ar',
        '147',
        'active'
    ),
    (
        'gcba_transito',
        'GCBA — Secretaría de Transporte y Seguridad Vial',
        'CABA',
        'Fiscalización y Tránsito',
        'transito@buenosaires.gob.ar',
        '147',
        'active'
    ),
    (
        'muni_avellaneda_obras',
        'Municipio de Avellaneda — Secretaría de Obras y Servicios Públicos',
        'Avellaneda',
        'Infraestructura y Vías Públicas',
        'obraspublicas@mda.gob.ar',
        '0800-122-6864',
        'active'
    ),
    (
        'muni_avellaneda_ambiente',
        'Municipio de Avellaneda — Dirección de Ambiente y Espacios Verdes',
        'Avellaneda',
        'Ambiente y Arbolado',
        'ambiente@mda.gob.ar',
        '0800-122-6864',
        'active'
    ),
    (
        'muni_avellaneda_transito',
        'Municipio de Avellaneda — Dirección General de Tránsito y Transporte',
        'Avellaneda',
        'Control y Seguridad Vial',
        'transito@mda.gob.ar',
        '0800-122-6864',
        'active'
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    jurisdiction = EXCLUDED.jurisdiction,
    area = EXCLUDED.area,
    contact_email = EXCLUDED.contact_email,
    phone = EXCLUDED.phone,
    status = EXCLUDED.status;

-- ------------------------------------------------------------------------------
-- 4. CONSENTIMIENTO DE TÉRMINOS PARA USUARIO DEMO (REP-3532)
-- ------------------------------------------------------------------------------
INSERT INTO public.terms_consents (id, user_id, terms_version, accepted_at, permissions, metadata)
VALUES
    (
        'a0000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001',
        '1.3',
        '2026-08-25T14:30:00Z',
        '{"camera": true, "location": true}'::jsonb,
        '{"client": "web", "user_agent": "Mozilla/5.0 (Demo Seed User)"}'::jsonb
    )
ON CONFLICT (id) DO UPDATE SET
    terms_version = EXCLUDED.terms_version,
    accepted_at = EXCLUDED.accepted_at,
    permissions = EXCLUDED.permissions,
    metadata = EXCLUDED.metadata;

-- ------------------------------------------------------------------------------
-- 5. DATASET DE REPORTES GEORREFERENCIADOS (CABA & AVELLANEDA)
-- ------------------------------------------------------------------------------
INSERT INTO public.reports (
    id,
    title,
    description,
    category_id,
    category_name,
    category_icon,
    status,
    status_color,
    pin_color,
    latitude,
    longitude,
    address,
    jurisdiction,
    organismo_id,
    user_id,
    evidence_count,
    report_date
)
VALUES
    -- REP-101: Obelisco / San Nicolás (CABA)
    (
        'REP-101',
        'Bache profundo en calzada principal',
        'Bache de gran tamaño que dificulta el tránsito vehicular y puede dañar neumáticos.',
        'infraestructura_vial',
        'Infraestructura vial',
        'construction',
        'En curso',
        'bg-[#FFF6E9] text-[#E08A00] border-[#FCE2B6]',
        '#E08A00',
        -34.6037,
        -58.3816,
        'Av. Corrientes 1050, San Nicolás',
        'CABA',
        'gcba_vialidad',
        '00000000-0000-0000-0000-000000000001',
        1,
        '2026-08-24'
    ),
    -- REP-102: Almagro (CABA)
    (
        'REP-102',
        'Luminaria pública parpadeando',
        'Columna de alumbrado parpadea constantemente durante la noche dejando la vereda a oscuras.',
        'infraestructura_vial',
        'Infraestructura vial',
        'construction',
        'Enviado',
        'bg-[#EEF5FC] text-[#1E6FCB] border-[#CFE4FA]',
        '#1E6FCB',
        -34.6158,
        -58.4201,
        'Av. Medrano 420, Almagro',
        'CABA',
        'gcba_vialidad',
        '00000000-0000-0000-0000-000000000001',
        1,
        '2026-08-26'
    ),
    -- REP-103: Belgrano (CABA)
    (
        'REP-103',
        'Contenedor de residuos desbordado',
        'El contenedor de basura se encontraba saturado y fue vaciado por el servicio municipal.',
        'medio_ambiente',
        'Medio ambiente',
        'eco',
        'Resuelto',
        'bg-[#E3F5EC] text-[#2E9E6B] border-[#C3EBD7]',
        '#2E9E6B',
        -34.5711,
        -58.4452,
        'Av. Cabildo 1820, Belgrano',
        'CABA',
        'gcba_higiene',
        '00000000-0000-0000-0000-000000000001',
        2,
        '2026-08-15'
    ),
    -- REP-104: Avellaneda Centro (Avellaneda)
    (
        'REP-104',
        'Semáforo fuera de servicio',
        'Semáforo en intermitente en intersección de alto caudal vehicular.',
        'infraccion_transito',
        'Infracción de tránsito',
        'local_shipping',
        'En curso',
        'bg-[#FFF6E9] text-[#E08A00] border-[#FCE2B6]',
        '#E08A00',
        -34.6624,
        -58.3662,
        'Av. Bartolomé Mitre 650, Avellaneda Centro',
        'Avellaneda',
        'muni_avellaneda_transito',
        '00000000-0000-0000-0000-000000000001',
        1,
        '2026-08-27'
    ),
    -- REP-105: Palermo (CABA)
    (
        'REP-105',
        'Árbol con ramas caídas sobre vereda',
        'Ramas de gran porte caídas tras tormenta, despejadas por cuadrilla de arbolado.',
        'medio_ambiente',
        'Medio ambiente',
        'eco',
        'Resuelto',
        'bg-[#E3F5EC] text-[#2E9E6B] border-[#C3EBD7]',
        '#2E9E6B',
        -34.5826,
        -58.4115,
        'Av. Coronel Díaz 2100, Palermo',
        'CABA',
        'gcba_higiene',
        '00000000-0000-0000-0000-000000000001',
        1,
        '2026-08-18'
    ),
    -- REP-106: Piñeyro (Avellaneda)
    (
        'REP-106',
        'Microbasural acumulado en esquina',
        'Acumulación indebida de escombros y restos de poda que obstruyen el paso peatonal.',
        'medio_ambiente',
        'Medio ambiente',
        'eco',
        'Enviado',
        'bg-[#EEF5FC] text-[#1E6FCB] border-[#CFE4FA]',
        '#1E6FCB',
        -34.6680,
        -58.3789,
        'Hipólito Yrigoyen 350, Piñeyro',
        'Avellaneda',
        'muni_avellaneda_ambiente',
        '00000000-0000-0000-0000-000000000001',
        1,
        '2026-08-28'
    ),
    -- REP-107: Crucecita (Avellaneda)
    (
        'REP-107',
        'Bloqueo indebido de rampa para personas con movilidad reducida',
        'Vehículo utilitario estacionado sobre la rampa de acceso a la vereda.',
        'infraccion_transito',
        'Infracción de tránsito',
        'local_shipping',
        'En curso',
        'bg-[#FFF6E9] text-[#E08A00] border-[#FCE2B6]',
        '#E08A00',
        -34.6590,
        -58.3580,
        'Av. Belgrano 1100, Crucecita',
        'Avellaneda',
        'muni_avellaneda_transito',
        '00000000-0000-0000-0000-000000000001',
        1,
        '2026-08-29'
    ),
    -- REP-108: Sarandí (Avellaneda)
    (
        'REP-108',
        'Venta no autorizada ocupando vereda peatonal',
        'Instalación de puestos comerciales sin habilitación municipal que impiden la circulación.',
        'comercio_irregular',
        'Comercio irregular',
        'storefront',
        'Enviado',
        'bg-[#EEF5FC] text-[#1E6FCB] border-[#CFE4FA]',
        '#1E6FCB',
        -34.6750,
        -58.3490,
        'Av. Mitre 2850, Sarandí',
        'Avellaneda',
        'muni_avellaneda_obras',
        '00000000-0000-0000-0000-000000000001',
        1,
        '2026-08-30'
    )
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    category_id = EXCLUDED.category_id,
    category_name = EXCLUDED.category_name,
    category_icon = EXCLUDED.category_icon,
    status = EXCLUDED.status,
    status_color = EXCLUDED.status_color,
    pin_color = EXCLUDED.pin_color,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    address = EXCLUDED.address,
    jurisdiction = EXCLUDED.jurisdiction,
    organismo_id = EXCLUDED.organismo_id,
    user_id = EXCLUDED.user_id,
    evidence_count = EXCLUDED.evidence_count,
    report_date = EXCLUDED.report_date,
    updated_at = timezone('utc'::text, now());

-- ------------------------------------------------------------------------------
-- 6. EVIDENCIAS FOTOGRÁFICAS SANITIZADAS DE PRUEBA (REP-2201)
-- ------------------------------------------------------------------------------
INSERT INTO public.report_evidences (
    id,
    report_id,
    image_url,
    sanitized,
    blur_faces,
    blur_license_plates,
    exif_stripped,
    quarantine_status
)
VALUES
    ('e0000000-0000-0000-0000-000000000101', 'REP-101', 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80', true, true, true, true, 'approved'),
    ('e0000000-0000-0000-0000-000000000102', 'REP-102', 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=600&auto=format&fit=crop&q=80', true, true, true, true, 'approved'),
    ('e0000000-0000-0000-0000-000000000103', 'REP-103', 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600&auto=format&fit=crop&q=80', true, true, true, true, 'approved'),
    ('e0000000-0000-0000-0000-000000000104', 'REP-104', 'https://images.unsplash.com/photo-1525935944571-4e99237764c9?w=600&auto=format&fit=crop&q=80', true, true, true, true, 'approved'),
    ('e0000000-0000-0000-0000-000000000105', 'REP-105', 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=600&auto=format&fit=crop&q=80', true, true, true, true, 'approved'),
    ('e0000000-0000-0000-0000-000000000106', 'REP-106', 'https://images.unsplash.com/photo-1605600659873-d808a13e4d2a?w=600&auto=format&fit=crop&q=80', true, true, true, true, 'approved'),
    ('e0000000-0000-0000-0000-000000000107', 'REP-107', 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600&auto=format&fit=crop&q=80', true, true, true, true, 'approved'),
    ('e0000000-0000-0000-0000-000000000108', 'REP-108', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80', true, true, true, true, 'approved')
ON CONFLICT (id) DO UPDATE SET
    report_id = EXCLUDED.report_id,
    image_url = EXCLUDED.image_url,
    sanitized = EXCLUDED.sanitized,
    blur_faces = EXCLUDED.blur_faces,
    blur_license_plates = EXCLUDED.blur_license_plates,
    exif_stripped = EXCLUDED.exif_stripped,
    quarantine_status = EXCLUDED.quarantine_status;
