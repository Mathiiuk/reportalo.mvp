Feature: REP-3793 - Anonimizacion real de rostros y patentes
  # Como ciudadano
  # Quiero que las caras y patentes de mis fotos queden pixeladas antes de guardarse
  # Para denunciar sin exponer a terceros

  Scenario: Una foto con una persona se guarda con la cara pixelada
    Given saque una foto donde se ve la cara de una persona
    When envio el reporte
    Then la foto guardada tiene la cara pixelada en bloques grandes
    And el resto de la foto no cambia

  Scenario: Una patente se pixela sin tapar el auto entero
    Given saque una foto de un auto con la patente legible
    When envio el reporte
    Then la patente queda pixelada
    And el resto del auto se sigue viendo

  Scenario: Una foto sin personas ni patentes igual pasa por la proteccion
    Given saque una foto de un bache sin personas ni autos
    When envio el reporte
    Then la foto se guarda re-codificada y sin metadatos
    And no se inventa ninguna zona pixelada

  Scenario: La foto se achica antes de subirla
    Given saque una foto de 4032 x 3024 con el celular
    When envio el reporte
    Then se sube una foto de 1600 x 1200

  Scenario Outline: Si la proteccion falla no se guarda nada
    Given el servicio de deteccion <falla>
    When envio el reporte
    Then veo "No pudimos proteger tu foto"
    And puedo elegir "Reintentar protección" o "Cambiar foto"
    And el reporte no se envia
    And en el almacenamiento no queda ninguna version de la foto

    Examples:
      | falla                 |
      | no esta configurado   |
      | no responde a tiempo  |
      | devuelve un error     |

  Scenario: Un reporte pendiente offline no se envia sin proteccion
    Given tengo un reporte pendiente guardado sin conexion
    And el servicio de deteccion no responde
    When vuelve la conexion y se intenta enviar
    Then el reporte sigue en Pendientes con su foto
    And no se crea el reporte ni se adjunta ninguna foto
