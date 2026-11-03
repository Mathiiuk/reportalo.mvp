# language: es
Característica: REP-3868 · Aviso de responsabilidad antes de enviar

  Escenario: el aviso aparece en cada reporte
    Dado que un usuario llega a "Revisá antes de enviar"
    Cuando mira la pantalla
    Entonces ve "Al enviar, confirmás que el reporte es real y que las fotos corresponden a lo que describís. Sos responsable de lo que enviás."
    Y ve el enlace "Condiciones de uso"
    Y no ve "Antes de enviar te vamos a pedir aceptar los términos"

  Escenario: el aviso aparece aunque ya haya aceptado los términos
    Dado que el usuario ya aceptó la versión vigente de los términos
    Cuando llega a "Revisá antes de enviar"
    Entonces el aviso está visible

  Escenario: el aviso no frena el envío
    Dado que el usuario ya aceptó la versión vigente
    Cuando toca "Enviar reporte"
    Entonces el reporte se envía sin ventanas ni casillas para tildar

  Escenario: la hoja de aceptación sigue igual
    Dado que el usuario no aceptó la versión vigente
    Cuando toca "Enviar reporte"
    Entonces aparece la hoja de aceptación de siempre

  Escenario: el enlace abre las condiciones sin enviar
    Cuando el usuario toca "Condiciones de uso"
    Entonces se abren las condiciones
    Y el reporte no se envía

  Escenario: lector de pantalla
    Cuando el foco llega a "Enviar reporte"
    Entonces el lector lee el aviso como descripción del botón
    Y el aviso no interrumpe con un anuncio

  Escenario: las condiciones son la versión 1.5 con la sección Fotos
    Cuando el usuario toca "Condiciones de uso"
    Entonces ve "Condiciones de uso" y "Versión 1.5 · vigente desde 11/2026"
    Y ve el punto "4. Fotos" con el texto de Hernán

  Escenario: quien aceptó la 1.4 vuelve a aceptar
    Dado que el usuario aceptó la versión 1.4
    Cuando toca "Enviar reporte"
    Entonces aparece la hoja de aceptación con "Leer condiciones de uso · v1.5"

  Escenario: ninguna pantalla promete patentes difuminadas
    Cuando un operador abre un caso en el panel
    Entonces las fotos dicen "Rostros difuminados"

  Escenario: sin conexión
    Dado que el usuario no tiene conexión
    Cuando llega a "Revisá antes de enviar"
    Entonces el aviso está visible junto a "Guardar reporte sin conexión"
