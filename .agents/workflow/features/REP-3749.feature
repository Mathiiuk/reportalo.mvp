# REP-3749 — Criterios de aceptación de Jira, ajustados a la decisión del PO v1.0 (24/10)
Feature: REP-3749 - Consultar el detalle de un reporte recibido
  Como operador autorizado de un organismo de prueba
  Quiero abrir un reporte de mi bandeja
  Para entender qué pasó, dónde y con qué fundamento antes de decidir

  Scenario: Detalle permitido
    Given un operador de prueba autorizado con un reporte admitido para su jurisdicción
    When lo abre desde la bandeja
    Then ve número de caso, categoría, fecha, estado, calle y altura, fotos protegidas, descripción filtrada y fundamento si existe

  Scenario: Datos que nunca recibe el operador
    Given un reporte cuyo autor escribió un correo o un teléfono
    When el operador consulta el detalle por UI o API
    Then no recibe identidad, user_id, contactos ni la foto original

  Scenario: Reporte ajeno (caso 5 PO)
    Given el operador de Reportalo CABA
    When abre por URL un reporte de Avellaneda
    Then ve "Este reporte no está disponible para tu organismo" y la API no devuelve datos

  Scenario: Dirección ausente o fundamento pendiente
    Given un reporte sin dirección o sin fundamento
    When se abre el detalle
    Then se muestra "Dirección no disponible" o el fundamento como pendiente, sin inventar nada

  Scenario: Sanciones
    Given un fundamento que cita una sanción
    When el operador lo lee
    Then ve la sanción con la leyenda "Sanción prevista por la norma; Reportalo no aplica sanciones"
    But si no hay sanción ve "La norma no registra sanción"

  Scenario: Inexistente o falla
    Given un identificador inexistente o un error de carga
    When se pide el detalle
    Then se muestra un mensaje veraz sin datos de otro reporte
