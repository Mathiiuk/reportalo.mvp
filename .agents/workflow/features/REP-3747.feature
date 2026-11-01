# REP-3747 — Criterios de aceptación de Jira, ajustados a la decisión del PO v1.0 (24/10)
Feature: REP-3747 - Acceder al panel como operador de organismo de prueba
  Como operador de Reportalo CABA o Reportalo Avellaneda (organismos de prueba)
  Quiero entrar al panel con mi cuenta
  Para ver solo lo que corresponde a mi jurisdicción

  Scenario: Acceso permitido
    Given un operador de prueba autenticado de Reportalo CABA
    When abre "/panel"
    Then ve el panel de "Reportalo CABA (organismo de prueba)" sin un login paralelo

  Scenario: Ciudadano sin permiso (caso 6 PO)
    Given un ciudadano sin rol de operador
    When intenta entrar al panel por UI, URL directa o API
    Then va a "/acceso-restringido" y no recibe datos de otros

  Scenario: Operador de otro organismo (caso 5 PO)
    Given el operador de Reportalo CABA
    When pide por URL o API un reporte de Avellaneda
    Then la base lo rechaza

  Scenario: Alcance de CABA
    Given el operador de Reportalo CABA
    When se evalúa un reporte de cualquier comuna de la Ciudad
    Then lo atiende

  Scenario: Sesión vencida
    Given un operador sin sesión válida
    When abre "/panel"
    Then se le pide iniciar sesión y después vuelve a "/panel"

  Scenario: Sin descripción cruda para el operador (AC-05 de REP-3874)
    Given un reporte con correo o teléfono en la descripción
    When el operador consulta citizen_reports por REST
    Then no recibe la fila, y conserva fotos y fundamento del reporte que atiende
