-- REP-2203: la descripción del reporte es obligatoria y breve (10 a 280 caracteres).
-- El frontend y el servicio de envío ya aplican la misma regla; este CHECK evita
-- que un cliente que se saltee la interfaz guarde texto fuera de rango.
--
-- NOT VALID: la regla rige para los INSERT/UPDATE nuevos y no revisa las filas que ya
-- existen, así ningún reporte histórico bloquea la migración. Para auditarlos después:
--   ALTER TABLE public.citizen_reports VALIDATE CONSTRAINT citizen_reports_description_length;
ALTER TABLE public.citizen_reports
  DROP CONSTRAINT IF EXISTS citizen_reports_description_length;

ALTER TABLE public.citizen_reports
  ADD CONSTRAINT citizen_reports_description_length
  CHECK (char_length(btrim(description)) BETWEEN 10 AND 280) NOT VALID;
