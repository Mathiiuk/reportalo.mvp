// RAG P0 (REP-3859) · Entorno común de los runners en modo --p0: credenciales, Supabase de SOLO LECTURA, git, corpus.
// No escribe en la base: solo GET a la API REST y el RPC de lectura match_knowledge_fragments. No imprime claves.
import fs from 'node:fs';
import { execSync } from 'node:child_process';

import { huellaCorpus, normalizarSet } from './esquema.mjs';

/** Lee el .env (por defecto el de la raíz del repo) sin imprimir valores. */
export const leerEnv = (envPath) => {
  const env = Object.fromEntries(
    fs.readFileSync(envPath, 'utf-8')
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim()])
  );
  const need = (name) => {
    if (!env[name]) throw new Error(`Falta ${name} en el .env (no se imprime su valor).`);
    return env[name];
  };
  return { env, need };
};

/** Cliente REST de Supabase. Solo se usa con GET y con el RPC de lectura. */
export const crearRest = (supabaseUrl, serviceKey) => async (path, init = {}) => {
  const metodo = (init.method ?? 'GET').toUpperCase();
  // Defensa: el modo P0 nunca escribe. El único POST permitido es el RPC de lectura de producción.
  if (metodo !== 'GET' && path !== 'rpc/match_knowledge_fragments') throw new Error(`P0 es de solo lectura: ${metodo} ${path} no permitido`);
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      // La clave legacy service_role es un JWT y va también como Bearer; las sb_secret_... solo en apikey.
      ...(serviceKey.startsWith('eyJ') ? { Authorization: `Bearer ${serviceKey}` } : {}),
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path.split('?')[0]} falló (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
};

const git = (cmd, cwd) => {
  try {
    return execSync(`git ${cmd}`, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
};

/** Commit del repo y último commit que tocó la Edge Function (el código que se mide). */
export const infoGit = (rootPath) => ({
  head: git('rev-parse HEAD', rootPath),
  commitCodigo: git('log -1 --format=%H -- supabase/functions/analizar-reporte', rootPath),
  cambiosLocalesEnFuncion: Boolean(git('status --porcelain -- supabase/functions/analizar-reporte', rootPath)),
});

/** Fragmentos vigentes (con texto, artículo y fecha) y su huella. */
export const leerCorpus = async (rest) => {
  const fragments = await rest(
    'knowledge_fragments?select=id,hierarchy_path,article,subsection,content,created_at,is_current&is_current=eq.true'
  );
  return { fragments, huella: huellaCorpus(fragments) };
};

/** Resuelve la localidad de cada caso: por id si lo trae, si no por nombre + provincia (debe haber exactamente una). */
export const resolverLocalidades = async (rest, casos) => {
  const cache = new Map();
  for (const caso of casos) {
    if (caso.localidad_id) continue;
    const clave = `${caso.localidad}|${caso.provincia}`;
    if (!cache.has(clave)) {
      const locs = await rest(
        `localities?select=id,name,subdivisions!inner(name,states_provinces!inner(name))` +
          `&name=eq.${encodeURIComponent(caso.localidad)}&subdivisions.states_provinces.name=eq.${encodeURIComponent(caso.provincia)}`
      );
      if (locs.length !== 1) throw new Error(`Caso ${caso.caso_id}: se esperaba 1 localidad "${caso.localidad}" (${caso.provincia}) y hay ${locs.length}.`);
      cache.set(clave, locs[0].id);
    }
    caso.localidad_id = cache.get(clave);
  }
  return casos;
};

/** Ids de agencies, para replicar validateOrganismoSugerido sin consultar uno por uno. */
export const leerAgencias = async (rest) => new Set((await rest('agencies?select=id')).map((a) => a.id));

/** Lee y valida el set; corta con la lista de errores si no está completo. */
export const cargarSet = (rutaSet) => {
  const raw = JSON.parse(fs.readFileSync(rutaSet, 'utf-8'));
  const set = normalizarSet(raw);
  if (set.errores.length) {
    throw new Error(`El set ${rutaSet} no está completo:\n - ${set.errores.slice(0, 20).join('\n - ')}${set.errores.length > 20 ? `\n … y ${set.errores.length - 20} más` : ''}`);
  }
  return set;
};

/** Argumentos comunes del modo --p0. */
export const argsP0 = (args) => {
  const valor = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
  };
  const repeticiones = Number(valor('--repeticiones') ?? 3);
  if (!Number.isInteger(repeticiones) || repeticiones < 1 || repeticiones > 10) throw new Error('--repeticiones debe ser un entero entre 1 y 10');
  const rutaSet = valor('--set');
  if (!rutaSet) throw new Error('--p0 necesita --set <ruta a casos-referencia-v1.json>');
  return {
    rutaSet,
    repeticiones,
    despliegue: valor('--despliegue'),
    dryRun: args.includes('--dry-run'),
    // Una corrida sobre un set que no es el congelado se marca como prueba y no vale para la puerta P0
    prueba: args.includes('--prueba'),
  };
};

export const marcaDeTiempo = (iso) => iso.replace(/[:.]/g, '-');
