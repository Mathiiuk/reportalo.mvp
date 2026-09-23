Feature: REP-2203 - Escribir descripcion breve del reporte
  # Como ciudadano que completa un reporte
  # Quiero escribir una descripcion breve
  # Para aportar contexto sobre el incumplimiento observado

  Background:
    Given estoy en el paso 2 del reporte con una categoria elegida

  Scenario: Descripcion valida
    When escribo "Camion bloqueando la rampa"
    And presiono Continuar
    Then paso a la revision del reporte

  Scenario: Descripcion vacia
    When presiono Continuar sin escribir nada
    Then no avanzo
    And veo un mensaje que pide escribir una descripcion

  Scenario Outline: Limites de longitud
    When escribo una descripcion de <largo> caracteres
    And presiono Continuar
    Then el resultado es "<resultado>"

    Examples:
      | largo | resultado |
      | 5     | error     |
      | 10    | avanza    |
      | 280   | avanza    |

  Scenario: El texto se conserva
    Given escribi una descripcion
    When vuelvo al paso 1 y regreso al paso 2
    Then la descripcion sigue escrita
