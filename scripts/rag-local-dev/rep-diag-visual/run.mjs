// REP-3839 · D6: repetibilidad de la verificación visual (analizar-imagen-reporte) sobre reportes reales, SIN escribir.
//
// Corre la MISMA lógica de la función (supabase/functions/analizar-imagen-reporte/analyze.ts, importada tal cual) con
// las dependencias en memoria: lee el reporte, la categoría y la foto ya anonimizada de staging (solo GET), llama a
// Gemini como la función y captura lo que la función GUARDARÍA, sin guardarlo. No crea reportes, no usa la cola, no
// escribe report_image_analysis ni visual_call_log. Al final controla que categoría y estado del reporte no cambiaron.
//
// Uso (desde la raíz del repo, Node 24: importa los .ts de la función sin compilar):
//   node scripts/rag-local-dev/rep-diag-visual/run.mjs --reportes 5e690a94-...,76b90fc9-... [--repeticiones 5]
//        [--despliegue "analizar-imagen-reporte v3"] [--etiquetas B9-66,B9-75] [--env .env]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { leerEnv, crearRest, marcaDeTiempo } from '../p0/entorno.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const FN_DIR = path.join(ROOT, 'supabase/functions/analizar-imagen-reporte');
const ESQUEMA = 'rag-d6/v1';

const args = process.argv.slice(2);
const valor = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const reportes = (valor('--reportes') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const etiquetas = (valor('--etiquetas') ?? '').split(',').map((s) => s.trim());
const repeticiones = Number(valor('--repeticiones') ?? 5);
if (!reportes.length) throw new Error('--reportes <uuid,uuid> es obligatorio');
if (!Number.isInteger(repeticiones) || repeticiones < 1 || repeticiones > 10) throw new Error('--repeticiones debe ser un entero entre 1 y 10');

const { analyzeImage } = await import(pathToFileURL(path.join(FN_DIR, 'analyze.ts')).href);
const { callGeminiVision } = await import(pathToFileURL(path.join(FN_DIR, 'gemini.ts')).href);
const contrato = await import(pathToFileURL(path.join(FN_DIR, 'contract.ts')).href);

const { need } = leerEnv(valor('--env') ?? path.join(ROOT, '.env'));
const supabaseUrl = need('VITE_SUPABASE_URL');
const serviceKey = need('SUPABASE_SERVICE_ROLE_KEY');
const apiKey = need('GEMINI_API_KEY');
const rest = crearRest(supabaseUrl, serviceKey);
const authHeaders = { apikey: serviceKey, ...(serviceKey.startsWith('eyJ') ? { Authorization: `Bearer ${serviceKey}` } : {}) };

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const sha256Archivo = (p) => sha256(fs.readFileSync(p));
const git = (cmd) => {
  try {
    return execSync(`git ${cmd}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
};

const servicios = await rest('services?select=id,service_code');
const codigoDeServicio = new Map(servicios.map((s) => [s.id, s.service_code]));
const idDeServicio = new Map(servicios.map((s) => [s.service_code, s.id]));

/** Foto del bucket (GET autenticado con la clave de servicio, igual que admin.storage.download de la función). */
const descargarEvidencia = async (ruta) => {
  for (const demora of [2000, 5000, 10000, null]) {
    try {
      const res = await fetch(`${supabaseUrl}/storage/v1/object/authenticated/report-evidences/${ruta.split('/').map(encodeURIComponent).join('/')}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`Storage ${res.status}`);
      return { bytes: new Uint8Array(await res.arrayBuffer()), mimeType: res.headers.get('content-type') };
    } catch (e) {
      if (demora === null) throw e;
      await new Promise((r) => setTimeout(r, demora));
    }
  }
};

const leerReporte = async (reportId) => {
  const [r] = await rest(`citizen_reports?select=id,client_side_id,description,service_id,current_state_code,updated_at&id=eq.${reportId}`);
  if (!r) throw new Error(`No existe el reporte ${reportId}`);
  return r;
};

const inicio = new Date().toISOString();
const casos = [];
const resultados = [];

for (const [n, reportId] of reportes.entries()) {
  const reporte = await leerReporte(reportId);
  const imagenes = await rest(`report_images?select=id,report_id,image_url&report_id=eq.${reportId}`);
  if (imagenes.length !== 1) throw new Error(`El reporte ${reportId} tiene ${imagenes.length} fotos; D6 espera 1`);
  const imagen = imagenes[0];
  const serviceCode = codigoDeServicio.get(reporte.service_id) ?? null;
  const ruta = contrato.extractEvidencePath(imagen.image_url, reporte.client_side_id);
  const foto = await descargarEvidencia(ruta);
  const fotoSha = sha256(foto.bytes);
  const analisisGuardados = await rest(
    `report_image_analysis?select=status,coherence,suggested_service_id,quality_flags,confidence_score,model_code,prompt_version,created_at&report_id=eq.${reportId}`
  );
  const caso = {
    caso_id: etiquetas[n] || `D6-${n + 1}`,
    report_id: reportId,
    image_id: imagen.id,
    categoria: serviceCode,
    descripcion: reporte.description,
    foto_sha256: fotoSha,
    foto_bytes: foto.bytes.length,
    estado_reporte_antes: reporte.current_state_code,
    // Lo que guardó producción el día que se creó el reporte (antecedente, no es una repetición de esta corrida)
    analisis_original: analisisGuardados.map((a) => ({ ...a, suggested_service_code: a.suggested_service_id ? codigoDeServicio.get(a.suggested_service_id) ?? null : null })),
  };
  casos.push(caso);

  for (let rep = 1; rep <= repeticiones; rep += 1) {
    const guardado = { fila: null, intentos: [] };
    const deps = {
      getImage: async () => ({
        id: imagen.id,
        report_id: reportId,
        image_url: imagen.image_url,
        client_side_id: reporte.client_side_id,
        description: reporte.description,
        service_code: serviceCode,
      }),
      // Siempre false: cada repetición es una llamada nueva al modelo (la función, en cambio, no repite si ya hay resultado)
      hasAnalysis: async () => false,
      // La misma foto en todas las repeticiones, descargada una sola vez
      downloadEvidence: async () => ({ bytes: foto.bytes, mimeType: foto.mimeType }),
      resolveServiceId: async (code) => idDeServicio.get(code) ?? null,
      callModel: ({ model, imageBase64, mimeType, prompt }) =>
        callGeminiVision({ fetchFn: fetch, apiKey, model, imageBase64, mimeType, prompt }),
      // NO se persiste: se captura lo que la función guardaría
      persist: async (row) => {
        guardado.fila = row;
        return true;
      },
      deleteMessage: async () => {},
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      geminiConfigured: true,
      logCall: async (entry) => {
        guardado.intentos.push({
          intento: entry.attempt,
          modelo_pedido: entry.model_requested,
          modelo_devuelto: entry.model_returned,
          http_status: entry.http_status,
          estado: entry.status,
          error: entry.error_code,
          duracion_ms: entry.duration_ms,
          tokens_entrada: entry.input_tokens,
          tokens_salida: entry.output_tokens,
          tokens_thinking: entry.thinking_tokens,
        });
      },
      deploymentId: null,
    };
    const fecha = new Date().toISOString();
    const respuesta = await analyzeImage(deps, { imageId: imagen.id, queueMessageId: null });
    const f = guardado.fila;
    resultados.push({
      caso_id: caso.caso_id,
      repeticion: rep,
      fecha_utc: fecha,
      foto_sha256: fotoSha,
      http_funcion: respuesta.status,
      resultado: f?.status ?? null,
      coherencia: f?.coherence ?? null,
      categoria_sugerida: f?.suggested_service_id ? codigoDeServicio.get(f.suggested_service_id) ?? null : f ? contrato.NO_SERVICE : null,
      marcas_calidad: f?.quality_flags ?? null,
      confianza: f?.confidence_score ?? null,
      resumen_escena: f?.scene_summary ?? null,
      motivo: f?.status_reason ?? (respuesta.status !== 200 ? respuesta.body?.error ?? null : null),
      modelo: f?.model_code ?? null,
      prompt_version: f?.prompt_version ?? null,
      tokens_entrada: f?.input_tokens ?? null,
      tokens_salida: f?.output_tokens ?? null,
      latencia_ms: f?.latency_ms ?? null,
      intentos: guardado.intentos,
    });
    console.log(`${caso.caso_id} r${rep}: ${f?.status ?? respuesta.status} · ${f?.coherence ?? '-'} · sugerida ${resultados.at(-1).categoria_sugerida}`);
  }

  // Control: la corrida no tocó el reporte (categoría y estado iguales que antes)
  const despues = await leerReporte(reportId);
  caso.reporte_sin_cambios = despues.service_id === reporte.service_id && despues.current_state_code === reporte.current_state_code && despues.updated_at === reporte.updated_at;
  const analisisDespues = await rest(`report_image_analysis?select=id&report_id=eq.${reportId}`);
  caso.sin_analisis_nuevos = analisisDespues.length === analisisGuardados.length;
}

const resumenCaso = (id) => {
  const rs = resultados.filter((r) => r.caso_id === id);
  const contar = (k) => rs.reduce((a, r) => ({ ...a, [r[k] ?? 'null']: (a[r[k] ?? 'null'] ?? 0) + 1 }), {});
  return {
    repeticiones: rs.length,
    resultado: contar('resultado'),
    coherencia: contar('coherencia'),
    categoria_sugerida: contar('categoria_sugerida'),
    marcas_calidad: rs.reduce((a, r) => ({ ...a, [JSON.stringify([...(r.marcas_calidad ?? [])].sort())]: (a[JSON.stringify([...(r.marcas_calidad ?? [])].sort())] ?? 0) + 1 }), {}),
    // Estable = mismo resultado, misma coherencia y misma categoría sugerida en todas las repeticiones
    estable: new Set(rs.map((r) => `${r.resultado}|${r.coherencia}|${r.categoria_sugerida}`)).size === 1,
  };
};

const fnArchivos = ['index.ts', 'analyze.ts', 'contract.ts', 'gemini.ts', 'redact.ts'];
const salida = {
  esquema: ESQUEMA,
  medicion: 'D6',
  ticket: 'REP-3839',
  inicio_utc: inicio,
  fin_utc: new Date().toISOString(),
  repeticiones,
  motor: {
    analizar_imagen_reporte: {
      despliegue: valor('--despliegue'),
      commit_codigo: git('log -1 --format=%H -- supabase/functions/analizar-imagen-reporte'),
      commit_repo: git('rev-parse HEAD'),
      cambios_locales_en_funcion: Boolean(git('status --porcelain -- supabase/functions/analizar-imagen-reporte')),
      sha256_archivos: Object.fromEntries(fnArchivos.map((a) => [a, sha256Archivo(path.join(FN_DIR, a))])),
    },
    prompt_version: contrato.PROMPT_VERSION,
    modelo_principal: contrato.PRIMARY_MODEL,
    modelos_respaldo: contrato.FALLBACK_MODELS,
    // gemini.ts: sin temperature explícita (validado en REP-3816), thinkingLevel low, salida JSON con esquema
    temperatura: 'no se fija (valor por defecto del modelo)',
    semilla: 'no se usa',
    thinking: 'low',
    max_output_tokens: 1024,
  },
  no_escribe: 'Solo GET a la API REST y a Storage. Sin persist_visual_analysis, log_visual_call ni cola.',
  casos,
  resultados,
  resumen: Object.fromEntries(casos.map((c) => [c.caso_id, resumenCaso(c.caso_id)])),
};
const dirSalida = path.join(__dirname, 'salida');
fs.mkdirSync(dirSalida, { recursive: true });
const nombre = `RAG-D6_visual_${marcaDeTiempo(inicio)}.json`;
fs.writeFileSync(path.join(dirSalida, nombre), JSON.stringify(salida, null, 2));
console.log(JSON.stringify(salida.resumen, null, 2));
console.log(`Salida: ${path.relative(ROOT, path.join(dirSalida, nombre))}`);
