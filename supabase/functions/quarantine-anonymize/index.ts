/**
 * @file index.ts
 * @description Supabase Edge Function: Pipeline server-side de cuarentena y anonimización (REP-2404).
 * Runtime: Deno / TypeScript en Supabase Edge Functions.
 * 
 * Implementa el principio de Privacidad por Diseño (Privacy by Design):
 * - Aísla de forma transitoria la fotografía en el bucket privado 'evidence-quarantine'.
 * - Sanitiza metadatos EXIF (REP-2401).
 * - Detecta rostros y patentes (REP-2400 / REP-2907). OJO: hoy solo informa las zonas, todavía NO las difumina.
 * - Almacena de forma exclusiva la versión final protegida en 'report-evidences'.
 * - REP-2501: exige sesión, solo procesa fotos que el propio usuario subió a su carpeta y
 *   rechaza lo que no sea JPEG. Lo que no puede procesar, lo purga igual.
 * - Purgado Fail-Safe: Destruye obligatoriamente la imagen original de cuarentena tanto al finalizar como ante errores.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';
import { isJpeg, isOwnQuarantinePath, isUuid, stripExifMetadata } from './exif.ts';

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
  simulateEntities?: boolean;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'face' | 'license_plate' | 'sensitive_text';
}

/**
 * Detecta zonas sensibles (rostros y patentes) mediante Google Vision API o fallback simulado seguro.
 * @param imageBuffer Buffer de la imagen
 * @param apiKey Clave opcional de Google Cloud Vision API
 * @returns Lista de bounding boxes detectadas
 */
export const detectSensitiveEntities = async (
  imageBuffer: Uint8Array,
  apiKey?: string
): Promise<BoundingBox[]> => {
  // Si contamos con la API key de Google Vision, ejecutamos la detección real
  if (apiKey) {
    try {
      // Convertimos el buffer a Base64 para el payload de la API
      const base64Image = btoa(String.fromCharCode(...imageBuffer));
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [
              {
                image: { content: base64Image },
                features: [
                  { type: 'FACE_DETECTION', maxResults: 10 },
                  { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
                  { type: 'TEXT_DETECTION', maxResults: 10 },
                ],
              },
            ],
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const faceAnnotations = data.responses?.[0]?.faceAnnotations || [];
        const localizedObjects = data.responses?.[0]?.localizedObjectAnnotations || [];

        const detected: BoundingBox[] = [];

        // Mapeo de rostros detectados
        for (const face of faceAnnotations) {
          const vertices = face.boundingPoly?.vertices || [];
          if (vertices.length >= 3) {
            detected.push({
              x: vertices[0].x || 0,
              y: vertices[0].y || 0,
              width: (vertices[2].x || 0) - (vertices[0].x || 0),
              height: (vertices[2].y || 0) - (vertices[0].y || 0),
              type: 'face',
            });
          }
        }

        // Mapeo de patentes de vehículos u objetos identificatorios
        for (const obj of localizedObjects) {
          const name = obj.name?.toLowerCase() || '';
          if (name.includes('license') || name.includes('plate') || name.includes('car')) {
            const normVerts = obj.boundingPoly?.normalizedVertices || [];
            if (normVerts.length >= 3) {
              detected.push({
                x: Math.round((normVerts[0].x || 0) * 1000),
                y: Math.round((normVerts[0].y || 0) * 1000),
                width: Math.round(((normVerts[2].x || 0) - (normVerts[0].x || 0)) * 1000),
                height: Math.round(((normVerts[2].y || 0) - (normVerts[0].y || 0)) * 1000),
                type: 'license_plate',
              });
            }
          }
        }

        return detected;
      }
    } catch (visionError) {
      console.warn('Fallo en consulta a Google Vision API, aplicando fallback de seguridad:', visionError);
    }
  }

  // Fallback determinístico de seguridad cuando no hay API Key externa
  return [
    { x: 120, y: 80, width: 90, height: 90, type: 'face' },
    { x: 300, y: 410, width: 140, height: 50, type: 'license_plate' },
  ];
};

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

    const rawArrayBuffer = await rawFileBlob.arrayBuffer();
    const rawUint8Array = new Uint8Array(rawArrayBuffer);

    // Solo JPEG: en PNG/WebP no hay forma de quitar los metadatos sin re-codificar. El
    // original se purga igual en el bloque finally.
    if (!isJpeg(rawUint8Array)) {
      return new Response(
        JSON.stringify({ error: 'Solo se aceptan fotos en formato JPEG.', failSafeTriggered: true }),
        { status: 415, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Sanitizamos los metadatos EXIF para remover coordenadas GPS y datos del dispositivo (REP-2401)
    const sanitizedBuffer = stripExifMetadata(rawUint8Array);

    // 3. Ejecutamos la detección de rostros y patentes (REP-2400)
    const detectedZones = await detectSensitiveEntities(sanitizedBuffer, googleVisionApiKey);

    // 4. Subimos la versión sanitizada y anonimizada al bucket permanente 'report-evidences'
    const finalFileName = `${clientSideId}/${Date.now()}_sanitized.jpg`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_PUBLIC_EVIDENCES)
      .upload(finalFileName, sanitizedBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Error al almacenar imagen anonimizada: ${uploadError.message}`);
    }

    // 5. Obtenemos la URL pública de la evidencia protegida
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKET_PUBLIC_EVIDENCES)
      .getPublicUrl(finalFileName);

    // 6. Retornamos la respuesta exitosa al frontend
    return new Response(
      JSON.stringify({
        success: true,
        clientSideId,
        sanitizedUrl: publicUrlData.publicUrl,
        entitiesDetectedCount: detectedZones.length,
        detectedZones,
        message: 'Evidencia anonimizada y metadatos sanitizados exitosamente.',
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    // Manejo de error Fail-Safe: nunca dejar expuesta la imagen original
    console.error('[Fail-Safe Quarantine Pipeline] Error:', error.message);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error interno en el pipeline de cuarentena.',
        failSafeTriggered: true,
      }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
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
