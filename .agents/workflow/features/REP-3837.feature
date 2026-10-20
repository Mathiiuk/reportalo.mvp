# language: es
Característica: Normas de competencia de CABA en el corpus (REP-3837 parte B)

  Escenario: La carga respeta el texto cotejado por el PO
    Dado el JSON de Hernán con 5 fragmentos y sus huellas SHA-256
    Cuando se cargan con el loader del corpus
    Entonces las 5 huellas en la base coinciden con las del PO
    Y quedan vigentes, con su categoría y su vector

  Escenario: Volver atrás
    Cuando se corre el rollback
    Entonces los 5 fragmentos dejan de estar vigentes sin borrarse
