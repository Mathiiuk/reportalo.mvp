Feature: H-35B - Pendientes: tarjeta a ancho completo y confirmar la ubicacion
  # Como ciudadano con un reporte guardado al que le falta la ubicacion
  # Quiero verlo con claridad y poder completarla
  # Para no tener que descartar mis fotos

  Background:
    Given tengo un reporte guardado en Pendientes

  Scenario: El texto ocupa todo el ancho
    Then el icono y el titulo estan arriba
    And el motivo y las acciones estan debajo, a todo el ancho de la tarjeta

  Scenario: Confirmar la ubicacion que falta
    Given al reporte le falta confirmar la ubicacion
    When presiono Confirmar ubicacion
    Then se abre el mismo mapa que usa el asistente, con la posicion guardada
    And al elegir la localidad el reporte se guarda con ella
    And se intenta enviar

  Scenario: Cerrar el mapa sin elegir
    Given al reporte le falta confirmar la ubicacion
    When abro el mapa y lo cierro
    Then no se guarda ningun cambio

  Scenario: Sin conexion
    Given no tengo conexion
    When confirmo la ubicacion
    Then queda guardada
    And veo que el reporte se enviara solo al volver la conexion

  Scenario: Faltan varias cosas
    Given al reporte le faltan la descripcion y la ubicacion
    Then puedo completar las dos desde la tarjeta

  Scenario: Falta la categoria
    Given al reporte le falta la categoria
    Then la tarjeta lo dice
    And solo puedo descartarlo
