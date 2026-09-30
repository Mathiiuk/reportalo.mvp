-- ============================================================
-- Reportalo MVP · Esquema completo (public) + datos del corpus normativo
-- Generado el 28/09/2026 a pedido de Hernán, vía Matías, desde el proyecto Supabase real (CiudadAR).
-- No es un pg_dump literal: se reconstruyó desde information_schema, así que
-- puede faltar algún detalle fino (triggers, RLS policies, funciones) que no
-- se pidió acá. Para eso, los archivos fuente del repo (supabase/*.sql,
-- supabase/migrations/*.sql) son la referencia completa.
-- ============================================================

-- ---------- ESQUEMA (las 42 tablas de public) ----------

-- Tabla: infraction_types (filas actuales: 0, RLS: activo)
CREATE TABLE public."infraction_types" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "description" text,
  "severity_level" integer DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
  , PRIMARY KEY ("id")
);

-- Tabla: infractions (filas actuales: 0, RLS: activo)
CREATE TABLE public."infractions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "location" geography,
  "image_url" text NOT NULL,
  "ocr_data" jsonb,
  "status" infraction_status /* enum: pendiente, en_revision, aprobada, rechazada */ NOT NULL DEFAULT 'pendiente'::infraction_status,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "type" text,
  "description" text,
  "provincia" text,
  "municipio" text,
  "direccion" text,
  "latitude" double precision,
  "longitude" double precision,
  "acta_borrador" text,
  "acta_generada_at" timestamp with time zone
  , PRIMARY KEY ("id")
);

-- Tabla: high_priority_zones (filas actuales: 0, RLS: activo)
CREATE TABLE public."high_priority_zones" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "center_location" geography NOT NULL,
  "infraction_count" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
  , PRIMARY KEY ("id")
);

-- Tabla: notifications (filas actuales: 0, RLS: activo)
CREATE TABLE public."notifications" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "read" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
  , PRIMARY KEY ("id")
);

-- Tabla: countries (filas actuales: 1, RLS: activo)
CREATE TABLE public."countries" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "iso_code" character varying NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
  , PRIMARY KEY ("id")
);

-- Tabla: states_provinces (filas actuales: 3, RLS: activo)
CREATE TABLE public."states_provinces" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "country_id" uuid NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
  , PRIMARY KEY ("id")
);

-- Tabla: subdivisions (filas actuales: 17, RLS: activo)
CREATE TABLE public."subdivisions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "state_province_id" uuid NOT NULL,
  "name" text NOT NULL,
  "type" text NOT NULL DEFAULT 'municipio'::text,
  "created_at" timestamp with time zone DEFAULT now()
  , PRIMARY KEY ("id")
);

-- Tabla: localities (filas actuales: 57, RLS: activo)
CREATE TABLE public."localities" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "subdivision_id" uuid NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
  , PRIMARY KEY ("id")
);

-- Tabla: agencies (filas actuales: 2, RLS: activo)
CREATE TABLE public."agencies" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "subdivision_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "parent_agency_id" uuid
  , PRIMARY KEY ("id")
);

-- Tabla: profiles (filas actuales: 15, RLS: activo)
CREATE TABLE public."profiles" (
  "id" uuid NOT NULL,
  "username" text NOT NULL,
  "full_name" text,
  "avatar_url" text,
  "role" text NOT NULL DEFAULT 'ciudadano'::text,
  "agency_id" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
  , PRIMARY KEY ("id")
);

-- Tabla: agency_subscriptions (filas actuales: 2, RLS: activo)
CREATE TABLE public."agency_subscriptions" (
  "agency_id" uuid NOT NULL,
  "plan_type" character varying NOT NULL DEFAULT 'free_tier'::character varying,
  "is_active" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp with time zone DEFAULT now()
  , PRIMARY KEY ("agency_id")
);

-- Tabla: agency_contacts (filas actuales: 2, RLS: activo)
CREATE TABLE public."agency_contacts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "agency_id" uuid NOT NULL,
  "contact_channel" character varying NOT NULL,
  "contact_value" text NOT NULL,
  "is_primary" boolean NOT NULL DEFAULT false
  , PRIMARY KEY ("id")
);

-- Tabla: services (filas actuales: 5, RLS: activo)
CREATE TABLE public."services" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "service_code" text NOT NULL,
  "service_name" text NOT NULL,
  "group_name" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now()
  , PRIMARY KEY ("id")
);

-- Tabla: service_attributes (filas actuales: 1, RLS: activo)
CREATE TABLE public."service_attributes" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "service_id" uuid NOT NULL,
  "attribute_code" text NOT NULL,
  "data_type" text NOT NULL,
  "required" boolean NOT NULL DEFAULT false,
  "datatype_description" text,
  "description" text,
  "sort_order" integer
  , PRIMARY KEY ("id")
);

-- Tabla: service_attribute_values (filas actuales: 0, RLS: activo)
CREATE TABLE public."service_attribute_values" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "attribute_id" uuid NOT NULL,
  "value_key" text NOT NULL,
  "value_name" text NOT NULL
  , PRIMARY KEY ("id")
);

-- Tabla: report_states (filas actuales: 5, RLS: activo)
CREATE TABLE public."report_states" (
  "code" character varying NOT NULL,
  "description" text NOT NULL,
  "open311_status" character varying NOT NULL
  , PRIMARY KEY ("code")
);

-- Tabla: citizen_reports (filas actuales: 56, RLS: activo)
CREATE TABLE public."citizen_reports" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "client_side_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "service_id" uuid,
  "locality_id" uuid NOT NULL,
  "latitud" double precision NOT NULL,
  "longitud" double precision NOT NULL,
  "description" text NOT NULL,
  "current_state_code" character varying NOT NULL DEFAULT 'RECIBIDO'::character varying,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "client_created_at" timestamp with time zone
  , PRIMARY KEY ("id")
);

-- Tabla: report_images (filas actuales: 45, RLS: activo)
CREATE TABLE public."report_images" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "report_id" uuid NOT NULL,
  "image_url" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
  , PRIMARY KEY ("id")
);

-- Tabla: infraction_attribute_responses (filas actuales: 0, RLS: activo)
CREATE TABLE public."infraction_attribute_responses" (
  "report_id" uuid NOT NULL,
  "attribute_id" uuid NOT NULL,
  "selected_value" text NOT NULL
  , PRIMARY KEY ("report_id", "attribute_id")
);

-- Tabla: report_state_history (filas actuales: 18, RLS: activo)
CREATE TABLE public."report_state_history" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "report_id" uuid NOT NULL,
  "state_code" character varying NOT NULL,
  "changed_by" uuid,
  "notes" text,
  "changed_at" timestamp with time zone DEFAULT now(),
  "actor_agency_id" uuid
  , PRIMARY KEY ("id")
);

-- Tabla: report_outreach_logs (filas actuales: 0, RLS: activo)
CREATE TABLE public."report_outreach_logs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "report_id" uuid NOT NULL,
  "contact_id" uuid NOT NULL,
  "delivery_status" character varying NOT NULL,
  "external_reference" text,
  "payload_snapshot" text NOT NULL,
  "sent_at" timestamp with time zone DEFAULT now()
  , PRIMARY KEY ("id")
);

-- Tabla: normativas (filas actuales: 7, RLS: activo)
CREATE TABLE public."normativas" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "subdivision_id" uuid,
  "tipo_documento" character varying NOT NULL DEFAULT 'ley'::character varying,
  "categoria" text,
  "regla" text NOT NULL,
  "embedding" vector NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "norma_codigo" text,
  "titulo" text,
  "jurisdiccion" text DEFAULT 'Municipal'::text,
  "autoridad" text DEFAULT 'Juzgado de Faltas'::text,
  "articulo" text,
  "fuente_url" text,
  "vigencia" text DEFAULT 'vigente'::text,
  "version" text DEFAULT '1.0'::text,
  "tipo_fundamento" text
  , PRIMARY KEY ("id")
);

-- Tabla: report_ai_analysis (filas actuales: 56, RLS: activo)
CREATE TABLE public."report_ai_analysis" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "report_id" uuid NOT NULL,
  "is_infraction" boolean NOT NULL DEFAULT false,
  "citizen_feedback" text,
  "official_legal_foundation" text,
  "suggested_agency_id" uuid,
  "confidence_score" numeric NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "result_status_code" character varying NOT NULL,
  "suggested_service_id" uuid,
  "embedding_model_code" character varying NOT NULL,
  "generation_model_code" character varying,
  "prompt_version" text,
  "input_tokens" integer,
  "output_tokens" integer,
  "latency_ms" integer,
  "status_reason" text
  , PRIMARY KEY ("id")
);

-- Tabla: report_learning_corpus (filas actuales: 0, RLS: activo)
CREATE TABLE public."report_learning_corpus" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "report_id" uuid NOT NULL,
  "final_outcome" character varying NOT NULL,
  "municipality_notes" text,
  "embedding" vector NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
  , PRIMARY KEY ("id")
);

-- Tabla: terms_consents (filas actuales: 8, RLS: activo)
CREATE TABLE public."terms_consents" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "terms_version" text NOT NULL,
  "accepted_at" timestamp with time zone NOT NULL DEFAULT now(),
  "camera_permission" boolean NOT NULL DEFAULT true,
  "location_permission" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
  , PRIMARY KEY ("id")
);

-- Tabla: service_keywords (filas actuales: 0, RLS: activo)
CREATE TABLE public."service_keywords" (
  "service_id" uuid NOT NULL,
  "keyword" text NOT NULL
  , PRIMARY KEY ("service_id", "keyword")
);

-- Tabla: agency_services (filas actuales: 0, RLS: activo)
CREATE TABLE public."agency_services" (
  "agency_id" uuid NOT NULL,
  "service_id" uuid NOT NULL
  , PRIMARY KEY ("agency_id", "service_id")
);

-- Tabla: profile_services (filas actuales: 0, RLS: activo)
CREATE TABLE public."profile_services" (
  "profile_id" uuid NOT NULL,
  "service_id" uuid NOT NULL
  , PRIMARY KEY ("profile_id", "service_id")
);

-- Tabla: report_event_types (filas actuales: 1, RLS: activo)
CREATE TABLE public."report_event_types" (
  "code" character varying NOT NULL,
  "description" text NOT NULL
  , PRIMARY KEY ("code")
);

-- Tabla: report_events (filas actuales: 0, RLS: activo)
CREATE TABLE public."report_events" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "report_id" uuid NOT NULL,
  "event_type_code" character varying NOT NULL,
  "actor_profile_id" uuid,
  "actor_agency_id" uuid,
  "occurred_at" timestamp with time zone NOT NULL DEFAULT now(),
  "notes" text
  , PRIMARY KEY ("id")
);

-- Tabla: source_types (filas actuales: 2, RLS: activo)
CREATE TABLE public."source_types" (
  "code" character varying NOT NULL,
  "description" text NOT NULL
  , PRIMARY KEY ("code")
);

-- Tabla: document_types (filas actuales: 3, RLS: activo)
CREATE TABLE public."document_types" (
  "code" character varying NOT NULL,
  "description" text NOT NULL
  , PRIMARY KEY ("code")
);

-- Tabla: foundation_types (filas actuales: 4, RLS: activo)
CREATE TABLE public."foundation_types" (
  "code" character varying NOT NULL,
  "description" text NOT NULL
  , PRIMARY KEY ("code")
);

-- Tabla: ai_result_statuses (filas actuales: 5, RLS: activo)
CREATE TABLE public."ai_result_statuses" (
  "code" character varying NOT NULL,
  "description" text NOT NULL
  , PRIMARY KEY ("code")
);

-- Tabla: embedding_models (filas actuales: 1, RLS: activo)
CREATE TABLE public."embedding_models" (
  "code" character varying NOT NULL,
  "provider" character varying NOT NULL,
  "model_name" text NOT NULL,
  "dimensions" integer NOT NULL,
  "is_active" boolean NOT NULL DEFAULT false,
  "retired_at" date
  , PRIMARY KEY ("code")
);

-- Tabla: generation_models (filas actuales: 1, RLS: activo)
CREATE TABLE public."generation_models" (
  "code" character varying NOT NULL,
  "provider" character varying NOT NULL,
  "model_name" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT false,
  "retired_at" date
  , PRIMARY KEY ("code")
);

-- Tabla: knowledge_sources (filas actuales: 8, RLS: activo)
CREATE TABLE public."knowledge_sources" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "source_type_code" character varying NOT NULL,
  "document_type_code" character varying NOT NULL,
  "document_number" text,
  "title" text NOT NULL,
  "issuing_authority" text NOT NULL,
  "country_id" uuid,
  "state_province_id" uuid,
  "subdivision_id" uuid,
  "requires_adhesion" boolean NOT NULL DEFAULT false,
  "source_url" text NOT NULL,
  "snapshot_path" text,
  "is_current" boolean NOT NULL DEFAULT true,
  "verified_at" timestamp with time zone NOT NULL,
  "last_amended_by" text,
  "created_at" timestamp with time zone DEFAULT now()
  , PRIMARY KEY ("id")
);

-- Tabla: source_adhesions (filas actuales: 1, RLS: activo)
CREATE TABLE public."source_adhesions" (
  "source_id" uuid NOT NULL,
  "adhering_source_id" uuid NOT NULL,
  "scope_note" text,
  "verified_at" timestamp with time zone NOT NULL
  , PRIMARY KEY ("source_id", "adhering_source_id")
);

-- Tabla: knowledge_fragments (filas actuales: 17, RLS: activo)
CREATE TABLE public."knowledge_fragments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "source_id" uuid NOT NULL,
  "hierarchy_path" text NOT NULL,
  "article" text,
  "subsection" text,
  "content" text NOT NULL,
  "foundation_type_code" character varying,
  "is_current" boolean NOT NULL DEFAULT true,
  "replaces_fragment_id" uuid,
  "fts" tsvector DEFAULT to_tsvector('spanish'::regconfig, content),
  "created_at" timestamp with time zone DEFAULT now()
  , PRIMARY KEY ("id")
);

-- Tabla: fragment_services (filas actuales: 16, RLS: activo)
CREATE TABLE public."fragment_services" (
  "fragment_id" uuid NOT NULL,
  "service_id" uuid NOT NULL
  , PRIMARY KEY ("fragment_id", "service_id")
);

-- Tabla: fragment_embeddings (filas actuales: 17, RLS: activo)
CREATE TABLE public."fragment_embeddings" (
  "fragment_id" uuid NOT NULL,
  "model_code" character varying NOT NULL,
  "embedding" vector NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
  , PRIMARY KEY ("fragment_id", "model_code")
);

-- Tabla: report_ai_evidence (filas actuales: 166, RLS: activo)
CREATE TABLE public."report_ai_evidence" (
  "analysis_id" uuid NOT NULL,
  "fragment_id" uuid NOT NULL,
  "rank" integer NOT NULL,
  "similarity" numeric NOT NULL,
  "was_cited" boolean NOT NULL DEFAULT false,
  "quoted_text" text
  , PRIMARY KEY ("analysis_id", "fragment_id")
);
-- ---------- DATOS DEL CORPUS Y CATÁLOGOS (no incluye citizen_reports, profiles, report_ai_* — datos de ciudadanos) ----------

-- countries (1 filas)
INSERT INTO public."countries" ("id", "name", "iso_code", "created_at") VALUES ('53a9958a-1646-4abe-8aaa-6e5173ca8424', 'Argentina', 'AR', '2026-09-14T13:29:22.426339+00:00');

-- states_provinces (3 filas)
INSERT INTO public."states_provinces" ("id", "name", "country_id", "created_at") VALUES ('eea2d197-f1b7-40e8-826e-b0c6233c935e', 'Ciudad Autónoma de Buenos Aires', '53a9958a-1646-4abe-8aaa-6e5173ca8424', '2026-09-14T13:29:22.426339+00:00');
INSERT INTO public."states_provinces" ("id", "name", "country_id", "created_at") VALUES ('7ef901f3-2992-44be-b6a4-445479672e97', 'Buenos Aires', '53a9958a-1646-4abe-8aaa-6e5173ca8424', '2026-09-14T13:29:22.426339+00:00');
INSERT INTO public."states_provinces" ("id", "name", "country_id", "created_at") VALUES ('c7e46cd0-0d92-4a09-9aff-86a6531e1c39', 'Santa Fe', '53a9958a-1646-4abe-8aaa-6e5173ca8424', '2026-09-14T13:29:22.426339+00:00');

-- subdivisions (17 filas)
INSERT INTO public."subdivisions" ("id", "name", "type", "created_at", "state_province_id") VALUES ('03ec259a-cde9-4e1e-a363-869b20921286', 'Comuna 15', 'comuna', '2026-09-14T13:29:22.426339+00:00', 'eea2d197-f1b7-40e8-826e-b0c6233c935e');
INSERT INTO public."subdivisions" ("id", "name", "type", "created_at", "state_province_id") VALUES ('44ca2b7e-a0b5-4f95-8525-d89f647b17c6', 'Comuna 14', 'comuna', '2026-09-14T13:29:22.426339+00:00', 'eea2d197-f1b7-40e8-826e-b0c6233c935e');
INSERT INTO public."subdivisions" ("id", "name", "type", "created_at", "state_province_id") VALUES ('e7948ad6-7f7e-4b8b-9b4f-bf207f4a81e7', 'Comuna 13', 'comuna', '2026-09-14T13:29:22.426339+00:00', 'eea2d197-f1b7-40e8-826e-b0c6233c935e');
INSERT INTO public."subdivisions" ("id", "name", "type", "created_at", "state_province_id") VALUES ('e5f9a87a-a7ab-4581-b3bb-608c21010928', 'Comuna 12', 'comuna', '2026-09-14T13:29:22.426339+00:00', 'eea2d197-f1b7-40e8-826e-b0c6233c935e');
INSERT INTO public."subdivisions" ("id", "name", "type", "created_at", "state_province_id") VALUES ('bf3916e4-93a6-4c9a-9d05-703bf16962b8', 'Comuna 11', 'comuna', '2026-09-14T13:29:22.426339+00:00', 'eea2d197-f1b7-40e8-826e-b0c6233c935e');
INSERT INTO public."subdivisions" ("id", "name", "type", "created_at", "state_province_id") VALUES ('27d30372-4747-4feb-90c6-3b559b8ab0c3', 'Comuna 10', 'comuna', '2026-09-14T13:29:22.426339+00:00', 'eea2d197-f1b7-40e8-826e-b0c6233c935e');
INSERT INTO public."subdivisions" ("id", "name", "type", "created_at", "state_province_id") VALUES ('a50ac29b-4ebb-4705-8c45-76aed7280603', 'Comuna 9', 'comuna', '2026-09-14T13:29:22.426339+00:00', 'eea2d197-f1b7-40e8-826e-b0c6233c935e');
INSERT INTO public."subdivisions" ("id", "name", "type", "created_at", "state_province_id") VALUES ('965fc884-c00e-4dd8-8cd1-09bff6b09ec6', 'Comuna 8', 'comuna', '2026-09-14T13:29:22.426339+00:00', 'eea2d197-f1b7-40e8-826e-b0c6233c935e');
INSERT INTO public."subdivisions" ("id", "name", "type", "created_at", "state_province_id") VALUES ('3f0a1d27-531b-4342-aec6-5ed52a01f484', 'Comuna 7', 'comuna', '2026-09-14T13:29:22.426339+00:00', 'eea2d197-f1b7-40e8-826e-b0c6233c935e');
INSERT INTO public."subdivisions" ("id", "name", "type", "created_at", "state_province_id") VALUES ('48f65f91-1a6c-43fa-8901-dea2a7a0cf12', 'Comuna 6', 'comuna', '2026-09-14T13:29:22.426339+00:00', 'eea2d197-f1b7-40e8-826e-b0c6233c935e');
INSERT INTO public."subdivisions" ("id", "name", "type", "created_at", "state_province_id") VALUES ('aad89e66-66ef-44e3-bbde-e01b23b8e790', 'Comuna 5', 'comuna', '2026-09-14T13:29:22.426339+00:00', 'eea2d197-f1b7-40e8-826e-b0c6233c935e');
INSERT INTO public."subdivisions" ("id", "name", "type", "created_at", "state_province_id") VALUES ('0898ab64-d6d2-40e6-84c3-eab428333393', 'Comuna 4', 'comuna', '2026-09-14T13:29:22.426339+00:00', 'eea2d197-f1b7-40e8-826e-b0c6233c935e');
INSERT INTO public."subdivisions" ("id", "name", "type", "created_at", "state_province_id") VALUES ('20ee551e-c1fc-4bf0-979e-4dccc907e8db', 'Comuna 3', 'comuna', '2026-09-14T13:29:22.426339+00:00', 'eea2d197-f1b7-40e8-826e-b0c6233c935e');
INSERT INTO public."subdivisions" ("id", "name", "type", "created_at", "state_province_id") VALUES ('29a3e2e4-eba6-49c4-994f-70d1165707c8', 'Comuna 2', 'comuna', '2026-09-14T13:29:22.426339+00:00', 'eea2d197-f1b7-40e8-826e-b0c6233c935e');
INSERT INTO public."subdivisions" ("id", "name", "type", "created_at", "state_province_id") VALUES ('f7874d5c-d4a3-4e4e-9fdf-9e2460d517d9', 'Comuna 1', 'comuna', '2026-09-14T13:29:22.426339+00:00', 'eea2d197-f1b7-40e8-826e-b0c6233c935e');
INSERT INTO public."subdivisions" ("id", "name", "type", "created_at", "state_province_id") VALUES ('09e839cc-7690-40d5-a732-efe1e16594de', 'Avellaneda', 'partido', '2026-09-14T13:29:22.426339+00:00', '7ef901f3-2992-44be-b6a4-445479672e97');
INSERT INTO public."subdivisions" ("id", "name", "type", "created_at", "state_province_id") VALUES ('d5e35294-2d22-4888-b9b7-7715f00717a8', 'Avellaneda', 'departamento', '2026-09-14T13:29:22.426339+00:00', 'c7e46cd0-0d92-4a09-9aff-86a6531e1c39');

-- localities (57 filas)
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('d8438ecf-daad-4ae1-9439-f5da9bdc298c', 'Chacarita', '03ec259a-cde9-4e1e-a363-869b20921286');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('e333cd05-2134-43e6-8967-d9c866d0031f', 'Villa Crespo', '03ec259a-cde9-4e1e-a363-869b20921286');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('35fde5e5-71aa-40be-ae1b-74359af78330', 'La Paternal', '03ec259a-cde9-4e1e-a363-869b20921286');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('35fa658d-3992-47bd-b5e8-3db6139c1289', 'Villa Ortúzar', '03ec259a-cde9-4e1e-a363-869b20921286');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('c9e2f2d5-9fde-4610-9a21-746b3075f73c', 'Agronomía', '03ec259a-cde9-4e1e-a363-869b20921286');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('e0bdde4a-a87a-48e6-9c90-fcf18c1912ad', 'Parque Chas', '03ec259a-cde9-4e1e-a363-869b20921286');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('efb5ca1b-c3e6-49e7-adf0-978f2bab54c4', 'Palermo', '44ca2b7e-a0b5-4f95-8525-d89f647b17c6');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('b8ee7b11-ff7b-498b-9e94-2c4f9639e058', 'Núñez', 'e7948ad6-7f7e-4b8b-9b4f-bf207f4a81e7');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('2889479e-c294-4377-840d-2556347af75c', 'Belgrano', 'e7948ad6-7f7e-4b8b-9b4f-bf207f4a81e7');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('7ae2c645-492b-41ee-9a8d-b604e1cfaa78', 'Colegiales', 'e7948ad6-7f7e-4b8b-9b4f-bf207f4a81e7');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('a0d8068f-c5f5-436f-9968-dd656b8b6d93', 'Coghlan', 'e5f9a87a-a7ab-4581-b3bb-608c21010928');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('bfd2b111-fdd3-410c-afda-a9cba455b6ec', 'Saavedra', 'e5f9a87a-a7ab-4581-b3bb-608c21010928');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('8e41fd95-82e6-4f57-8c0c-f8b67917e67d', 'Villa Urquiza', 'e5f9a87a-a7ab-4581-b3bb-608c21010928');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('c5a0529f-7fc6-47df-87e4-91fc8966c075', 'Villa Pueyrredón', 'e5f9a87a-a7ab-4581-b3bb-608c21010928');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('f6b3c490-4965-4278-b4a8-d2410508ff69', 'Villa General Mitre', 'bf3916e4-93a6-4c9a-9d05-703bf16962b8');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('8fd9179c-d1b4-41e5-a1dd-3cf027637d6e', 'Villa Devoto', 'bf3916e4-93a6-4c9a-9d05-703bf16962b8');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('937e9213-6a15-41e4-913d-17f3bb2a697a', 'Villa del Parque', 'bf3916e4-93a6-4c9a-9d05-703bf16962b8');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('2b9fab5e-be6a-42cf-a2a3-3fd1ade65e20', 'Villa Santa Rita', 'bf3916e4-93a6-4c9a-9d05-703bf16962b8');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('f8b6e837-9342-45dd-a5c9-4bb385b72d57', 'Villa Real', '27d30372-4747-4feb-90c6-3b559b8ab0c3');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('515204c3-ab4a-471e-88a8-22a2570997f7', 'Monte Castro', '27d30372-4747-4feb-90c6-3b559b8ab0c3');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('1b10c2bd-ad26-4aec-b635-94e988fbf09c', 'Versalles', '27d30372-4747-4feb-90c6-3b559b8ab0c3');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('694680bb-104f-4f2e-bd30-1b732cbf0923', 'Floresta', '27d30372-4747-4feb-90c6-3b559b8ab0c3');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('b9936a46-1c40-4aba-9a66-064c7e89c595', 'Vélez Sarsfield', '27d30372-4747-4feb-90c6-3b559b8ab0c3');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('53d2d44d-fc61-4940-ab54-bf32f28b716e', 'Villa Luro', '27d30372-4747-4feb-90c6-3b559b8ab0c3');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('41e02555-8677-4d6d-a096-93d049fc9ef1', 'Liniers', 'a50ac29b-4ebb-4705-8c45-76aed7280603');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('d956453a-1fcf-4e57-a3d2-be542f526fde', 'Mataderos', 'a50ac29b-4ebb-4705-8c45-76aed7280603');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('3599a067-a40f-4b5b-85d8-1442e489c497', 'Parque Avellaneda', 'a50ac29b-4ebb-4705-8c45-76aed7280603');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('925fa4e6-6fab-4eff-8643-6e31d6285c6b', 'Villa Soldati', '965fc884-c00e-4dd8-8cd1-09bff6b09ec6');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('d33c64f8-871d-4129-a087-ddcc5d9ceae2', 'Villa Riachuelo', '965fc884-c00e-4dd8-8cd1-09bff6b09ec6');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('f5a7e6a1-ab88-4b06-a903-585e174a889a', 'Villa Lugano', '965fc884-c00e-4dd8-8cd1-09bff6b09ec6');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('41c88642-689a-4346-897d-0ae6f92bdba3', 'Flores', '3f0a1d27-531b-4342-aec6-5ed52a01f484');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('9b7d37ea-1471-4bea-90ab-2c172577b218', 'Parque Chacabuco', '3f0a1d27-531b-4342-aec6-5ed52a01f484');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('412dcfbc-2cd3-4fbf-be30-433a1ef89ddd', 'Caballito', '48f65f91-1a6c-43fa-8901-dea2a7a0cf12');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('497d8317-44a9-473b-95dc-56836c35199b', 'Almagro', 'aad89e66-66ef-44e3-bbde-e01b23b8e790');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('8d1ecd70-f692-4af2-85e5-2a4530542d90', 'Boedo', 'aad89e66-66ef-44e3-bbde-e01b23b8e790');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('8bde166a-3aea-4f7c-ad55-90fd3fa11f23', 'La Boca', '0898ab64-d6d2-40e6-84c3-eab428333393');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('cbb20774-387a-4619-aa59-39d9711b21c1', 'Barracas', '0898ab64-d6d2-40e6-84c3-eab428333393');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('f998553d-8dcb-4218-856c-303091c49591', 'Parque Patricios', '0898ab64-d6d2-40e6-84c3-eab428333393');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('9746f173-6e16-4cf2-86a5-1f1b844a9c90', 'Nueva Pompeya', '0898ab64-d6d2-40e6-84c3-eab428333393');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('ffa721a3-f9a9-4c88-9861-bf907727e4e9', 'Balvanera', '20ee551e-c1fc-4bf0-979e-4dccc907e8db');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('a1fb368f-059d-4ab1-842a-5ecdd572a400', 'San Cristóbal', '20ee551e-c1fc-4bf0-979e-4dccc907e8db');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('70a5acfa-58fe-40c8-8322-b4830cf41d04', 'Recoleta', '29a3e2e4-eba6-49c4-994f-70d1165707c8');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('5cf0be29-55ce-452c-892b-d37fb6e669f2', 'Retiro', 'f7874d5c-d4a3-4e4e-9fdf-9e2460d517d9');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('c388ab04-9fd1-465c-a109-65c7b1d528c3', 'San Nicolás', 'f7874d5c-d4a3-4e4e-9fdf-9e2460d517d9');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('e025128c-3ec9-46d7-987a-1eaf0cffebb4', 'Puerto Madero', 'f7874d5c-d4a3-4e4e-9fdf-9e2460d517d9');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('f7b80337-4fae-4c2e-a548-8c5c27f5b393', 'San Telmo', 'f7874d5c-d4a3-4e4e-9fdf-9e2460d517d9');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('366ea621-38d6-4e7b-8ba6-d3caf0ad3239', 'Monserrat', 'f7874d5c-d4a3-4e4e-9fdf-9e2460d517d9');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('44a8f9ca-3240-4f4f-9662-3b6096da6989', 'Constitución', 'f7874d5c-d4a3-4e4e-9fdf-9e2460d517d9');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('2fe4cf09-c3d9-4514-ae99-cac0256494e4', 'Avellaneda', '09e839cc-7690-40d5-a732-efe1e16594de');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('1bc88f76-a31e-4071-b0a2-11b2c08a60b8', 'Crucecita', '09e839cc-7690-40d5-a732-efe1e16594de');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('731e44ac-491e-4a95-93e7-7c3b1ad3a9d0', 'Dock Sud', '09e839cc-7690-40d5-a732-efe1e16594de');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('cba99f1c-1290-4873-b4fb-af8ae61122e1', 'Gerli', '09e839cc-7690-40d5-a732-efe1e16594de');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('90079a38-1e7e-45d6-8fbf-60140bee9b8d', 'Piñeyro', '09e839cc-7690-40d5-a732-efe1e16594de');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('c1580602-abfc-40ed-83e5-d80b38126f5e', 'Sarandí', '09e839cc-7690-40d5-a732-efe1e16594de');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('c8d6ab33-9049-4baf-ae4a-cbefdc52199d', 'Villa Domínico', '09e839cc-7690-40d5-a732-efe1e16594de');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('094a78f5-ce7b-4e76-8d54-5bb95419fe93', 'Wilde', '09e839cc-7690-40d5-a732-efe1e16594de');
INSERT INTO public."localities" ("id", "name", "subdivision_id") VALUES ('69a358ff-64c0-436b-9cf8-c9ea346b394c', 'Avellaneda', 'd5e35294-2d22-4888-b9b7-7715f00717a8');

-- source_types (2 filas)
INSERT INTO public."source_types" ("code", "description") VALUES ('corpus_legal', 'Normativa jurídica');
INSERT INTO public."source_types" ("code", "description") VALUES ('informacion', 'Información no normativa: trámites, guías del organismo');

-- document_types (3 filas)
INSERT INTO public."document_types" ("code", "description") VALUES ('constitucion', 'Constitución');
INSERT INTO public."document_types" ("code", "description") VALUES ('ley', 'Ley');
INSERT INTO public."document_types" ("code", "description") VALUES ('decreto_ley', 'Decreto-Ley');

-- foundation_types (4 filas)
INSERT INTO public."foundation_types" ("code", "description") VALUES ('obligacion', 'Obligación del Estado o del municipio');
INSERT INTO public."foundation_types" ("code", "description") VALUES ('conducta_prohibida', 'Conducta prohibida');
INSERT INTO public."foundation_types" ("code", "description") VALUES ('sancion', 'Sanción (no se muestra al ciudadano)');
INSERT INTO public."foundation_types" ("code", "description") VALUES ('competencia', 'Competencia de un organismo');

-- ai_result_statuses (5 filas)
INSERT INTO public."ai_result_statuses" ("code", "description") VALUES ('fundamentado', 'Hay normativa aplicable y citada');
INSERT INTO public."ai_result_statuses" ("code", "description") VALUES ('indeterminado', 'Error o validación fallida: no se emite fundamento');
INSERT INTO public."ai_result_statuses" ("code", "description") VALUES ('sin_normativa', 'No hay normativa cargada que sustente el reporte');
INSERT INTO public."ai_result_statuses" ("code", "description") VALUES ('fuera_de_alcance', 'No corresponde a Reportalo (por ejemplo, un delito: 911)');
INSERT INTO public."ai_result_statuses" ("code", "description") VALUES ('asistencia', 'Situación de asistencia social, no es una infracción (vulnerabilidad social)');

-- embedding_models (1 filas)
INSERT INTO public."embedding_models" ("code", "provider", "is_active", "dimensions", "model_name", "retired_at") VALUES ('gemini-embedding-2@768', 'google', true, 768, 'gemini-embedding-2', NULL);

-- generation_models (1 filas)
INSERT INTO public."generation_models" ("code", "provider", "is_active", "model_name", "retired_at") VALUES ('gemini-3.8-flash', 'google', true, 'gemini-3.8-flash', NULL);

-- agencies (2 filas)
INSERT INTO public."agencies" ("id", "name", "created_at", "subdivision_id", "parent_agency_id") VALUES ('0004c0f0-f7bd-4934-bc6d-9894c7028a72', 'Dirección General de Fiscalización — Comuna 1', '2026-09-14T13:29:22.426339+00:00', 'f7874d5c-d4a3-4e4e-9fdf-9e2460d517d9', NULL);
INSERT INTO public."agencies" ("id", "name", "created_at", "subdivision_id", "parent_agency_id") VALUES ('4e76e2b0-f2e8-4bfe-b387-1991fcd4fc1a', 'Secretaría de Servicios Públicos — Avellaneda', '2026-09-14T13:29:22.426339+00:00', '09e839cc-7690-40d5-a732-efe1e16594de', NULL);

-- services (5 filas)
INSERT INTO public."services" ("id", "created_at", "group_name", "description", "service_code", "service_name") VALUES ('aedc05f4-e748-4f81-97ca-0b9e0aed430b', '2026-09-14T13:29:22.426339+00:00', 'Vía pública', NULL, 'TRANSITO', 'Tránsito');
INSERT INTO public."services" ("id", "created_at", "group_name", "description", "service_code", "service_name") VALUES ('64becc16-63c1-456b-b0c2-25256c32fd16', '2026-09-14T13:29:22.426339+00:00', 'Vía pública', NULL, 'INFRAESTRUCTURA', 'Infraestructura');
INSERT INTO public."services" ("id", "created_at", "group_name", "description", "service_code", "service_name") VALUES ('170275b6-9d03-4aed-9179-2e11cd429c2c', '2026-09-14T13:29:22.426339+00:00', 'Vía pública', NULL, 'AMBIENTE', 'Ambiente');
INSERT INTO public."services" ("id", "created_at", "group_name", "description", "service_code", "service_name") VALUES ('9f241256-52bd-47d4-b9bd-5c90b6bb0b4f', '2026-09-14T13:29:22.426339+00:00', 'Vía pública', NULL, 'COMERCIO_IRREGULAR', 'Comercio irregular');
INSERT INTO public."services" ("id", "created_at", "group_name", "description", "service_code", "service_name") VALUES ('eefbff51-09f4-4887-99b5-e17906bac9e1', '2026-09-14T13:29:22.426339+00:00', 'Asistencia social', NULL, 'VULNERABILIDAD_SOCIAL', 'Vulnerabilidad social');

-- service_attributes (1 filas)
INSERT INTO public."service_attributes" ("id", "required", "data_type", "service_id", "sort_order", "description", "attribute_code", "datatype_description") VALUES ('4ab3e6bd-dc72-4b73-a684-3f287185c9be', false, 'string', 'aedc05f4-e748-4f81-97ca-0b9e0aed430b', NULL, NULL, 'patente', NULL);

-- service_attribute_values: sin filas

-- knowledge_sources (8 filas)
INSERT INTO public."knowledge_sources" ("id", "title", "country_id", "is_current", "source_url", "verified_at", "snapshot_path", "subdivision_id", "document_number", "last_amended_by", "source_type_code", "issuing_authority", "requires_adhesion", "state_province_id", "document_type_code") VALUES ('10000000-0000-4000-8000-000000000001', 'Constitución de la Provincia de Buenos Aires', NULL, true, 'https://www.infoleg.gob.ar/?page_id=173', '2026-09-06T00:00:00+00:00', NULL, NULL, NULL, NULL, 'corpus_legal', 'Provincia de Buenos Aires', false, '7ef901f3-2992-44be-b6a4-445479672e97', 'constitucion');
INSERT INTO public."knowledge_sources" ("id", "title", "country_id", "is_current", "source_url", "verified_at", "snapshot_path", "subdivision_id", "document_number", "last_amended_by", "source_type_code", "issuing_authority", "requires_adhesion", "state_province_id", "document_type_code") VALUES ('10000000-0000-4000-8000-000000000002', 'Ley Orgánica de las Municipalidades', NULL, true, 'https://normas.gba.gob.ar/documentos/OVG48SW0.html', '2026-09-06T00:00:00+00:00', NULL, NULL, '6769/58', NULL, 'corpus_legal', 'Provincia de Buenos Aires', false, '7ef901f3-2992-44be-b6a4-445479672e97', 'decreto_ley');
INSERT INTO public."knowledge_sources" ("id", "title", "country_id", "is_current", "source_url", "verified_at", "snapshot_path", "subdivision_id", "document_number", "last_amended_by", "source_type_code", "issuing_authority", "requires_adhesion", "state_province_id", "document_type_code") VALUES ('10000000-0000-4000-8000-000000000004', 'Ley de Tránsito', '53a9958a-1646-4abe-8aaa-6e5173ca8424', true, 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/818/texact.htm', '2026-09-06T00:00:00+00:00', NULL, NULL, '24.449', NULL, 'corpus_legal', 'Congreso de la Nación Argentina', true, NULL, 'ley');
INSERT INTO public."knowledge_sources" ("id", "title", "country_id", "is_current", "source_url", "verified_at", "snapshot_path", "subdivision_id", "document_number", "last_amended_by", "source_type_code", "issuing_authority", "requires_adhesion", "state_province_id", "document_type_code") VALUES ('10000000-0000-4000-8000-000000000005', 'Código de Tránsito y Transporte', NULL, true, 'https://juristeca.jusbaires.gob.ar/compilacion-normativa-juristeca/ley-2148/h-tit-7/', '2026-09-06T00:00:00+00:00', NULL, NULL, '2148', NULL, 'corpus_legal', 'Legislatura de la Ciudad Autónoma de Buenos Aires', false, 'eea2d197-f1b7-40e8-826e-b0c6233c935e', 'ley');
INSERT INTO public."knowledge_sources" ("id", "title", "country_id", "is_current", "source_url", "verified_at", "snapshot_path", "subdivision_id", "document_number", "last_amended_by", "source_type_code", "issuing_authority", "requires_adhesion", "state_province_id", "document_type_code") VALUES ('10000000-0000-4000-8000-000000000006', 'Régimen de Faltas', NULL, true, 'https://boletinoficial.buenosaires.gob.ar/normativaba/norma/391197', '2026-09-07T00:00:00+00:00', NULL, NULL, '451', 'Ley N° 5905/17', 'corpus_legal', 'Legislatura de la Ciudad Autónoma de Buenos Aires', false, 'eea2d197-f1b7-40e8-826e-b0c6233c935e', 'ley');
INSERT INTO public."knowledge_sources" ("id", "title", "country_id", "is_current", "source_url", "verified_at", "snapshot_path", "subdivision_id", "document_number", "last_amended_by", "source_type_code", "issuing_authority", "requires_adhesion", "state_province_id", "document_type_code") VALUES ('10000000-0000-4000-8000-000000000007', 'Código de Faltas de la Provincia de Buenos Aires', NULL, true, 'https://normas.gba.gob.ar/documentos/ZBOPDhkV.html', '2026-09-06T00:00:00+00:00', NULL, NULL, '8031/73', NULL, 'corpus_legal', 'Provincia de Buenos Aires', false, '7ef901f3-2992-44be-b6a4-445479672e97', 'decreto_ley');
INSERT INTO public."knowledge_sources" ("id", "title", "country_id", "is_current", "source_url", "verified_at", "snapshot_path", "subdivision_id", "document_number", "last_amended_by", "source_type_code", "issuing_authority", "requires_adhesion", "state_province_id", "document_type_code") VALUES ('10000000-0000-4000-8000-000000000008', 'Ley 13.927 (Provincia de Buenos Aires)', NULL, true, 'https://normas.gba.gob.ar/documentos/0YqDnfd0.html', '2026-09-13T00:00:00+00:00', NULL, NULL, '13.927', NULL, 'corpus_legal', 'Legislatura de la Provincia de Buenos Aires', false, '7ef901f3-2992-44be-b6a4-445479672e97', 'ley');
INSERT INTO public."knowledge_sources" ("id", "title", "country_id", "is_current", "source_url", "verified_at", "snapshot_path", "subdivision_id", "document_number", "last_amended_by", "source_type_code", "issuing_authority", "requires_adhesion", "state_province_id", "document_type_code") VALUES ('10000000-0000-4000-8000-000000000003', 'Ente Único Regulador de los Servicios Públicos', NULL, true, 'https://boletinoficial.buenosaires.gob.ar/normativaba/norma/4623', '2026-09-07T00:00:00+00:00', 'ley/ley_210_caba_ente_regulador/2026-09-07--91f9b48cb367.md', NULL, '210', NULL, 'corpus_legal', 'Legislatura de la Ciudad Autónoma de Buenos Aires', false, 'eea2d197-f1b7-40e8-826e-b0c6233c935e', 'ley');

-- source_adhesions (1 filas)
INSERT INTO public."source_adhesions" ("source_id", "scope_note", "verified_at", "adhering_source_id") VALUES ('10000000-0000-4000-8000-000000000004', 'en cuanto no se opongan a las disposiciones de la presente', '2026-09-13T00:00:00+00:00', '10000000-0000-4000-8000-000000000008');

-- knowledge_fragments (17 filas)
INSERT INTO public."knowledge_fragments" ("id", "article", "content", "source_id", "is_current", "subsection", "hierarchy_path", "foundation_type_code", "replaces_fragment_id") VALUES ('20000000-0000-4000-8000-000000000001', '192', 'Son atribuciones inherentes al régimen municipal, las siguientes:
4. Tener a su cargo el ornato y salubridad, los establecimientos de beneficencia que no estén a cargo de sociedades particulares, asilos de inmigrantes que sostenga la Provincia, las cárceles locales de detenidos y la vialidad pública.', '10000000-0000-4000-8000-000000000001', true, '4', 'Constitución de la Provincia de Buenos Aires > Artículo 192 > inciso 4', 'obligacion', NULL);
INSERT INTO public."knowledge_fragments" ("id", "article", "content", "source_id", "is_current", "subsection", "hierarchy_path", "foundation_type_code", "replaces_fragment_id") VALUES ('20000000-0000-4000-8000-000000000002', '52', 'Corresponde al Concejo disponer la prestación de los servicios públicos de barrido, riego, limpieza, alumbrado, provisión de agua, obras sanitarias y desagües pluviales, inspecciones, registro de guías, transporte y todo otro tendiente a satisfacer necesidades colectivas de carácter local, siempre que su ejecución no se encuentre a cargo de la Provincia o de la Nación.
Tratándose de servicios que puedan tener vinculaciones con las leyes y planes provinciales, el Concejo deberá gestionar autorización ante el Poder Ejecutivo o proceder a convenir las coordinaciones necesarias.', '10000000-0000-4000-8000-000000000002', true, NULL, 'Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 52', 'obligacion', NULL);
INSERT INTO public."knowledge_fragments" ("id", "article", "content", "source_id", "is_current", "subsection", "hierarchy_path", "foundation_type_code", "replaces_fragment_id") VALUES ('20000000-0000-4000-8000-000000000003', '59', 'Constituyen obras públicas municipales:
a) Las concernientes a los establecimientos e instituciones municipales.
b) Las de ornato, salubridad, vivienda y urbanismo.
c) Las atinentes a servicios públicos de competencia municipal.
d) Las de infraestructura urbana, en especial las de pavimentación, repavimentación, cercos, veredas, saneamiento, agua corriente, iluminación, electrificación, provisión de gas y redes telefónicas.
Se considerará que las obras de infraestructura cuentan con declaración de utilidad pública, cuando estén incluidas expresamente en planes integrales de desarrollo urbano, aprobados por ordenanza.
Cuando se trate de obras que no estén incluidas en los planes aludidos precedentemente, sólo se podrá proceder a la pertinente declaración de Utilidad pública, mediante ordenanza debidamente fundada.', '10000000-0000-4000-8000-000000000002', true, NULL, 'Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 59', 'obligacion', NULL);
INSERT INTO public."knowledge_fragments" ("id", "article", "content", "source_id", "is_current", "subsection", "hierarchy_path", "foundation_type_code", "replaces_fragment_id") VALUES ('20000000-0000-4000-8000-000000000007', '48', 'Está prohibido en la vía pública:
i) La detención irregular sobre la calzada, el estacionamiento sobre la banquina y la detención en ella sin ocurrir emergencia;', '10000000-0000-4000-8000-000000000004', true, 'i', 'Ley 24.449 — Ley de Tránsito > Artículo 48 (prohibiciones) > inciso i)', 'conducta_prohibida', NULL);
INSERT INTO public."knowledge_fragments" ("id", "article", "content", "source_id", "is_current", "subsection", "hierarchy_path", "foundation_type_code", "replaces_fragment_id") VALUES ('20000000-0000-4000-8000-000000000009', '49', 'En zona urbana deben observarse las reglas siguientes:
b) No se debe estacionar ni autorizarse el mismo:
1. En todo lugar donde se pueda afectar la seguridad, visibilidad o fluidez del tránsito o se oculte la señalización;', '10000000-0000-4000-8000-000000000004', true, 'b.1', 'Ley 24.449 — Ley de Tránsito > Artículo 49 (estacionamiento) > inciso b) > 1', 'conducta_prohibida', NULL);
INSERT INTO public."knowledge_fragments" ("id", "article", "content", "source_id", "is_current", "subsection", "hierarchy_path", "foundation_type_code", "replaces_fragment_id") VALUES ('20000000-0000-4000-8000-000000000010', '49', 'En zona urbana deben observarse las reglas siguientes:
b) No se debe estacionar ni autorizarse el mismo:
3. Sobre la senda para peatones o bicicletas, aceras, rieles, sobre la calzada, y en los diez metros anteriores y posteriores a la parada del transporte de pasajeros.', '10000000-0000-4000-8000-000000000004', true, 'b.3', 'Ley 24.449 — Ley de Tránsito > Artículo 49 (estacionamiento) > inciso b) > 3', 'conducta_prohibida', NULL);
INSERT INTO public."knowledge_fragments" ("id", "article", "content", "source_id", "is_current", "subsection", "hierarchy_path", "foundation_type_code", "replaces_fragment_id") VALUES ('20000000-0000-4000-8000-000000000005', '2', 'b) Alumbrado público y señalamiento luminoso', '10000000-0000-4000-8000-000000000003', true, 'b', 'Ley 210 (CABA) — Ente Único Regulador de los Servicios Públicos > Artículo 2 (servicios comprendidos) > inciso b)', 'competencia', NULL);
INSERT INTO public."knowledge_fragments" ("id", "article", "content", "source_id", "is_current", "subsection", "hierarchy_path", "foundation_type_code", "replaces_fragment_id") VALUES ('20000000-0000-4000-8000-000000000006', '2', 'c) Higiene urbana, incluida la disposición final', '10000000-0000-4000-8000-000000000003', true, 'c', 'Ley 210 (CABA) — Ente Único Regulador de los Servicios Públicos > Artículo 2 (servicios comprendidos) > inciso c)', 'competencia', NULL);
INSERT INTO public."knowledge_fragments" ("id", "article", "content", "source_id", "is_current", "subsection", "hierarchy_path", "foundation_type_code", "replaces_fragment_id") VALUES ('20000000-0000-4000-8000-000000000004', '3', 'j) Recibir y tramitar las quejas y reclamos que efectúen los usuarios en sede administrativa tendiente a resolver el conflicto planteado con el prestador.', '10000000-0000-4000-8000-000000000003', true, 'j', 'Ley 210 (CABA) — Ente Único Regulador de los Servicios Públicos > Artículo 3 (funciones) > inciso j)', 'competencia', NULL);
INSERT INTO public."knowledge_fragments" ("id", "article", "content", "source_id", "is_current", "subsection", "hierarchy_path", "foundation_type_code", "replaces_fragment_id") VALUES ('20000000-0000-4000-8000-000000000011', '7.1.8', 'En doble fila, excepto como detención previa a la maniobra de estacionamiento.', '10000000-0000-4000-8000-000000000005', true, NULL, 'Ley 2148 (CABA) — Código de Tránsito y Transporte > Título VII > Artículo 7.1.8 (prohibiciones especiales)', 'conducta_prohibida', NULL);
INSERT INTO public."knowledge_fragments" ("id", "article", "content", "source_id", "is_current", "subsection", "hierarchy_path", "foundation_type_code", "replaces_fragment_id") VALUES ('20000000-0000-4000-8000-000000000012', '7.1.9', 'Frente a los vados o rampas para personas con discapacidad.', '10000000-0000-4000-8000-000000000005', true, NULL, 'Ley 2148 (CABA) — Código de Tránsito y Transporte > Título VII > Artículo 7.1.9 (prohibiciones generales)', 'conducta_prohibida', NULL);
INSERT INTO public."knowledge_fragments" ("id", "article", "content", "source_id", "is_current", "subsection", "hierarchy_path", "foundation_type_code", "replaces_fragment_id") VALUES ('20000000-0000-4000-8000-000000000013', '6.1.52', 'El/la conductor/a, titular o responsable de un automotor de uso particular, motovehículo, acoplado o semiacoplado que estacione o se detenga en un lugar prohibido o en forma antirreglamentaria, es sancionado/a con multa de cien (100) unidades fijas. El/la conductor/a, titular o responsable de transporte de pasajeros y/o de carga que estacione en un lugar prohibido o en forma antirreglamentaria, es sancionado/a con multa de cien (100) unidades fijas. Cuando el estacionamiento se realice en lugares reservados para servicios de emergencia, o paradas de transporte de pasajeros, entradas de vehículos, ciclovías, carriles exclusivos, corredores de Metrobus y zonas de Microcentro y Macrocentro, la multa se elevará al doble. Cuando el estacionamiento se realice en lugares reservados para vehículos de personas con discapacidad o rampas para discapacitados es sancionado/a con multa de trescientas (300) unidades fijas.', '10000000-0000-4000-8000-000000000006', true, NULL, 'Ley 451 (CABA) — Régimen de Faltas > Artículo 6.1.52 (estacionamiento o detención prohibida)', 'sancion', NULL);
INSERT INTO public."knowledge_fragments" ("id", "article", "content", "source_id", "is_current", "subsection", "hierarchy_path", "foundation_type_code", "replaces_fragment_id") VALUES ('20000000-0000-4000-8000-000000000014', '6.1.37', 'El/la conductor/a de un vehículo que cause la obstrucción de la vía transversal, ciclovías, veredas o estacionamientos reservados, es sancionado/a con multa de setenta (70) unidades fijas. Cuando la obstrucción se produzca, carriles exclusivos y/o preferenciales, METROBUS y Premetro, la multa se elevará al doble. Cuando la obstrucción se produzca en rampas para discapacitados o en lugares reservados para vehículos de personas con discapacidad es sancionado/a con multa de trescientas (300) unidades fijas.', '10000000-0000-4000-8000-000000000006', true, NULL, 'Ley 451 (CABA) — Régimen de Faltas > Artículo 6.1.37 (obstrucción de vía)', 'sancion', NULL);
INSERT INTO public."knowledge_fragments" ("id", "article", "content", "source_id", "is_current", "subsection", "hierarchy_path", "foundation_type_code", "replaces_fragment_id") VALUES ('20000000-0000-4000-8000-000000000015', NULL, 'TÍTULO I — Del Régimen Contravencional (validez, penas, imputabilidad, reincidencia, extinción)
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
TÍTULO III — Órgano de la Justicia de Faltas y del Procedimiento', '10000000-0000-4000-8000-000000000007', true, NULL, 'Decreto-Ley 8031/73 — Código de Faltas de la Provincia de Buenos Aires > Índice', NULL, NULL);
INSERT INTO public."knowledge_fragments" ("id", "article", "content", "source_id", "is_current", "subsection", "hierarchy_path", "foundation_type_code", "replaces_fragment_id") VALUES ('20000000-0000-4000-8000-000000000008', '48', 'Está prohibido en la vía pública:
t) Estorbar u obstaculizar de cualquier forma la calzada o la banquina y hacer construcciones, instalarse o realizar venta de productos en zona alguna del camino;', '10000000-0000-4000-8000-000000000004', false, 't', 'Ley 24.449 — Ley de Tránsito > Artículo 48 (prohibiciones) > inciso t) [SUPERADO — partido en dos, ver abajo]', 'conducta_prohibida', NULL);
INSERT INTO public."knowledge_fragments" ("id", "article", "content", "source_id", "is_current", "subsection", "hierarchy_path", "foundation_type_code", "replaces_fragment_id") VALUES ('20000000-0000-4000-8000-000000000016', '48', 'Está prohibido en la vía pública:
t) Estorbar u obstaculizar de cualquier forma la calzada o la banquina y hacer construcciones,', '10000000-0000-4000-8000-000000000004', true, 't.obstruccion', 'Ley 24.449 — Ley de Tránsito > Artículo 48 (prohibiciones) > inciso t) (obstrucción)', 'conducta_prohibida', '20000000-0000-4000-8000-000000000008');
INSERT INTO public."knowledge_fragments" ("id", "article", "content", "source_id", "is_current", "subsection", "hierarchy_path", "foundation_type_code", "replaces_fragment_id") VALUES ('b6717f77-c30e-4cca-985a-6346d741fe38', '48', 'Está prohibido en la vía pública:
t) instalarse o realizar venta de productos en zona alguna del camino;', '10000000-0000-4000-8000-000000000004', true, 't.venta', 'Ley 24.449 — Ley de Tránsito > Artículo 48 (prohibiciones) > inciso t) (venta de productos en el camino)', 'conducta_prohibida', '20000000-0000-4000-8000-000000000008');

-- fragment_services (16 filas)
INSERT INTO public."fragment_services" ("service_id", "fragment_id") VALUES ('64becc16-63c1-456b-b0c2-25256c32fd16', '20000000-0000-4000-8000-000000000001');
INSERT INTO public."fragment_services" ("service_id", "fragment_id") VALUES ('64becc16-63c1-456b-b0c2-25256c32fd16', '20000000-0000-4000-8000-000000000002');
INSERT INTO public."fragment_services" ("service_id", "fragment_id") VALUES ('170275b6-9d03-4aed-9179-2e11cd429c2c', '20000000-0000-4000-8000-000000000002');
INSERT INTO public."fragment_services" ("service_id", "fragment_id") VALUES ('64becc16-63c1-456b-b0c2-25256c32fd16', '20000000-0000-4000-8000-000000000003');
INSERT INTO public."fragment_services" ("service_id", "fragment_id") VALUES ('aedc05f4-e748-4f81-97ca-0b9e0aed430b', '20000000-0000-4000-8000-000000000007');
INSERT INTO public."fragment_services" ("service_id", "fragment_id") VALUES ('aedc05f4-e748-4f81-97ca-0b9e0aed430b', '20000000-0000-4000-8000-000000000008');
INSERT INTO public."fragment_services" ("service_id", "fragment_id") VALUES ('aedc05f4-e748-4f81-97ca-0b9e0aed430b', '20000000-0000-4000-8000-000000000009');
INSERT INTO public."fragment_services" ("service_id", "fragment_id") VALUES ('aedc05f4-e748-4f81-97ca-0b9e0aed430b', '20000000-0000-4000-8000-000000000010');
INSERT INTO public."fragment_services" ("service_id", "fragment_id") VALUES ('aedc05f4-e748-4f81-97ca-0b9e0aed430b', '20000000-0000-4000-8000-000000000011');
INSERT INTO public."fragment_services" ("service_id", "fragment_id") VALUES ('aedc05f4-e748-4f81-97ca-0b9e0aed430b', '20000000-0000-4000-8000-000000000012');
INSERT INTO public."fragment_services" ("service_id", "fragment_id") VALUES ('aedc05f4-e748-4f81-97ca-0b9e0aed430b', '20000000-0000-4000-8000-000000000013');
INSERT INTO public."fragment_services" ("service_id", "fragment_id") VALUES ('aedc05f4-e748-4f81-97ca-0b9e0aed430b', '20000000-0000-4000-8000-000000000014');
INSERT INTO public."fragment_services" ("service_id", "fragment_id") VALUES ('aedc05f4-e748-4f81-97ca-0b9e0aed430b', '20000000-0000-4000-8000-000000000016');
INSERT INTO public."fragment_services" ("service_id", "fragment_id") VALUES ('64becc16-63c1-456b-b0c2-25256c32fd16', '20000000-0000-4000-8000-000000000005');
INSERT INTO public."fragment_services" ("service_id", "fragment_id") VALUES ('170275b6-9d03-4aed-9179-2e11cd429c2c', '20000000-0000-4000-8000-000000000006');
INSERT INTO public."fragment_services" ("service_id", "fragment_id") VALUES ('64becc16-63c1-456b-b0c2-25256c32fd16', '20000000-0000-4000-8000-000000000004');
