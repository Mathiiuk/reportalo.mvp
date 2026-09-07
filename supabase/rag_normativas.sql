-- =====================================================================
-- Spike RAG: Infraestructura y Corpus Normativo con pgvector (REP-2907)
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
    ADD COLUMN IF NOT EXISTS fuente_url TEXT,
    ADD COLUMN IF NOT EXISTS vigencia TEXT DEFAULT 'vigente',
    ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '1.0';

-- Permitir vectores de dimensión flexible (ej. 768 para Gemini o 1536 para OpenAI)
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
  match_threshold double precision DEFAULT 0.5,
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

-- 5. Seed data del corpus normativo inicial (REP-2906)
INSERT INTO public.normativas (
  id, norma_codigo, titulo, categoria, jurisdiccion, autoridad,
  tipo_documento, articulo, regla, fuente_url, vigencia, version, embedding
)
VALUES
(
    'e1000001-0000-0000-0000-000000000001',
    'LEY-24449-ART49B',
    'Obstrucción de rampa para personas con movilidad reducida',
    'mal_estacionado',
    'Nacional / Municipal',
    'Dirección General de Tránsito y Seguridad Vial',
    'Ley Nacional',
    'Art. 49 bis',
    'Queda terminantemente prohibido estacionar o detener vehículos frente o sobre rampas destinadas a personas con movilidad reducida o sillas de ruedas, garantizando el libre paso y accesibilidad.',
    'http://servicios.infoleg.gob.ar/infolegInternet/anexos/15000-19999/17887/texact.htm#49',
    'vigente',
    '1.0',
    '[0.410655,0.410655,0.410655,0.410655,0.045628,0.045628,0.045628,0.045628,0.228142,0.228142,0.228142,0.228142,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.091257,0.091257,0.091257,0.091257,0,0,0,0,0.091257,0.091257,0.091257,0.091257,0.091257,0.091257,0.091257,0.091257,0,0,0,0,0,0.018251,0.018251,0.036503,0.073005,0,0,0,0.036503,0,0.018251,0]'::vector
  ),
(
    'e1000001-0000-0000-0000-000000000002',
    'LEY-24449-ART49',
    'Estacionamiento sobre senda peatonal u ochava',
    'mal_estacionado',
    'Nacional / Municipal',
    'Dirección General de Tránsito y Seguridad Vial',
    'Ley Nacional',
    'Art. 49 inc. b',
    'En zona urbana está prohibido estacionar sobre la senda para peatones o ciclovías, en las esquinas u ochavas entre su vértice y la línea imaginaria que resulte de prolongar la ochava.',
    'http://servicios.infoleg.gob.ar/infolegInternet/anexos/15000-19999/17887/texact.htm#49',
    'vigente',
    '1.0',
    '[0,0,0,0,0.441511,0.441511,0.441511,0.441511,0.165567,0.165567,0.165567,0.165567,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.110378,0.110378,0.110378,0.110378,0.110378,0.110378,0.110378,0.110378,0,0,0,0,0,0.044151,0,0,0.088302,0,0.044151,0,0,0.022076,0.022076,0.022076]'::vector
  ),
(
    'e1000001-0000-0000-0000-000000000003',
    'LEY-24449-ART44',
    'Violación de semáforo con luz roja',
    'semaforo',
    'Nacional / Municipal',
    'Juzgado Administrativo de Faltas',
    'Ley Nacional',
    'Art. 44 inc. a',
    'En las vías reguladas por semáforos, los vehículos deben detenerse antes de la línea señalada o de la senda peatonal ante luz roja fija o intermitente, considerándose falta grave su inobservancia.',
    'http://servicios.infoleg.gob.ar/infolegInternet/anexos/15000-19999/17887/texact.htm#44',
    'vigente',
    '1.0',
    '[0,0,0,0,0.122905,0.122905,0.122905,0.122905,0.122905,0.122905,0.122905,0.122905,0.430169,0.430169,0.430169,0.430169,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.122905,0.122905,0.122905,0.122905,0.122905,0.122905,0.122905,0.122905,0.073743,0,0,0.024581,0,0.073743,0.049162,0.024581,0,0,0.049162,0,0,0.024581,0.024581,0]'::vector
  ),
(
    'e1000001-0000-0000-0000-000000000004',
    'LEY-24449-ART48',
    'Circulación vehicular en sentido contrario (contramano)',
    'mal_estacionado',
    'Nacional / Municipal',
    'Dirección General de Tránsito y Transporte',
    'Ley Nacional',
    'Art. 48 inc. d',
    'Está prohibido transitar en contramano, no respetar los carriles correspondientes o girar en U en lugares no permitidos por la reglamentación municipal o provincial.',
    'http://servicios.infoleg.gob.ar/infolegInternet/anexos/15000-19999/17887/texact.htm#48',
    'vigente',
    '1.0',
    '[0,0,0,0,0,0,0,0,0.102815,0.102815,0.102815,0.102815,0,0,0,0,0.308444,0.308444,0.308444,0.308444,0,0,0,0,0,0,0,0,0.102815,0.102815,0.102815,0.102815,0,0,0,0,0,0,0,0,0.257036,0.257036,0.257036,0.257036,0.257036,0.257036,0.257036,0.257036,0.020563,0,0.020563,0,0.041126,0,0,0.020563,0.020563,0,0.020563,0,0,0.020563,0.020563,0.041126]'::vector
  ),
(
    'e1000001-0000-0000-0000-000000000005',
    'ORD-RESIDUOS-CLAND',
    'Disposición clandestina de residuos y escombros en vía pública',
    'basura',
    'Municipal',
    'Dirección de Higiene Urbana y Gestión Ambiental',
    'Ordenanza Municipal',
    'Art. 12 Ord. 8820',
    'Se prohíbe arrojar, verter o acumular residuos domiciliarios, restos de poda, tierra o escombros en la vía pública, calzadas, aceras o baldíos fuera de los horarios y contenedores autorizados.',
    'https://boletinoficial.buenosaires.gob.ar/normativa/higiene_urbana',
    'vigente',
    '1.0',
    '[0,0,0,0,0,0,0,0,0.059272,0.059272,0.059272,0.059272,0,0,0,0,0,0,0,0,0.296362,0.296362,0.296362,0.296362,0.177817,0.177817,0.177817,0.177817,0,0,0,0,0.059272,0.059272,0.059272,0.059272,0.237089,0.237089,0.237089,0.237089,0.177817,0.177817,0.177817,0.177817,0.177817,0.177817,0.177817,0.177817,0,0.047418,0.023709,0,0.023709,0.023709,0.023709,0,0.047418,0,0,0.023709,0,0,0.094836,0]'::vector
  ),
(
    'e1000001-0000-0000-0000-000000000006',
    'COD-EDIF-ACERA',
    'Obstrucción de acera con materiales de obra sin vallado reglamentario',
    'bache',
    'Municipal',
    'Dirección de Obras Particulares y Catastro',
    'Código de Edificación',
    'Art. 35 Código de Edificación',
    'Toda obra en construcción debe garantizar un paso peatonal techado y seguro de al menos un metro de ancho en la acera, prohibiéndose el depósito de ladrillos, áridos y andamios sin cerco.',
    'https://normativas.buenosaires.gob.ar/obras_particulares',
    'vigente',
    '1.0',
    '[0,0,0,0,0.11399,0.11399,0.11399,0.11399,0.056995,0.056995,0.056995,0.056995,0,0,0,0,0,0,0,0,0,0,0,0,0.398966,0.398966,0.398966,0.398966,0,0,0,0,0,0,0,0,0.11399,0.11399,0.11399,0.11399,0.170985,0.170985,0.170985,0.170985,0.170985,0.170985,0.170985,0.170985,0.022798,0.068394,0.022798,0,0.022798,0.022798,0.022798,0,0,0.045596,0.022798,0,0.022798,0.045596,0,0]'::vector
  ),
(
    'e1000001-0000-0000-0000-000000000007',
    'ORD-RUIDOS-MOL',
    'Ruidos molestos y emisiones sonoras por encima del límite legal',
    'otro',
    'Municipal',
    'Dirección de Control Comunal y Convivencia',
    'Ordenanza de Convivencia',
    'Art. 18 Régimen de Faltas',
    'Queda prohibido perturbar el descanso o la tranquilidad pública mediante música en alto volumen, alarmas continuas, motores o gritos que excedan los 45 decibeles en horario nocturno (22:00 a 07:00 hs).',
    'https://boletinoficial.buenosaires.gob.ar/normativa/convivencia_acustica',
    'vigente',
    '1.0',
    '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.454621,0.454621,0.454621,0.454621,0,0,0,0,0.045462,0.045462,0.045462,0.045462,0.136386,0.136386,0.136386,0.136386,0.136386,0.136386,0.136386,0.136386,0.090924,0.03637,0.03637,0.03637,0.018185,0,0.018185,0.03637,0,0.018185,0.018185,0.018185,0.018185,0,0.018185,0.018185]'::vector
  ),
(
    'e1000001-0000-0000-0000-000000000008',
    'LEY-PROT-ARBOL',
    'Poda o tala clandestina del arbolado público',
    'otro',
    'Provincial / Municipal',
    'Secretaría de Espacios Públicos y Arbolado',
    'Ley Provincial',
    'Art. 4 Ley 12.276',
    'Queda prohibida la extracción, tala, poda drástica o daño directo sobre ejemplares del arbolado público urbano sin previa autorización y dictamen técnico de la autoridad competente.',
    'https://normas.gba.gob.ar/arbolado_publico',
    'vigente',
    '1.0',
    '[0,0,0,0,0,0,0,0,0.114799,0.114799,0.114799,0.114799,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.401795,0.401795,0.401795,0.401795,0.114799,0.114799,0.114799,0.114799,0.172198,0.172198,0.172198,0.172198,0.172198,0.172198,0.172198,0.172198,0,0.045919,0.02296,0.02296,0.02296,0,0.02296,0,0.045919,0.02296,0,0.045919,0,0.02296,0.045919,0]'::vector
  )
ON CONFLICT (id) DO UPDATE SET
  norma_codigo = EXCLUDED.norma_codigo,
  titulo = EXCLUDED.titulo,
  categoria = EXCLUDED.categoria,
  jurisdiccion = EXCLUDED.jurisdiccion,
  autoridad = EXCLUDED.autoridad,
  tipo_documento = EXCLUDED.tipo_documento,
  articulo = EXCLUDED.articulo,
  regla = EXCLUDED.regla,
  fuente_url = EXCLUDED.fuente_url,
  vigencia = EXCLUDED.vigencia,
  version = EXCLUDED.version,
  embedding = EXCLUDED.embedding;
