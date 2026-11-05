// REP-3863 · Foto del catálogo de fragmentos y de los pares (fragmento, categoría) de staging, SOLO LECTURA.
// Mismo formato que catalogo_fragmentos_2026-10-20.csv (REP-3859): BOM, CRLF, mismas 16 columnas.
// Uso (desde la raíz de reportalo.mvp, con .env de staging):
//   node scripts/rep3863/foto_catalogo.mjs <catalogo_viejo.csv> <carpeta_salida> <fecha>
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

for (const l of fs.readFileSync('.env', 'utf-8').split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const [rutaVieja, salida, fecha] = process.argv.slice(2);
const db = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const todo = async (tabla, cols) => {
  const { data, error } = await db.from(tabla).select(cols).range(0, 9999);
  if (error) throw error;
  return data;
};
const [frs, srcs, sps, sds, cts, fss, svs] = await Promise.all([
  todo('knowledge_fragments', 'id, source_id, hierarchy_path, article, subsection, foundation_type_code, is_current, replaces_fragment_id, created_at'),
  todo('knowledge_sources', 'id, title, document_type_code, document_number, source_url, is_current, country_id, state_province_id, subdivision_id'),
  todo('states_provinces', 'id, name'),
  todo('subdivisions', 'id, name, state_province_id'),
  todo('countries', 'id, name'),
  todo('fragment_services', 'fragment_id, service_id'),
  todo('services', 'id, service_code'),
]);
const por = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
const S = por(srcs), SP = por(sps), SD = por(sds), C = por(cts), SV = por(svs);
const ts = (t) => (t ? t.replace('T', ' ').replace(/\+00:00$/, '+00') : '');
const ambito = (s) => {
  if (s.subdivision_id) { const d = SD[s.subdivision_id]; return [`${d.name} (${SP[d.state_province_id].name})`, 'municipal']; }
  if (s.state_province_id) return [SP[s.state_province_id].name, 'provincial'];
  return [s.country_id ? C[s.country_id].name : '', 'nacional'];
};
const q = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const COLS = ['fragment_id','source_id','fuente','tipo_documento','numero','hierarchy_path','articulo','inciso','tipo_fundamento','jurisdiccion','nivel','is_current','reemplaza_a','fuente_vigente','source_url','creado'];
const fila = (f) => {
  const s = S[f.source_id]; const [jur, nivel] = ambito(s);
  return [f.id, f.source_id, s.title, s.document_type_code, s.document_number, f.hierarchy_path, f.article, f.subsection, f.foundation_type_code, jur, nivel, f.is_current, f.replaces_fragment_id, s.is_current, s.source_url, ts(f.created_at)].map(q).join(',');
};
// Orden: el de la foto vieja para los fragmentos que ya estaban; los nuevos al final, por fecha de carga.
const vieja = fs.readFileSync(rutaVieja, 'utf8').replace(/^\uFEFF/, '').split(/\r\n/).filter(Boolean);
const ordenViejo = vieja.slice(1).map((l) => l.slice(0, 36));
const F = por(frs);
const nuevos = frs.filter((f) => !ordenViejo.includes(f.id)).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
const faltan = ordenViejo.filter((id) => !F[id]);
if (faltan.length) throw new Error(`Fragmentos de la foto vieja que ya no están: ${faltan}`);
const lineas = [COLS.join(','), ...ordenViejo.map((id) => fila(F[id])), ...nuevos.map(fila)];
const csv = '\uFEFF' + lineas.join('\r\n') + '\r\n';
fs.mkdirSync(salida, { recursive: true });
fs.writeFileSync(path.join(salida, `catalogo_fragmentos_${fecha}.csv`), csv);
// Comparación fila por fila con la foto vieja
const distintas = vieja.slice(1).map((l, i) => [l, lineas[i + 1]]).filter(([a, b]) => a !== b);
const pares = [...new Set(fss.map((x) => `${x.fragment_id}|${SV[x.service_id].service_code}`))].sort();
fs.writeFileSync(path.join(salida, `pares_fragment_services_${fecha}.json`), JSON.stringify({ fuente: `fragment_services de staging (yryuhyiujyignkdhiyua), solo lectura, ${fecha}`, filas: pares.length, pares }, null, 1) + '\n');
console.log(JSON.stringify({ fragmentos: frs.length, vigentes: frs.filter((f) => f.is_current).length, fuentes: new Set(frs.map((f) => f.source_id)).size, filas_viejas_distintas: distintas.length, nuevos: nuevos.map((f) => f.id), pares: pares.length }, null, 1));
for (const [a, b] of distintas.slice(0, 5)) console.log('VIEJA: ' + a + '\nNUEVA: ' + b);
