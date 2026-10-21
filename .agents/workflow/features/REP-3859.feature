# language: es
Característica: Línea base P0 reproducible (REP-3859)

  Escenario: Validar el set antes de medir
    Dado el set congelado casos-referencia-v1.json
    Cuando corro el runner con --p0 --dry-run
    Entonces se valida el set y se estiman las llamadas sin usar red

  Escenario: Medir sin tocar la base
    Cuando corro M1 y M2 con --p0
    Entonces cada corrida guarda el motor, la huella del corpus y una fila por caso y repetición
    Y no se escribe nada en la base
