# REP-3000 — Criterios de aceptación de Jira, ajustados a la decisión del PO v1.0 (24/10)
Feature: REP-3000 - Bandeja del organismo de prueba
  Como operador de un organismo de prueba
  Quiero ver los reportes que ingresaron a la bandeja de mi jurisdicción
  Para revisar los casos que corresponden a mi equipo

  Scenario: Reportes admitidos y estado DERIVADO
    Given un reporte de CABA o Avellaneda con borrador generado y dentro del piloto
    When queda disponible en la bandeja del organismo de prueba correspondiente
    Then el operador lo ve con código, categoría, fecha, zona, estado y acceso al detalle
    And el reporte pasa a DERIVADO por entrega interna, sin afirmar un envío al municipio real

  Scenario: Exclusiones expresas del PO (casos 4 y 7)
    Given un reporte INFORMADO, fuera de alcance, sin destino o de Lanús
    When se construye la bandeja
    Then no ingresa a ninguna bandeja de prueba

  Scenario: Aislamiento entre organismos
    Given el operador de Reportalo CABA
    When consulta la bandeja o la API
    Then recibe solo lo habilitado para CABA

  Scenario: Bandeja vacía o error
    Given un organismo sin reportes admitidos o una falla de conexión
    When abre la bandeja
    Then ve un mensaje veraz de vacío o de error

  Scenario: Destinatario real preservado
    Given un reporte en la bandeja de prueba
    When se consulta su borrador institucional
    Then el destinatario sigue saliendo del catálogo REP-2806 y el borrador no figura como enviado

  Scenario: El análisis no se pierde
    Given que la entrega interna falla
    When se guarda el análisis RAG
    Then el análisis queda guardado igual
