import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

// REP-ANDROID-TWA: la app de Play Store es una TWA que abre la PWA en Chrome.
// Si el manifest, los íconos o el Digital Asset Links no coinciden, Bubblewrap
// no genera el proyecto o la app abre con la barra de URL visible.
const raiz = path.resolve(__dirname, '../..');
const leerJson = (rel) => JSON.parse(fs.readFileSync(path.join(raiz, rel), 'utf8'));

// Ancho y alto reales de un PNG, leídos del chunk IHDR (bytes 16 a 23)
const medidasPng = (rel) => {
  const buf = fs.readFileSync(path.join(raiz, rel));
  // Firma PNG: 89 50 4E 47
  expect(buf.subarray(0, 4).toString('hex')).toBe('89504e47');
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
};

const PACKAGE_ID = 'ar.com.reportalo.app';
const HUELLA_SHA256 = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

describe('REP-ANDROID-TWA-1: íconos, manifest y Digital Asset Links', () => {
  const manifest = leerJson('public/manifest.json');

  it('UT-TWA-01: cada ícono del manifest es un PNG que mide lo que declara', () => {
    [...manifest.icons, ...manifest.shortcuts.flatMap((s) => s.icons)].forEach((icono) => {
      expect(icono.type).toBe('image/png');
      // El src es absoluto desde /public
      expect(medidasPng(path.join('public', icono.src))).toBe(icono.sizes);
    });
  });

  it('UT-TWA-02: hay íconos 192 y 512 "any" y uno 512 "maskable" (requisito de Bubblewrap)', () => {
    const tiene = (sizes, purpose) =>
      manifest.icons.some((i) => i.sizes === sizes && i.purpose === purpose);
    expect(tiene('192x192', 'any')).toBe(true);
    expect(tiene('512x512', 'any')).toBe(true);
    expect(tiene('512x512', 'maskable')).toBe(true);
  });

  it('UT-TWA-03: el ícono de la ficha de Play Store es un PNG de 512x512', () => {
    expect(medidasPng('android/store/play-store-icon-512.png')).toBe('512x512');
  });

  it('UT-TWA-04: assetlinks.json delega todas las URLs al paquete Android con huellas SHA-256 válidas', () => {
    const enlaces = leerJson('public/.well-known/assetlinks.json');
    expect(Array.isArray(enlaces)).toBe(true);
    const app = enlaces.find((e) => e.target?.package_name === PACKAGE_ID);
    expect(app).toBeDefined();
    expect(app.relation).toContain('delegate_permission/common.handle_all_urls');
    expect(app.target.namespace).toBe('android_app');
    expect(app.target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
    app.target.sha256_cert_fingerprints.forEach((huella) => {
      expect(huella).toMatch(HUELLA_SHA256);
    });
  });
});

describe('REP-ANDROID-TWA-2: proyecto TWA y build firmado', () => {
  const manifest = leerJson('public/manifest.json');
  const twa = leerJson('android/twa/twa-manifest.json');

  it('UT-TWA-05: el proyecto TWA usa el mismo paquete que assetlinks.json y abre staging', () => {
    expect(twa.packageId).toBe(PACKAGE_ID);
    expect(twa.host).toBe('reportalo-staging.vercel.app');
    expect(twa.startUrl).toBe(manifest.start_url);
    const gradle = fs.readFileSync(path.join(raiz, 'android/twa/app/build.gradle'), 'utf8');
    expect(gradle).toContain(`applicationId "${PACKAGE_ID}"`);
    expect(gradle).toContain(`hostName: '${twa.host}'`);
    // androidbrowserhelper exige minSdk 24; con menos el manifest merger falla
    expect(gradle).toMatch(/minSdkVersion 24\b/);
  });

  it('UT-TWA-06: los íconos y colores de la TWA salen del manifest web', () => {
    // Cada URL de ícono apunta a un archivo que existe en public/
    [twa.iconUrl, twa.maskableIconUrl].forEach((url) => {
      expect(new URL(url).host).toBe(twa.host);
      expect(fs.existsSync(path.join(raiz, 'public', new URL(url).pathname))).toBe(true);
    });
    expect(twa.themeColor).toBe(manifest.theme_color);
    expect(twa.backgroundColor).toBe(manifest.background_color);
    // Delegación de notificaciones: las Web Push de la PWA llegan como notificaciones de la app
    expect(twa.enableNotifications).toBe(true);
  });

  it('UT-TWA-07: sin upload key el build falla antes de compilar y explica cómo configurarla', () => {
    // HOME y USERPROFILE vacíos: no hay ~/.reportalo-android/credenciales.txt
    const r = spawnSync(process.execPath, ['scripts/android/compilar.mjs'], {
      cwd: raiz,
      env: {
        PATH: process.env.PATH,
        HOME: os.tmpdir(),
        USERPROFILE: os.tmpdir(),
        JAVA_HOME: raiz,
        ANDROID_HOME: raiz,
        ANDROID_KEYSTORE_PATH: path.join(os.tmpdir(), 'no-existe.jks'),
      },
      encoding: 'utf8',
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Falta la upload key');
  });

  it('UT-TWA-09: el workflow de CI firma con secrets, publica el AAB y borra la clave', () => {
    const wf = fs.readFileSync(path.join(raiz, '.github/workflows/android-twa.yml'), 'utf8');
    expect(wf).toContain('workflow_dispatch');
    expect(wf).toContain('secrets.ANDROID_KEYSTORE_BASE64');
    expect(wf).toContain('secrets.ANDROID_KEYSTORE_PASSWORD');
    expect(wf).toContain('node scripts/android/compilar.mjs');
    expect(wf).toContain('android/twa/dist/app-release-bundle.aab');
    // La clave se borra aunque el build falle, y ninguna contraseña se imprime
    expect(wf).toMatch(/if: always\(\)\s+run: rm -f "\$RUNNER_TEMP\/upload-keystore\.jks"/);
    expect(wf).not.toMatch(/echo .*PASSWORD/);
  });

  it('UT-TWA-08: las claves y la salida de Gradle están fuera de git', () => {
    const ignorados = fs.readFileSync(path.join(raiz, '.gitignore'), 'utf8');
    ['*.jks', '*.keystore', 'android/twa/app/build/', 'android/twa/local.properties'].forEach((p) =>
      expect(ignorados).toContain(p),
    );
  });
});
