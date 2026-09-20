# Plan Técnico de Implementación — REP-2500-PRESEL

- **Spec:** [`specs/REP-2500-PRESEL.md`](../specs/REP-2500-PRESEL.md)
- **Base:** rama de REP-3789 (apilada: ambas tocan `NewReportPage`)

---

## 1. Estrategia

Reutilizar los centroides que ya existen. `localityCentroids.js` tiene los 56 barrios de CABA y
Avellaneda junto con la fórmula de Haversine, pero hasta ahora solo servían para advertir "el pin
parece lejos del barrio elegido". Falta una función que los recorra y devuelva el más cercano.

El resto es cableado: preseleccionar, marcar que fue automático y avisarlo.

## 2. Desglose por archivo

| Archivo | Acción | Detalle |
|---|---|---|
| `src/services/localityCentroids.js` | `[MODIFY]` | `findNearestLocality(coords, localities)` pura y testeable, más `NEAREST_LOCALITY_MAX_METERS`. Actualizar el encabezado, que prohibía inferir el barrio. |
| `src/pages/NewReportPage.jsx` | `[MODIFY]` | Efecto de preselección condicionado a `isGranted`; marca `isAutoSuggested`; la confirmación manual la limpia. |
| `src/components/report/ReportReviewStep.jsx` | `[MODIFY]` | Prop `isLocalityAutoSuggested` y aviso correspondiente. |
| `src/test/NearestLocality.test.js` | `[NEW]` | Cercanía, área fuera de cobertura, entradas inválidas, centroide ausente. |
| `src/test/ReportReviewStep.test.jsx` | `[MODIFY]` | Aviso presente con sugerencia, ausente con elección manual. |

## 3. Guardas de correctitud

1. **`isGranted` antes que coordenadas.** El hook arranca con `DEFAULT_CITY_COORDINATES`; sugerir
   desde ese valor sería inferir jurisdicción desde una ubicación falsa.
2. **Umbral de 5 km** para no proponer nada fuera del área habilitada.
3. **La elección explícita manda** sobre la sugerencia, en cualquier orden de ejecución.
4. **Fallo silencioso seguro:** si no se pueden leer las localidades (offline sin caché), el flujo
   vuelve al comportamiento anterior sin romperse.

## 4. Riesgo principal

Los centroides son aproximados. Cerca de un límite entre barrios la sugerencia puede errar, y el
`locality_id` define el organismo receptor. Por eso la sugerencia se muestra de forma explícita y
sigue existiendo el ajuste manual — y por eso la tarea requiere sign-off (punto O-1 de REP-2500).

## 5. Quality Gates

- `pnpm test`
- `pnpm run build`
- `agt task:verify REP-2500-PRESEL`
- Validación manual en dispositivo con GPS real, con foco en límites entre barrios.
