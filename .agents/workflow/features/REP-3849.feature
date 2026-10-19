# language: es
Característica: El resumen de un reporte ajeno no identifica a su autor (REP-3849)

  Antecedentes:
    Dado que la cuenta A creó un reporte
    Y que la cuenta B no tiene relación con ese reporte

  Escenario: B ve el resumen público sin el user_id de A
    Cuando B consulta el reporte de A por la API pública
    Entonces recibe categoría, descripción, ubicación, estado y fechas
    Y la respuesta no contiene user_id ni client_side_id

  Escenario: B pide explícitamente el user_id
    Cuando B consulta "select=user_id" sobre el reporte de A
    Entonces no obtiene el user_id de A

  Escenario: A sigue administrando su reporte
    Cuando A abre el detalle de su reporte
    Entonces ve sus fotos, el fundamento y el historial de estados

  Escenario: Un usuario sin sesión no lee reportes
    Cuando un usuario anónimo consulta citizen_reports o public_citizen_reports
    Entonces no recibe filas
