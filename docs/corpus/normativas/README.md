# Fuentes normativas — materia prima del corpus

**Qué hay acá.** El texto verbatim de cada norma del corpus del RAG, con su URL
oficial, la fecha de verificación, qué artículos se cargan y qué artículos se
relevaron y no se cargan.

**Para qué sirve.** Para leer, verificar y auditar una cita sin entrar a la base.
Es la materia prima y la evidencia de trazabilidad de cada fragmento.

**Para qué NO sirve — importante.** Estos archivos **no tienen el formato que
espera el loader** de [REP-3774](https://unlz2026.atlassian.net/browse/REP-3774)
(front matter + bloques `## fragmento`). No son entrada de carga y **no se copian
sobre `corpus/normativas/`** del repositorio de la aplicación: ahí viven las
fixtures del loader y los nombres chocan. El 29/09/2026 esa copia pisó dos veces
la fixture `ley_210_caba_ente_regulador.md`; por eso la versión de referencia de
esa norma se llama acá `ley_210_caba_referencia.md`.

**La vía de carga es el SQL:** `docs/outputs/REP-3797_lote_corpus_S14.sql` y
`docs/outputs/REP-3797_lote2_corpus_S14.sql`.

**Qué mirar primero:** `PENDIENTES_corpus.md` tiene el registro vivo de lo
resuelto, lo que falta y las vías muertas que no conviene reintentar.
