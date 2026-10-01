/**
 * Mide /mapa con Lighthouse y con una sonda de "reportes visibles" (REP-3803).
 *
 * Uso:
 *   node measure.mjs --dist <carpeta-dist> --profile mobile|desktop --runs 5 --label base --out <carpeta>
 *
 * Qué hace en cada corrida (perfil de navegador nuevo, caché fría):
 *   1. Levanta `vite preview` sobre la carpeta dist indicada.
 *   2. Abre Edge con un perfil vacío e inyecta una sesión SIMULADA en localStorage
 *      (ver sessionFor): solo existe para pasar la guarda de rutas del cliente. No se toca
 *      ni la autenticación ni RLS; la consulta de reportes es la pública de siempre.
 *   3. Lighthouse (solo Performance) con el emulador estándar del perfil.
 *   4. Sonda aparte con estrangulamiento REAL (CPU 4x y red 4G lenta en mobile): mide cuánto
 *      tardan en aparecer el primer pin y todos los pines.
 * Guarda un JSON por corrida y un meta.json con el entorno. No guarda la clave.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import lighthouse from 'lighthouse';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, token, i, all) => {
    if (token.startsWith('--')) acc.push([token.slice(2), all[i + 1]]);
    return acc;
  }, [])
);
const dist = path.resolve(args.dist);
const profile = args.profile ?? 'mobile';
const runs = Number(args.runs ?? 5);
const label = args.label ?? 'sin-etiqueta';
const outDir = path.resolve(args.out ?? path.join(repo, '.perf', 'results'));
const port = Number(args.port ?? 4300 + Math.floor(Math.random() * 400));
const EDGE = args.browser ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

// --- variables públicas del proyecto (no se imprimen ni se guardan) -----------------------
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(repo, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')])
);
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const PUBLIC_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];

/**
 * Sesión simulada para la guarda del cliente. El access_token es la clave PUBLICABLE: con ella
 * PostgREST atiende la lectura pública (policy lectura_publica) y responde 200. Con un token
 * inventado respondía 401 y el mapa se medía vacío.
 */
const sessionFor = () => ({
  access_token: PUBLIC_KEY,
  refresh_token: 'perf-mapa-refresh',
  token_type: 'bearer',
  expires_at: Math.floor(Date.now() / 1000) + 3600 * 6,
  expires_in: 3600 * 6,
  user: { id: '00000000-0000-0000-0000-00000000f003', email: 'perf-mapa@example.com', aud: 'authenticated', app_metadata: {}, user_metadata: {} },
});

const PROFILES = {
  mobile: {
    viewport: { width: 412, height: 823, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true },
    ua: 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36',
    cpu: 4,
    // Aproximación de "4G lenta" de Lighthouse: 150 ms de RTT, 1,6 Mbps de bajada, 0,75 Mbps de subida
    net: { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
    lh: { formFactor: 'mobile' },
  },
  desktop: {
    viewport: { width: 1350, height: 940, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
    ua: null,
    cpu: 1,
    net: null,
    lh: {
      formFactor: 'desktop',
      screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
      throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 },
      emulatedUserAgent: false,
    },
  },
}[profile];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- servidor de la compilación ---------------------------------------------------------
const startPreview = async () => {
  const proc = spawn('pnpm', ['exec', 'vite', 'preview', '--outDir', dist, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: repo, shell: true, stdio: 'ignore' });
  for (let i = 0; i < 60; i += 1) {
    try { const r = await fetch(`http://127.0.0.1:${port}/`); if (r.ok) return proc; } catch { /* aún no */ }
    await sleep(500);
  }
  proc.kill();
  throw new Error('vite preview no levantó');
};

const stopPreview = (proc) => {
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(proc.pid), '/t', '/f'], { stdio: 'ignore' });
  else proc.kill();
};

// --- una corrida -----------------------------------------------------------------------
const launch = async (n) => {
  const userDataDir = path.join(outDir, '_profiles', `${label}-${profile}-${n}-${Date.now()}`);
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir, args: ['--no-first-run', '--disable-extensions'] });
  const page = await browser.newPage();
  // Se siembra el localStorage desde un archivo estático para NO cargar la app (caché fría)
  await page.goto(`http://127.0.0.1:${port}/manifest.json`);
  await page.evaluate((key, session) => {
    localStorage.setItem(key, JSON.stringify(session));
    localStorage.setItem('reportalo_onboarding_completed', 'true');
    localStorage.setItem('reportalo_permissions_configured', 'true');
  }, `sb-${projectRef}-auth-token`, sessionFor());
  return { browser, page, userDataDir };
};

const runLighthouse = async (n) => {
  const { browser, page, userDataDir } = await launch(n);
  try {
    const flags = { port: Number(new URL(browser.wsEndpoint()).port), output: 'json', disableStorageReset: true, logLevel: 'error', onlyCategories: ['performance'] };
    const result = await lighthouse(`http://127.0.0.1:${port}/mapa`, flags, { extends: 'lighthouse:default', settings: { ...PROFILES.lh, onlyCategories: ['performance'] } });
    const lhr = result.lhr;
    // --full guarda el reporte completo (para diagnosticar dónde se va el tiempo)
    if (args.full) fs.writeFileSync(path.join(outDir, `lhr-${label}-${profile}-${n}.json`), JSON.stringify(lhr));
    const a = lhr.audits;
    const reqs = a['network-requests']?.details?.items ?? [];
    const reportsReq = reqs.filter((r) => /citizen_reports/.test(r.url));
    return {
      lighthouseVersion: lhr.lighthouseVersion,
      finalUrl: lhr.finalDisplayedUrl,
      runtimeError: lhr.runtimeError ?? null,
      performance: Math.round((lhr.categories.performance.score ?? 0) * 100),
      fcp: a['first-contentful-paint'].numericValue,
      lcp: a['largest-contentful-paint'].numericValue,
      tbt: a['total-blocking-time'].numericValue,
      cls: a['cumulative-layout-shift'].numericValue,
      speedIndex: a['speed-index'].numericValue,
      tti: a['interactive']?.numericValue ?? null,
      longTasks: (a['long-tasks']?.details?.items ?? []).map((t) => Math.round(t.duration)),
      reportsRequestStatus: reportsReq.map((r) => r.statusCode),
      anyClientError: reqs.filter((r) => r.statusCode >= 400).map((r) => `${r.statusCode} ${new URL(r.url).pathname}`),
      emulation: { formFactor: lhr.configSettings.formFactor, throttlingMethod: lhr.configSettings.throttlingMethod, throttling: lhr.configSettings.throttling, screen: lhr.configSettings.screenEmulation },
    };
  } finally {
    await browser.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
};

/** Sonda con estrangulamiento real: cuánto tardan en verse los pines. */
const runProbe = async (n) => {
  const { browser, page, userDataDir } = await launch(n);
  try {
    await page.setViewport(PROFILES.viewport);
    if (PROFILES.ua) await page.setUserAgent(PROFILES.ua);
    const cdp = await page.createCDPSession();
    await cdp.send('Network.enable');
    await cdp.send('Network.clearBrowserCache');
    if (PROFILES.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: PROFILES.cpu });
    if (PROFILES.net) await cdp.send('Network.emulateNetworkConditions', PROFILES.net);
    const statuses = [];
    page.on('response', (r) => { if (/citizen_reports/.test(r.url())) statuses.push(r.status()); });
    await page.evaluateOnNewDocument(() => {
      window.__perf = { first: null, last: null, count: 0 };
      const sel = '[data-testid^="marker-"]';
      const tick = () => {
        const c = document.querySelectorAll(sel).length;
        if (c !== window.__perf.count) {
          window.__perf.count = c;
          window.__perf.last = performance.now();
          if (window.__perf.first === null && c > 0) window.__perf.first = performance.now();
        }
      };
      new MutationObserver(tick).observe(document, { childList: true, subtree: true });
    });
    await page.goto(`http://127.0.0.1:${port}/mapa`, { waitUntil: 'domcontentloaded' });
    // Espera a que aparezcan pines y a que el conteo se estabilice 2 s
    const deadline = Date.now() + 60000;
    let lastSeen = -1; let stableSince = Date.now();
    while (Date.now() < deadline) {
      const p = await page.evaluate(() => window.__perf);
      if (p.count !== lastSeen) { lastSeen = p.count; stableSince = Date.now(); }
      if (p.count > 0 && Date.now() - stableSince > 2000) break;
      await sleep(250);
    }
    const perf = await page.evaluate(() => window.__perf);
    return {
      url: page.url(),
      markersFirstMs: perf.first,
      markersAllMs: perf.last,
      markersCount: perf.count,
      reportsRequestStatus: statuses,
    };
  } finally {
    await browser.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
};

// --- principal -------------------------------------------------------------------------
fs.mkdirSync(outDir, { recursive: true });
const preview = await startPreview();
const results = [];
try {
  for (let n = 1; n <= runs; n += 1) {
    const lh = await runLighthouse(n);
    const probe = await runProbe(n);
    results.push({ n, lh, probe });
    console.log(`[${label}/${profile}] corrida ${n}/${runs}: perf=${lh.performance} fcp=${Math.round(lh.fcp)} lcp=${Math.round(lh.lcp)} tbt=${Math.round(lh.tbt)} | pines=${probe.markersCount} 1º=${Math.round(probe.markersFirstMs)}ms todos=${Math.round(probe.markersAllMs)}ms | reportes HTTP ${[...new Set([...lh.reportsRequestStatus, ...probe.reportsRequestStatus])].join(',')}`);
  }
} finally {
  stopPreview(preview);
}

const meta = {
  label, profile, runs, dist: path.relative(repo, dist),
  fecha: new Date().toISOString(),
  commit: spawnGit(['rev-parse', '--short', 'HEAD']),
  ramaSucia: spawnGit(['status', '--porcelain', '--', 'src']).length > 0,
  navegador: spawnPs(EDGE),
  node: process.version,
  so: `${process.platform} ${process.arch}`,
  emulacionSonda: { cpu: PROFILES.cpu, red: PROFILES.net, viewport: PROFILES.viewport },
  cache: 'fría: perfil de navegador nuevo por corrida, sin service worker registrado, sesión simulada sembrada desde /manifest.json',
};
fs.writeFileSync(path.join(outDir, `${label}-${profile}.json`), JSON.stringify({ meta, results }, null, 2));
console.log(`guardado ${label}-${profile}.json`);

function spawnGit(a) {
  try { return spawnSyncText('git', a); } catch { return ''; }
}
function spawnPs(exe) {
  try { return spawnSyncText('powershell', ['-NoProfile', '-Command', `(Get-Item '${exe.replace(/\//g, '\\')}').VersionInfo.ProductVersion`]); } catch { return 'desconocido'; }
}
function spawnSyncText(cmd, a) {
  return spawnSync(cmd, a, { cwd: repo, encoding: 'utf8' }).stdout.trim();
}
