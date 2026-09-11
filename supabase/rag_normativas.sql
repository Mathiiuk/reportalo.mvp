-- =====================================================================
-- Spike RAG: Infraestructura y Corpus Normativo con pgvector (REP-2907)
-- Corpus oficial verificado REP-2906 con URLs de fuente consolidada
-- =====================================================================

-- 1. Asegurar extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Asegurar columnas de trazabilidad legal en la tabla normativas (REP-2906)
ALTER TABLE public.normativas 
    ADD COLUMN IF NOT EXISTS norma_codigo TEXT,
    ADD COLUMN IF NOT EXISTS titulo TEXT,
    ADD COLUMN IF NOT EXISTS jurisdiccion TEXT DEFAULT 'Municipal',
    ADD COLUMN IF NOT EXISTS autoridad TEXT DEFAULT 'Juzgado de Faltas',
    ADD COLUMN IF NOT EXISTS articulo TEXT,
    ADD COLUMN IF NOT EXISTS tipo_fundamento TEXT,
    ADD COLUMN IF NOT EXISTS fuente_url TEXT,
    ADD COLUMN IF NOT EXISTS vigencia TEXT DEFAULT 'vigente',
    ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '1.0';

-- Permitir categoría nula para el distractor neutro (Hallazgo 2 Hernán)
ALTER TABLE public.normativas ALTER COLUMN categoria DROP NOT NULL;

-- Permitir vectores de dimensión flexible (ej. 64 en spike, 768 en producción Gemini)
ALTER TABLE public.normativas ALTER COLUMN embedding TYPE vector;

-- 3. Habilitar RLS y políticas de acceso
ALTER TABLE public.normativas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica de normativas" ON public.normativas;
CREATE POLICY "Lectura publica de normativas"
ON public.normativas FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Gestion administrativa de normativas" ON public.normativas;
CREATE POLICY "Gestion administrativa de normativas"
ON public.normativas FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. Función de búsqueda vectorial semántica por similitud de coseno
DROP FUNCTION IF EXISTS public.match_normativas(vector, double precision, integer);
DROP FUNCTION IF EXISTS public.match_normativas(vector, double precision, integer, text, text);

CREATE OR REPLACE FUNCTION public.match_normativas(
  query_embedding vector,
  match_threshold double precision DEFAULT 0.45,
  match_count integer DEFAULT 5,
  filter_categoria text DEFAULT NULL,
  filter_jurisdiccion text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  norma_codigo text,
  titulo text,
  jurisdiccion text,
  autoridad text,
  tipo_documento character varying,
  categoria text,
  articulo text,
  tipo_fundamento text,
  regla text,
  fuente_url text,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    normativas.id,
    COALESCE(normativas.norma_codigo, 'N/A') AS norma_codigo,
    COALESCE(normativas.titulo, normativas.categoria) AS titulo,
    COALESCE(normativas.jurisdiccion, 'Municipal') AS jurisdiccion,
    COALESCE(normativas.autoridad, 'Autoridad Municipal') AS autoridad,
    normativas.tipo_documento,
    normativas.categoria,
    COALESCE(normativas.articulo, 'General') AS articulo,
    normativas.tipo_fundamento,
    normativas.regla,
    COALESCE(normativas.fuente_url, '') AS fuente_url,
    1 - (normativas.embedding <=> query_embedding) AS similarity
  FROM public.normativas
  WHERE (1 - (normativas.embedding <=> query_embedding)) > match_threshold
    AND (filter_categoria IS NULL OR normativas.categoria = filter_categoria)
    AND (filter_jurisdiccion IS NULL OR normativas.jurisdiccion = filter_jurisdiccion)
  ORDER BY normativas.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 5. Seed data del corpus normativo oficial (REP-2906 con URLs verificadas)
INSERT INTO public.normativas (
  id, norma_codigo, titulo, categoria, jurisdiccion, autoridad,
  tipo_documento, articulo, tipo_fundamento, regla, fuente_url, vigencia, version, embedding
)
VALUES
(
    'e1000001-0000-0000-0000-000000000001',
    'CONST-PBA-ART192-INC4',
    'Constitución de la Provincia de Buenos Aires, art. 192 inc. 4',
    'infraestructura',
    'Provincial — Buenos Aires',
    'Municipalidad / Provincia de Buenos Aires',
    'Constitución Provincial',
    'Art. 192 inc. 4',
    'obligacion',
    'Tener a su cargo el ornato y salubridad, los establecimientos de beneficencia que no estén a cargo de sociedades particulares, asilos de inmigrantes que sostenga la Provincia, las cárceles locales de detenidos y la vialidad pública.',
    'https://www.infoleg.gob.ar/?page_id=173',
    'vigente',
    '1.0',
    '[0.274825,0.274825,0.274825,0.274825,0.274825,0.274825,0.274825,0.274825,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.137412,0.137412,0.137412,0.137412,0.137412,0.137412,0.137412,0.137412,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.10993,0.10993,0.054965,0.164895,0.054965,0,0,0,0.10993,0.164895,0.21986,0,0.21986,0.164895,0.10993,0.10993]'::vector
  ),
(
    'e1000001-0000-0000-0000-000000000002',
    'LOM-DECLEY-6769-ART52',
    'Ley Orgánica de las Municipalidades (Dec-Ley 6769/58), art. 52',
    'infraestructura',
    'Provincial — Buenos Aires',
    'Concejo Deliberante / Departamento Ejecutivo Municipal',
    'Decreto-Ley',
    'Art. 52',
    'obligacion',
    'Corresponde al Concejo disponer la prestación de los servicios públicos de barrido, riego, limpieza, alumbrado, provisión de agua, obras sanitarias y desagües pluviales, inspecciones, registro de guías, transporte y todo otro tendiente a satisfacer necesidades colectivas de carácter local, siempre que su ejecución no se encuentre a cargo de la Provincia o de la Nación.',
    'https://normas.gba.gob.ar/documentos/OVG48SW0.html',
    'vigente',
    '1.0',
    '[0.167412,0.167412,0.167412,0.167412,0.167412,0.167412,0.167412,0.167412,0.251119,0.251119,0.251119,0.251119,0.251119,0.251119,0.251119,0.251119,0.083706,0.083706,0.083706,0.083706,0.083706,0.083706,0.083706,0.083706,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.083706,0.083706,0.083706,0.083706,0.083706,0.083706,0.083706,0.083706,0.066965,0.066965,0.100447,0.234377,0.033482,0.167412,0.100447,0.033482,0.033482,0.033482,0.033482,0.066965,0.100447,0.13393,0.066965,0.066965]'::vector
  ),
(
    'e1000001-0000-0000-0000-000000000003',
    'LOM-DECLEY-6769-ART59',
    'Ley Orgánica de las Municipalidades (Dec-Ley 6769/58), art. 59',
    'infraestructura',
    'Provincial — Buenos Aires',
    'Municipalidad de la Provincia de Buenos Aires',
    'Decreto-Ley',
    'Art. 59 inc. d',
    'obligacion',
    'Constituyen obras públicas municipales: a) Las concernientes a los servicios de competencia municipal; ... d) Pavimentación, repavimentación, nivelación, ensanche, conservación de calles, veredas y caminos vecinales.',
    'https://normas.gba.gob.ar/documentos/OVG48SW0.html',
    'vigente',
    '1.0',
    '[0.27683,0.27683,0.27683,0.27683,0.27683,0.27683,0.27683,0.27683,0.184553,0.184553,0.184553,0.184553,0.184553,0.184553,0.184553,0.184553,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.147643,0.036911,0.110732,0.110732,0.221464,0,0.036911,0,0.036911,0.036911,0.036911,0.073821,0,0,0.073821,0.036911]'::vector
  ),
(
    'e1000001-0000-0000-0000-000000000004',
    'LEY-210-CABA-ARTS2-3',
    'Ley 210 — Ente Único Regulador de Servicios Públicos de CABA',
    'infraestructura',
    'Municipal — CABA',
    'Ente Único Regulador de los Servicios Públicos de la CABA',
    'Ley Municipal',
    'Arts. 2 y 3 inc. j',
    'competencia',
    'El Ente ejerce el control, seguimiento y resguardo de la calidad de los servicios públicos prestados por la administración o terceros: alumbrado, barrido y limpieza, mantenimiento de desagües pluviales. Corresponde tramitar y resolver en sede administrativa los reclamos que presenten los usuarios.',
    'https://boletinoficial.buenosaires.gob.ar/normativaba/norma/4623',
    'vigente',
    '1.0',
    '[0.139482,0.139482,0.139482,0.139482,0.139482,0.139482,0.139482,0.139482,0.278964,0.278964,0.278964,0.278964,0.278964,0.278964,0.278964,0.278964,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.139482,0.139482,0.139482,0.139482,0.139482,0.139482,0.139482,0.139482,0.055793,0.027896,0,0.083689,0.083689,0.055793,0.111586,0,0,0.027896,0.139482,0.027896,0.083689,0.055793,0.027896,0.027896]'::vector
  ),
(
    'e1000001-0000-0000-0000-000000000005',
    'LEY-24449-ARTS48-49',
    'Ley Nacional de Tránsito 24.449, arts. 48 y 49',
    'transito',
    'Nacional',
    'Agencia Nacional de Seguridad Vial / Dirección de Tránsito',
    'Ley Nacional',
    'Arts. 48 inc. i, 49 inc. b',
    'conducta_prohibida',
    'Está prohibido en la vía pública: Estacionar en zona urbana sobre la senda para peatones o ciclovías, en las esquinas u ochavas, obstruir la circulación vehicular o peatonal, o estacionar en doble fila afectando el tránsito libre.',
    'http://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/818/norma.htm',
    'vigente',
    '1.0',
    '[0.023463,0.023463,0.023463,0.023463,0.023463,0.023463,0.023463,0.023463,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.351946,0.351946,0.351946,0.351946,0.351946,0.351946,0.351946,0.351946,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.037541,0,0.01877,0.009385,0.01877,0.028156,0,0,0.028156,0.01877,0,0,0,0.009385,0.01877,0.009385]'::vector
  ),
(
    'e1000001-0000-0000-0000-000000000006',
    'LEY-2148-CABA-ARTS718-719',
    'Código de Tránsito y Transporte de la CABA — Ley 2148',
    'transito',
    'Municipal — CABA',
    'Cuerpo de Agentes de Tránsito CABA',
    'Ley Municipal',
    'Arts. 7.1.8 inc. c, 7.1.9',
    'conducta_prohibida',
    'Prohibición general de estacionar frente a las entradas de garajes y rampas para personas con necesidades especiales o movilidad reducida, y en las esquinas entre su vértice y la prolongación de la ochava.',
    'https://juristeca.jusbaires.gob.ar/compilacion-normativa-juristeca/ley-2148/h-tit-7/',
    'vigente',
    '1.0',
    '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.225308,0.225308,0.225308,0.225308,0.225308,0.225308,0.225308,0.225308,0.270369,0.270369,0.270369,0.270369,0.270369,0.270369,0.270369,0.270369,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.036049,0,0.018025,0.018025,0,0,0,0.018025,0.018025,0.018025,0.036049,0,0.036049,0.054074,0.018025,0.018025]'::vector
  ),
(
    'e1000001-0000-0000-0000-000000000007',
    'LEY-451-CABA-ART6152',
    'Régimen de Faltas de la CABA — Ley 451, art. 6.1.52',
    'transito',
    'Municipal — CABA',
    'Dirección General de Administración de Infracciones (DGAI)',
    'Ley Municipal',
    'Art. 6.1.52',
    'sancion',
    'Estacionamiento indebido. El conductor de un vehículo que estacione en lugares prohibidos o antirreglamentarios. Cuando el estacionamiento se produzca en rampas para personas con movilidad reducida la sanción se agravará.',
    'https://juristeca.jusbaires.gob.ar/compilacion-normativa-juristeca/ley-451',
    'vigente',
    '1.0',
    '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.12609,0.12609,0.12609,0.12609,0.12609,0.12609,0.12609,0.12609,0.210151,0.210151,0.210151,0.210151,0.210151,0.210151,0.210151,0.210151,0.252181,0.252181,0.252181,0.252181,0.252181,0.252181,0.252181,0.252181,0,0,0,0,0,0,0,0,0.033624,0,0,0.050436,0,0,0,0.033624,0.016812,0,0.033624,0,0,0.067248,0,0]'::vector
  ),
(
    'e1000001-0000-0000-0000-000000000008',
    'DECLEY-8031-73-INDICE',
    'Código de Faltas de la Provincia de Buenos Aires — Dec-Ley 8031/73',
    NULL,
    'Provincial — Buenos Aires',
    'Juzgados de Paz / Justicia de Faltas Provincial',
    'Decreto-Ley',
    'Índice Títulos I a III',
    NULL,
    'Régimen contravencional general de la provincia: faltas contra la seguridad de las personas, el patrimonio, la moralidad pública, la tranquilidad y el orden público, la autoridad y la fe pública. No regula la vía pública vehicular ni el tránsito urbano.',
    'https://normas.gba.gob.ar/documentos/ZBOPDhkV.html',
    'vigente',
    '1.0',
    '[0.038281,0.038281,0.038281,0.038281,0.038281,0.038281,0.038281,0.038281,0.038281,0.038281,0.038281,0.038281,0.038281,0.038281,0.038281,0.038281,0,0,0,0,0,0,0,0,0.114842,0.114842,0.114842,0.114842,0.114842,0.114842,0.114842,0.114842,0.114842,0.114842,0.114842,0.114842,0.114842,0.114842,0.114842,0.114842,0.306246,0.306246,0.306246,0.306246,0.306246,0.306246,0.306246,0.306246,0.045937,0.015312,0.015312,0,0,0,0.015312,0.045937,0.076562,0.030625,0.015312,0.015312,0.030625,0.045937,0,0]'::vector
  )
ON CONFLICT (id) DO UPDATE SET
  norma_codigo = EXCLUDED.norma_codigo,
  titulo = EXCLUDED.titulo,
  categoria = EXCLUDED.categoria,
  jurisdiccion = EXCLUDED.jurisdiccion,
  autoridad = EXCLUDED.autoridad,
  tipo_documento = EXCLUDED.tipo_documento,
  articulo = EXCLUDED.articulo,
  tipo_fundamento = EXCLUDED.tipo_fundamento,
  regla = EXCLUDED.regla,
  fuente_url = EXCLUDED.fuente_url,
  vigencia = EXCLUDED.vigencia,
  version = EXCLUDED.version,
  embedding = EXCLUDED.embedding;
