# ==============================================================================
# REP-3535 · Landing institucional Municipios (MVP informativo)
# Criterios de la sección 08 del handoff REP-3830 (Iván) con las decisiones del PO
# del 15/10 (Hernán): landing solo informativa; planes, pagos, demo y alta afuera.
# Los pasos se ejecutan con Vitest en src/test/MunicipiosLanding.test.jsx
# (el repo no tiene runner de Cucumber: `pnpm test:bdd` no existe).
# ==============================================================================

Feature: REP-3535 - Landing institucional Municipios
  # Como representante municipal
  # Quiero una landing institucional clara
  # Para entender qué propone Reportalo, cómo trata la evidencia y volver al portal ciudadano

  Background:
    Given un visitante en "/municipios"

  Scenario: Secciones informativas
    When la página termina de cargar
    Then ve, en este orden, hero, Cómo funciona, Privacidad y marco legal, y la banda del portal ciudadano

  Scenario Outline: Volver al portal
    Given el visitante "<sesion>" tiene sesión iniciada
    When toca «Ir al portal ciudadano» en la barra o en la banda final
    Then navega en la misma pestaña a "<destino>"

    Examples:
      | sesion | destino |
      | no     | /       |
      | sí     | /mapa   |

  Scenario: Anclas
    Given un visitante en escritorio o tablet
    When hace clic en «Cómo funciona» o «Privacidad»
    Then la página se desplaza a esa sección y el título no queda tapado por la barra fija

  Scenario: Sin CTA comerciales
    Given la versión MVP
    When se recorre la página completa
    Then no aparecen «Ver planes», «Planes», «Solicitar una demo», «Contratar Reportalo™» ni «Ingresar»
    And tampoco deshabilitados ni como «próximamente»

  Scenario: Teléfono
    Given un viewport de 390 px
    When se carga "/municipios"
    Then no hay scroll horizontal, las anclas se ocultan y todos los CTA miden al menos 44 px de alto

  Scenario: Accesibilidad
    Given navegación solo con teclado
    When se recorre con Tab
    Then cada enlace muestra el anillo de foco y el texto cumple contraste 4.5:1

  Scenario: Ruta heredada de planes
    Given un visitante que entra a "/municipalidad/plan"
    Then es redirigido a "/municipios" sin ancla de planes
