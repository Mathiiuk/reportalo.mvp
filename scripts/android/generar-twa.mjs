#!/usr/bin/env node
// Reportalo™ · genera el proyecto Android (TWA) en android/twa con Bubblewrap.
// Uso: node scripts/android/generar-twa.mjs [--bump]
//   --bump  sube versionCode en 1 (Play rechaza un AAB con un versionCode ya subido)
// La fuente de verdad es public/manifest.json + la config de abajo. El proyecto
// generado se commitea: CI solo necesita Gradle, no Node ni Bubblewrap.

import { createServer } from 'node:http';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { TwaManifest, TwaGenerator, ConsoleLog } from '@bubblewrap/core';

const root = process.cwd();
const destino = resolve(root, 'android/twa');
const rutaTwaManifest = join(destino, 'twa-manifest.json');

// Ambiente al que apunta la app. Pasar a producción = cambiar HOST, regenerar
// y publicar /.well-known/assetlinks.json en ese dominio.
const HOST = 'reportalo-staging.vercel.app';
const PACKAGE_ID = 'ar.com.reportalo.app';

// Conservamos la versión de la última generación para no retroceder el versionCode
let versionCode = 1;
let versionName = '1.0.0';
if (existsSync(rutaTwaManifest)) {
  const anterior = JSON.parse(readFileSync(rutaTwaManifest, 'utf8'));
  versionCode = anterior.appVersionCode;
  versionName = anterior.appVersionName;
}
if (process.argv.includes('--bump')) versionCode += 1;

const webManifest = JSON.parse(readFileSync(join(root, 'public/manifest.json'), 'utf8'));
const twa = TwaManifest.fromWebManifestJson(new URL(`https://${HOST}/manifest.json`), webManifest);
Object.assign(twa, {
  packageId: PACKAGE_ID,
  appVersionCode: versionCode,
  appVersionName: versionName,
  // La plantilla trae 21, pero androidbrowserhelper 2.7.4 exige 24 (Android 7.0)
  minSdkVersion: 24,
  // Delegación de notificaciones: las Web Push de la PWA salen como notificaciones de la app
  enableNotifications: true,
  // Barras del sistema con los colores de la marca
  navigationColor: twa.themeColor,
  navigationColorDark: twa.themeColor,
  // Sin Chrome compatible, abrir en Custom Tab (mantiene SW, push y login de Google)
  fallbackType: 'customtabs',
  // Informativo: la firma la hace scripts/android/compilar.mjs, no Bubblewrap
  signingKey: { path: '~/.reportalo-android/upload-keystore.jks', alias: 'upload' },
});

// Bubblewrap descarga los íconos desde el host. Mientras la rama no esté
// desplegada no existen ahí, así que los servimos desde public/ en un puerto local.
const tipos = { '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const servidor = createServer((req, res) => {
  const archivo = join(root, 'public', decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!archivo.startsWith(join(root, 'public')) || !existsSync(archivo)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': tipos[extname(archivo)] || 'application/octet-stream' });
  res.end(readFileSync(archivo));
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const local = `http://127.0.0.1:${servidor.address().port}`;
const aLocal = (url) => url && url.replace(`https://${HOST}`, local);

const urlsPublicas = { iconUrl: twa.iconUrl, maskableIconUrl: twa.maskableIconUrl };
const iconosShortcuts = twa.shortcuts.map((s) => s.chosenIconUrl);
twa.iconUrl = aLocal(twa.iconUrl);
twa.maskableIconUrl = aLocal(twa.maskableIconUrl);
twa.shortcuts.forEach((s) => (s.chosenIconUrl = aLocal(s.chosenIconUrl)));

try {
  // Regeneramos desde cero para no arrastrar archivos de una plantilla vieja
  rmSync(join(destino, 'app'), { recursive: true, force: true });
  await new TwaGenerator().createTwaProject(destino, twa, new ConsoleLog('generar-twa'));
} finally {
  servidor.close();
}

// En el twa-manifest.json commiteado quedan las URLs públicas, no las locales
Object.assign(twa, urlsPublicas);
twa.shortcuts.forEach((s, i) => (s.chosenIconUrl = iconosShortcuts[i]));
await twa.saveToFile(rutaTwaManifest);

console.log(`[generar-twa] ${PACKAGE_ID} v${versionName} (${versionCode}) → https://${HOST}${twa.startUrl}`);
// fetch-h2 (cliente HTTP/2 de Bubblewrap) deja la sesión abierta y el proceso no termina solo
process.exit(0);
