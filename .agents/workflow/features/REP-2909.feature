# ==============================================================================
# REP-2909 — Cerrar el RAG productivo: pipeline asíncrono, persistencia, RLS,
# pantalla del ciudadano. Continuación directa de REP-2908.
# ==============================================================================

Feature: REP-2909 - El análisis del RAG llega al ciudadano de forma confiable
  # Como ciudadano que ya envió un reporte
  # Quiero ver el fundamento legal de mi reclamo, o saber con transparencia que no lo hay
  # Para confiar en que Reportalo no me esconde ni me inventa nada

  Background:
    Given un reporte ya fue creado por un ciudadano
    And el análisis del RAG (REP-2908) ya se ejecutó para ese reporte

  Scenario: El análisis se guarda y el ciudadano lo ve
    Given el resultado del análisis es "fundamentado" con citas válidas
    When se persiste el análisis en report_ai_analysis y report_ai_evidence
    Then el mensaje de la cola se borra solo después de guardar con éxito
    And el ciudadano dueño del reporte puede ver el fundamento en el detalle de su reporte

  Scenario: Un ciudadano no puede ver el análisis de un reporte ajeno
    Given existe un análisis guardado para el reporte de otro ciudadano
    When un ciudadano distinto intenta leer ese análisis
    Then la política RLS le niega el acceso

  Scenario: Sin evidencia normativa, se muestra de forma transparente
    Given el resultado del análisis es "sin_normativa"
    When el ciudadano abre el detalle de su reporte
    Then se muestra un mensaje claro de que no hay fundamento normativo cargado
    And no se muestra ningún texto inventado como si fuera una cita

  Scenario: Un fallo de generación nunca deja el reporte sin rastro
    Given la Edge Function falla al llamar a Gemini
    When el pipeline asíncrono reintenta el mensaje de la cola
    Then el análisis queda como "indeterminado" tras los reintentos
    And el ciudadano ve un estado transparente, no un error técnico

  Scenario Outline: La pantalla del ciudadano nunca expone contenido de sanción
    Given un fragmento citado tiene foundation_type_code "<tipo>"
    When se renderiza el panel de análisis del ciudadano
    Then el contenido del fragmento se muestra "<visible>"

    Examples:
      | tipo                | visible |
      | obligacion          | true    |
      | conducta_prohibida  | true    |
      | competencia         | true    |
      | sancion             | false   |
