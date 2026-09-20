# ==============================================================================
# REP-3789 - Visualizacion del fundamento juridico del RAG en el frontend
# Palabras clave en ingles (estandar Gherkin) con comentarios en espanol.
# ==============================================================================

Feature: REP-3789 - Preservar y visualizar el fundamento juridico del RAG textual
  # Como ciudadano que envio un reporte
  # Quiero ver el fundamento juridico que la IA determino para mi reclamo
  # Para entender que norma lo respalda y que organismo es competente

  Background:
    Given un ciudadano autenticado con un reporte propio enviado

  # ----------------------------------------------------------------------------
  # ESCENARIO 1: Camino feliz - el analisis ya existe
  # ----------------------------------------------------------------------------
  Scenario: El ciudadano ve el fundamento legal de su reporte
    Given el reporte tiene un analisis en estado "fundamentado"
    When el ciudadano abre el detalle del reporte desde "Mis reportes"
    Then ve el fundamento redactado para el ciudadano
    And ve la norma detectada con su ruta jerarquica
    And ve el organismo competente sugerido
    But no ve ningun fragmento de tipo "sancion"

  # ----------------------------------------------------------------------------
  # ESCENARIO 2: Analisis asincrono todavia pendiente
  # ----------------------------------------------------------------------------
  Scenario: El analisis todavia no termino
    Given el reporte no tiene analisis persistido
    When el ciudadano abre el detalle del reporte
    Then ve un estado de procesamiento explicito
    And no ve un mensaje de error ni un panel vacio

  # ----------------------------------------------------------------------------
  # ESCENARIO 3: Actualizacion en vivo
  # ----------------------------------------------------------------------------
  Scenario: El fundamento aparece sin recargar la pantalla
    Given el ciudadano tiene abierto el detalle con el analisis pendiente
    When el backend persiste el analisis del reporte
    Then la pantalla muestra el fundamento sin que el usuario recargue

  Scenario: El respaldo actua cuando Realtime no conecta
    Given el canal de Realtime no logra suscribirse
    And el ciudadano tiene abierto el detalle con el analisis pendiente
    When el backend persiste el analisis del reporte
    Then el polling de respaldo actualiza la pantalla igual
    And deja de consultar una vez obtenido el resultado

  # ----------------------------------------------------------------------------
  # ESCENARIO 4: Fallar cerrado - nunca inventar fundamento
  # ----------------------------------------------------------------------------
  Scenario Outline: Estados sin fundamento se representan con transparencia
    Given el reporte tiene un analisis en estado "<estado>"
    When el ciudadano abre el detalle del reporte
    Then ve el mensaje propio de ese estado
    And no ve ninguna norma citada

    Examples:
      | estado           |
      | sin_normativa    |
      | indeterminado    |
      | fuera_de_alcance |
      | asistencia       |

  # ----------------------------------------------------------------------------
  # ESCENARIO 5: Privacidad - el detalle es del dueno
  # ----------------------------------------------------------------------------
  Scenario: Un reporte ajeno no expone su fundamento juridico
    Given un reporte que pertenece a otra cuenta
    When el ciudadano abre el detalle de ese reporte por su enlace directo
    Then no ve el fundamento juridico
    And ve un aviso de reporte no encontrado

  # ----------------------------------------------------------------------------
  # ESCENARIO 6: Linea de tiempo
  # ----------------------------------------------------------------------------
  Scenario: La linea de tiempo refleja el historial real
    Given el reporte tiene historial de estados registrado
    When el ciudadano abre el detalle del reporte
    Then ve los pasos alcanzados con su fecha real
    And ve los pasos pendientes sin fecha

  Scenario: La linea de tiempo funciona sin historial registrado
    Given el reporte no tiene filas de historial de estados
    When el ciudadano abre el detalle del reporte
    Then ve el primer paso derivado de la fecha de envio del reporte
    And ve los pasos siguientes como pendientes
