# ==============================================================================
# REP-2908 — RAG jurídico de producción
# Reemplaza el spike de REP-2907 (corpus hardcodeado + embedding léxico local)
# por un pipeline real: corpus en base, embeddings de Gemini, cascada
# jurisdiccional en SQL y generación con validación determinística anti-alucinación.
# ==============================================================================

Feature: REP-2908 - RAG jurídico de producción sin hardcode ni alucinación
  # Como ciudadano que reporta una incidencia
  # Quiero que el fundamento legal citado sea siempre real y verificable
  # Para que el organismo destinatario reciba una fundamentación que puede confiar

  Background:
    Given el corpus de conocimiento tiene fragmentos verificados cargados
    And el cliente de embeddings y el cliente de generación son dobles de prueba deterministicos

  # ----------------------------------------------------------------------------
  # Camino feliz: hay fragmentos suficientes, el LLM redacta citando lo recuperado
  # ----------------------------------------------------------------------------
  Scenario: El reporte recupera fragmentos relevantes y el fundamento cita solo eso
    Given un reporte con descripcion "Hay una boca de tormenta rota hace semanas en mi cuadra" en Avellaneda
    When se ejecuta el analisis del reporte
    Then el resultado recupera unicamente fragmentos de la jurisdiccion de Avellaneda o superior
    And el fundamento generado cita textualmente contenido de los fragmentos recuperados
    And el estado del resultado es "fundamentado"

  # ----------------------------------------------------------------------------
  # Aislamiento jurisdiccional: mismo texto, otra jurisdiccion, otro resultado
  # ----------------------------------------------------------------------------
  Scenario: El mismo reclamo en jurisdicciones distintas no devuelve la misma norma
    Given un reporte con descripcion "No anda la luz de la calle hace tres dias" en Avellaneda
    And otro reporte con la misma descripcion en CABA
    When se ejecuta el analisis de ambos reportes
    Then el resultado de Avellaneda no incluye ningun fragmento exclusivo de CABA
    And el resultado de CABA no incluye ningun fragmento exclusivo de Avellaneda o PBA

  # ----------------------------------------------------------------------------
  # Resistencia a falso positivo lexico
  # ----------------------------------------------------------------------------
  Scenario: Un distractor con vocabulario parecido no se cuela por similitud de palabras
    Given un reporte con descripcion "Hay quilombo en la esquina, discuten y frenan el transito todos los dias" en Avellaneda
    When se ejecuta el analisis del reporte
    Then el fragmento distractor del Codigo de Faltas no aparece entre los citados

  # ----------------------------------------------------------------------------
  # Sin evidencia suficiente: nunca se inventa una cita
  # ----------------------------------------------------------------------------
  Scenario: Sin fragmentos sobre el umbral de similitud, no se llama al LLM
    Given un reporte con descripcion "Un puesto vende bebidas en la vereda sin habilitacion" en Avellaneda
    When se ejecuta el analisis del reporte
    Then el estado del resultado es "sin_normativa"
    And el cliente de generacion no fue invocado

  # ----------------------------------------------------------------------------
  # Fallo cerrado ante una respuesta del LLM que no cumple el contrato
  # ----------------------------------------------------------------------------
  Scenario Outline: El resultado cae a indeterminado ante cualquier incumplimiento de validacion
    Given un reporte con fragmentos recuperados validos
    And el cliente de generacion devuelve una respuesta con "<falla>"
    When se ejecuta el analisis del reporte
    Then el estado del resultado es "indeterminado"
    And no se persiste ninguna cita como valida

    Examples:
      | falla                                             |
      | una cita que no aparece literal en el fragmento    |
      | un fragment_id que no estaba entre los recuperados |
      | un organismo_sugerido_id inexistente                |
      | un JSON que no cumple el esquema obligatorio         |
