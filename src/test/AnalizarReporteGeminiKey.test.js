/**
 * @file AnalizarReporteGeminiKey.test.js
 * @description La clave de Gemini de analizar-reporte nunca viaja en la URL ni
 * queda guardada en report_ai_analysis.status_reason. Mismo criterio que
 * REP-3793 aplicó a Google Vision en quarantine-anonymize.
 *
 * index.ts no se puede importar desde Vitest (arranca Deno.serve y trae
 * supabase-js desde esm.sh), así que la URL se verifica leyendo el fuente y
 * la redacción se prueba importando redact.ts.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { redactApiKeys } from '../../supabase/functions/analizar-reporte/redact';

// Clave con el formato real de Google ("AIza" + 35 caracteres), inventada para el test
const FAKE_KEY = 'AIzaSyD-FAKEfakeFAKEfakeFAKEfake_123456';

describe('analizar-reporte: la clave de Gemini va en el header', () => {
  const source = readFileSync(resolve(__dirname, '../../supabase/functions/analizar-reporte/index.ts'), 'utf8');

  it('ninguna URL de Gemini lleva ?key=', () => {
    expect(source).not.toMatch(/[?&]key=/);
  });

  it('embedContent y generateContent mandan x-goog-api-key', () => {
    const headerUses = source.match(/'x-goog-api-key': apiKey/g) ?? [];
    expect(headerUses).toHaveLength(2);
  });

  it('el catch general redacta el mensaje antes de guardarlo', () => {
    expect(source).toMatch(/error: redactApiKeys\(/);
  });
});

describe('redactApiKeys', () => {
  it('borra la clave de un error de red de Deno con la URL completa', () => {
    const message = `error sending request for url (https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${FAKE_KEY}): client error (Connect): dns error`;
    const redacted = redactApiKeys(message);
    expect(redacted).not.toContain(FAKE_KEY);
    expect(redacted).toContain(':embedContent?key=***)');
    expect(redacted).toContain('dns error');
  });

  it('borra key= cuando no es el primer parámetro', () => {
    expect(redactApiKeys('https://x.test/a?alt=json&key=secreto123&b=1')).toBe('https://x.test/a?alt=json&key=***&b=1');
  });

  it('borra una clave de Google suelta aunque no venga como parámetro', () => {
    expect(redactApiKeys(`clave inválida: ${FAKE_KEY}.`)).toBe('clave inválida: ***.');
  });

  it('no toca mensajes sin claves', () => {
    const message = 'generateContent falló (503): {"error":{"code":503,"message":"The model is overloaded."}}';
    expect(redactApiKeys(message)).toBe(message);
  });
});
