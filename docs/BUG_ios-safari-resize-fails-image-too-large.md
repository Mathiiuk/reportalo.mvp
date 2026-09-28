# BUG · En iPhone/Safari, la foto puede quedar sin reducir y trabar el envío — para el PO

**Encontrado:** 28/09/2026, prueba manual real en staging desde **iPhone 13 Pro, Safari**, con señal
4G débil. Foto de reproducción sacada **en horizontal** (coincide con el registro
`4032×3024` de los logs, 16:48:16 UTC — el sensor principal del 13 Pro es de 12 MP).
**Sin ticket propio todavía** — se documenta acá para que el PO decida prioridad y a quién se asigna.
No es parte de REP-3793 ni REP-3795: es un hallazgo nuevo de esa sesión de pruebas.

## Resumen en una línea

En algunos iPhone/Safari, la reducción de la foto a 1600 px que hace la app **antes de subirla
falla en silencio** y sube la foto a tamaño completo de cámara (hasta 4032×3024) — el servidor la
rechaza siempre (límite 2048 px), y el ciudadano queda en un ciclo de reintentos sin una salida
clara.

## Evidencia real (no es una hipótesis sin datos)

Logs de la Edge Function `quarantine-anonymize` durante la prueba, mismo dispositivo, mismo intento
de envío, en orden:

```
16:44:42 UTC  evidence_fail_safe  image_too_large  "La foto mide 3024×4032; el máximo es 2048 px"
16:45:00 UTC  evidence_fail_safe  image_too_large  "La foto mide 3024×4032; el máximo es 2048 px"
16:48:16 UTC  evidence_fail_safe  image_too_large  "La foto mide 4032×3024; el máximo es 2048 px"
16:52:39 UTC  evidence_fail_safe  vision_timeout   "Vision no respondió en 12000 ms"
16:53:05 UTC  evidence_protected  1600×1200 ✅ (recién acá se ve una foto ya reducida)
16:53:16 UTC  evidence_protected  1600×1200 ✅
```

Tres intentos seguidos llegaron al servidor con el tamaño completo de la cámara del iPhone (12 MP,
~4000 px de lado) — la reducción a 1600 px que se supone corre en el navegador **no se aplicó**.
Recién en el cuarto intento (con otra foto o en otro momento) llegó ya reducida.

## Dónde está en el código

`src/services/metadataSanitizer.js`, función `prepareEvidenceImage` (usada por
`quarantinePipelineService.js` antes de subir cualquier foto, online o desde la cola de
pendientes):

```js
try {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  // ... acá se calcula la escala y se reduce a 1600 px con un canvas
} catch (error) {
  // Nunca se pierde la evidencia por no poder reducirla: se usa el camino anterior
  return ensureJpeg(await normalizeImageOrientation(file));  // ← esto NO reduce el tamaño
}
```

Y el "camino anterior" (`normalizeImageOrientation`) llama **a la misma función**
(`createImageBitmap` con la misma opción `imageOrientation: 'from-image'`) para enderezar la foto
— así que si `createImageBitmap` falla una vez para ese archivo, va a fallar la segunda vez
también, y la función devuelve la foto **tal cual la sacó la cámara**, sin reducir ni enderezar.

## Por qué pasa (con qué grado de certeza)

**Alta certeza, con matiz:** `createImageBitmap` con la opción `imageOrientation: 'from-image'`
tiene problemas de compatibilidad conocidos en WebKit/Safari, sobre todo con fotos grandes (12 MP+)
— puede lanzar una excepción o comportarse de forma inconsistente según la versión de iOS y la
memoria disponible en ese momento. Esto **no se verificó línea por línea contra el motor de Safari
en este dispositivo puntual** (no hay acceso a herramientas de depuración de iOS desde esta
sesión) — es la explicación que mejor calza con el código y la evidencia de los logs, no una causa
confirmada con un stack trace real.

**Importante:** este no es un descuido — es un trade-off tomado a propósito y ya cubierto por un
test (`UT-RSZ-06` en `src/test/EvidenceImageResize.test.js`): *"si no se puede decodificar, devuelve
el original, nunca pierde la evidencia"*. La decisión de diseño fue correcta en su momento (mejor
subir una foto grande que perderla), pero no contempló que el propio servidor **siempre** va a
rechazar esa foto grande, dejando al ciudadano sin una salida real más que probar con otra foto al
azar.

## Impacto para el ciudadano

- Ve "Protección interrumpida" repetidas veces, con **"Sacar otra foto"**, **"Reintentar
  protección"** o **"Guardar y enviar cuando haya señal"** como únicas opciones — ninguna resuelve
  el problema real (el tamaño), así que el ciudadano no tiene forma de saber qué hacer distinto.
- El fallo es **completamente silencioso del lado del cliente**: no hay ningún `console.warn` ni
  métrica cuando `createImageBitmap` falla acá — solo se puede ver el síntoma en los logs del
  servidor (`image_too_large`), nunca en los del navegador. Nadie del equipo se hubiera enterado de
  esto sin cruzar una prueba manual real con los logs de Supabase.
- Afecta específicamente a fotos de cámara sin reducir en iPhone/Safari (Android/Chrome no mostró
  este problema en las pruebas anteriores de REP-3793) — es decir, a una porción real y
  potencialmente grande de la base de usuarios.

## Qué se necesita para cerrar esto (no implementado, a criterio del PO/equipo)

1. **Confirmar el alcance real:** ya hay un caso puntual reproducido (iPhone 13 Pro, Safari, foto
   horizontal de 12 MP) — falta ver si pasa en otros modelos/versiones de iOS o es específico de
   ese equipo. Necesita una prueba dedicada en varios dispositivos, no una sola corrida.
2. **Agregar una vía de reducción que no dependa de `createImageBitmap`** cuando esa falla — por
   ejemplo, decodificar con un elemento `<img>` y su evento `onload` en vez de `createImageBitmap`,
   que tiene soporte más amplio y estable en Safari viejo.
3. **Instrumentar el fallo silencioso:** como mínimo, un `console.warn` (o una métrica) cuando
   `prepareEvidenceImage` cae al camino que no reduce, para poder detectar esto sin depender de
   cruzar logs del servidor a mano.
4. **Mientras no esté arreglado:** evaluar si el mensaje de "Protección interrumpida" debería
   distinguir el caso "la foto es muy grande" (que sí tiene una acción útil: elegir una foto ya
   guardada y más chica de la galería) del resto de los fail-safe — hoy todos muestran el mismo
   texto genérico.

## Referencias

- `src/services/metadataSanitizer.js` (`prepareEvidenceImage`, `normalizeImageOrientation`,
  `ensureJpeg`)
- `src/services/quarantinePipelineService.js` (llama a `prepareEvidenceImage` antes de subir)
- `src/test/EvidenceImageResize.test.js` (`UT-RSZ-06`, el trade-off ya está probado y documentado)
- `supabase/functions/quarantine-anonymize/protect.ts` (`MAX_SERVER_SIDE = 2048`, el límite que
  rechaza la foto sin reducir)
- Logs reales citados arriba: proyecto Supabase CiudadAR, función `quarantine-anonymize`,
  28/09/2026 ~16:44–16:53 UTC.
