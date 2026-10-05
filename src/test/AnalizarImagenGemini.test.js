/**
 * @file AnalizarImagenGemini.test.js
 * @description REP-3818: la llamada multimodal a Gemini (configuración validada en REP-3816, clave solo en el header,
 * tiempo máximo). `fetch` se inyecta: no hay red.
 */
import { describe, it, expect, vi } from 'vitest';
import { callGeminiVision, GEMINI_TIMEOUT_MS } from '../../supabase/functions/analizar-imagen-reporte/gemini';
import { OUTPUT_SCHEMA } from '../../supabase/functions/analizar-imagen-reporte/contract';

const FAKE_KEY = 'AIzaSyD-FAKEfakeFAKEfakeFAKEfake_123456';
const respuesta = (cuerpo, { ok = true, status = 200 } = {}) => ({ ok, status, text: async () => JSON.stringify(cuerpo) });

const llamar = (fetchFn, extra = {}) =>
  callGeminiVision({ fetchFn, apiKey: FAKE_KEY, model: 'gemini-3.8-flash', imageBase64: 'QUJD', mimeType: 'image/jpeg', prompt: 'Describí', ...extra });

describe('REP-3818: callGeminiVision', () => {
  it('UT-V3818-18: la clave va en x-goog-api-key y nunca en la URL', async () => {
    const fetchFn = vi.fn().mockResolvedValue(respuesta({ candidates: [] }));
    await llamar(fetchFn);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    expect(url).not.toContain(FAKE_KEY);
    expect(url).not.toMatch(/[?&]key=/);
    expect(init.headers['x-goog-api-key']).toBe(FAKE_KEY);
  });

  it('UT-V3818-19: manda imagen en línea, salida JSON con el esquema obligatorio y razonamiento bajo', async () => {
    const fetchFn = vi.fn().mockResolvedValue(respuesta({ candidates: [] }));
    await llamar(fetchFn);
    const cuerpo = JSON.parse(fetchFn.mock.calls[0][1].body);
    const partes = cuerpo.contents[0].parts;
    expect(partes[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } });
    expect(partes[1]).toEqual({ text: 'Describí' });
    expect(cuerpo.generationConfig.responseMimeType).toBe('application/json');
    expect(cuerpo.generationConfig.responseSchema).toEqual(OUTPUT_SCHEMA);
    expect(cuerpo.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' });
    expect(cuerpo.generationConfig.maxOutputTokens).toBeLessThanOrEqual(1024);
  });

  it('UT-V3818-20: devuelve estado, datos y latencia; ante un error HTTP trae un texto corto del motivo', async () => {
    const bien = await llamar(vi.fn().mockResolvedValue(respuesta({ candidates: [{ finishReason: 'STOP' }] })));
    expect(bien).toMatchObject({ ok: true, status: 200, errorText: null });
    expect(bien.latencyMs).toBeGreaterThanOrEqual(0);

    const mal = await llamar(vi.fn().mockResolvedValue(respuesta({ error: { message: 'x'.repeat(1000) } }, { ok: false, status: 503 })));
    expect(mal).toMatchObject({ ok: false, status: 503 });
    expect(mal.errorText.length).toBeLessThanOrEqual(300);
  });

  it('UT-V3818-21: un cuerpo que no es JSON no rompe: data queda en null', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'no es json' });
    expect((await llamar(fetchFn)).data).toBeNull();
  });

  it('UT-V3818-22: si el servidor no responde a tiempo, se corta (el tiempo máximo es de 20 s)', async () => {
    expect(GEMINI_TIMEOUT_MS).toBe(20_000);
    const fetchFn = vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('The operation was aborted')));
    }));
    await expect(llamar(fetchFn, { timeoutMs: 20 })).rejects.toThrow(/aborted/);
  });
});
