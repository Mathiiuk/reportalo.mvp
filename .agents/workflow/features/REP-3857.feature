# language: es
Característica: Citas con elisión por tramos (REP-3857)
  Escenario: Elisión válida de la LOM art. 59
    Dada una cita con tramos literales, en orden y de 15 caracteres o más
    Entonces se acepta y no termina en indeterminado
  Escenario: Se omite una salvedad
    Dada una cita que saltea «salvo», «no» u otra salvedad, entre tramos o en los bordes
    Entonces se rechaza
  Escenario: Sin marca de elisión
    Entonces el resultado es idéntico al de P0
  Escenario: Lista H-02 de Hernán (REP-3879, 01/11/2026)
    Dada una cita con «...» cuyo texto omitido dice «En ningún caso», «únicamente» o «prohibido»
    Entonces se rechaza, con o sin tilde y en mayúsculas o minúsculas
  Escenario: Palabra entera
    Dada una cita con «...» cuyo texto omitido solo dice «niños»
    Entonces se acepta
