/**
 * @file server.mjs
 * @description Panel de prueba LOCAL para el RAG jurídico (REP-2908) — solo texto por ahora.
 * NO es parte de la app de Reportalo ni se despliega: es una herramienta de desarrollo
 * para que Matías pruebe el pipeline real (Postgres local + Gemini real) desde un
 * formulario, sin tener que escribir scripts cada vez.
 *
 * Corre analyzeReport() de src/services/legalRagService.js tal cual, con los
 * clientes reales de src/services/geminiClient.js — mismo código que usaría la
 * Edge Function analizar-reporte en producción, sin ningún stub.
 *
 * Uso:
 *   node scripts/rag-local-dev/panel/server.mjs
 *   abrir http://localhost:5175
 *
 * Requiere:
 *   - GEMINI_API_KEY en .env (raíz del repo)
 *   - Postgres local corriendo en localhost:5433 (supabase/local-dev/sql/native-no-pgvector/)
 *     con el esquema y el corpus ya cargados
 */

import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { analyzeReport } from '../../../src/services/legalRagService.js';
import { createGeminiEmbeddingsClient, createGeminiGenerationClient } from '../../../src/services/geminiClient.js';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvVar(name) {
  if (process.env[name]) return process.env[name];
  const envFile = readFileSync(path.resolve(__dirname, '../../../.env'), 'utf-8');
  const match = envFile.match(new RegExp(`^${name}=(.*)$`, 'm'));
  if (!match) throw new Error(`Falta ${name} en .env`);
  return match[1].trim();
}

const GEMINI_API_KEY = loadEnvVar('GEMINI_API_KEY');
const CONNECTION_STRING = process.env.RAG_DEV_DB_URL || 'postgresql://postgres@localhost:5433/reportalo_rag_dev';
const PORT = process.env.RAG_PANEL_PORT || 5175;

// Reintento simple ante 429/503 (picos de demanda transitorios de la API de Gemini)
async function fetchWithRetry(url, options, attempt = 1) {
  const response = await fetch(url, options);
  if ((response.status === 429 || response.status === 503) && attempt <= 4) {
    await new Promise((r) => setTimeout(r, attempt * 4000));
    return fetchWithRetry(url, options, attempt + 1);
  }
  return response;
}

const embeddingsClient = createGeminiEmbeddingsClient({ apiKey: GEMINI_API_KEY, fetchImpl: fetchWithRetry });
const generationClient = createGeminiGenerationClient({ apiKey: GEMINI_API_KEY, fetchImpl: fetchWithRetry, thinkingLevel: 'low' });

const pgClient = new Client({ connectionString: CONNECTION_STRING });
await pgClient.connect();

const supabaseClient = {
  rpc: async (fnName, args) => {
    try {
      const { rows } = await pgClient.query(
        `select * from public.${fnName}($1, $2, $3, $4)`,
        [args.query_embedding, args.p_locality_id, args.p_model_code, args.match_count]
      );
      return { data: rows, error: null };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },
};

const HTML_PAGE = readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(HTML_PAGE);
      return;
    }

    if (req.method === 'GET' && req.url === '/api/localities') {
      const { rows } = await pgClient.query(`
        select l.id, l.name, s.name as subdivision, sp.name as province
        from public.localities l
        join public.subdivisions s on s.id = l.subdivision_id
        join public.states_provinces sp on sp.id = s.state_province_id
        order by sp.name, s.name, l.name
      `);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(rows));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/analyze') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const { description, category, localityId } = JSON.parse(body || '{}');

      if (!description || !localityId) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Faltan description o localityId.' }));
        return;
      }

      const result = await analyzeReport({
        description,
        category: category || null,
        localityId,
        supabaseClient,
        embeddingsClient,
        generationClient,
      });

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Panel de prueba del RAG corriendo en http://localhost:${PORT}`);
  console.log('Solo texto por ahora (sin análisis de imagen todavía).');
});
