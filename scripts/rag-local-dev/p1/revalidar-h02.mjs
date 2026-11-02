// REP-3857 / REP-3879 H-02 · Revalida las MISMAS respuestas de una corrida P1 con la lista nueva de Hernán, sin llamar a la IA.
// Para cada cita guardada en el JSON compara la regla de `0fe39bd` (la medida el 23/10) con la regla actual del repo, contra
// el texto del fragmento leído de staging. Antes verifica que el corpus sea el de la corrida (misma huella). Solo lectura.
//
// Uso: node scripts/rag-local-dev/p1/revalidar-h02.mjs <corrida.json> [más corridas…] [--env ruta/.env] [--salida informe.json]
//      node scripts/rag-local-dev/p1/revalidar-h02.mjs <corrida.json> … --fragmentos fragmentos_vigentes.json
//
// REP-3878 O-05: con --fragmentos no se lee la base ni se pide ninguna clave. El archivo es el export de solo lectura de QA:
//   select id, content, created_at, is_current from knowledge_fragments where is_current = true order by id
// Su huella se calcula igual que en las corridas; si no coincide con la de cada corrida, el script corta.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { leerEnv, crearRest, leerCorpus } from '../p0/entorno.mjs';
import { huellaCorpus } from '../p0/esquema.mjs';
import { quoteMatchesFragment as reglaNueva } from '../rep-diag-generacion/lib.mjs';

const COMMIT_ANTERIOR = '0fe39bd';
const root = path.resolve(new URL('../../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const args = process.argv.slice(2);
const valor = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const corridas = args.filter((a, i) => !a.startsWith('--') && !['--env', '--salida', '--fragmentos'].includes(args[i - 1]));
if (corridas.length === 0) throw new Error('Falta al menos un JSON de corrida (ver el uso en la cabecera).');

// La regla anterior sale del propio git: así nadie depende de una copia a mano.
const cargarReglaAnterior = async () => {
  const fuente = execSync(`git show ${COMMIT_ANTERIOR}:scripts/rag-local-dev/rep-diag-generacion/lib.mjs`, { cwd: root }).toString();
  const archivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rep3857-')), 'lib-anterior.mjs');
  fs.writeFileSync(archivo, fuente);
  return (await import(pathToFileURL(archivo).href)).quoteMatchesFragment;
};

const leerExport = (archivo) => {
  const datos = JSON.parse(fs.readFileSync(archivo, 'utf-8'));
  const fragments = Array.isArray(datos) ? datos : datos.fragments ?? datos.fragmentos;
  if (!Array.isArray(fragments) || fragments.some((f) => !f.id || typeof f.content !== 'string')) {
    throw new Error(`${path.basename(archivo)}: se esperaba una lista de fragmentos con id y content`);
  }
  return { fragments, huella: huellaCorpus(fragments) };
};
const leerDeStaging = async () => {
  const { need } = leerEnv(valor('--env') ? path.resolve(valor('--env')) : path.join(root, '.env'));
  return leerCorpus(crearRest(need('VITE_SUPABASE_URL').replace(/\/$/, ''), need('SUPABASE_SERVICE_ROLE_KEY')));
};
const { fragments, huella } = valor('--fragmentos') ? leerExport(path.resolve(valor('--fragmentos'))) : await leerDeStaging();
const textoPorId = new Map(fragments.map((f) => [f.id, f.content ?? '']));
const reglaAnterior = await cargarReglaAnterior();

const informe = { esquema: 'rep3857-revalidacion-h02/v1', regla_anterior: COMMIT_ANTERIOR, regla_nueva: execSync('git rev-parse HEAD', { cwd: root }).toString().trim(), corpus: huella, fuente_corpus: valor('--fragmentos') ? path.basename(valor('--fragmentos')) : 'staging', corridas: [] };

for (const archivo of corridas) {
  const corrida = JSON.parse(fs.readFileSync(archivo, 'utf-8'));
  const huellaCorrida = corrida.motor?.corpus?.sha256 ?? null;
  // Si el corpus cambió, las respuestas ya no son comparables: se corta en vez de informar un resultado engañoso.
  if (huellaCorrida && huellaCorrida !== huella.sha256) throw new Error(`${path.basename(archivo)}: corpus distinto (${huellaCorrida.slice(0, 8)} ≠ ${huella.sha256.slice(0, 8)})`);

  const resumen = { archivo: path.basename(archivo), huella_corpus_corrida: huellaCorrida, filas: 0, citas: 0, citas_con_elision: 0, sin_fragmento: 0, cambian: [], elididas: [] };
  for (const fila of corrida.resultados ?? []) {
    resumen.filas += 1;
    for (const cita of fila.citas ?? []) {
      resumen.citas += 1;
      const texto = textoPorId.get(cita.fragment_id);
      if (texto === undefined) {
        resumen.sin_fragmento += 1;
        continue;
      }
      const antes = reglaAnterior(cita.cita_textual, texto);
      const ahora = reglaNueva(cita.cita_textual, texto);
      const id = `${fila.caso_id} r${fila.repeticion}`;
      if (cita.con_elision) {
        resumen.citas_con_elision += 1;
        resumen.elididas.push({ fila: id, fragment_id: cita.fragment_id, articulo: cita.articulo, cita_textual: cita.cita_textual, regla_anterior: antes, regla_nueva: ahora });
      }
      if (antes !== ahora) resumen.cambian.push({ fila: id, fragment_id: cita.fragment_id, articulo: cita.articulo, cita_textual: cita.cita_textual, regla_anterior: antes, regla_nueva: ahora });
    }
  }
  informe.corridas.push(resumen);
  console.log(`${resumen.archivo}: ${resumen.filas} filas, ${resumen.citas} citas (${resumen.citas_con_elision} con elisión), ${resumen.sin_fragmento} sin fragmento vigente, ${resumen.cambian.length} cambian de resultado`);
  for (const c of resumen.cambian) console.log(`  · ${c.fila} ${c.articulo ?? ''}: ${c.regla_anterior ? 'aceptada' : 'rechazada'} → ${c.regla_nueva ? 'aceptada' : 'rechazada'}`);
}

const salida = valor('--salida');
if (salida) fs.writeFileSync(salida, JSON.stringify(informe, null, 2) + '\n');
console.log(`Corpus ${huella.sha256.slice(0, 8)}… (${huella.fragmentos_vigentes} vigentes) · regla ${COMMIT_ANTERIOR} contra ${informe.regla_nueva.slice(0, 7)}${salida ? ` · informe en ${salida}` : ''}`);
