# ==============================================================================
# REP-2500-PRESEL - Preseleccion de la localidad detectada
# ==============================================================================

Feature: REP-2500-PRESEL - Preseleccionar la localidad para agilizar el envio
  # Como ciudadano que ya compartio su ubicacion con la app
  # Quiero que la localidad venga elegida
  # Para enviar el reporte sin tener que buscarla a mano

  Background:
    Given un ciudadano autenticado armando un reporte con foto y descripcion

  Scenario: La localidad llega preseleccionada y el envio es directo
    Given el permiso de ubicacion esta concedido
    And el ciudadano se encuentra dentro de CABA o Avellaneda
    When llega al paso de revision
    Then la localidad mas cercana aparece ya elegida
    And puede enviar el reporte sin abrir el ajuste de ubicacion

  Scenario: La sugerencia es visible y corregible
    Given la localidad fue detectada automaticamente
    When el ciudadano mira el paso de revision
    Then ve un aviso de que la localidad surge de su ubicacion
    And puede corregirla con el boton de ajuste

  Scenario: Una correccion manual deja de considerarse sugerencia
    Given la localidad fue detectada automaticamente
    When el ciudadano la cambia desde el ajuste de ubicacion
    Then el aviso de deteccion automatica desaparece

  Scenario: Sin permiso de ubicacion no se sugiere nada
    Given el permiso de ubicacion esta denegado
    When el ciudadano llega al paso de revision
    Then no hay ninguna localidad preseleccionada
    And se le pide confirmarla antes de enviar

  Scenario: Fuera del area habilitada no se sugiere nada
    Given el ciudadano se encuentra fuera de CABA y de Avellaneda
    When el ciudadano llega al paso de revision
    Then no hay ninguna localidad preseleccionada

  Scenario: Una eleccion previa tiene prioridad sobre la sugerencia
    Given el ciudadano ya habia elegido una localidad a mano
    When se restaura el borrador del reporte
    Then se conserva la localidad que habia elegido
    And no se reemplaza por la sugerida
