Feature: REP-2500 - Conservar el reporte enviado para consultarlo despues
  # Como ciudadano
  # Quiero que el reporte que envie quede guardado de forma persistente
  # Para poder consultarlo y seguir su evolucion despues

  Background:
    Given el ciudadano completo los pasos de evidencia, categoria y descripcion de un reporte nuevo
    And la evidencia ya paso por el pipeline de cuarentena y quedo sanitizada (sin EXIF, sin la foto original)

  Scenario: Un envio online exitoso crea un registro real y persistente
    Given el ciudadano confirma el envio con conexion a internet
    When se persiste el reporte
    Then se crea una fila en citizen_reports con usuario, categoria, descripcion, ubicacion, fecha y estado inicial "RECIBIDO"
    And se crea una fila en report_images con la URL de la evidencia sanitizada en el bucket report-evidences
    And la pantalla de exito muestra el identificador real del reporte, no un valor hardcodeado

  Scenario: Un fallo de persistencia nunca se informa como exito
    Given el ciudadano confirma el envio con conexion a internet
    When el insert en citizen_reports o en report_images falla
    Then el ciudadano ve un error, no la pantalla de exito
    And el borrador local del reporte no se borra

  Scenario: El ciudadano puede consultar despues sus reportes enviados
    Given el ciudadano ya envio reportes previamente
    When abre la pantalla "Mis reportes"
    Then ve sus reportes reales recuperados de citizen_reports, no datos de demostracion
    And cada reporte muestra su identificador, categoria, descripcion y estado

  Scenario: Nunca se persiste la foto original ni metadata EXIF
    Given el ciudadano adjunto una foto con metadata EXIF
    When el reporte se persiste
    Then la fila de report_images solo referencia el resultado sanitizado del pipeline de cuarentena
    And el archivo original ya fue purgado del bucket de cuarentena
