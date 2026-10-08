/**
 * @file index.ts
 * @description Supabase Edge Function: verificación visual asíncrona de una evidencia fotográfica (REP-3818).
 * Runtime: Deno / TypeScript en Supabase Edge Functions.
 *
 * Compara la foto ya anonimizada (bucket report-evidences) con la descripción y la categoría del reporte y guarda
 * un resultado en report_image_analysis. NO emite fundamento jurídico, NO cambia el estado ni la categoría del
 * reporte y NO modifica analizar-reporte. Toda la lógica está en analyze.ts (probada con Vitest); este archivo solo
 * conecta Deno, Supabase y Gemini.
 *
 * La invoca dispatch_visual_analysis_queue (REP-3817) con el cuerpo { imageId, reportId, queueMessageId } y el header
 * x-visual-dispatch-token. Solo imageId y queueMessageId se usan: todo lo demás se lee de la base con la clave de
 * servicio (descripción, categoría, ruta de la foto), igual que en R5-05 de analizar-reporte.
 *
 * Secrets de la función (nunca en el repositorio):
 *   - VISUAL_DISPATCH_TOKEN : mismo valor que el secret visual_dispatch_token de Vault.
 *   - GEMINI_API_KEY        : ya configurada para analizar-reporte.
 *   - FUNCTION_COMMIT       : (opcional, REP-3822) commit que se despliega; queda en visual_call_log.deployment_id.
 *   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY : los inyecta Supabase.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';
import { analyzeImage, type AnalyzeDeps, type ImageRecord } from './analyze.ts';
import { EVIDENCE_BUCKET } from './contract.ts';
import { callGeminiVision } from './gemini.ts';
import { redactApiKeys } from './redact.ts';

const QUEUE_NAME = 'visual_analysis_queue';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-visual-dispatch-token',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

/** Comparación en tiempo constante: el token no se puede adivinar midiendo cuánto tarda el rechazo. */
const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  // Solo el despachador de la cola conoce este token: cualquier otro llamador, aunque tenga una sesión válida,
  // se rechaza antes de tocar Gemini o la base.
  const dispatchToken = Deno.env.get('VISUAL_DISPATCH_TOKEN') ?? '';
  const received = req.headers.get('x-visual-dispatch-token') ?? '';
  if (!dispatchToken || !safeEqual(received, dispatchToken)) {
    return json({ error: 'No autorizado.' }, 403);
  }

  let payload: { imageId?: unknown; queueMessageId?: unknown } | null = null;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'El cuerpo del pedido no es un JSON válido.' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
  const admin = createClient(supabaseUrl, serviceKey);

  const deps: AnalyzeDeps = {
    geminiConfigured: Boolean(geminiApiKey),

    getImage: async (imageId): Promise<ImageRecord | null> => {
      const { data, error } = await admin
        .from('report_images')
        .select('id, report_id, image_url, citizen_reports(client_side_id, description, services(service_code))')
        .eq('id', imageId)
        .maybeSingle();
      if (error) throw new Error(`No se pudo leer la evidencia: ${error.message}`);
      if (!data) return null;
      const report = data.citizen_reports as unknown as {
        client_side_id: string;
        description: string | null;
        services?: { service_code?: string } | null;
      } | null;
      if (!report) return null;
      return {
        id: data.id,
        report_id: data.report_id,
        image_url: data.image_url,
        client_side_id: report.client_side_id,
        description: report.description,
        service_code: report.services?.service_code ?? null,
      };
    },

    hasAnalysis: async (imageId) => {
      const { data, error } = await admin.from('report_image_analysis').select('id').eq('image_id', imageId).maybeSingle();
      if (error) throw new Error(`No se pudo consultar el análisis: ${error.message}`);
      return Boolean(data);
    },

    downloadEvidence: async (path) => {
      const { data, error } = await admin.storage.from(EVIDENCE_BUCKET).download(path);
      if (error || !data) throw new Error(error?.message ?? 'Archivo no encontrado');
      return { bytes: new Uint8Array(await data.arrayBuffer()), mimeType: data.type || null };
    },

    resolveServiceId: async (code) => {
      const { data } = await admin.from('services').select('id').eq('service_code', code).maybeSingle();
      return data?.id ?? null;
    },

    callModel: ({ model, imageBase64, mimeType, prompt }) =>
      callGeminiVision({ fetchFn: fetch as never, apiKey: geminiApiKey, model, imageBase64, mimeType, prompt }),

    persist: async (row) => {
      const { data, error } = await admin.rpc('persist_visual_analysis', { p_analysis: row });
      if (error || !data) {
        console.error('[analizar-imagen-reporte] No se pudo persistir el resultado:', redactApiKeys(error?.message ?? 'sin id'));
        return false;
      }
      return true;
    },

    deleteMessage: async (messageId) => {
      const { error } = await admin.rpc('pgmq_delete_message', { queue_name: QUEUE_NAME, msg_id: messageId });
      if (error) throw new Error(error.message);
    },

    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

    // REP-3822: un registro por intento contra Gemini. No lanza: el análisis no depende de este registro
    deploymentId: Deno.env.get('FUNCTION_COMMIT') ?? null,
    logCall: async (entry) => {
      const { error } = await admin.rpc('log_visual_call', { p_entry: entry });
      if (error) console.error('[analizar-imagen-reporte] No se pudo registrar el intento:', redactApiKeys(error.message));
    },
  };

  const { status, body } = await analyzeImage(deps, payload);
  return json(body, status);
});
