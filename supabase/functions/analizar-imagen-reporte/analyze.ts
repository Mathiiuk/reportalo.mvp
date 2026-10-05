/**
 * @file analyze.ts
 * @description Lógica de analizar-imagen-reporte (REP-3818): verifica la evidencia visual ya anonimizada contra la
 * descripción y la categoría del reporte. Todas las dependencias (base, bucket, modelo, cola) se inyectan: index.ts
 * las conecta a Supabase y a Gemini, y Vitest las reemplaza para probar cada camino sin red ni Deno.
 *
 * Qué NO hace, a propósito (criterios de aceptación de REP-3818):
 *   - No cambia el estado ni la categoría del reporte, ni toca el fundamento jurídico: solo guarda un resultado en
 *     report_image_analysis (vía persist_visual_analysis). No modifica analizar-reporte.
 *   - No emite fundamento jurídico y no analiza la categoría VULNERABILIDAD_SOCIAL.
 *   - No confía en el cuerpo del pedido: descripción, categoría y ruta de la foto salen de la base.
 *
 * Falla cerrada: ante un error o una validación fallida del modelo se guarda un estado controlado ('fallido' o
 * 'omitido') y el reporte sigue su curso. Los errores transitorios (modelo no disponible, red, lectura del bucket,
 * clave sin configurar) NO se guardan: la función responde 503, el mensaje queda en la cola y el despachador lo
 * reintenta (y tras 3 intentos lo marca 'fallido').
 */

import {
  ALLOWED_IMAGE_MIME_TYPES,
  FALLBACK_MODELS,
  MAX_IMAGE_BYTES,
  NO_SERVICE,
  PRIMARY_MODEL,
  PROMPT_VERSION,
  VULNERABILIDAD_SOCIAL_SERVICE_CODE,
  buildPrompt,
  containsPersonalData,
  extractEvidencePath,
  mimeTypeFromPath,
  truncateReason,
  validateOutput,
  type AnalysisRow,
  type VisualOutput,
} from './contract.ts';
import type { GeminiResult } from './gemini.ts';
import { redactApiKeys } from './redact.ts';

export type ImageRecord = {
  id: string;
  report_id: string;
  image_url: string;
  client_side_id: string;
  description: string | null;
  service_code: string | null;
};

export interface AnalyzeDeps {
  /** Evidencia + reporte + categoría, leídos de la base con la clave de servicio. */
  getImage(imageId: string): Promise<ImageRecord | null>;
  hasAnalysis(imageId: string): Promise<boolean>;
  /** Descarga la foto del bucket report-evidences. Lanza si no se puede leer. */
  downloadEvidence(path: string): Promise<{ bytes: Uint8Array; mimeType: string | null }>;
  resolveServiceId(code: string): Promise<string | null>;
  callModel(args: { model: string; imageBase64: string; mimeType: string; prompt: string }): Promise<GeminiResult>;
  /** persist_visual_analysis: idempotente. Devuelve true si el resultado quedó guardado. */
  persist(row: AnalysisRow): Promise<boolean>;
  /** pgmq_delete_message sobre visual_analysis_queue. */
  deleteMessage(messageId: number): Promise<void>;
  sleep(ms: number): Promise<void>;
  geminiConfigured: boolean;
}

export type AnalyzeResponse = { status: number; body: Record<string, unknown> };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Espera entre el primer intento y el reintento del modelo principal (429/5xx). */
export const RETRY_BACKOFF_MS = 1500;

// Estados HTTP que significan «el modelo no está disponible ahora» (no un problema de la foto): se reintenta y,
// si persiste, se prueba el siguiente modelo. 404 = modelo retirado; 401/403 = clave o permisos (problema de
// configuración, no del reporte).
const UNAVAILABLE_STATUSES = [401, 403, 404, 408, 429, 500, 502, 503, 504];

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const errorMessage = (error: unknown): string => redactApiKeys(error instanceof Error ? error.message : String(error));

export const analyzeImage = async (
  deps: AnalyzeDeps,
  payload: { imageId?: unknown; queueMessageId?: unknown } | null
): Promise<AnalyzeResponse> => {
  const imageId = typeof payload?.imageId === 'string' ? payload.imageId : '';
  const messageId = typeof payload?.queueMessageId === 'number' ? payload.queueMessageId : null;
  if (!UUID_PATTERN.test(imageId)) {
    return { status: 400, body: { error: 'Falta el parámetro requerido: imageId (UUID).' } };
  }

  const dropMessage = async () => {
    if (messageId === null) return;
    try {
      await deps.deleteMessage(messageId);
    } catch (error) {
      // El resultado ya está guardado: si el mensaje no se borra, el despachador lo descarta solo en su próxima corrida
      console.error('[analizar-imagen-reporte] Resultado guardado pero no se pudo borrar el mensaje:', errorMessage(error));
    }
  };

  /** Guarda un resultado controlado y, solo si quedó guardado, borra el mensaje de la cola. */
  const finish = async (row: AnalysisRow, extra: Record<string, unknown> = {}): Promise<AnalyzeResponse> => {
    const saved = await deps.persist(row);
    if (!saved) {
      // Sin resultado guardado el mensaje se queda: pgmq lo reintenta (falla cerrada a nivel de la cola)
      return { status: 500, body: { error: 'No se pudo guardar el resultado.', estado: row.status } };
    }
    await dropMessage();
    return { status: 200, body: { estado: row.status, modelo: row.model_code, motivo: row.status_reason, ...extra } };
  };

  const emptyRow = (status: AnalysisRow['status'], reason: string, extra: Partial<AnalysisRow> = {}): AnalysisRow => ({
    image_id: imageId,
    status,
    scene_summary: null,
    coherence: null,
    suggested_service_id: null,
    quality_flags: [],
    confidence_score: null,
    model_code: null,
    prompt_version: null,
    input_tokens: null,
    output_tokens: null,
    latency_ms: null,
    status_reason: truncateReason(reason),
    ...extra,
  });

  try {
    // La evidencia, la descripción y la categoría se leen de la base: lo que venga en el cuerpo se ignora
    const image = await deps.getImage(imageId);
    if (!image) {
      // Evidencia borrada: no hay a qué asociar un resultado ni sentido en reintentar
      await dropMessage();
      return { status: 404, body: { error: `No se encontró la evidencia "${imageId}".` } };
    }

    // Idempotencia: si ya tiene resultado no se paga otra llamada al modelo
    if (await deps.hasAnalysis(imageId)) {
      await dropMessage();
      return { status: 200, body: { estado: 'ya_analizada' } };
    }

    // Esta categoría es una derivación a asistencia social, no un reclamo verificable por foto
    if (image.service_code === VULNERABILIDAD_SOCIAL_SERVICE_CODE) {
      return await finish(emptyRow('omitido', 'categoria_no_analizable'));
    }

    const description = (image.description ?? '').trim();
    if (!description) return await finish(emptyRow('fallido', 'reporte_sin_descripcion'));

    // Solo se lee la foto ya anonimizada del propio reporte, desde report-evidences
    const path = extractEvidencePath(image.image_url, image.client_side_id);
    if (!path) return await finish(emptyRow('fallido', 'ruta_de_evidencia_invalida'));

    if (!deps.geminiConfigured) {
      return { status: 503, body: { error: 'GEMINI_API_KEY no configurada en los secrets de la función.' } };
    }

    let evidence: { bytes: Uint8Array; mimeType: string | null };
    try {
      evidence = await deps.downloadEvidence(path);
    } catch (error) {
      return { status: 503, body: { error: `No se pudo leer la evidencia: ${errorMessage(error)}` } };
    }
    if (evidence.bytes.length === 0 || evidence.bytes.length > MAX_IMAGE_BYTES) {
      return await finish(emptyRow('fallido', evidence.bytes.length === 0 ? 'imagen_vacia' : 'imagen_demasiado_grande'));
    }
    const mimeType = mimeTypeFromPath(path, evidence.mimeType);
    if (!mimeType || !ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
      return await finish(emptyRow('fallido', 'formato_de_imagen_no_soportado'));
    }

    const prompt = buildPrompt({ description, categoryCode: image.service_code ?? 'SIN_CATEGORIA' });
    const imageBase64 = toBase64(evidence.bytes);

    // Modelo principal (con un reintento) y, solo ante indisponibilidad, los respaldos validados en REP-3816
    const models = [PRIMARY_MODEL, ...FALLBACK_MODELS];
    let answered: { model: string; result: GeminiResult } | null = null;
    let rejected: { model: string; result: GeminiResult } | null = null;
    let unavailableReason = 'sin respuesta';
    search: for (let m = 0; m < models.length; m += 1) {
      const attempts = m === 0 ? 2 : 1;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        let result: GeminiResult;
        try {
          result = await deps.callModel({ model: models[m], imageBase64, mimeType, prompt });
        } catch (error) {
          unavailableReason = `${models[m]}: ${errorMessage(error)}`;
          if (attempt < attempts) await deps.sleep(RETRY_BACKOFF_MS);
          continue;
        }
        if (result.ok) {
          answered = { model: models[m], result };
          break search;
        }
        if (UNAVAILABLE_STATUSES.includes(result.status)) {
          unavailableReason = `${models[m]}: HTTP ${result.status}`;
          if (attempt < attempts) await deps.sleep(RETRY_BACKOFF_MS);
          continue;
        }
        // 400 y similares: el modelo rechazó el pedido; otro modelo no lo arregla
        rejected = { model: models[m], result };
        break search;
      }
    }

    if (!answered && !rejected) {
      // Ningún modelo disponible: transitorio, no se guarda nada y el despachador reintenta
      return { status: 503, body: { error: `Modelo no disponible (${unavailableReason}).` } };
    }

    if (rejected) {
      return await finish(
        emptyRow(
          'fallido',
          `solicitud_rechazada_por_el_modelo (HTTP ${rejected.result.status}): ${redactApiKeys(rejected.result.errorText ?? '')}`,
          { model_code: rejected.model, prompt_version: PROMPT_VERSION, latency_ms: Math.round(rejected.result.latencyMs) }
        )
      );
    }

    const { model, result } = answered as { model: string; result: GeminiResult };
    const usage = result.data?.usageMetadata ?? {};
    const outputTokens =
      usage.candidatesTokenCount === undefined && usage.thoughtsTokenCount === undefined
        ? null
        : (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
    // Gemini ya respondió (y se pagó): modelo, prompt y consumo se guardan también si la validación lo rechaza
    const metadata: Partial<AnalysisRow> = {
      model_code: model,
      prompt_version: PROMPT_VERSION,
      input_tokens: usage.promptTokenCount ?? null,
      output_tokens: outputTokens,
      latency_ms: Math.round(result.latencyMs),
    };

    const blockReason = result.data?.promptFeedback?.blockReason;
    if (blockReason) return await finish(emptyRow('fallido', `bloqueado_por_el_modelo (${blockReason})`, metadata));

    const candidate = result.data?.candidates?.[0];
    if (candidate?.finishReason !== 'STOP') {
      return await finish(emptyRow('fallido', `respuesta_incompleta (finishReason: ${candidate?.finishReason ?? 'desconocido'})`, metadata));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse((candidate.content?.parts ?? []).map((part: { text?: string }) => part.text ?? '').join(''));
    } catch {
      return await finish(emptyRow('fallido', 'respuesta_no_json', metadata));
    }

    const validation = validateOutput(parsed);
    if (!validation.valid) return await finish(emptyRow('fallido', `validacion: ${validation.reason}`, metadata));
    const output = parsed as VisualOutput;

    // Segunda defensa contra datos personales: si el resumen los trae, no se guarda
    if (containsPersonalData(output.scene_summary)) {
      return await finish(emptyRow('fallido', 'resumen_con_datos_personales', metadata));
    }

    const suggestedServiceId = output.suggested_service_code === NO_SERVICE ? null : await deps.resolveServiceId(output.suggested_service_code);

    return await finish({
      image_id: imageId,
      status: 'completado',
      scene_summary: output.scene_summary.trim(),
      coherence: output.coherence,
      suggested_service_id: suggestedServiceId,
      quality_flags: [...new Set(output.quality_flags)],
      // Solo observabilidad (REP-3816): nunca se usa como probabilidad ni para decidir
      confidence_score: output.confidence_score,
      model_code: model,
      prompt_version: PROMPT_VERSION,
      input_tokens: metadata.input_tokens ?? null,
      output_tokens: metadata.output_tokens ?? null,
      latency_ms: metadata.latency_ms ?? null,
      status_reason: null,
    });
  } catch (error) {
    // Cualquier error no previsto (base, red) no guarda nada y deja el mensaje en la cola para reintentar
    return { status: 500, body: { error: errorMessage(error) } };
  }
};
