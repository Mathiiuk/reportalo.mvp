Feature: REP-3786 - Experimento de optimizacion del RAG
  # Como equipo tecnico
  # Quiero comparar variantes de top-k, umbral, thinking y salida con corridas reales
  # Para reducir tokens y latencia sin degradar precision, trazabilidad ni abstencion

  Background:
    Given el corpus, los casos y el modelo son constantes
    And la regla de decision esta fijada antes de correr

  Scenario: Cada variante se mide con los mismos casos
    When corro cada configuracion cinco veces por caso
    Then registro resultado, abstencion, citas, tokens, latencia y truncamientos

  Scenario Outline: Una variante solo reemplaza al baseline si cumple la regla
    Given la configuracion <variante>
    When la comparo con el baseline medido en el mismo experimento
    Then reemplaza al baseline solo si cumple aciertos, seguridad, recall, abstencion y ganancia medible

    Examples:
      | variante |
      | A        |
      | B        |
      | C        |

  Scenario: Recuperar menos no debe perder normativa relevante
    Given el baseline cita un fragmento que queda fuera del top-3
    When evaluo la variante con top-3
    Then informo la perdida aunque la regla a nivel de norma se cumpla

  Scenario: Ninguna variante mejora sin afectar calidad
    Given ninguna variante conserva la normativa relevante con ganancia medible
    When emito la recomendacion
    Then mantengo el baseline y documento el resultado

  Scenario: El experimento no modifica produccion
    When ejecuto las corridas
    Then solo hago lecturas sobre el corpus
    And no despliego ni modifico la Edge Function
