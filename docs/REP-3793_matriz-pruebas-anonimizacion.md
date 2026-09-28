# REP-3793 · Matriz de pruebas manuales — anonimización real de rostros y patentes

Checklist que usó Matías el 27/09/2026 para probar `quarantine-anonymize-rep3793` (copia de la función,
solo en el preview de Vercel de la rama — ver `scripts/rep3793/LEEME.md` §1-bis). No estaba versionado:
se reconstruye acá con los resultados ya obtenidos y se completan los casos 7 y 8, que habían quedado
pendientes.

Corresponde a la matriz `Q1`–`Q10` de `scripts/rep3793/LEEME.md` §3, con otro orden y otra numeración.
Equivalencia: 1→Q1, 2→Q2, 3→Q4, 4→Q5, 5→Q6, 6→Q7, 9→Q9. Los casos 7 y 8 de acá cubren `Q8` (Vision
caído por falta de clave) y agregan un caso que la matriz original no distinguía por separado: clave
cargada pero inválida.

## Resultados

| # | Caso | Cómo | Resultado | Veredicto |
|---|---|---|---|---|
| 1 | Un rostro | Persona de frente, situación de calle | La cara aparece con bloques de pixelado reales, no CSS falso | ✅ Pasa |
| 2 | Varios rostros | Foto nocturna con 3 personas | Los 3 rostros quedaron pixelados, incluida la persona de fondo a la derecha | ✅ Pasa |
| 3 | Patente cerca | Auto con patente legible | La patente del auto azul quedó cubierta con pixelado | ✅ Pasa |
| 4 | Patente lejos/ángulo | Autos fotografiados desde atrás/costado | No se ve ninguna patente clara en el encuadre en sí (no es que el sistema falló en cubrirla, es que la foto no muestra ninguna patente legible). No se pudo confirmar el caso límite real con esta imagen | ⚠️ Repetir con una foto con patente visible pero borrosa/angulada |
| 5 | Sin datos sensibles | Bache | Se subió sin pixelar nada, sin error | ✅ Pasa |
| 6 | Baja luz | Obelisco de noche | Se subió sin pixelar nada (no hay caras/patentes), sin error catastrófico | ✅ Pasa |
| 7 | Vision sin clave configurada | Se sacó `GOOGLE_VISION_API_KEY` del proyecto (28/09, 11:29 UTC) y se envió un reporte con foto desde el preview | Pantalla: "No pudimos proteger tu foto" con Reintentar/Cambiar foto. Log: `evidence_fail_safe`, `reason: "vision_not_configured"`, `detail: "Falta el secreto GOOGLE_VISION_API_KEY."`. Sin archivos nuevos en Storage | ✅ Pasa |
| 8 | Vision con clave inválida | Se cargó una clave de prueba (`AIzaClaveInvalidaDePrueba...`, 28/09, 11:34 UTC) y se enviaron reportes con foto | Mismo mensaje genérico en pantalla que el caso 7. Log: `evidence_fail_safe`, `reason: "vision_http_error"`, `detail: "Vision respondió 400: ... API_KEY_INVALID"` — el detalle interno nunca llegó al cliente | ✅ Pasa |
| 9 | Offline → reconexión | Sin conexión al enviar | Quedó "pendiente" con el mensaje correcto "Falta protegerse la foto: requiere conexión" (no se mandó sin proteger). Al reconectar: se envió y la patente salió pixelada igual que en el caso 3 | ✅ Pasa — el fail-safe offline funciona como se esperaba |

## Casos 7 y 8 · cómo se probaron y qué confirman

Los dos son fail-safe de Vision, pero por motivos distintos, y el código ya los distingue con un
`reason` propio (`supabase/functions/quarantine-anonymize/vision.ts`, cubierto por los tests
`UT-VIS-10` y `UT-VIS-11` en `src/test/QuarantineAnonymizeProtection.test.js`):

- **Sin clave** (`GOOGLE_VISION_API_KEY` no seteada) → `detectSensitiveZones` corta antes de llamar a
  Vision y lanza `VisionError('vision_not_configured')`. Nunca llega a hacer `fetch`.
- **Clave cargada pero inválida** (random / vencida / sin permiso a Cloud Vision) → Vision responde con
  un HTTP de error (401/403, o 400 `INVALID_ARGUMENT` según el caso) y `detectSensitiveZones` lanza
  `VisionError('vision_http_error')` con el cuerpo de la respuesta (nunca la clave) en el mensaje.

Ambos motivos mapean a **503** (`statusForReason` en `protect.ts`) y a **el mismo texto para el
ciudadano**: "El servicio que detecta rostros y patentes no respondió. Probá de nuevo en unos minutos."
(`describeProtectionFailure` en `src/services/quarantinePipelineService.js`). Es decir: el pipeline no
guarda nada en ninguno de los dos casos, y la persona no ve el detalle técnico — a propósito, no es un
bug si ambos casos se ven "iguales" desde la app.

### Procedimiento ejecutado (28/09/2026, contra la copia `quarantine-anonymize-rep3793`)

No hizo falta redesplegar la función: el secreto `GOOGLE_VISION_API_KEY` es a nivel de proyecto
Supabase (afecta a todas las funciones, no solo a la copia — ver nota de riesgo abajo), así que
`supabase secrets set/unset` alcanza para el cambio.

```powershell
npx supabase secrets unset GOOGLE_VISION_API_KEY --project-ref yryuhyiujyignkdhiyua   # caso 7
# ... enviar reporte con foto desde el preview ...
npx supabase secrets set GOOGLE_VISION_API_KEY="AIzaClaveInvalidaDePrueba1234567890" --project-ref yryuhyiujyignkdhiyua   # caso 8
# ... enviar reporte(s) con foto desde el preview ...
npx supabase secrets set GOOGLE_VISION_API_KEY="<clave real>" --project-ref yryuhyiujyignkdhiyua   # restaurar
```

**Nota de riesgo (importante para la próxima vez):** el secreto es compartido por todo el proyecto, así
que mientras duró la prueba `quarantine-anonymize` (la productiva, v18, usada por staging) también se
quedó sin clave válida. No se detectó impacto porque esa función ya no llega a usar la clave de forma
útil por el bug de Base64 documentado en el run-report — pero conviene hacerlo en un horario de bajo
uso, como recomienda `scripts/rep3793/LEEME.md` §3.2, y no asumir que "probar con la copia" es 100%
inocuo.

**Verificación final:** tras restaurar la clave real, se envió un reporte más y el log dio
`evidence_protected` con `emulated: false, faces: 1` (28/09, 11:41 UTC) — la clave real quedó operativa.

## Pendiente además de 7 y 8

- **Caso 4** (patente lejos/ángulo): repetir con una foto que sí tenga una patente visible pero borrosa
  o angulada — la de ayer no mostraba ninguna patente en el encuadre, así que no probó nada.
- El resto de la matriz `Q1`–`Q10` original (`scripts/rep3793/LEEME.md` §3) que no se cubrió acá: `Q3`
  (rostro de perfil/lejos, distinto del falso negativo ya registrado en el run-report), `Q10`
  (metadatos con `exiftool`).
