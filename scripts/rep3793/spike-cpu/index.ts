/**
 * REP-3793 · Bloque 0 · Spike de viabilidad CPU (NO es código productivo).
 *
 * Edge Function de prueba: recibe un JPEG en el cuerpo, lo decodifica con ImageScript,
 * pixela rectángulos fijos y lo vuelve a codificar como JPEG. Devuelve los tiempos de cada
 * etapa para decidir si el pixelado entra en el límite de CPU de Supabase Edge Functions.
 * Se despliega SOLO en el proyecto descartable, nunca en CiudadAR.
 *
 * Parámetros por query string:
 *   zones   cantidad de rectángulos a pixelar (por defecto 4)
 *   quality calidad JPEG de salida (por defecto 85)
 */
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { pixelateZones, type Zone } from '../../../supabase/functions/quarantine-anonymize/pixelate.ts';

Deno.serve(async (req: Request) => {
  // Solo POST con la foto en el cuerpo
  if (req.method !== 'POST') return new Response('POST con un JPEG en el cuerpo', { status: 405 });

  const url = new URL(req.url);
  const zoneCount = Number(url.searchParams.get('zones') ?? 4);
  const quality = Number(url.searchParams.get('quality') ?? 85);

  const t0 = performance.now();
  // 1. Lectura del cuerpo
  const input = new Uint8Array(await req.arrayBuffer());
  const t1 = performance.now();

  // 2. Decodificación del JPEG a píxeles RGBA
  const image = await Image.decode(input);
  const t2 = performance.now();

  // 3. Rectángulos fijos repartidos por la foto (simulan rostros y patentes de tamaños variados)
  const zones: Zone[] = Array.from({ length: zoneCount }, (_, i) => ({
    x: Math.round(image.width * (0.1 + 0.2 * (i % 4))),
    y: Math.round(image.height * (0.15 + 0.25 * Math.floor(i / 4))),
    width: Math.round(image.width * 0.12),
    height: Math.round(image.height * 0.1),
    type: i % 2 === 0 ? 'face' : 'license_plate',
  }));
  const applied = pixelateZones(image.bitmap, image.width, image.height, zones);
  const t3 = performance.now();

  // 4. Recodificación a JPEG
  const output = await image.encodeJPEG(quality);
  const t4 = performance.now();

  return new Response(
    JSON.stringify({
      width: image.width,
      height: image.height,
      inputBytes: input.length,
      outputBytes: output.length,
      zones: applied.length,
      ms: {
        read: +(t1 - t0).toFixed(1),
        decode: +(t2 - t1).toFixed(1),
        pixelate: +(t3 - t2).toFixed(1),
        encode: +(t4 - t3).toFixed(1),
        total: +(t4 - t0).toFixed(1),
      },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
