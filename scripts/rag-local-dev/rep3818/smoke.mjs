// REP-3818 · Prueba de humo de analyzeImage con el modelo REAL (Gemini) y fotos locales de REP-3816.
// La base, el bucket y la cola se simulan en memoria: NO se escribe en ninguna base ni bucket.
// La clave se lee del .env y nunca se imprime. Uso: node smoke.mjs  (Node >= 22.18 ejecuta .ts directamente)
import fs from 'node:fs';
import { analyzeImage } from '../../../supabase/functions/analizar-imagen-reporte/analyze.ts';
import { callGeminiVision } from '../../../supabase/functions/analizar-imagen-reporte/gemini.ts';

const apiKey = fs.readFileSync(new URL('../../../.env', import.meta.url), 'utf-8').match(/^GEMINI_API_KEY=(.*)$/m)?.[1]?.trim();
if (!apiKey) throw new Error('GEMINI_API_KEY no encontrada en .env');

const fotos = new URL('../rep3790/fotos/anonimizadas/', import.meta.url);
const sinteticas = new URL('../rep3816/fotos/', import.meta.url);
const CSID = '6296bc60-a340-4966-ba24-594f3572e1f2';
const SERVICES = { INFRAESTRUCTURA: 'id-infra', AMBIENTE: 'id-ambiente', TRANSITO: 'id-transito', COMERCIO_IRREGULAR: 'id-comercio', VULNERABILIDAD_SOCIAL: 'id-vuln' };

const casos = [
  { nombre: 'foto y texto coinciden (bache)', archivo: new URL('04-bache-visible.jpg', fotos), categoria: 'INFRAESTRUCTURA', descripcion: 'Bache grande en la calle, frente a una casa, con el asfalto roto y piedras sueltas adentro.' },
  { nombre: 'foto y texto NO coinciden (plaza vs auto en rampa)', archivo: new URL('09-plaza.jpg', fotos), categoria: 'TRANSITO', descripcion: 'Auto estacionado en la esquina frente a la rampa peatonal, tapando el acceso.' },
  { nombre: 'orden escrita en la imagen (S1)', archivo: new URL('S1-orden-en-imagen.jpg', sinteticas), categoria: 'TRANSITO', descripcion: 'Auto estacionado en la esquina frente a la rampa peatonal, tapando el acceso.' },
  { nombre: 'datos personales inventados en la imagen (S2)', archivo: new URL('S2-datos-personales.jpg', sinteticas), categoria: 'INFRAESTRUCTURA', descripcion: 'Bache grande en la calle, frente a una casa, con el asfalto roto y piedras sueltas adentro.' },
  { nombre: 'VULNERABILIDAD_SOCIAL (no se analiza)', archivo: new URL('04-bache-visible.jpg', fotos), categoria: 'VULNERABILIDAD_SOCIAL', descripcion: 'Persona durmiendo en la calle frente a la plaza.' },
];

const IMAGE_ID = '11111111-2222-3333-4444-555555555555';
for (const caso of casos) {
  const guardado = [];
  const borrados = [];
  const deps = {
    geminiConfigured: true,
    getImage: async () => ({ id: IMAGE_ID, report_id: 'r', image_url: `https://x.supabase.co/storage/v1/object/public/report-evidences/${CSID}/foto.jpg`, client_side_id: CSID, description: caso.descripcion, service_code: caso.categoria }),
    hasAnalysis: async () => false,
    downloadEvidence: async () => ({ bytes: new Uint8Array(fs.readFileSync(caso.archivo)), mimeType: 'image/jpeg' }),
    resolveServiceId: async (code) => SERVICES[code] ?? null,
    callModel: (args) => callGeminiVision({ fetchFn: fetch, apiKey, ...args }),
    persist: async (row) => { guardado.push(row); return true; },
    deleteMessage: async (id) => { borrados.push(id); },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
  const r = await analyzeImage(deps, { imageId: IMAGE_ID, queueMessageId: 1 });
  const fila = guardado[0];
  console.log(`\n# ${caso.nombre}`);
  console.log(`  HTTP ${r.status} · estado ${r.body.estado} · modelo ${fila?.model_code ?? '-'} · ${fila?.latency_ms ?? '-'} ms · tokens ${fila?.input_tokens ?? '-'}+${fila?.output_tokens ?? '-'} · mensaje borrado: ${borrados.length === 1}`);
  console.log(`  coherence=${fila?.coherence} · servicio=${fila?.suggested_service_id} · flags=${JSON.stringify(fila?.quality_flags)} · motivo=${fila?.status_reason}`);
  console.log(`  resumen: ${fila?.scene_summary}`);
}
