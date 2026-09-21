/**
 * @file EvidencePrivacyOnlineSend.test.js
 * @description H-30: la regla que decide si una evidencia se puede adjuntar.
 *
 * El pipeline de cuarentena tiene un camino "emulador" que solo limpia el EXIF,
 * no difumina nada y aun asi devuelve exito, con una URL blob: local. Adjuntar
 * esa foto significa subir al bucket publico una imagen sin difuminar.
 *
 * La cola offline (pendingSyncService) ya rechazaba esas URLs; el envio con
 * conexion (NewReportPage) no. Ahora las dos vias usan esta misma funcion.
 */
import { describe, it, expect } from 'vitest';
import { isServerProtectedUrl } from '../services/reportSubmissionService';

describe('REP-3787 H-30: solo se adjuntan evidencias protegidas por el servidor', () => {
  it('UT-PRIV-01: acepta una URL del servidor, que es la senal de que hubo difuminado', () => {
    expect(isServerProtectedUrl('https://proyecto.supabase.co/storage/v1/object/public/evidencias/foto.jpg')).toBe(true);
    expect(isServerProtectedUrl('http://localhost:54321/storage/v1/object/public/evidencias/foto.jpg')).toBe(true);
  });

  it('UT-PRIV-02: rechaza la URL local del emulador, que no paso por el difuminado', () => {
    expect(isServerProtectedUrl('blob:http://localhost:5173/9b1c-4f2a')).toBe(false);
    expect(isServerProtectedUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(false);
  });

  it('UT-PRIV-03: ante la duda no adjunta: vacio, nulo o cualquier otra cosa', () => {
    expect(isServerProtectedUrl('')).toBe(false);
    expect(isServerProtectedUrl(null)).toBe(false);
    expect(isServerProtectedUrl(undefined)).toBe(false);
    expect(isServerProtectedUrl('/ruta/relativa/foto.jpg')).toBe(false);
    expect(isServerProtectedUrl(42)).toBe(false);
  });
});
