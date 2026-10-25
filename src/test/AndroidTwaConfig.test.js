import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

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
