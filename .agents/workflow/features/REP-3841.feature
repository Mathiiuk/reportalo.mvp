# language: es
Característica: Vulnerabilidad social sin falsa derivación y con el canal del catálogo (REP-3841)

  Escenario: Se pregunta si hay niñas, niños o adolescentes
    Dado que elijo la categoría «Vulnerabilidad social»
    Cuando intento continuar sin responder «¿Hay niñas, niños o adolescentes?»
    Entonces no avanzo y se me pide elegir una opción

  Escenario: Adulto en situación de calle en CABA
    Dado que envío un reporte de Vulnerabilidad social en Boedo con «Solo personas adultas»
    Entonces «Reporte enviado» dice que Reportalo no deriva el caso
    Y muestra «Ministerio de Desarrollo Humano y Hábitat» con el canal 108
    Y el recorrido es Enviado → Informado

  Escenario: Sin canal verificado
    Dado un reporte de Vulnerabilidad social sin la respuesta de niñas/niños
    Cuando abro el detalle
    Entonces dice «No tenemos un canal verificado para este caso»
    Y no muestra el canal general como si fuera verificado
