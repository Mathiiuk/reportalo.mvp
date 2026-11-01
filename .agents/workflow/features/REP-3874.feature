# REP-3874 — Criterios de aceptación de Jira (DEV + QA), en Gherkin
Feature: REP-3874 - Ocultar emails y teléfonos en descripciones para terceros y operadores
  Como vecino que reporta
  Quiero que mis datos de contacto escritos por error no los vean otros
  Para no quedar expuesto por usar Reportalo

  Scenario: Un tercero no recibe los contactos del autor
    Given un reporte de A cuya descripción tiene un correo y un teléfono
    When B lo consulta por mapa, detalle o API REST directa
    Then ve la descripción con "[correo oculto]" y "[teléfono oculto]"
    And la respuesta JSON no contiene los valores originales

  Scenario: El autor conserva su texto
    Given el mismo reporte
    When A lo abre en "Mis reportes" o en su detalle
    Then ve la descripción original

  Scenario Outline: Sin falsos positivos
    Given una descripción "<texto>"
    When se consulta desde la vista pública
    Then el texto no cambia

    Examples:
      | texto                          |
      | Ley 24.449 art. 48             |
      | Av. Rivadavia 4500             |
      | Desde el 25-10-2026            |
      | -34.603722, -58.381592         |

  Scenario: El operador recibe el texto redactado (se cierra en REP-3747)
    Given un operador autorizado de Reportalo CABA o Avellaneda
    When abre el reporte por panel o API
    Then recibe la descripción con los contactos ocultos
