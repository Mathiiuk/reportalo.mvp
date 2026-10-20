# language: es
Característica: «Reporte enviado» muestra el destino real del routing (REP-3845)

  Escenario: Sin prestación identificada
    Dado que envío un reporte de Tránsito en Balvanera sin prestación
    Cuando veo «Reporte enviado»
    Entonces veo «Gobierno de la Ciudad de Buenos Aires · BA Colaborativa»
    Y la aclaración «Destino sin verificar»
    Y queda una traza en report_routing

  Escenario: Fuera del piloto
    Dado un reporte en una localidad fuera de CABA y Avellaneda
    Cuando veo «Reporte enviado»
    Entonces no se muestra ningún organismo y se informa la cobertura

  Escenario: Reporte enviado al recuperar la señal
    Dado un reporte en la cola sin conexión
    Cuando se sincroniza
    Entonces queda ruteado sin duplicar la traza
