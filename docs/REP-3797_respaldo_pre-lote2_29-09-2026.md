# REP-3797 — Respaldo previo al lote 2 y a la normalización (29/09/2026)

Base: CiudadAR (`yryuhyiujyignkdhiyua`). Lecturas hechas antes de tocar nada.

## Línea de base

| Dato | Valor |
|---|---|
| Fuentes | 20 |
| Fragmentos (total / vigentes) | 84 / 83 |
| Mapeos `fragment_services` | 89 |
| Embeddings | 84 |
| Fragmentos con `\r` | 50 (todos `\r\n` puros: 0 con `\n` sin `\r`, 0 con `\r` suelto) |

## Cómo revertir la normalización (exacto)

Como los 50 fragmentos solo tienen `\r\n` (ningún `\n` sin `\r`), la normalización es reversible:

```sql
update public.knowledge_fragments
   set content = replace(content, E'\n', E'\r\n')
 where id in (<los 50 ids de la tabla de abajo>);
```

y se verifica con `md5(content)` contra la columna «md5 original». Los embeddings se regeneran (no se respaldan los vectores).

## Estado de las filas que toca el lote 2

- `b6717f77-c30e-4cca-985a-6346d741fe38`: mapeado a `COMERCIO_IRREGULAR` (único). El lote 2 agrega `TRANSITO` y quita `COMERCIO_IRREGULAR`. Reversión: insertar `COMERCIO_IRREGULAR` y borrar `TRANSITO`.
- `20000000-…0011` (Ley 2148 7.1.8) y `20000000-…0012` (7.1.9): `is_current = true`, `hierarchy_path` = `Ley 2148 (CABA) — Código de Tránsito y Transporte > Título VII > Artículo 7.1.8 (prohibiciones especiales)` y `… > Artículo 7.1.9 (prohibiciones generales)`. El lote 2 los pasa a `is_current = false` y agrega « [SUPERADO — inciso sin encabezado, ver reemplazo]» al `hierarchy_path`. Reversión: `is_current = true` y quitar ese sufijo.

## Los 50 fragmentos con `\r\n` (id · md5 original · longitud · vigente)

| id | md5 original | len | vigente |
|---|---|---|---|
| 20000000-0000-4000-8000-000000000001 | 8a4d7522225d1d96040deb1ea7b026fb | 302 | sí |
| 20000000-0000-4000-8000-000000000002 | c56efba6194f87f1530da0c373dabf88 | 582 | sí |
| 20000000-0000-4000-8000-000000000003 | 1aa001f9dcc2c6b1ed561c5d69f35e21 | 830 | sí |
| 20000000-0000-4000-8000-000000000007 | 529b81382d697517b6711a1a08c51336 | 162 | sí |
| 20000000-0000-4000-8000-000000000008 | 456633f0d4c2a7796eda053786c75f50 | 197 | no |
| 20000000-0000-4000-8000-000000000009 | daa6ca434853657a2a529bdb63010f23 | 224 | sí |
| 20000000-0000-4000-8000-000000000010 | 6cf3702edcd990cedfbbe397dc3bc9e4 | 273 | sí |
| 20000000-0000-4000-8000-000000000015 | f253c022b7390f1aa0609ef87532a043 | 669 | sí |
| 20000000-0000-4000-8000-000000000016 | c94bd6363eb6d3ec5f8db395565d76ab | 129 | sí |
| 40000000-0000-4000-8000-000000000003 | b5e6cf44f93ec5abba024c5725189383 | 660 | sí |
| 40000000-0000-4000-8000-000000000006 | 7decfe9b51c80863037a378e485a7f2c | 599 | sí |
| 40000000-0000-4000-8000-000000000011 | c8a42a77bd7c80bec0177385279c745d | 712 | sí |
| 40000000-0000-4000-8000-000000000013 | 7656dab9a01c0fed3ad9138410e69ecf | 1957 | sí |
| 40000000-0000-4000-8000-000000000014 | 58b60a194dc6d8c7082229fb75cfca9d | 357 | sí |
| 40000000-0000-4000-8000-000000000015 | 86066f5742cb1ee48d06c1472d23215d | 954 | sí |
| 40000000-0000-4000-8000-000000000016 | cbdd6a8d8bb75a88f312cf682e9de197 | 269 | sí |
| 40000000-0000-4000-8000-000000000020 | 28fb16823536c39a6eddde5c401e076c | 448 | sí |
| 40000000-0000-4000-8000-000000000023 | 0dac87b7eda48b5fd8f6e424d4b0de94 | 2406 | sí |
| 40000000-0000-4000-8000-000000000024 | 31bc2d8b64a3786e2655dd3354f9eac7 | 963 | sí |
| 40000000-0000-4000-8000-000000000026 | 1d5a7f636531edffce636cf653aff332 | 291 | sí |
| 40000000-0000-4000-8000-000000000028 | b387ba1547c9c59a776795a6a316052a | 1754 | sí |
| 40000000-0000-4000-8000-000000000029 | 8b775a377366ea4e4174fdfe0a948bf4 | 1389 | sí |
| 40000000-0000-4000-8000-000000000032 | 13e3abe92787fb5bf64a5cb9d6bcbc6d | 495 | sí |
| 40000000-0000-4000-8000-000000000033 | 535083f2d095dbe15569c5f8940fa83b | 447 | sí |
| 40000000-0000-4000-8000-000000000038 | 8274604ce51ec18855752487d5b6e5ee | 450 | sí |
| 40000000-0000-4000-8000-000000000040 | fc9e31ce72c295d6e512d3a92a53e105 | 953 | sí |
| 40000000-0000-4000-8000-000000000041 | 759cecaf9a1e772b539ce43d009037f3 | 586 | sí |
| 40000000-0000-4000-8000-000000000042 | d50942faa47d0f6dfdf85e2ee1b87f8b | 511 | sí |
| 40000000-0000-4000-8000-000000000043 | 814593a571e94af96e1eb9911426964c | 586 | sí |
| 40000000-0000-4000-8000-000000000044 | e93df381570a44ad11d31f503f16af86 | 410 | sí |
| 40000000-0000-4000-8000-000000000046 | 05e3428c1076170a4272e561b5a1d84e | 2573 | sí |
| 40000000-0000-4000-8000-000000000047 | 590ca3d5acb8a46af01cecf77230f3d2 | 432 | sí |
| 40000000-0000-4000-8000-000000000049 | 93c975e77320accaaa7db5a65538f954 | 296 | sí |
| 40000000-0000-4000-8000-000000000050 | 8ddd853dbabba98bd60f9e199d995edd | 288 | sí |
| 40000000-0000-4000-8000-000000000051 | d62919d834ee10f4be5bd532b6dba156 | 336 | sí |
| 40000000-0000-4000-8000-000000000052 | c9ea361c57d77387577105b20d6355fc | 188 | sí |
| 40000000-0000-4000-8000-000000000053 | 7dc6a6dfd76bf9551324924306b4d540 | 371 | sí |
| 40000000-0000-4000-8000-000000000055 | e4c906428feaa7831a1431b903bee49d | 1195 | sí |
| 40000000-0000-4000-8000-000000000057 | e7840ef926f93397850fd3867185f6c4 | 478 | sí |
| 40000000-0000-4000-8000-000000000058 | 87b2f7ddbcf48624e0cab359c73713dd | 843 | sí |
| 40000000-0000-4000-8000-000000000059 | e0a3fb85588260773b718174a3103462 | 1023 | sí |
| 40000000-0000-4000-8000-000000000060 | 1d2d081a13ba52ecd14bc643d10c3521 | 1031 | sí |
| 40000000-0000-4000-8000-000000000061 | 58311bcbbe6a10f04a7fd994d39c114b | 701 | sí |
| 40000000-0000-4000-8000-000000000062 | 8f6715d01012c696d871254a44df5194 | 1223 | sí |
| 40000000-0000-4000-8000-000000000063 | 57333e640acc8b1d1dc67517d79d3cee | 578 | sí |
| 40000000-0000-4000-8000-000000000064 | 8eb4ddb88e3041b3a011fe3d9c61a968 | 863 | sí |
| 40000000-0000-4000-8000-000000000065 | 7783cbd16c9c343f921710f33bc065c9 | 322 | sí |
| 40000000-0000-4000-8000-000000000066 | a7c893e3b9830b58d8b7fcb7a172fc22 | 305 | sí |
| 40000000-0000-4000-8000-000000000067 | 77988f186768f62d18bf5f48c2031af9 | 417 | sí |
| b6717f77-c30e-4cca-985a-6346d741fe38 | 75deb452191e802e69bb8f3fcdda40cc | 105 | sí |

---

## Respaldo previo a la aplicación del lote nuevo (art. 49 b.3 de la Ley 24.449), 29/09/2026

Estado ANTES (base CiudadAR): 26 fuentes · 123 fragmentos (120 vigentes) · 158 mapeos · 0 fragmentos con `\r`.

Fila que se da de baja: `20000000-0000-4000-8000-000000000010`
- `is_current = true`
- `hierarchy_path` = `Ley 24.449 — Ley de Tránsito > Artículo 49 (estacionamiento) > inciso b) > 3`
- md5 del contenido: `10fb02fda1c43c44a3d2b6ff2c211ce6` (271 caracteres, solo la primera oración del apartado 3)
- categoría: `TRANSITO` · 14 filas de `report_ai_evidence` apuntan a ella (no se tocan; se conservan como historial)

### Cómo revertir (en este orden; el índice único parcial exige bajar el nuevo antes de subir el viejo)

```sql
begin;
  update public.knowledge_fragments set is_current = false
   where id = '60000000-0000-4000-8000-000000000040';
  update public.knowledge_fragments
     set is_current = true,
         hierarchy_path = replace(hierarchy_path, ' [SUPERADO — apartado incompleto, ver reemplazo]', '')
   where id = '20000000-0000-4000-8000-000000000010';
commit;
-- Si el fragmento nuevo aún no tiene análisis que lo referencien, se puede borrar del todo:
--   delete from public.fragment_services where fragment_id = '60000000-0000-4000-8000-000000000040';
--   delete from public.knowledge_fragments where id = '60000000-0000-4000-8000-000000000040';
-- Con análisis que lo citan NO se borra (report_ai_evidence): se deja con is_current = false.
```

Verificación de la reversión: `md5(content)` del `20000000-…0010` = `10fb02fda1c43c44a3d2b6ff2c211ce6` y `is_current = true`.
