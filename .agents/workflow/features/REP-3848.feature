# language: es
Característica: Las fotos privadas no se reutilizan desde la caché entre sesiones (REP-3848)

  Antecedentes:
    Dado que la cuenta A tiene un reporte con una foto protegida
    Y que A y B usan el mismo navegador

  Escenario: B no recibe la foto que A descargó antes
    Dado que A descargó la foto de su reporte
    Y que A cerró sesión y B inició sesión
    Cuando B pide la misma ruta de la foto
    Entonces no obtiene contenido, ni desde la caché ni desde la red

  Escenario: A sigue accediendo a su foto
    Cuando A abre el detalle de su reporte
    Entonces ve su foto

  Escenario: La respuesta prohíbe guardarla
    Cuando se descarga una foto de evidencia
    Entonces la respuesta tiene Cache-Control "max-age=0, private, no-store"
