# REP-3843 — Criterios de aceptación de Jira + decisión del PO (REP-3876 §8)
Feature: REP-3843 - Dirección aproximada con calle y altura
  Como vecino que reporta
  Quiero que el reporte tenga una dirección legible
  Para que el organismo sepa dónde está el problema sin exponer más de lo necesario

  Scenario: Dirección disponible
    Given un punto confirmado en CABA o Avellaneda con dirección sugerida
    When se guarda el reporte
    Then queda registrada la calle, la altura si existe y si la vía es calle o avenida

  Scenario: Dirección no disponible
    Given que no se pudo determinar la calle (sin conexión, falla o respuesta vacía)
    When se guarda el reporte
    Then se muestra "Dirección no disponible" sin inventar datos
    And el envío y la sincronización continúan normalmente

  Scenario: Comunicación al organismo
    Given un reporte con dirección aproximada
    When se genera el borrador institucional
    Then la dirección aparece en la sección "Ubicación"
    And la regla R-4 usa el tipo de vía si está disponible

  Scenario: Privacidad por rol (REP-3876 §8)
    Given un reporte con calle y altura
    When lo consulta un tercero por mapa o API
    Then ve la calle y la zona, sin altura
    But el autor y el operador ven calle y altura
