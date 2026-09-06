# ==============================================================================
# PLANTILLA ESTÁNDAR DE ESPECIFICACIÓN BDD EN GHERKIN
# ==============================================================================
# Propósito: Definir los criterios de aceptación y el comportamiento del sistema
# en un formato legible por humanos y ejecutable por máquinas (Cucumber).
# Palabras clave en inglés (estándar universal) con comentarios en español.
# ==============================================================================

Feature: REP-2703 - Persistir borrador y evidencia offline en IndexedDB
  # Como [rol del usuario]
  # Quiero [acción o funcionalidad deseada]
  # Para [beneficio o valor de negocio obtenido]

  # ----------------------------------------------------------------------------
  # CONTEXTO / PRECONDICIONES COMUNES (Opcional)
  # Se ejecuta antes de cada escenario de esta característica
  # ----------------------------------------------------------------------------
  Background:
    Given the environment is initialized for "REP-2703"

  # ----------------------------------------------------------------------------
  # ESCENARIO 1: Camino Feliz (Happy Path)
  # Describe el flujo principal donde todo funciona según lo esperado
  # ----------------------------------------------------------------------------
  Scenario: Successful execution of main flow
    Given the system is in a valid initial state
    When the user performs the primary action with valid input
    Then the system should produce the expected successful result
    And the state changes should be persisted correctly

  # ----------------------------------------------------------------------------
  # ESCENARIO 2: Caso de Validación / Error (Edge Case / Error Handling)
  # Describe cómo reacciona el sistema ante entradas inválidas o fallos
  # ----------------------------------------------------------------------------
  Scenario: Handling invalid input or edge case
    Given the system is ready
    When the user provides invalid or empty data
    Then the system should reject the request with a clear error message
    And no unauthorized state changes should occur

  # ----------------------------------------------------------------------------
  # ESCENARIO 3: Esquema del Escenario con Ejemplos (Data-Driven Testing)
  # Permite probar múltiples combinaciones de datos con la misma lógica
  # ----------------------------------------------------------------------------
  Scenario Outline: Processing multiple input combinations
    Given an input value of "<input_val>"
    When the validation logic is executed
    Then the resulting status should be "<expected_status>"

    Examples:
      | input_val | expected_status |
      | valid_1   | success         |
      | valid_2   | success         |
      | invalid_0 | error           |
