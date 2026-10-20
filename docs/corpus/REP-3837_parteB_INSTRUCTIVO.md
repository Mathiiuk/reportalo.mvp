# REP-3837 · Parte B — Cargar Ley 2628 y Ley 5688 (5 fragmentos)

**Estado: preparado, NO aplicado.** Entrega del PO: Hernán, 19/10/2026 ([comentario en REP-3837](https://unlz2026.atlassian.net/browse/REP-3837?focusedCommentId=10874)). QA: [REP-3838](https://unlz2026.atlassian.net/browse/REP-3838).

## Cuándo se aplica

**No antes de terminar las mediciones P0, P1 y P2** (REP-3859, REP-3857, REP-3860). Cargar estos fragmentos cambia el corpus, y la línea base y sus comparaciones se miden con el corpus del 13/10: 132 fragmentos, 127 vigentes y 29 fuentes. Lo piden Hernán en REP-3837, Leo en REP-3859 y la Planning del Sprint 17.

- **Ventana:** se acuerda con Leo. El jueves 22 no hay deploys ni migraciones, así que queda el viernes 23 o el Sprint 18.
- **Al aplicar:** anotar en REP-3837 la versión nueva del corpus (los totales de `verificar_huellas.sql`).

## Qué se carga

| Clave | Fragmento | Categoría | Tipo | SHA-256 de `content` |
|---|---|---|---|---|
| LEY2628-ART3-INC3 | Ley 2628 art. 3 inc. 3 | AMBIENTE | competencia | `d4e4b842…f28bc` |
| LEY2628-ART3-INC17 | Ley 2628 art. 3 inc. 17 | AMBIENTE | competencia | `1d346034…dae0a` |
| LEY5688-ART506 | Ley 5688 art. 506 | TRANSITO | competencia | `526bda1b…c3eb7` |
| LEY5688-ART507 | Ley 5688 art. 507 | TRANSITO | competencia | `fa8d35ad…1f2e2` |
| LEY5688-ART511 | Ley 5688 art. 511 (16 incisos) | TRANSITO | competencia | `f146ed8f…331d6` |

- **Numeración:** la Ley 5688 se carga con la del texto consolidado vigente (506/507/511). La matriz REP-2806 citaba la vieja (493/498).
- **Fuentes:** 2 nuevas, ambas de CABA (`state_province`), `verified_at` 2026-10-19 y `source_url` del Boletín Oficial.

## Archivos

| Archivo | Qué es |
|---|---|
| `scripts/rep3837/fragmentos_propuestos_2628_5688.json` | JSON de Hernán sin cambios. SHA-256 del archivo según su `INDICE.txt`: `82d90366…797f4` (con saltos LF) |
| `scripts/rep3837/generar_corpus_md.mjs` | Genera los `.md` del loader desde el JSON. Antes de escribir verifica las 5 huellas; no transcribe nada |
| `corpus/normativas/ley_2628_caba_apra_art3.md` | Generado: 2 fragmentos |
| `corpus/normativas/ley_5688_caba_agentes_transito.md` | Generado: 3 fragmentos |
| `scripts/rep3837/verificar_huellas.sql` | Verificación posterior, de solo lectura |
| `scripts/rep3837/rollback_parteB.sql` | Rollback: baja de vigencia, sin borrar |
| `src/test/Rep3837ParteB.test.js` | El parser del loader lee los 5 fragmentos con la huella exacta, también si el archivo tiene CRLF |

## Cómo aplicarlo (en la ventana acordada)

Hace falta `SUPABASE_SERVICE_ROLE_KEY` y `GEMINI_API_KEY` en el ambiente. No están en `.env` ni se commitean.

1. **Antes de cargar:** correr `scripts/rep3837/verificar_huellas.sql` y anotar los totales (hoy 132 / 127 / 29).
2. **Dry-run de cada archivo.** No escribe nada; valida catálogos, ámbito y plan:
   ```bash
   node scripts/corpus-loader/load-corpus.mjs corpus/normativas/ley_2628_caba_apra_art3.md --dry-run
   node scripts/corpus-loader/load-corpus.mjs corpus/normativas/ley_5688_caba_agentes_transito.md --dry-run
   ```
3. **Carga.** Crea las 2 fuentes y los 5 fragmentos, sube el snapshot a `corpus-fuentes`, mapea las categorías en `fragment_services` y genera el vector con el modelo activo (`gemini-embedding-2@768`):
   ```bash
   node scripts/corpus-loader/load-corpus.mjs corpus/normativas/ley_2628_caba_apra_art3.md
   node scripts/corpus-loader/load-corpus.mjs corpus/normativas/ley_5688_caba_agentes_transito.md
   ```
   Si se corre dos veces, da `unchanged`: no duplica.
4. **Verificar:** correr `verificar_huellas.sql`. Las 5 filas tienen que dar `huella_ok`, `vigente`, `categoria_ok` y `con_vector` en `true`, con jurisdicción CABA. Los totales tienen que quedar en **137 / 132 / 31** y 0 vigentes sin vector.
5. **Avisar en REP-3837:** resultado de las huellas, totales antes y después, y commit. Iván audita en REP-3838.

## Volver atrás

Correr `scripts/rep3837/rollback_parteB.sql`. Baja de vigencia los 5 fragmentos y sus 2 fuentes, sin borrar nada: los análisis que los citaron los siguen referenciando. Después, `verificar_huellas.sql` tiene que mostrar las 5 filas vacías y volver a 132 vigentes.

## Fuera de esta parte

- **Parte A (lote D2–D4, REP-3836):** según Hernán ya está cargada y aprobada. Solo falta verificar sus huellas con la carpeta de REP-3836.
- **Variante de texto enriquecido (P3, Sprint 18):** cuando exista, hay que generar también el vector de estos 5 fragmentos.
- **Prestaciones, vocabulario y destinos (REP-3863):** no van en este ticket.
