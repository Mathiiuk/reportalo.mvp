#!/usr/bin/env node
// Reportalo™ · compila y firma la app Android (TWA) generada en android/twa.
// Uso: node scripts/android/compilar.mjs
// Salida: android/twa/dist/app-release-bundle.aab (Play Console) y
//         android/twa/dist/app-release-signed.apk (instalar a mano en un teléfono).
//
// Firma con la upload key. Toma la config de variables de entorno (CI) o, si no
// están, de ~/.reportalo-android/credenciales.txt (PC local):
//   ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD
// JDK 17 y Android SDK: JAVA_HOME / ANDROID_HOME, o las rutas por defecto de la guía.

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, copyFileSync, rmSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const root = process.cwd();
const proyecto = resolve(root, 'android/twa');
const salida = join(proyecto, 'dist');
const esWindows = process.platform === 'win32';

function fallar(mensaje) {
  console.error(`[compilar] ${mensaje}`);
  process.exit(1);
}

// Primera carpeta que exista entre las candidatas
function primeraQueExista(...candidatas) {
  return candidatas.find((c) => c && existsSync(c));
}

// JDK: JAVA_HOME o el JDK 17 instalado por la guía en %LOCALAPPDATA%\Programs\Java
const javaLocal = join(process.env.LOCALAPPDATA || '', 'Programs/Java');
const javaHome = primeraQueExista(
  process.env.JAVA_HOME,
  existsSync(javaLocal) &&
    join(javaLocal, readdirSync(javaLocal).find((d) => d.startsWith('jdk-17')) || '-'),
);
const androidHome = primeraQueExista(
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  join(process.env.LOCALAPPDATA || '', 'Android/Sdk'),
  join(homedir(), 'Android/Sdk'),
);
if (!javaHome) fallar('No encuentro el JDK 17. Definí JAVA_HOME (ver docs/android/PLAY_STORE.md).');
if (!androidHome) fallar('No encuentro el Android SDK. Definí ANDROID_HOME (ver docs/android/PLAY_STORE.md).');

// Credenciales de la upload key: primero entorno, después el archivo local
const credencialesLocales = join(homedir(), '.reportalo-android/credenciales.txt');
const archivo = existsSync(credencialesLocales)
  ? Object.fromEntries(
      readFileSync(credencialesLocales, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.includes('='))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
    )
  : {};
const keystore = process.env.ANDROID_KEYSTORE_PATH || archivo.KEYSTORE;
const storePass = process.env.ANDROID_KEYSTORE_PASSWORD || archivo.STORE_PASSWORD;
const alias = process.env.ANDROID_KEY_ALIAS || archivo.ALIAS || 'upload';
const keyPass = process.env.ANDROID_KEY_PASSWORD || archivo.KEY_PASSWORD || storePass;
if (!keystore || !existsSync(keystore) || !storePass) {
  fallar(
    'Falta la upload key. Definí ANDROID_KEYSTORE_PATH y ANDROID_KEYSTORE_PASSWORD, ' +
      `o creá ${credencialesLocales} (ver docs/android/PLAY_STORE.md).`,
  );
}

// Las contraseñas viajan por entorno a jarsigner/apksigner, nunca como argumento
const entorno = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  RPT_STORE_PASS: storePass,
  RPT_KEY_PASS: keyPass,
  PATH: `${join(javaHome, 'bin')}${esWindows ? ';' : ':'}${process.env.PATH}`,
};

function correr(comando, args, opciones = {}) {
  // Los .bat de Windows solo corren a través del shell; citamos rutas con espacios
  const citar = (a) => (esWindows && /\s/.test(a) ? `"${a}"` : a);
  const r = spawnSync(citar(comando), args.map(citar), {
    cwd: proyecto,
    env: entorno,
    stdio: opciones.capturar ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    shell: esWindows,
  });
  if (r.status !== 0) fallar(`Falló: ${comando} ${args.join(' ')}`);
  return opciones.capturar ? r.stdout.toString() : '';
}

// build-tools más nuevo instalado (zipalign y apksigner)
const buildTools = join(
  androidHome,
  'build-tools',
  readdirSync(join(androidHome, 'build-tools')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop(),
);
const ext = esWindows ? '.bat' : '';

console.log(`[compilar] JDK ${javaHome}\n[compilar] SDK ${androidHome}`);
correr(join(proyecto, `gradlew${ext}`), ['bundleRelease', 'assembleRelease', '--no-daemon']);

rmSync(salida, { recursive: true, force: true });
mkdirSync(salida, { recursive: true });

// AAB: se firma con jarsigner (Play lo vuelve a firmar con la clave de App Signing)
const aab = join(salida, 'app-release-bundle.aab');
copyFileSync(join(proyecto, 'app/build/outputs/bundle/release/app-release.aab'), aab);
correr(join(javaHome, 'bin', 'jarsigner'), [
  '-sigalg', 'SHA256withRSA', '-digestalg', 'SHA-256',
  '-keystore', keystore, '-storepass:env', 'RPT_STORE_PASS', '-keypass:env', 'RPT_KEY_PASS',
  aab, alias,
]);

// APK: zipalign antes de firmar con apksigner (v2/v3)
const apkAlineado = join(salida, 'app-release-aligned.apk');
const apk = join(salida, 'app-release-signed.apk');
correr(join(buildTools, `zipalign${esWindows ? '.exe' : ''}`), [
  '-f', '-p', '4', join(proyecto, 'app/build/outputs/apk/release/app-release-unsigned.apk'), apkAlineado,
]);
correr(join(buildTools, `apksigner${ext}`), [
  'sign', '--ks', keystore, '--ks-key-alias', alias,
  '--ks-pass', 'env:RPT_STORE_PASS', '--key-pass', 'env:RPT_KEY_PASS',
  '--out', apk, apkAlineado,
]);
rmSync(apkAlineado);
rmSync(`${apk}.idsig`, { force: true });

// La huella con la que firmamos tiene que estar en assetlinks.json; si no, la
// app abre con barra de URL y nadie se da cuenta hasta probarla en un teléfono.
const certs = correr(join(buildTools, `apksigner${ext}`), ['verify', '--print-certs', apk], { capturar: true });
const sha = certs.match(/SHA-256 digest:\s*([0-9a-f]{64})/i)?.[1];
if (!sha) fallar('No pude leer la huella del APK firmado.');
const huella = sha.toUpperCase().match(/../g).join(':');
const enlaces = JSON.parse(readFileSync(join(root, 'public/.well-known/assetlinks.json'), 'utf8'));
const publicadas = enlaces.flatMap((e) => e.target?.sha256_cert_fingerprints || []);
if (!publicadas.includes(huella)) {
  fallar(`La huella ${huella} no está en public/.well-known/assetlinks.json.`);
}
correr(join(javaHome, 'bin', 'jarsigner'), ['-verify', aab], { capturar: true });

console.log(`[compilar] OK, firmado con ${huella}\n  ${aab}\n  ${apk}`);
