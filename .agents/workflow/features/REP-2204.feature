Feature: REP-2204 - Enviar reporte con un boton claro
  # Como ciudadano
  # Quiero enviar mi reporte con una accion clara
  # Para finalizar el registro y recibir confirmacion de que fue recibido

  Background:
    Given estoy en el paso de revision de mi reporte

  Scenario: Envio exitoso
    Given cargue una foto, una categoria, una descripcion valida y confirme la ubicacion
    When presiono Enviar reporte
    Then veo la confirmacion Reporte enviado
    And veo el codigo de mi reporte

  Scenario Outline: El boton no esta disponible con datos incompletos
    Given me falta <dato>
    When presiono Enviar reporte
    Then no se envia nada
    And veo que me falta <dato>

    Examples:
      | dato        |
      | una foto    |
      | la categoria |
      | la descripcion |

  Scenario: Falta confirmar la ubicacion
    Given no confirme la ubicacion
    When presiono Enviar reporte
    Then se abre el ajuste de ubicacion

  Scenario: Doble toque
    Given cargue todos los datos
    When presiono Acepto y envio dos veces seguidas
    Then se crea un solo reporte
    And el consentimiento se registra una sola vez

  Scenario: Falla el envio
    Given cargue todos los datos
    When el servidor rechaza el reporte
    Then veo un mensaje en castellano que no muestra detalles tecnicos
    And mi borrador sigue guardado
    And puedo volver a intentarlo

  Scenario: La categoria no se pierde
    Given estoy sin conexion a las categorias y elegi una del respaldo local
    When envio el reporte
    Then el reporte se guarda con su categoria
    Or no se envia y me avisa, pero nunca se guarda sin categoria
