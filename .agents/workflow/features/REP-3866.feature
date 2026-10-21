# language: es
Característica: «Acerca de» y footer compartido (REP-3866)

  Escenario: Ver la versión real
    Cuando abro /acerca después de un deploy
    Entonces Build, Compilación y Publicada coinciden con el build-info.json de ese build

  Escenario: Llegar desde Perfil
    Dado que toco «Acerca de Reportalo™» en Perfil
    Entonces se abre /acerca?desde=perfil y el botón dice «Volver al perfil»

  Escenario: Emergencia sin sesión
    Dado que no inicié sesión
    Cuando toco «¿Es una emergencia?» en el footer
    Entonces se abre la pregunta de emergencias con el 911, el 107 y el 100 a la vista
