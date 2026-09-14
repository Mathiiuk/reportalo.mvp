# Test Plan — REP-DEPLOY-RAG-SUPABASE

## 1. Objetivo

Confirmar que el RAG productivo (REP-2908/2909), ya validado contra Postgres local + Gemini real, se comporta igual una vez desplegado contra el Supabase real — antes de habilitar pruebas de Hernán o de cualquier otra persona del equipo.

## 2. Riesgos a validar

- Que el seed real cargue el mismo contenido jurídico que se usó en la validación local (mismos casos A-F deben dar el mismo resultado).
- Que las políticas RLS no dejen expuesto `report_ai_analysis`/`report_ai_evidence` a usuarios que no atienden ese reporte.
- Que el pipeline asíncrono (trigger → pgmq → pg_cron → pg_net → Edge Function → persistencia) funcione de punta a punta en el entorno real, no solo en la simulación local.
- Que `GEMINI_API_KEY` no quede expuesta en ningún lugar del repo, logs, o config del frontend.
- Que la cuota diaria de Gemini (20 llamadas/día en free tier) no se agote durante la validación, dejando sin margen las pruebas de Hernán el mismo día.

## 3. Unit tests

- [ ] No aplica — ya cubierto en REP-2908/2909 (144 tests en el repo, sin cambios de código en esta tarea).

## 4. Integration tests

- [ ] Re-correr los 6 casos A-F de `docs/REP-3764_casos_esperados.md` contra el Supabase real (vía script adaptado o panel de pruebas apuntando a las credenciales reales) y comparar resultado por caso contra lo documentado en la validación local.
- [ ] Insertar un reporte de prueba real y verificar el pipeline asíncrono completo: aparece en la cola pgmq → `pg_cron` lo despacha → la Edge Function se invoca → el resultado se persiste en `report_ai_analysis`/`report_ai_evidence` → el mensaje se borra de la cola solo si la persistencia fue exitosa.

## 5. E2E tests

- [ ] Fuera de alcance — no existe todavía la pantalla real de detalle del reporte para el ciudadano (`ReportsPage.jsx` es mock); queda para un ticket propio.

## 6. Regression tests

- [ ] Confirmar que cargar el seed no rompe datos ya existentes en el Supabase real (reportes, perfiles, etc. de otras funcionalidades ya en producción/staging).

## 7. Security checks

- [ ] Verificar `GEMINI_API_KEY` vive únicamente en Supabase Vault (no en `.env`, no en el bundle del frontend, no en logs de la Edge Function).
- [ ] Probar RLS con al menos dos usuarios distintos (uno que atiende el reporte, otro que no) y confirmar que el segundo no puede leer `report_ai_analysis` de un reporte que no le corresponde.

## 8. Smoke tests

- [ ] Invocación manual de la Edge Function `analizar-reporte` recién desplegada, con un payload de prueba simple, confirmando que responde (no necesariamente el resultado final, solo que está viva).
- [ ] Ver logs de la Edge Function (`supabase functions logs analizar-reporte`) durante la primera corrida real sin errores inesperados.

## 9. Evidencia requerida

- comando: seed ejecutado (`psql`/Supabase SQL editor con `docs/REP-3769_seed_y_RAG.sql`); resultado: counts de `knowledge_sources`/`knowledge_fragments`/`fragment_embeddings`; entorno: Supabase real.
- comando: `supabase functions deploy analizar-reporte`; resultado: deploy exitoso; entorno: Supabase real.
- comando: re-corrida de los 6 casos A-F contra Supabase real; resultado: tabla comparativa local vs. real por caso; entorno: Supabase real.
- comando: prueba RLS cross-usuario; resultado: acceso denegado correctamente al usuario sin permiso; entorno: Supabase real.
- log: `supabase functions logs analizar-reporte` de la primera corrida de punta a punta.

## 10. Resultado

`PENDING`
