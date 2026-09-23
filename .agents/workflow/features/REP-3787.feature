# language: es
@REP-3787 @sprint13 @uj-v3-3
Característica: Aplicar los bloques del User Journey v3.3 sin regresiones
  Como líder técnico del proyecto
  quiero incorporar los bloques de diseño que entrega UX uno por uno
  para alinear el frontend con el UJ v3.3 sin romper lo que ya funciona.

  Antecedentes:
    Dado que la rama base es "staging"
    Y que la baseline conocida es 266 tests, todos en verde
    Y que no hay fallos conocidos admitidos

  Escenario: Un bloque entregado se aplica limpio sobre staging actual
    Dado un bloque del handoff REP-3791 con su archivo .patch
    Cuando se crea una rama nueva derivada de "origin/staging"
    Y se aplica el parche del bloque
    Entonces el parche aplica sin conflictos
    Y "pnpm test" sigue en verde
    Y "pnpm build" compila y genera el service worker de la PWA

  Escenario: Un bloque quedó desactualizado respecto de staging
    Dado un bloque generado contra un commit anterior de staging
    Cuando "git apply --check" reporta conflictos
    Entonces no se fuerza la aplicación del parche
    Y se solicita a UX que regenere el bloque contra la cabeza actual

  Escenario: No se usa la carpeta de archivos completos
    Dado que el bloque incluye una carpeta "archivos/" con los archivos enteros
    Cuando se necesita incorporar el bloque al repositorio
    Entonces se aplica el ".patch" y no se copian los archivos completos
    Y el trabajo ya mergeado de REP-3789 y REP-2500 se conserva intacto

  Escenario: El flujo principal de reporte sigue operativo
    Dado un bloque ya aplicado sobre la rama
    Cuando se recorre el alta de un reporte de punta a punta
    Entonces el recorrido se completa sin bloqueos
    Y los estados offline y de sincronización siguen funcionando
