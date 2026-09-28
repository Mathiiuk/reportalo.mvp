/**
 * @file index.ts
 * @description Supabase Edge Function: Pipeline server-side de cuarentena y anonimización (REP-2404).
 * Runtime: Deno / TypeScript en Supabase Edge Functions.
 *
 * Implementa el principio de Privacidad por Diseño (Privacy by Design):
 * - Aísla de forma transitoria la fotografía en el bucket privado 'evidence-quarantine'.
 * - REP-3793: detecta rostros y patentes con Google Vision y los PIXELA de verdad sobre la
 *   imagen (protect.ts). Hasta REP-3793 solo informaba las zonas y guardaba la foto sin tocar.
 * - Sanitiza metadatos EXIF (REP-2401), antes de mandar la foto a Vision y otra vez al final.
 * - Almacena de forma exclusiva la versión final protegida en 'report-evidences'.
 * - REP-2501: exige sesión, solo procesa fotos que el propio usuario subió a su carpeta y
 *   rechaza lo que no sea JPEG. Lo que no puede procesar, lo purga igual.
 * - Fail-safe: si Vision falla, no está configurado o la protección no se completa, no se
 *   guarda nada y se responde `failSafeTriggered` con el motivo en `reason`.
 * - Purgado Fail-Safe: Destruye obligatoriamente la imagen original de cuarentena tanto al finalizar como ante errores.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { isOwnQuarantinePath, isUuid } from './exif.ts';
import type { Zone } from './pixelate.ts';
import {
  protectEvidence,
  ProtectionError,
  statusForReason,
  type DecodedImage,
  type ImageCodec,
  type ZoneDetector,
} from './protect.ts';
import { detectSensitiveZones } from './vision.ts';

// Cabeceras estándar para permitir CORS en las peticiones del frontend
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Nombre del bucket de cuarentena privada
const BUCKET_QUARANTINE = 'evidence-quarantine';

// Nombre del bucket de evidencias públicas protegidas
const BUCKET_PUBLIC_EVIDENCES = 'report-evidences';

interface QuarantineRequestPayload {
  quarantinePath?: string;
  clientSideId: string;
}

/** Abre y guarda JPEG con ImageScript (WASM, corre dentro del límite de CPU: ver Bloque 0). */
const imageScriptCodec: ImageCodec = {
  decode: async (bytes) => {
    const image = await Image.decode(bytes);
    if (!(image instanceof Image)) throw new Error('La foto no es una imagen fija.');
    return image;
  },
  encode: (image: DecodedImage, quality) => (image as Image).encodeJPEG(quality),
};

/**
 * Emulador de Vision SOLO para desarrollo local, y solo si se pide explícitamente con
 * QUARANTINE_VISION_EMULATOR=true contra un Supabase local. Pixela un recuadro central
 * para poder ver el efecto sin clave de Vision. En cualquier otro entorno no existe.
 */
const isLocalEmulatorEnabled = (supabaseUrl: string): boolean =>
  Deno.env.get('QUARANTINE_VISION_EMULATOR') === 'true' &&
  /^https?:\/\/(localhost|127\.0\.0\.1|kong|host\.docker\.internal)(:\d+)?/.test(supabaseUrl);

const emulatedDetector: ZoneDetector = async (_bytes, width, height): Promise<Zone[]> => [
  { x: Math.round(width * 0.4), y: Math.round(height * 0.3), width: Math.round(width * 0.2), height: Math.round(height * 0.2), type: 'face' },
];

/** Respuesta JSON con CORS. */
const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

/**
 * Handler principal de la Edge Function servida por Supabase.
 */
Deno.serve(async (req: Request) => {
  // Manejo de solicitudes pre-flight OPTIONS de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  // Cliente Supabase con service_role para operar sobre buckets privados
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const googleVisionApiKey = Deno.env.get('GOOGLE_VISION_API_KEY');

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  let quarantinePathToDelete: string | null = null;

  try {
    const payload: QuarantineRequestPayload = await req.json();
    const { quarantinePath, clientSideId } = payload;

    if (!quarantinePath || !clientSideId) {
      return new Response(
        JSON.stringify({ error: 'Faltan parámetros requeridos: quarantinePath o clientSideId.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // REP-2501: esta función corre con service role y estaba desplegada sin verificar el
    // JWT, así que cualquiera podía pedirle procesar (y borrar) una foto ajena. Se
    // identifica al usuario por su token y solo se acepta su propia carpeta.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: authData, error: authError } = token
      ? await supabaseAdmin.auth.getUser(token)
      : { data: null, error: new Error('Falta el token de sesión.') };
    const authenticatedUserId = authData?.user?.id;

    if (authError || !authenticatedUserId) {
      return new Response(JSON.stringify({ error: 'Se requiere una sesión iniciada.' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (!isUuid(clientSideId) || !isOwnQuarantinePath(quarantinePath, authenticatedUserId)) {
      return new Response(JSON.stringify({ error: 'La ruta de la evidencia no es válida.' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Recién con la ruta validada se registra para la purga forzosa del bloque finally:
    // nunca se borra una ruta que no es del usuario que hizo el pedido.
    quarantinePathToDelete = quarantinePath;

    // 1. Descargamos la imagen cruda desde el bucket privado de cuarentena
    const { data: rawFileBlob, error: downloadError } = await supabaseAdmin.storage
      .from(BUCKET_QUARANTINE)
      .download(quarantinePath);

    if (downloadError || !rawFileBlob) {
      throw new Error(`Error al descargar imagen desde cuarentena: ${downloadError?.message || 'Archivo no encontrado'}`);
    }

    const rawUint8Array = new Uint8Array(await rawFileBlob.arrayBuffer());

    // 2. Protección (REP-3793): validar, quitar EXIF, detectar, pixelar y re-codificar.
    // Si algo falla, protectEvidence lanza ProtectionError y no se guarda nada.
    const startedAt = performance.now();
    const detector: ZoneDetector = googleVisionApiKey
      ? (bytes, width, height) => detectSensitiveZones(bytes, width, height, googleVisionApiKey)
      : isLocalEmulatorEnabled(supabaseUrl)
        ? emulatedDetector
        : (bytes, width, height) => detectSensitiveZones(bytes, width, height, undefined);
    const protectedEvidence = await protectEvidence(rawUint8Array, imageScriptCodec, detector);

    // 3. Subimos SOLO la versión protegida al bucket permanente 'report-evidences'
    const finalFileName = `${clientSideId}/${Date.now()}_sanitized.jpg`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_PUBLIC_EVIDENCES)
      .upload(finalFileName, protectedEvidence.bytes, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Error al almacenar imagen anonimizada: ${uploadError.message}`);
    }

    // 4. Obtenemos la URL pública de la evidencia protegida
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKET_PUBLIC_EVIDENCES)
      .getPublicUrl(finalFileName);

    // Registro para QA y trazabilidad (REP-3793): cantidades, tamaños y tiempos; nunca la foto ni la clave
    const faces = protectedEvidence.zones.filter((zone) => zone.type === 'face').length;
    const plates = protectedEvidence.zones.length - faces;
    console.log(
      JSON.stringify({
        event: 'evidence_protected',
        clientSideId,
        storedPath: finalFileName,
        width: protectedEvidence.width,
        height: protectedEvidence.height,
        faces,
        plates,
        zones: protectedEvidence.zones,
        emulated: !googleVisionApiKey,
        ms: Math.round(performance.now() - startedAt),
      })
    );

    // 5. Retornamos la respuesta exitosa al frontend
    return json(
      {
        success: true,
        clientSideId,
        sanitizedUrl: publicUrlData.publicUrl,
        entitiesDetectedCount: protectedEvidence.zones.length,
        detectedZones: protectedEvidence.zones,
        imageWidth: protectedEvidence.width,
        imageHeight: protectedEvidence.height,
        message:
          protectedEvidence.zones.length > 0
            ? `Pixelamos ${faces} rostro(s) y ${plates} patente(s) y quitamos los metadatos.`
            : 'No encontramos rostros ni patentes; quitamos los metadatos.',
      },
      200
    );
  } catch (error: any) {
    // Fail-safe: no se guardó nada en 'report-evidences'; el original se purga en el finally
    const reason = error instanceof ProtectionError ? error.reason : 'internal_error';
    console.error(JSON.stringify({ event: 'evidence_fail_safe', reason, detail: error?.message }));

    return json(
      {
        success: false,
        failSafeTriggered: true,
        reason,
        error: 'No pudimos proteger tu foto. No se guardó ninguna copia.',
      },
      error instanceof ProtectionError ? statusForReason(error.reason) : 500
    );
  } finally {
    // 7. Principio Fail-Safe estricto: Eliminamos de forma irrecuperable la foto original del bucket de cuarentena
    if (quarantinePathToDelete) {
      try {
        await supabaseAdmin.storage
          .from(BUCKET_QUARANTINE)
          .remove([quarantinePathToDelete]);
        console.log(`[Fail-Safe] Fotografía original eliminada exitosamente de cuarentena: ${quarantinePathToDelete}`);
      } catch (purgeError) {
        console.error('[Fail-Safe] Error al purgar foto original de cuarentena:', purgeError);
      }
    }
  }
});
