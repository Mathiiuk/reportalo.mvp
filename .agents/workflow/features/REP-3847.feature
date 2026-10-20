# language: es
Característica: El grupo de reportes cerrados se llama «Concluidos» (REP-3847)

  Escenario: Un reporte informado no figura como resuelto
    Dado que tengo un reporte de vulnerabilidad social en estado INFORMADO
    Cuando abro «Mis reportes»
    Entonces el filtro dice «Concluidos · 1»
    Y la insignia del reporte dice «Informado»

  Escenario: El contador de Perfil coincide con el filtro
    Cuando abro «Perfil»
    Entonces el contador se llama «CONCLUIDOS» y muestra la misma cantidad
