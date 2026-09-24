Feature: H-35 - Salida para borradores trabados en Pendientes
  # Como ciudadano con un reporte guardado sin conexion que no se puede enviar
  # Quiero poder corregirlo o descartarlo desde Pendientes
  # Para no quedar con un reporte trabado para siempre

  Background:
    Given tengo un reporte guardado en Pendientes

  Scenario: Completar la descripcion que falta
    Given al reporte le falta la descripcion
    When la tarjeta me pide la descripcion y escribo "Contenedor desbordado"
    And presiono Guardar y reintentar
    Then el reporte se guarda con esa descripcion
    And se intenta enviar

  Scenario Outline: Limites de la descripcion
    Given al reporte le falta la descripcion
    When escribo una descripcion de <largo> caracteres y presiono Guardar y reintentar
    Then el resultado es "<resultado>"

    Examples:
      | largo | resultado                              |
      | 5     | no se guarda y explica el minimo       |
      | 10    | se guarda                              |
      | 280   | se guarda                              |

  Scenario: Sin conexion
    Given no tengo conexion
    When completo la descripcion y presiono Guardar y reintentar
    Then la descripcion queda guardada
    And veo que el reporte se enviara solo al volver la conexion

  Scenario: Descartar con confirmacion
    When presiono Descartar
    Then me pregunta si quiero descartarlo y me avisa que pierdo las fotos
    And si presiono Cancelar no pasa nada
    And si presiono Si, descartar el reporte desaparece de la lista

  Scenario: La tarjeta dice el motivo real
    Given el ultimo intento fallo porque falta la ubicacion
    Then la tarjeta lo dice en castellano
    And no dice que requiere conexion

  Scenario: Un reporte invalido no procesa fotos
    Given al reporte le falta un dato obligatorio
    When la cola intenta enviarlo
    Then no se procesan las fotos
    And no se crea ningun reporte
    And el motivo queda guardado
