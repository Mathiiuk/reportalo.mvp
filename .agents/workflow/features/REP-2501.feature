Feature: REP-2501 - Conservar la evidencia anonimizada del reporte
  # Como ciudadano
  # Quiero que la evidencia ya anonimizada quede asociada a mi reporte
  # Para que el registro conserve la prueba visual sin guardar la fotografia original

  Scenario: La evidencia guardada queda vinculada al reporte
    Given envie un reporte con una foto
    When la foto se procesa en el servidor
    Then existe una fila de evidencia para mi reporte
    And la direccion de la imagen pertenece a la carpeta de mi reporte

  Scenario: La foto original no queda guardada
    Given subi una foto a la cuarentena
    When termina el procesamiento
    Then la foto original ya no esta en la cuarentena

  Scenario: La foto original se elimina aunque nunca se procese
    Given subi una foto a la cuarentena y cerre la aplicacion
    When pasa mas de una hora
    Then la purga programada elimina la foto original

  Scenario: La evidencia guardada no conserva metadatos
    Given una foto con ubicacion, autor y una segunda imagen incrustada
    When se procesa en el servidor
    Then la evidencia guardada no contiene esos datos

  Scenario Outline: Formatos de foto
    Given selecciono una foto en formato <formato>
    When se envia el reporte
    Then el resultado es "<resultado>"

    Examples:
      | formato | resultado                       |
      | JPEG    | se guarda procesada             |
      | PNG     | se convierte a JPEG y se guarda |
      | WebP    | se convierte a JPEG y se guarda |

  Scenario: Un usuario no puede tocar la evidencia de otro
    Given otra persona subio una foto a la cuarentena
    When pido procesar la ruta de esa foto
    Then el sistema rechaza el pedido
    And la foto de la otra persona no se modifica ni se borra

  Scenario: No se puede adjuntar una imagen ajena a mi reporte
    Given tengo un reporte propio
    When intento asociarle la direccion de una imagen de otro reporte
    Then la base rechaza la asociacion
