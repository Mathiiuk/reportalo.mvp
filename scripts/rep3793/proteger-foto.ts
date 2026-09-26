/**
 * REP-3793 · Herramienta de QA: corre el MISMO pipeline de la Edge Function
 * (supabase/functions/quarantine-anonymize/protect.ts) sobre una foto local y deja la
 * evidencia de antes/después para la matriz de QA.
 *
 * Uso (Deno):
 *   # Con Google Vision real (la clave se lee del entorno y nunca se imprime):
 *   GOOGLE_VISION_API_KEY=... deno run -A scripts/rep3793/proteger-foto.ts fotos/01.jpg
 *   # Sin Vision, con zonas fijas (x,y,ancho,alto) para probar solo el pixelado:
 *   deno run -A scripts/rep3793/proteger-foto.ts fotos/01.jpg --zona 100,80,160,200
 *
 * Salida, junto a la foto: <nombre>.protegida.jpg, <nombre>.zonas.jpg (con los recuadros
 * marcados, para revisar coordenadas) y <nombre>.resultado.json.
 * La foto de entrada tiene que medir 2048 px de lado o menos (como las que manda la app).
 */
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { protectEvidence, type ImageCodec } from '../../supabase/functions/quarantine-anonymize/protect.ts';
import { detectSensitiveZones } from '../../supabase/functions/quarantine-anonymize/vision.ts';
import { readJpegSize } from '../../supabase/functions/quarantine-anonymize/exif.ts';
import type { Zone } from '../../supabase/functions/quarantine-anonymize/pixelate.ts';

const [inputPath, ...rest] = Deno.args;
if (!inputPath) {
  console.error('Uso: deno run -A scripts/rep3793/proteger-foto.ts <foto.jpg> [--zona x,y,ancho,alto ...]');
  Deno.exit(1);
}

// Zonas fijas pasadas por parámetro (modo sin Vision)
const fixedZones: Zone[] = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--zona') {
    const [x, y, width, height] = rest[++i].split(',').map(Number);
    fixedZones.push({ x, y, width, height, type: 'face' });
  }
}

const codec: ImageCodec = {
  decode: async (bytes) => (await Image.decode(bytes)) as Image,
  encode: (image, quality) => (image as Image).encodeJPEG(quality),
};

const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
const useVision = fixedZones.length === 0;
if (useVision && !apiKey) {
  console.error('Falta GOOGLE_VISION_API_KEY en el entorno (o pasá --zona para probar sin Vision).');
  Deno.exit(1);
}

const raw = await Deno.readFile(inputPath);
const base = inputPath.replace(/\.jpe?g$/i, '');
const startedAt = performance.now();

try {
  const result = await protectEvidence(raw, codec, (bytes, width, height) =>
    useVision ? detectSensitiveZones(bytes, width, height, apiKey) : Promise.resolve(fixedZones)
  );
  const ms = Math.round(performance.now() - startedAt);

  await Deno.writeFile(`${base}.protegida.jpg`, result.bytes);

  // Copia con los recuadros dibujados (solo para revisar que las coordenadas caen donde deben)
  const marked = (await Image.decode(result.bytes)) as Image;
  for (const zone of result.zones) {
    const color = zone.type === 'face' ? 0xff0000ff : 0x00a0ffff;
    for (let t = 0; t < 3; t++) {
      marked.drawBox(zone.x + t, zone.y + t, Math.max(1, zone.width - 2 * t), 1, color);
      marked.drawBox(zone.x + t, zone.y + zone.height - 1 - t, Math.max(1, zone.width - 2 * t), 1, color);
      marked.drawBox(zone.x + t, zone.y + t, 1, Math.max(1, zone.height - 2 * t), color);
      marked.drawBox(zone.x + zone.width - 1 - t, zone.y + t, 1, Math.max(1, zone.height - 2 * t), color);
    }
  }
  await Deno.writeFile(`${base}.zonas.jpg`, await marked.encodeJPEG(85));

  const summary = {
    foto: inputPath,
    tamaño: readJpegSize(raw),
    detector: useVision ? 'google-vision' : 'zonas-fijas',
    rostros: result.zones.filter((z) => z.type === 'face').length,
    patentes: result.zones.filter((z) => z.type === 'license_plate').length,
    zonas: result.zones,
    bytesEntrada: raw.length,
    bytesSalida: result.bytes.length,
    ms,
  };
  await Deno.writeTextFile(`${base}.resultado.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  // Fail-safe: no se escribe ninguna versión de la foto
  const failure = { foto: inputPath, failSafeTriggered: true, reason: (error as any)?.reason, detalle: (error as Error).message };
  await Deno.writeTextFile(`${base}.resultado.json`, JSON.stringify(failure, null, 2));
  console.error(JSON.stringify(failure, null, 2));
  Deno.exit(2);
}
