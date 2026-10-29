-- =====================================================================================================================
-- REP-3843 · Dirección aproximada buscada desde la base (opción A de la propuesta técnica §8, decisión de Matías 29/10)
--
-- Nominatim responde 403 a las Edge Functions de Supabase y 200 a la base (pg_net, verificado el 25/10 y el 29/10). Por
-- eso la dirección se busca al guardar el reporte, desde la base:
--   1. address_source suma 'geocodificada' (la puso Reportalo, no el vecino).
--   2. report_geocoding: cola con un renglón por reporte. RLS activa y sin acceso para la app.
--   3. Al insertar un reporte sin calle y con coordenadas, entra a la cola.
--   4. dispatch_report_geocoding(), cada 10 segundos (pg_cron):
--      a) lee las respuestas que ya llegaron a net._http_response y guarda calle, altura y tipo de vía, solo si el
--         reporte sigue sin calle (nunca pisa lo que cargó el vecino);
--      b) manda **un** pedido nuevo por vuelta: la política de uso de Nominatim pide como mucho 1 por segundo y un
--         User-Agent que identifique a la app. Hasta 3 intentos por reporte.
--   5. parse_nominatim_address(): la misma conversión que el proxy (supabase/functions/geocodificar-direccion/geocode.ts):
--      calle de «road», altura solo si es un número de puerta, y avenida si el nombre empieza con Avenida/Avda./Av.
--
-- Privacidad: a Nominatim (OSMF) le llegan solo las coordenadas del reporte, desde la IP de Supabase. Nunca la IP ni
-- datos del vecino.
-- No hay sugerencia antes de enviar: el vecino puede seguir cargando la dirección a mano en el modal.
--
-- Reversión: `select cron.unschedule('report-geocoding-dispatch');`, borrar el trigger trg_enqueue_report_geocoding, las
-- funciones dispatch_report_geocoding, enqueue_report_geocoding y parse_nominatim_address, la tabla report_geocoding, y
-- volver la regla citizen_reports_address_check a ('sugerida', 'corregida') después de limpiar los 'geocodificada'.
-- =====================================================================================================================

-- 1. Origen «geocodificada» ----------------------------------------------------------------------------------------
alter table public.citizen_reports drop constraint if exists citizen_reports_address_check;
alter table public.citizen_reports add constraint citizen_reports_address_check check (
  (address_street is null or char_length(btrim(address_street)) between 1 and 120)
  and (address_number is null or address_number ~ '^\d{1,5}[A-Za-z]?$')       -- solo número de puerta
  and (address_road_type is null or address_road_type in ('avenida', 'secundaria'))
  and (address_source is null or address_source in ('sugerida', 'corregida', 'geocodificada'))
  and (address_street is not null or (address_number is null and address_road_type is null))  -- sin calle no hay altura
);

comment on column public.citizen_reports.address_source is
  'REP-3843: sugerida (proxy), corregida (la escribió el vecino) o geocodificada (la buscó la base al guardar).';

-- 2. Cola -------------------------------------------------------------------------------------------------------------
create table if not exists public.report_geocoding (
  report_id  uuid primary key references public.citizen_reports (id) on delete cascade,
  status     text not null default 'pendiente'
             check (status in ('pendiente', 'enviada', 'hecha', 'sin_calle', 'omitida', 'error')),
  request_id bigint,
  attempts   integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.report_geocoding is
  'REP-3843: cola de geocodificación inversa (Nominatim desde pg_net). Solo la usa dispatch_report_geocoding().';

create index if not exists report_geocoding_status_idx on public.report_geocoding (status, created_at);

alter table public.report_geocoding enable row level security;
revoke all on public.report_geocoding from public, anon, authenticated;

-- 3. Respuesta de Nominatim → dirección -------------------------------------------------------------------------------
create or replace function public.parse_nominatim_address(p_body jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_street text := nullif(btrim(coalesce(p_body -> 'address' ->> 'road', '')), '');
  v_number text := btrim(coalesce(p_body -> 'address' ->> 'house_number', ''));
begin
  -- Sin calle no hay dirección; tampoco si no entra en la regla de la tabla
  if v_street is null or char_length(v_street) > 120 then
    return null;
  end if;
  -- Solo un número de puerta (con letra opcional, como 745B); rangos o «s/n» no se toman
  if v_number !~ '^\d{1,5}[A-Za-z]?$' then
    v_number := null;
  end if;
  return jsonb_build_object(
    'street',    v_street,
    'number',    v_number,
    'road_type', case when v_street ~* '^(avenida|avda\.?|av\.?)(\s|$)' then 'avenida' else 'secundaria' end);
end;
$$;

revoke execute on function public.parse_nominatim_address(jsonb) from public, anon, authenticated;

-- 4. Al guardar el reporte, entra a la cola ------------------------------------------------------------------------
create or replace function public.enqueue_report_geocoding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.address_street is null and new.latitud is not null and new.longitud is not null then
    insert into public.report_geocoding (report_id) values (new.id)
    on conflict (report_id) do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function public.enqueue_report_geocoding() from public, anon, authenticated;

drop trigger if exists trg_enqueue_report_geocoding on public.citizen_reports;
create trigger trg_enqueue_report_geocoding
  after insert on public.citizen_reports
  for each row execute function public.enqueue_report_geocoding();

-- 5. Despacho: respuestas que llegaron + un pedido nuevo --------------------------------------------------------------
create or replace function public.dispatch_report_geocoding()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job    public.report_geocoding%rowtype;
  v_resp   record;
  v_addr   jsonb;
  v_report public.citizen_reports%rowtype;
  v_req    bigint;
begin
  -- a) Respuestas que ya llegaron
  for v_job in
    select * from public.report_geocoding where status = 'enviada' for update skip locked
  loop
    select r.status_code, r.timed_out, r.error_msg, r.content
      into v_resp
      from net._http_response r
     where r.id = v_job.request_id;

    if not found then
      -- Sin respuesta después de 2 minutos: se reintenta (o se da por perdida)
      if v_job.updated_at < now() - interval '2 minutes' then
        update public.report_geocoding
           set status = case when attempts >= 3 then 'error' else 'pendiente' end,
               last_error = 'sin respuesta', updated_at = now()
         where report_id = v_job.report_id;
      end if;
      continue;
    end if;

    if v_resp.status_code = 200 and not coalesce(v_resp.timed_out, false) then
      begin
        v_addr := public.parse_nominatim_address(v_resp.content::jsonb);
      exception when others then
        v_addr := null;
      end;

      if v_addr is null then
        update public.report_geocoding set status = 'sin_calle', updated_at = now() where report_id = v_job.report_id;
      else
        -- Nunca pisa lo que cargó el vecino mientras tanto
        update public.citizen_reports r
           set address_street    = v_addr ->> 'street',
               address_number    = v_addr ->> 'number',
               address_road_type = v_addr ->> 'road_type',
               address_source    = 'geocodificada'
         where r.id = v_job.report_id
           and r.address_street is null;
        update public.report_geocoding set status = 'hecha', updated_at = now() where report_id = v_job.report_id;
      end if;
    else
      update public.report_geocoding
         set status = case when attempts >= 3 then 'error' else 'pendiente' end,
             last_error = coalesce(v_resp.error_msg, 'HTTP ' || v_resp.status_code), updated_at = now()
       where report_id = v_job.report_id;
    end if;
  end loop;

  -- b) Un pedido nuevo por vuelta (Nominatim: como mucho 1 por segundo)
  select g.* into v_job
    from public.report_geocoding g
   where g.status = 'pendiente'
   order by g.created_at
   limit 1
   for update skip locked;
  if not found then
    return;
  end if;

  select * into v_report from public.citizen_reports where id = v_job.report_id;
  if not found or v_report.address_street is not null or v_report.latitud is null or v_report.longitud is null then
    update public.report_geocoding set status = 'omitida', updated_at = now() where report_id = v_job.report_id;
    return;
  end if;

  v_req := net.http_get(
    url := format('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=%s&lon=%s&zoom=18&addressdetails=1&accept-language=es',
                  v_report.latitud, v_report.longitud),
    headers := jsonb_build_object('User-Agent', 'Reportalo/1.0 (+https://reportalo-staging.vercel.app; info@reportalo.com.ar)'),
    timeout_milliseconds := 5000);

  update public.report_geocoding
     set status = 'enviada', request_id = v_req, attempts = attempts + 1, updated_at = now()
   where report_id = v_job.report_id;
end;
$$;

revoke execute on function public.dispatch_report_geocoding() from public, anon, authenticated;

-- 6. Cada 10 segundos ----------------------------------------------------------------------------------------------
select cron.schedule(
  'report-geocoding-dispatch',
  '10 seconds',
  $cron$select public.dispatch_report_geocoding();$cron$
);
