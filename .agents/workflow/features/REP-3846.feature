# language: es
Característica: Envío con 4 fotos sin falsa pérdida de conexión (REP-3846)

  Escenario: 4 fotos con buena señal
    Dado que envío un reporte con 4 fotos y conexión estable
    Cuando la protección tarda unos 45 segundos
    Entonces la pantalla muestra el avance «Protegiendo la foto N de 4»
    Y no vuelvo al mapa ni veo «recuperes señal»
    Y llego a «Reporte enviado» con el código #RP

  Escenario: Tarda más de lo habitual con señal
    Cuando pasa el tiempo de aviso
    Entonces veo «Está tardando más de lo habitual» y la opción «Dejarlo en Pendientes y salir»
    Y si la elijo, se abre Pendientes con «Tu reporte quedó pendiente de envío»

  Escenario: Sin conexión confirmada
    Dado que el teléfono no tiene red
    Cuando el reporte pasa a Pendientes
    Entonces veo «Se enviará automáticamente apenas recuperes señal»
