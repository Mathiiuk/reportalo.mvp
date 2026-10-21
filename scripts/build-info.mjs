#!/usr/bin/env node
// Reportalo™ · genera public/build-info.json antes de cada build.
// Uso: node scripts/build-info.mjs [carpeta-de-salida]   (por defecto: public)
// Node 18+, sin dependencias. El archivo generado NO se commitea.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = process.cwd();
const outDir = resolve(root, process.argv[2] || 'public');
const env = process.env;

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

let version = '0.0.0';
try {
  version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version || version;
} catch {
  console.warn('[build-info] No se pudo leer package.json; se usa 0.0.0');
}

// Las variables de CI van primero: en Vercel y otros CI el clon puede no traer .git
const commit =
  env.VERCEL_GIT_COMMIT_SHA || env.GITHUB_SHA || env.CI_COMMIT_SHA || git('rev-parse HEAD') || 'unknown';
const branch =
  env.VERCEL_GIT_COMMIT_REF || env.GITHUB_REF_NAME || env.CI_COMMIT_REF_NAME || git('rev-parse --abbrev-ref HEAD') || '';
const appEnv = (env.APP_ENV || env.VERCEL_ENV || env.NODE_ENV || 'development').toLowerCase();

const info = {
  app: 'Reportalo',
  version,
  commit,
  commitShort: commit === 'unknown' ? 'unknown' : commit.slice(0, 7),
  branch,
  builtAt: new Date().toISOString(),
  env: appEnv,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'build-info.json'), JSON.stringify(info, null, 2) + '\n');
console.log(`[build-info] ${info.version} · ${info.commitShort} · ${info.env} → ${join(outDir, 'build-info.json')}`);
