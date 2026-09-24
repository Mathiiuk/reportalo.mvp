# Reportalo

*Plataforma de Auditoría Ciudadana*

## SPIKE: IMAGEN → HECHOS OBSERVABLES → RAG TEXTUAL

**Versión 1.0 · 24 de septiembre de 2026 · Proyecto RAR-2026**

**Jira:** [REP-3790](https://unlz2026.atlassian.net/browse/REP-3790) (spike · stretch del Sprint 13)
**Protocolo:** Confluence «REP-3790: Protocolo del spike (imagen → hechos observables → RAG textual)», fijado antes de correr
**Referencia:** [REP-3786](https://unlz2026.atlassian.net/browse/REP-3786) (arnés y baseline) · [REP-3793](https://unlz2026.atlassian.net/browse/REP-3793) (anonimización real, Sprint 14)
**Evidencia:** `scripts/rag-local-dev/rep3790/`

> **Pregunta.** ¿Una imagen ya anonimizada, convertida en hechos observables, da una respuesta del RAG legal equivalente a la de
> una descripción escrita por una persona, con costo y latencia aceptables?

---

## 1. Resumen

**Resultado según la regla fijada de antemano: REFORMULAR.** Es un «reformular» acotado: la calidad jurídica pasa con margen y lo único que no
cumple es la latencia, por muy poco y solo por la etapa de extracción.

| Criterio (protocolo §6) | Umbral | Medido | ¿Cumple? |
|---|---|---|---|
| Normativa correcta de I respecto de T | ≥ 80 % | **94 %** (17 de 18) | ✅ |
| Hechos inventados en imágenes irrelevantes | 0 | **0** | ✅ |
| Sobrecosto de latencia de I sobre T (mediana) | < 2× | **2,03×** (5,18 s contra 2,55 s) | ❌ por 0,03 |

La regla dice «Reformular […] si falla solo por la etapa de extracción», y es el caso: la extracción suma una mediana de **2,68 s**. El resto del
camino (vector, recuperación y generación) tarda lo mismo en T y en I.

Lo más relevante no es el agregado sino que **T e I llegan a la misma conclusión jurídica en los 8 casos**: citan las mismas normas esperadas o se abstienen
por igual. Las diferencias son de detalle y no cambian el resultado: en 01, T omite en dos corridas una norma secundaria (6.1.37) que I cita siempre; en 02,
la corrida que queda «indeterminado» cita una norma menos en I; y en 09 una corrida de I se abstiene como «indeterminado» en vez de «fuera_de_alcance».
La única diferencia en «normativa correcta» (18 contra 17) sale de una **falla técnica de T**, no de un acierto: en el caso 08, una corrida de T no pasó la
validación y la función la entrega como «indeterminado» sin citas, que casualmente coincide con la abstención esperada. Si se descuenta esa corrida, T e I
empatan 17 a 17.

**Recomendación:** reformular solo la extracción para bajar su latencia (§6) y volver a medir **únicamente la latencia** de I. Si baja de 2×, la idea es viable.
La integración productiva, en cualquier caso, depende de REP-3793: hoy el servidor no anonimiza las fotos.

## 2. Qué se corrió

| | T (control) | I |
|---|---|---|
| Origen del texto | Texto equivalente escrito a mano | Foto anonimizada → modelo multimodal → hechos observables en JSON → su `texto_reclamo` |
| Recuperación | top-k 6 · umbral 0,45 · misma localidad y categoría | igual |
| Generación | prompt, esquema y validación de `analizar-reporte` (arnés de REP-3786) · thinking `low` · `maxOutputTokens` 2048 | igual |

- **8 casos × 2 variantes × 3 repeticiones = 48 corridas**, en orden intercalado con semilla fija. Modelo `gemini-3.8-flash`, vectores `gemini-embedding-2@768`.
- **Recuperación local verificada contra la base.** El RPC no se puede llamar con la clave pública, así que se reprodujo localmente con la misma regla
  (fuentes elegibles por localidad, filtro por categoría y similitud coseno). Antes de correr, `verify-retrieval.mjs` la comparó con las recuperaciones reales
  de REP-3786: **mismos fragmentos y mismo orden en los 9 casos**, con una diferencia máxima de similitud de 0,0000037. El vector de consulta de hoy es idéntico
  al que usó la base (coseno 1,000000).
- **Extracción:** el prompt prohíbe hablar de leyes, suponer lo que no se ve e identificar personas, y pide las dudas en `incertidumbres` (ver `run-spike.mjs`).
- **Fotos:** reales, provistas por el equipo. Tres tenían personas reconocibles (01, 08 y 09, con un menor en la 09) y se **pixelaron a mano** antes de usarlas
  (`anonimizar.py`), además de borrar todos los metadatos. Las fotos no están en el repo.

## 3. Resultados por caso

| Caso | Tipo | Localidad · categoría | T (3 corridas) | I (3 corridas) | ¿Misma conclusión? |
|---|---|---|---|---|---|
| 01 · auto sobre la rampa | clara (REP-3786 B) | CABA · TRANSITO | fundamentado, 7.1.9 + 6.1.52 (+6.1.37 en 1) | fundamentado, 7.1.9 + 6.1.52 + 6.1.37 | ✅ |
| 02 · luminaria apagada | clara (REP-3786 D-CABA) | CABA · INFRAESTRUCTURA | fundamentado ×2, indeterminado ×1 · Ley 210 art. 2 b) (+ art. 3 j) | fundamentado ×2, indeterminado ×1 · Ley 210 art. 2 b) (+ art. 3 j en 2) | ✅ |
| 03 · señal caída | ambigua | CABA · INFRAESTRUCTURA | sin_normativa ×3 | sin_normativa ×3 | ✅ |
| 04 · bache | clara | Avellaneda · INFRAESTRUCTURA | fundamentado · art. 59 + Const. art. 192 inc. 4 | igual | ✅ |
| 05 · boca de tormenta | clara (REP-3786 A) | Avellaneda · INFRAESTRUCTURA | fundamentado · art. 52 + 59 + 192 inc. 4 | igual | ✅ |
| 07 · basura junto a contenedores | clara | CABA · AMBIENTE | indeterminado citando Ley 210 art. 2 c) ×3 | igual | ✅ |
| 08 · puesto de venta en la vereda | sin normativa | Avellaneda · sin categoría | fundamentado ×2 citando 24.449 art. 48 t) «venta en el camino», 1 falla técnica | fundamentado ×3, misma cita | ✅* |
| 09 · plaza | irrelevante | CABA · sin categoría | fuera_de_alcance ×3 | fuera_de_alcance ×2, indeterminado ×1 · sin citas | ✅ |

\* En 08, la corrida de T sin citas es la falla técnica: el modelo respondió, pero su respuesta no pasó la validación (el arnés no guardó el motivo).

**Métricas del protocolo (§5)**

| Métrica | T | I |
|---|---|---|
| Normativa correcta (según el resultado esperado en borrador) | 18 / 24 | 17 / 24 |
| Falsos positivos | 0 | 0 |
| Citas discutibles (a decidir por el validador) | 9 | 11 |
| Fallas técnicas | 1 | 0 |
| Casos consistentes en las 3 repeticiones | 5 / 8 | 6 / 8 |
| Fidelidad de hechos (rúbrica 0–2, `raw/fidelidad.json`) | — | **1,75** de promedio; 0 hechos inventados en la irrelevante |

**Errores de la extracción.** El único error concreto es el del caso 03, en las 3 corridas: la señal de «prohibido girar» se lee como «giro obligatorio o curva».
No cambia el resultado jurídico, porque el corpus no tiene norma para esa situación. Hay además inferencias leves presentadas como hechos: «dificulta el paso
de los autos» en el bache y «personas» en plural en el puesto de venta.

## 4. Costo y latencia

| | T | I |
|---|---|---|
| Latencia total (mediana) | **2,55 s** | **5,18 s** |
| · extracción | — | 2,68 s |
| · vector de consulta | 0,40 s | 0,38 s |
| · generación | 2,12 s | 2,21 s |
| Tokens de extracción (mediana) | — | 1.315 de entrada (1.100 de imagen) + 221 de salida |
| Tokens de generación (mediana) | 940 de entrada + 324 de salida | 943 de entrada + 296 de salida |

La extracción agrega unos **1.536 tokens por reporte**, lo que **más que duplica** los ~1.264 tokens de la generación. El costo en dinero es esa cantidad por
el precio vigente del modelo. No se incluye acá un valor en pesos o dólares para no fijar una tarifa sin verificar.

La latencia se midió desde una sola máquina, en corridas secuenciales. Con una diferencia de 0,03× sobre el umbral, la variación de red entre corridas
podría cambiar el resultado en cualquiera de las dos direcciones.

## 5. Observaciones que no dependen de la imagen

Estos dos casos se comportan igual en T y en I: no son problemas del spike sino del RAG textual actual, y conviene que los mire el validador.

- **07 · basura.** El modelo cita «Higiene urbana» (Ley 210 art. 2 c) pero declara `indeterminado`: reconoce el servicio, pero no encuentra una obligación
  concreta en un fragmento que solo enumera servicios. Con el resultado esperado del borrador cuenta como 0/3 en las dos variantes.
- **08 · venta en la vereda.** Las dos variantes citan Ley 24.449 art. 48 t), que prohíbe la venta «en zona alguna del camino». Hay que decidir si eso aplica
  a una vereda urbana: si no aplica, es un falso positivo del RAG textual, compartido por T e I.

## 6. Qué reformular

Todo apunta a la extracción. El resto del camino no cambia.

1. **Thinking de la extracción en `minimal`** o con presupuesto 0. Describir una foto no necesita razonamiento. En REP-3786 esto no movió la latencia de la
   generación, pero en la extracción la imagen pesa distinto: hay que medirlo.
2. **Resolución de la imagen.** La imagen ocupa ~1.100 tokens. Probar con resolución media o baja del modelo, o achicar la foto antes de enviarla,
   que además es lo que va a hacer REP-3793 (Bloque 1).
3. **Salida más corta.** El `texto_reclamo` es lo único que usa el RAG. Los `hechos_observables` y las `incertidumbres` sirven para auditar, pero
   cuestan tokens de salida.

Con cualquiera de estas, alcanza con volver a correr solo la variante I (24 corridas) para comparar la latencia contra el mismo T.

## 7. Limitaciones

- **8 casos, no 10.** Faltan la 06 (auto cerca de una rampa, ambigua) y la 10 (segunda irrelevante). Con este tamaño, los porcentajes son orientativos
  y lo que vale es el detalle por caso.
- **El resultado esperado es un borrador mío.** Lo tienen que validar Ivo y/o Hernán (`casos.json`, con notas para el validador en 03, 07 y 08). Si cambia,
  alcanza con volver a correr `analyze.mjs`: las corridas no se repiten.
- **La anonimización fue manual.** Las fotos se pixelaron a mano. En producción, el servidor todavía no lo hace (REP-3793).
- **El texto equivalente también lo escribí yo**, mirando las fotos. Un vecino real podría escribir menos o distinto, lo que en la práctica podría favorecer a I.

## 8. Cómo reproducirlo

```bash
cd scripts/rag-local-dev/rep3790
python anonimizar.py            # fotos/ -> fotos/anonimizadas/ (pixelado y sin metadatos)
node embed-fragments.mjs        # vectores del corpus (texto verificado por md5 contra la base)
node verify-retrieval.mjs       # la recuperación local tiene que coincidir con la base
node run-spike.mjs --reps 3     # retoma si se corta: no repite corridas hechas
node analyze.mjs                # resumen y raw/analysis.json
```

La clave del modelo se lee del `.env` y nunca se imprime. Las fotos y los vectores del corpus no se versionan.

---

*Reportalo · REP-3790 · Sprint 13 · Matías Krepchuk*
