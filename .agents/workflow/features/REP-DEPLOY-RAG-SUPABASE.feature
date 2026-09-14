Feature: REP-DEPLOY-RAG-SUPABASE - Desplegar RAG productivo (REP-2908/2909) contra Supabase real
  # Como responsable tecnico del proyecto
  # Quiero que el RAG productivo (REP-2908/2909) este desplegado y cargado en el Supabase real
  # Para que Hernan y el resto del equipo puedan probarlo con datos y respuestas reales, no contra una base vacia

  Background:
    Given el seed de conocimiento juridico "docs/REP-3769_seed_y_RAG.sql" fue ejecutado contra el Supabase real
    And la Edge Function "analizar-reporte" esta desplegada en el Supabase real
    And las politicas RLS de "supabase/rag_rls_policies.sql" estan aplicadas
    And el pipeline asincrono de "supabase/rag_async_pipeline.sql" esta activo

  Scenario: Un reporte con normativa aplicable dispara el analisis y persiste el resultado
    Given un ciudadano crea un reporte que corresponde a jurisdiccion CABA con normativa cargada
    When el trigger encola el analisis y pg_cron lo despacha a la Edge Function
    Then el resultado se persiste en report_ai_analysis con status "fundamentado"
    And la cita generada existe literalmente en el fragmento recuperado
    And el mensaje se borra de la cola pgmq solo despues de la persistencia exitosa

  Scenario: Un reporte sin normativa cargada falla cerrado, no inventa
    Given un ciudadano crea un reporte para una categoria sin fragmentos cargados en esa jurisdiccion
    When el pipeline procesa el analisis
    Then el resultado persistido tiene status "sin_normativa"
    And no se genera ninguna cita ni texto legal inventado

  Scenario: RLS impide ver el analisis de un reporte que no corresponde
    Given un usuario que no atiende un reporte dado
    When intenta leer report_ai_analysis de ese reporte
    Then la consulta no devuelve filas por RLS

  Scenario Outline: Los 6 casos A-F de REP-3764 dan el mismo resultado contra Supabase real que en el entorno local
    # El status exacto de cada caso debe tomarse de src/test/LegalRagService.test.js
    # (los 24 tests ya escritos contra los fixtures), no de esta tabla — se deja
    # aqui solo el criterio de recuperacion documentado en REP-3764, que es
    # independiente del enum de status usado por el servicio.
    Given el caso "<caso>" de docs/REP-3764_casos_esperados.md
    When se ejecuta contra el Supabase real
    Then recupera los fragmentos esperados y descarta los que debe descartar segun REP-3764
    And el status resultante coincide con el que arrojo el mismo caso en la validacion local

    Examples:
      | caso | debe_recuperar                       | debe_descartar                  |
      | A    | items 1, 2, 3 (Avellaneda)            | item 8                          |
      | B    | items 6 y 7 juntos (CABA)              | item 5                          |
      | C    | item 5 (Avellaneda, mismo texto que B) | items 6 y 7                     |
      | D    | item 2 (Avellaneda) / item 4 (CABA)    | la misma norma para ambas       |
      | E    | item 5 (Avellaneda, encuadre transito) | item 8 (falso positivo lexico)  |
      | F    | nada del corpus                        | cualquier norma citada como si fundamentara |
