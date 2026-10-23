// REP-3863 · P4 · Genera la propuesta de migración con los DATOS adentro, desde el dataset del PO (sin red, sin base).
//
// Entradas (todas versionadas salvo el catálogo, que se valida por huella):
//   scripts/rep3863/dataset/{prestaciones,vocabulario,vinculos_norma}.csv   dataset del puente (PD-07, REP-3858)
//   supabase/catalogo/rep2800_carga_catalogo_destinos.sql                   las 37 prestaciones actuales (c_prest)
//   scripts/rep3863/dataset/pares_fragment_services_2026-10-23.json         pares (fragmento, categoría) de staging
//   <catálogo>  catalogo_fragmentos_2026-10-20.csv (adjunto de REP-3859; no se versiona, se controla su SHA-256)
// Salidas:
//   docs/rag/REP-3863_propuesta_migracion_P4.sql   migración completa (esquema + datos + controles + rollback)
//   docs/rag/REP-3863_c_prest_nuevas.sql           las 70 filas nuevas para c_prest del loader de REP-2800
//
// Uso: node scripts/rep3863/generar_carga_p4.mjs <ruta a catalogo_fragmentos_2026-10-20.csv>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATASET = path.join(ROOT, 'scripts/rep3863/dataset');
const CATALOGO_SHA256 = '3602a43446c4544e7cb6b32b8d9298e99fd238497d348fbac837fd1ad7ae6cb7';

const rutaCatalogo = process.argv[2];
if (!rutaCatalogo) throw new Error('Uso: node scripts/rep3863/generar_carga_p4.mjs <catalogo_fragmentos_2026-10-20.csv>');
const shaCatalogo = crypto.createHash('sha256').update(fs.readFileSync(rutaCatalogo)).digest('hex');
if (shaCatalogo !== CATALOGO_SHA256) throw new Error(`El catálogo no es el de REP-3859 (SHA-256 ${shaCatalogo})`);

// ---------------------------------------------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------------------------------------------
const csv = (p) => {
  const t = fs.readFileSync(p, 'utf8').replace(/^﻿/, '');
  const rows = [];
  let r = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { r.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      r.push(f); f = '';
      if (r.some((x) => x)) rows.push(r);
      r = [];
    } else f += c;
  }
  if (f || r.length) { r.push(f); rows.push(r); }
  const [h, ...b] = rows;
  return b.map((x) => Object.fromEntries(h.map((k, i) => [k, x[i] ?? ''])));
};

const prestaciones = csv(path.join(DATASET, 'prestaciones.csv'));
const vocabulario = csv(path.join(DATASET, 'vocabulario.csv'));
const vinculos = csv(path.join(DATASET, 'vinculos_norma.csv'));
const catalogo = csv(rutaCatalogo).filter((f) => f.is_current === 'true');
const pares = new Set(JSON.parse(fs.readFileSync(path.join(DATASET, 'pares_fragment_services_2026-10-23.json'), 'utf8')).pares);

const loader = fs.readFileSync(path.join(ROOT, 'supabase/catalogo/rep2800_carga_catalogo_destinos.sql'), 'utf8');
const bloqueCPrest = loader.slice(loader.indexOf('insert into c_prest values'), loader.indexOf(';', loader.indexOf('insert into c_prest values')));
const actuales = [...bloqueCPrest.matchAll(/\('(\w+)',\s*'(\w+)',\s*'(\w+)',\s*'((?:[^']|'')*)'\)/g)].map((m) => ({
  grupo: m[1], servicio: m[2], clave: m[3], nombre: m[4].replace(/''/g, "'"),
}));
if (actuales.length !== 37) throw new Error(`Se esperaban 37 prestaciones en c_prest y hay ${actuales.length}`);

// ---------------------------------------------------------------------------------------------------------------
// 1. Prestaciones: 107 del dataset ↔ 37 actuales (34 por nombre + 3 equivalencias) + 70 nuevas
// ---------------------------------------------------------------------------------------------------------------
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
// Las 3 que la base ya tiene con otro nombre (REP-3863 §3). Se conserva la clave de la base: routing y REP-3841.
const EQUIVALENCIAS = {
  'Higienización, desratización, saneamiento de terreno baldío o casa abandonada': 'terreno_baldio_higienizacion',
  'Establecimiento sin autorización para funcionar sin venta o elaboración de alimentos': 'local_sin_habilitacion',
  'Niñas, niños o adolescentes en situación de calle o riesgo': 'situacion_de_calle_ninez',
};
const slug = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60).replace(/_$/, '');

const usadas = new Set(actuales.map((a) => a.clave));
const prestacionGrupo = prestaciones.map((p) => {
  const porNombre = actuales.find((a) => a.servicio === p.categoria_reportalo && norm(a.nombre) === norm(p.prestacion_oficial));
  const clave = EQUIVALENCIAS[p.prestacion_oficial] ?? porNombre?.clave ?? null;
  if (clave) return { ...p, clave, nueva: false, como: EQUIVALENCIAS[p.prestacion_oficial] ? 'equivalencia' : 'nombre' };
  let k = slug(p.prestacion_oficial);
  for (let n = 2; usadas.has(k); n++) k = `${slug(p.prestacion_oficial).slice(0, 57)}_${n}`;
  usadas.add(k);
  return { ...p, clave: k, nueva: true, como: 'nueva' };
});
const cuenta = (como) => prestacionGrupo.filter((p) => p.como === como).length;
const sinUsar = actuales.filter((a) => !prestacionGrupo.some((p) => p.clave === a.clave));
if (prestacionGrupo.length !== 107 || cuenta('nombre') !== 34 || cuenta('equivalencia') !== 3 || cuenta('nueva') !== 70 || sinUsar.length) {
  throw new Error(`Prestaciones: ${prestacionGrupo.length} (nombre ${cuenta('nombre')}, equivalencia ${cuenta('equivalencia')}, nuevas ${cuenta('nueva')}); sin usar: ${sinUsar.map((a) => a.clave)}`);
}

// ---------------------------------------------------------------------------------------------------------------
// 2. Vocabulario: 176 términos, cada uno con una prestación del dataset
// ---------------------------------------------------------------------------------------------------------------
const porNombreOficial = new Map(prestacionGrupo.map((p) => [p.prestacion_oficial, p]));
const terminos = vocabulario.map((t) => {
  const p = porNombreOficial.get(t.prestacion_oficial);
  if (!p) throw new Error(`Vocabulario: «${t.termino}» apunta a «${t.prestacion_oficial}», que no está en prestaciones.csv`);
  return { termino: t.termino, servicio: p.categoria_reportalo, clave: p.clave, origen: t.origen };
});
if (terminos.length !== 176) throw new Error(`Se esperaban 176 términos y hay ${terminos.length}`);

// ---------------------------------------------------------------------------------------------------------------
// 3. Vínculos: norma del CSV → fragmentos vigentes del catálogo, respetando artículo E inciso
// ---------------------------------------------------------------------------------------------------------------
const GRUPO_CAT = {
  ALUMBRADO: 'INFRAESTRUCTURA', CALLES: 'INFRAESTRUCTURA', VEREDAS: 'INFRAESTRUCTURA', PLUVIALES: 'INFRAESTRUCTURA',
  SEMAFOROS_SENALES: 'INFRAESTRUCTURA', TRANSITO_ESTACIONAMIENTO: 'TRANSITO', HIGIENE_RESIDUOS: 'AMBIENTE',
  CONTAMINACION: 'AMBIENTE', ESPACIO_PUBLICO_COMERCIO: 'COMERCIO_IRREGULAR', LOCAL_SIN_HABILITACION: 'COMERCIO_IRREGULAR',
  SITUACION_DE_CALLE: 'VULNERABILIDAD_SOCIAL', NINEZ: 'VULNERABILIDAD_SOCIAL',
};
const numero = (s) => String(s).replace(/\./g, '').replace(/\/\d+$/, '');
const lista = (s) => s.split(/\s*(?:,|\by\b)\s*/).map((x) => x.trim().replace(/\)$/, '')).filter(Boolean);
const leerNorma = (n) => {
  let ley = null;
  if (/^LOM \(DL 6769\/58\)/.test(n)) ley = '6769';
  else if (/Constitución PBA/.test(n)) ley = 'CONST_PBA';
  else { const x = n.match(/(?:Ley|DL|Ordenanza Fiscal)\s*([\d.]+(?:\/\d+)?)/i); if (x) ley = numero(x[1]); }
  const a = n.match(/(?:arts?\.|Secc\.)\s*([\d.]+(?:\s+bis)?(?:\s*y\s*[\d.]+)?)/i);
  const i = n.match(/incs?\.\s*([a-z0-9]+\)?(?:\s*y\s*[a-z0-9]+\)?)?)/i);
  return { ley, articulos: a ? lista(a[1]).map((x) => x.replace(/\s+/g, ' ')) : [], incisos: i ? lista(i[1]) : [] };
};
// En el catálogo, «4 bis» viene como artículo 4 con inciso «bis»: es otro artículo, no un inciso
const articuloDe = (f) => (f.inciso === 'bis' ? `${f.articulo} bis` : f.articulo);
const incisoDe = (f) => (f.inciso === 'bis' ? '' : f.inciso.split('.')[0]);

const filasVinculo = [];
const excepciones = [];
for (const v of vinculos) {
  const n = leerNorma(v.norma);
  const categoria = GRUPO_CAT[v.grupo_destino];
  const deLaLey = catalogo.filter((f) => (n.ley === 'CONST_PBA' ? /constituci/i.test(f.fuente) : n.ley && numero(f.numero) === n.ley));
  const fragmentos = deLaLey.filter(
    (f) => n.articulos.includes(articuloDe(f)) && (!n.incisos.length || !incisoDe(f) || n.incisos.includes(incisoDe(f)))
  );
  const base = `${v.jurisdiccion}/${v.grupo_destino} · ${v.norma}`;
  if (!deLaLey.length) { excepciones.push({ tipo: 'fuera_del_corpus', vinculo: base }); continue; }
  if (!n.articulos.length) { excepciones.push({ tipo: 'sin_articulo', vinculo: base }); continue; }
  if (!fragmentos.length) { excepciones.push({ tipo: 'articulo_no_cargado', vinculo: base }); continue; }
  for (const f of fragmentos) {
    if (!pares.has(`${f.fragment_id}|${categoria}`)) { excepciones.push({ tipo: 'par_nuevo_P5', vinculo: `${base} → ${f.fragment_id} (${categoria})` }); continue; }
    filasVinculo.push({ fragment_id: f.fragment_id, categoria, grupo: v.grupo_destino, tipo_fundamento: v.tipo_fundamento, norma: v.norma });
  }
}
// Una fila por (fragmento, categoría, grupo): dos normas del CSV pueden caer en el mismo fragmento
const unicas = [...new Map(filasVinculo.map((f) => [`${f.fragment_id}|${f.categoria}|${f.grupo}`, f])).values()];
// Filas que se insertan en fragment_services: cada vínculo × cada prestación de su grupo y categoría
const filasEsperadas = new Set();
for (const v of unicas) {
  for (const p of prestacionGrupo.filter((p) => p.grupo_destino === v.grupo && p.categoria_reportalo === v.categoria)) {
    filasEsperadas.add(`${v.fragment_id}|${v.categoria}|${p.clave}`);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Salida SQL
// ---------------------------------------------------------------------------------------------------------------
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const valores = (filas, cols) => filas.map((f) => `  (${cols.map((c) => (f[c] === null ? 'null' : q(f[c]))).join(', ')})`).join(',\n');
const porTipo = excepciones.reduce((a, e) => ({ ...a, [e.tipo]: (a[e.tipo] ?? 0) + 1 }), {});

const cPrest = `-- REP-3863 · P4 · Las 70 prestaciones NUEVAS para c_prest del loader de REP-2800
-- (supabase/catalogo/rep2800_carga_catalogo_destinos.sql). GENERADO por scripts/rep3863/generar_carga_p4.mjs: no editar a mano.
-- Se agregan a "insert into c_prest values" del loader; el loader ya arma agency_services por grupo (c_ruta).
${valores(prestacionGrupo.filter((p) => p.nueva).map((p) => ({ g: p.grupo_destino, s: p.categoria_reportalo, k: p.clave, n: p.prestacion_oficial })), ['g', 's', 'k', 'n'])}
`;

const migracion = `-- REP-3863 · P4 · PROPUESTA de migración (NO APLICAR todavía)
-- GENERADA por scripts/rep3863/generar_carga_p4.mjs desde el dataset del PO: no editar a mano, regenerar.
-- Catálogo de fragmentos usado: catalogo_fragmentos_2026-10-20.csv (REP-3859), SHA-256 ${CATALOGO_SHA256}.
-- Pares (fragmento, categoría) de staging: scripts/rep3863/dataset/pares_fragment_services_2026-10-23.json (${pares.size}).
--
-- Está fuera de supabase/migrations a propósito. Orden al aplicar (REP-3864 pide "antes" y "después" de cada paso):
--   1. aviso a QA (foto "antes");  2. loader de REP-2800 con las 70 filas de REP-3863_c_prest_nuevas.sql;
--   3. esta migración;  4. segunda corrida de las dos (idempotencia);  5. M1 sobre P0-v1.0 (mismo top 8).
-- No cambia match_knowledge_fragments, RLS ni agency_services.
-- fragment_services y service_keywords NO están en ninguna publicación de Realtime (verificado el 23/10/2026),
-- así que quitarles la PK no afecta replicación (MIG-04).

begin;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Esquema (idempotente). PK reales (23/10/2026): fragment_services_pkey (fragment_id, service_id) y
--    service_keywords_pkey (service_id, keyword).
-- ---------------------------------------------------------------------------------------------------------------
alter table public.service_keywords
  add column if not exists attribute_value_id uuid references public.service_attribute_values(id),
  add column if not exists origin text;
alter table public.service_keywords drop constraint if exists service_keywords_origin_check;
alter table public.service_keywords add constraint service_keywords_origin_check
  check (origin is null or origin in ('suaci', 'norma', 'pruebas_s15', 'po'));
alter table public.service_keywords drop constraint if exists service_keywords_pkey;
create unique index if not exists service_keywords_uq
  on public.service_keywords (service_id, lower(keyword),
                              coalesce(attribute_value_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.fragment_services
  add column if not exists attribute_value_id uuid references public.service_attribute_values(id),
  add column if not exists tipo_fundamento text;
alter table public.fragment_services drop constraint if exists fragment_services_pkey;
create unique index if not exists fragment_services_uq
  on public.fragment_services (fragment_id, service_id,
                               coalesce(attribute_value_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists fragment_services_attribute_value_idx on public.fragment_services (attribute_value_id);

-- ---------------------------------------------------------------------------------------------------------------
-- 2. MIG-01: upsert_knowledge_fragment ya no borra los vínculos de P4.
--    Antes: "delete from fragment_services where fragment_id = …" en CADA llamada, aunque el texto no cambie, y al
--    versionar los vínculos quedaban en la versión no vigente. Ahora reescribe solo las filas de categoría
--    (attribute_value_id is null) y, si versiona, copia los vínculos de P4 a la versión nueva SOLO para las
--    categorías que el fragmento sigue teniendo: nunca crea un par (fragmento, categoría) nuevo.
--    Firma, permisos y resultado iguales a 20260920210000_rep3774.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.upsert_knowledge_fragment(
  p_source_id            uuid,
  p_hierarchy_path       text,
  p_article              text,
  p_subsection           text,
  p_content              text,
  p_foundation_type_code varchar,
  p_service_codes        text[] default '{}'
)
returns table (fragment_id uuid, action text)
language plpgsql
set search_path = public
as $fn$
declare
  v_current_id      uuid;
  v_current_content text;
  v_new_id          uuid;
  v_action          text;
begin
  select f.id, f.content into v_current_id, v_current_content
  from knowledge_fragments f
  where f.source_id  = p_source_id
    and f.article    is not distinct from p_article
    and f.subsection is not distinct from p_subsection
    and f.is_current;

  if v_current_id is not null and v_current_content = p_content then
    v_new_id := v_current_id;
    v_action := 'unchanged';
    update knowledge_fragments f
       set hierarchy_path       = p_hierarchy_path,
           foundation_type_code = coalesce(p_foundation_type_code, f.foundation_type_code)
     where f.id = v_current_id;
  else
    if v_current_id is not null then
      update knowledge_fragments set is_current = false where id = v_current_id;
      v_action := 'versioned';
    else
      v_action := 'created';
    end if;

    insert into knowledge_fragments
      (source_id, hierarchy_path, article, subsection, content,
       foundation_type_code, is_current, replaces_fragment_id)
    values
      (p_source_id, p_hierarchy_path, p_article, p_subsection, p_content,
       p_foundation_type_code, true, v_current_id)
    returning id into v_new_id;
  end if;

  -- Categorías del fragmento: se reescriben siempre, pero SOLO las filas sin prestación (REP-3863 MIG-01)
  delete from fragment_services fs where fs.fragment_id = v_new_id and fs.attribute_value_id is null;
  insert into fragment_services (fragment_id, service_id)
  select v_new_id, s.id
  from unnest(coalesce(p_service_codes, '{}')) as code
  join services s on s.service_code = code
  on conflict do nothing;

  -- Vínculos por prestación (P4): si el fragmento cambió de versión, pasan a la vigente, solo en categorías que
  -- siguen asignadas. Las de categorías quitadas quedan en la versión vieja (no vigente) y no se buscan.
  if v_action = 'versioned' then
    insert into fragment_services (fragment_id, service_id, attribute_value_id, tipo_fundamento)
    select v_new_id, old.service_id, old.attribute_value_id, old.tipo_fundamento
      from fragment_services old
     where old.fragment_id = v_current_id
       and old.attribute_value_id is not null
       and exists (select 1 from fragment_services cat
                    where cat.fragment_id = v_new_id and cat.service_id = old.service_id and cat.attribute_value_id is null)
    on conflict do nothing;
  end if;

  return query select v_new_id, v_action;
end;
$fn$;
revoke execute on function public.upsert_knowledge_fragment(uuid, text, text, text, text, varchar, text[]) from public, anon, authenticated;
grant  execute on function public.upsert_knowledge_fragment(uuid, text, text, text, text, varchar, text[]) to service_role;

-- Huella de la búsqueda ANTES de cargar: los pares distintos (fragmento, categoría)
create temporary table p4_pares_antes on commit drop as
  select distinct fragment_id, service_id from public.fragment_services;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. MIG-02: prestación ↔ grupo de destino (107). Resuelve las 3 equivalencias de nombre (§3 del informe):
--    el nombre del dataset apunta a la clave que ya tiene la base. Las 70 nuevas las crea antes el loader de REP-2800.
--    Generado: ${cuenta('nombre')} por nombre · ${cuenta('equivalencia')} por equivalencia · ${cuenta('nueva')} nuevas.
-- ---------------------------------------------------------------------------------------------------------------
create temporary table p4_prestacion_grupo (servicio text, grupo text, value_key text, nombre_oficial text, como text) on commit drop;
insert into p4_prestacion_grupo values
${valores(prestacionGrupo.map((p) => ({ s: p.categoria_reportalo, g: p.grupo_destino, k: p.clave, n: p.prestacion_oficial, c: p.como })), ['s', 'g', 'k', 'n', 'c'])};

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Vínculos norma ↔ prestación: ${unicas.length} (fragmento, categoría, grupo), todos sobre pares que YA existen.
--    Excepciones (no van a la base): ${Object.entries(porTipo).map(([k, n]) => `${k} ${n}`).join(' · ')}. Ver docs/rag/REP-3863_auditoria_y_diseno_P4.md.
-- ---------------------------------------------------------------------------------------------------------------
create temporary table p4_vinculo (fragment_id uuid, categoria text, grupo text, tipo_fundamento text, norma text) on commit drop;
insert into p4_vinculo values
${valores(unicas, ['fragment_id', 'categoria', 'grupo', 'tipo_fundamento', 'norma'])};

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Vocabulario: ${terminos.length} términos
-- ---------------------------------------------------------------------------------------------------------------
create temporary table p4_termino (termino text, servicio text, value_key text, origen text) on commit drop;
insert into p4_termino values
${valores(terminos, ['termino', 'servicio', 'clave', 'origen'])};

-- ---------------------------------------------------------------------------------------------------------------
-- 6. MIG-03: antes de cargar, todo tiene que resolver. Si algo no da, se aborta (nada se descarta en silencio).
-- ---------------------------------------------------------------------------------------------------------------
do $chk$
declare n int;
begin
  select count(*) into n from p4_prestacion_grupo pg
    join public.services s on s.service_code = pg.servicio
    join public.service_attributes sa on sa.service_id = s.id and sa.attribute_code = 'prestacion'
    join public.service_attribute_values av on av.attribute_id = sa.id and av.value_key = pg.value_key;
  if n <> 107 then raise exception 'P4: se esperaban 107 prestaciones en la base y resuelven %. ¿Corrió el loader de REP-2800 con las 70 nuevas?', n; end if;
  select count(*) into n from p4_termino t join p4_prestacion_grupo pg on pg.value_key = t.value_key;
  if n <> 176 then raise exception 'P4: se esperaban 176 términos con prestación y resuelven %', n; end if;
  select count(*) into n from p4_vinculo v
    join public.services s on s.service_code = v.categoria
    join p4_pares_antes p on p.fragment_id = v.fragment_id and p.service_id = s.id;
  if n <> ${unicas.length} then raise exception 'P4: se esperaban ${unicas.length} vínculos sobre pares existentes y hay % (¿cambió fragment_services?)', n; end if;
end $chk$;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Carga
-- ---------------------------------------------------------------------------------------------------------------
insert into public.fragment_services (fragment_id, service_id, attribute_value_id, tipo_fundamento)
select v.fragment_id, s.id, av.id, v.tipo_fundamento
  from p4_vinculo v
  join public.services s on s.service_code = v.categoria
  join p4_prestacion_grupo pg on pg.grupo = v.grupo and pg.servicio = v.categoria
  join public.service_attributes sa on sa.service_id = s.id and sa.attribute_code = 'prestacion'
  join public.service_attribute_values av on av.attribute_id = sa.id and av.value_key = pg.value_key
on conflict do nothing;

insert into public.service_keywords (service_id, keyword, attribute_value_id, origin)
select s.id, t.termino, av.id, t.origen
  from p4_termino t
  join public.services s on s.service_code = t.servicio
  join public.service_attributes sa on sa.service_id = s.id and sa.attribute_code = 'prestacion'
  join public.service_attribute_values av on av.attribute_id = sa.id and av.value_key = t.value_key
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------------------------
-- 8. Controles después de cargar (MIG-03 y búsqueda intacta). Valen también en la segunda corrida (idempotencia).
-- ---------------------------------------------------------------------------------------------------------------
do $post$
declare n int;
begin
  if exists (select distinct fragment_id, service_id from public.fragment_services
             except select fragment_id, service_id from p4_pares_antes) then
    raise exception 'P4 agregó un par (fragmento, categoría) nuevo: cambiaría match_knowledge_fragments';
  end if;
  select count(*) into n from public.fragment_services where attribute_value_id is not null;
  if n <> ${filasEsperadas.size} then raise exception 'P4: se esperaban ${filasEsperadas.size} filas de vínculo por prestación y hay %', n; end if;
  select count(*) into n from public.service_keywords where attribute_value_id is not null;
  if n <> 176 then raise exception 'P4: se esperaban 176 términos y hay %', n; end if;
end $post$;

commit;

-- ---------------------------------------------------------------------------------------------------------------
-- ROLLBACK (solo lo que cargó P4; no borra nada que use un reporte). MIG-05: controla también report_routing y
-- service_keywords antes de borrar una prestación nueva.
-- ---------------------------------------------------------------------------------------------------------------
-- begin;
-- delete from public.fragment_services where attribute_value_id is not null;
-- delete from public.service_keywords  where attribute_value_id is not null;
-- drop index if exists public.fragment_services_uq;
-- drop index if exists public.fragment_services_attribute_value_idx;
-- alter table public.fragment_services add constraint fragment_services_pkey primary key (fragment_id, service_id);
-- alter table public.fragment_services drop column if exists attribute_value_id, drop column if exists tipo_fundamento;
-- drop index if exists public.service_keywords_uq;
-- alter table public.service_keywords add constraint service_keywords_pkey primary key (service_id, keyword);
-- alter table public.service_keywords drop constraint if exists service_keywords_origin_check;
-- alter table public.service_keywords drop column if exists attribute_value_id, drop column if exists origin;
-- -- upsert_knowledge_fragment: volver a la versión de 20260920210000_rep3774 (re-ejecutar ese create or replace).
-- -- Prestaciones nuevas (las 70 de REP-3863_c_prest_nuevas.sql): solo las que ningún reporte usa.
-- --   create temporary table p4_nuevas (value_key text) on commit drop;  insert … (las 70 claves);
-- --   create temporary table p4_borrables on commit drop as
-- --     select av.id from public.service_attribute_values av join p4_nuevas n on n.value_key = av.value_key
-- --      where not exists (select 1 from public.infraction_attribute_responses r where r.selected_value = av.value_key)
-- --        and not exists (select 1 from public.report_routing rr                -- la prestación va en input/result (jsonb)
-- --                         where rr.input::text like '%"' || av.value_key || '"%' or rr.result::text like '%"' || av.value_key || '"%')
-- --        and not exists (select 1 from public.service_keywords k where k.attribute_value_id = av.id);
-- --   delete from public.agency_services where attribute_value_id in (select id from p4_borrables);
-- --   delete from public.service_attribute_values where id in (select id from p4_borrables);
-- commit;
`;

fs.writeFileSync(path.join(ROOT, 'docs/rag/REP-3863_propuesta_migracion_P4.sql'), migracion);
fs.writeFileSync(path.join(ROOT, 'docs/rag/REP-3863_c_prest_nuevas.sql'), cPrest);
console.log(JSON.stringify({
  prestaciones: { total: prestacionGrupo.length, por_nombre: cuenta('nombre'), equivalencia: cuenta('equivalencia'), nuevas: cuenta('nueva') },
  terminos: terminos.length,
  vinculos_csv: vinculos.length,
  vinculos_cargables: unicas.length,
  filas_fragment_services_p4: filasEsperadas.size,
  excepciones: porTipo,
}, null, 2));
for (const e of excepciones) console.log(` - ${e.tipo}: ${e.vinculo}`);
