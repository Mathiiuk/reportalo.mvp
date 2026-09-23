/**
 * @file index.ts
 * @description Supabase Edge Function: purga de la cuarentena de evidencias (REP-2501).
 *
 * La foto original vive en 'evidence-quarantine' solo mientras quarantine-anonymize la
 * procesa, y esa función la borra siempre al terminar. Pero si el cliente sube la foto y
 * nunca invoca la función (se cortó la red, cerró la app), la original quedaba guardada
 * para siempre. Esta función la elimina cuando supera la ventana de 1 hora.
 *
 * La invoca pg_cron cada 15 minutos, con la clave de servicio (ver la migración REP-2501).
 * Se despliega con verify_jwt activado y además exige la clave de servicio: un JWT de
 * ciudadano no alcanza.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';
import { QUARANTINE_MAX_AGE_MS, selectExpiredPaths, type StoredObject } from './purge.ts';

const BUCKET_QUARANTINE = 'evidence-quarantine';
const PAGE_SIZE = 1000;
const REMOVE_CHUNK = 100;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Solo la clave de servicio puede disparar la purga
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!serviceKey || bearer !== serviceKey) {
    return json({ error: 'No autorizado.' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const storage = admin.storage.from(BUCKET_QUARANTINE);

  try {
    // Las fotos viven en carpetas por usuario; también se revisa la raíz por las rutas
    // viejas (`temp_<id>_<ts>.jpg`) que subía la versión anterior de la app.
    const { data: rootEntries, error: rootError } = await storage.list('', { limit: PAGE_SIZE });
    if (rootError) throw new Error(`No se pudo listar la cuarentena: ${rootError.message}`);

    const candidates: StoredObject[] = [];
    for (const entry of rootEntries ?? []) {
      // Las carpetas vienen sin id ni fecha
      if (entry.id) {
        candidates.push({ name: entry.name, created_at: entry.created_at });
        continue;
      }
      const { data: files, error: folderError } = await storage.list(entry.name, { limit: PAGE_SIZE });
      if (folderError) throw new Error(`No se pudo listar ${entry.name}: ${folderError.message}`);
      for (const file of files ?? []) {
        if (file.id) candidates.push({ name: `${entry.name}/${file.name}`, created_at: file.created_at });
      }
    }

    const expired = selectExpiredPaths(candidates, Date.now(), QUARANTINE_MAX_AGE_MS);

    let removed = 0;
    for (let i = 0; i < expired.length; i += REMOVE_CHUNK) {
      const chunk = expired.slice(i, i + REMOVE_CHUNK);
      const { error: removeError } = await storage.remove(chunk);
      if (removeError) throw new Error(`No se pudo borrar de cuarentena: ${removeError.message}`);
      removed += chunk.length;
    }

    console.log(`[Quarantine Purge] revisados=${candidates.length} eliminados=${removed}`);
    return json({ success: true, scanned: candidates.length, removed });
  } catch (error: any) {
    console.error('[Quarantine Purge] Error:', error.message);
    return json({ success: false, error: error.message }, 500);
  }
});
