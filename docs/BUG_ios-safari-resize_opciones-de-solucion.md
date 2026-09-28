# Opciones de solución · Foto sin reducir en iPhone/Safari

Complementa `docs/BUG_ios-safari-resize-fails-image-too-large.md` (el diagnóstico). Este documento
solo compara alternativas — no se implementó ninguna todavía. Las tres quedan dentro de la misma
arquitectura actual (reducir la foto en el cliente antes de subirla, límite de 2048 px sin cambios
del lado del servidor, sin agregar dependencias nuevas).

## Opción 1 · Reemplazar `createImageBitmap` por `<img>` + canvas en el camino de respaldo

Cuando falle la reducción normal, decodificar la foto con un elemento `<img>` (su evento `onload`)
en vez de volver a llamar a `createImageBitmap` — que es la misma API que ya falló.

```js
const img = new Image();
img.src = URL.createObjectURL(file);
await new Promise((resolve, reject) => {
  img.onload = resolve;
  img.onerror = reject;
});
// dibujar img en el canvas con las dimensiones ya reducidas
```

| | Detalle |
|---|---|
| **Ventaja** | `<img>` tiene soporte mucho más amplio y estable en Safari/iOS que `createImageBitmap` — es la técnica clásica y probada para este problema puntual. Soluciona el caso de raíz, no solo lo mitiga. |
| **Ventaja** | No depende de una API con historial de bugs de compatibilidad; si Safari cambia de versión, es menos probable que se rompa de nuevo. |
| **Desventaja** | `<img>` no aplica la rotación EXIF al dibujarse en canvas (a diferencia de `createImageBitmap` con `imageOrientation: 'from-image'`), así que hay que leer la orientación a mano (`readExifOrientation`, ya existe en el código) y rotar el canvas con `context.rotate()`/`context.translate()` antes de dibujar. |
| **Desventaja** | Más código nuevo que las otras dos opciones, y hay que probarlo bien (las 8 combinaciones de orientación EXIF 1–8, no solo la rotación simple de 90°). |
| **Esfuerzo** | Medio — la lógica de rotación manual ya tiene un antecedente parcial en el código (`readExifOrientation`), pero hay que escribir la matriz de transformación completa. |
| **Resuelve el problema de raíz** | Sí. |

## Opción 2 · Reintentar `createImageBitmap` sin la opción de orientación

Si `createImageBitmap(file, { imageOrientation: 'from-image' })` falla, reintentar con
`createImageBitmap(file)` a secas (sin esa opción) y aplicar la rotación EXIF a mano sobre el
resultado, en vez de resignarse directo al tamaño completo.

| | Detalle |
|---|---|
| **Ventaja** | Cambio chico, reutiliza casi todo el código actual — un segundo intento antes de rendirse. |
| **Ventaja** | Si la causa real es específicamente la opción `imageOrientation: 'from-image'` (hay reportes de esa combinación puntual fallando en algunas versiones de Safari), esto lo resuelve con el mínimo esfuerzo. |
| **Desventaja** | **No hay certeza de que sea esa la causa.** Si `createImageBitmap` falla por el tamaño/memoria de la imagen (12 MP+) y no por la opción, este cambio no soluciona nada — seguiría fallando igual, solo que con un paso intermedio de más. |
| **Desventaja** | Sigue dependiendo de la misma API con historial de problemas; no es una solución definitiva, es una apuesta a que la causa sea la más barata de arreglar. |
| **Esfuerzo** | Bajo. |
| **Resuelve el problema de raíz** | Solo si la causa es la opción de orientación, no el tamaño. Sin poder reproducir en el dispositivo real, es una apuesta. |

## Opción 3 · Pedirle a `createImageBitmap` que reduzca en el mismo paso (`resizeWidth`)

En vez de decodificar la foto completa y recién después reducirla con canvas, pasar
`resizeWidth`/`resizeHeight`/`resizeQuality` directo en las opciones de `createImageBitmap`, para
que el navegador decodifique ya en el tamaño chico:

```js
createImageBitmap(file, {
  imageOrientation: 'from-image',
  resizeWidth: 1600,
  resizeQuality: 'medium',
})
```

| | Detalle |
|---|---|
| **Ventaja** | Cambio mínimo, un par de propiedades nuevas en la llamada que ya existe. |
| **Ventaja** | Si la causa es memoria pico al decodificar una imagen de 12 MP completa antes de reducirla, evitar ese pico podría alcanzar para que no falle. |
| **Desventaja** | Sigue siendo la misma API (`createImageBitmap`); si el problema no es de memoria sino de la opción de orientación combinada con esa implementación de Safari, esto no cambia nada. |
| **Desventaja** | Menos control fino sobre el resultado final (hay que verificar que `resizeWidth` solo, sin `resizeHeight`, mantenga la relación de aspecto como se espera). |
| **Esfuerzo** | Bajo. |
| **Resuelve el problema de raíz** | Parcial — depende de cuál sea la causa real, que no está confirmada. |

## Recomendación

**Opción 1 como arreglo definitivo**, probando primero **Opción 3 como intento intermedio barato**
antes de cae al camino con `<img>` (es decir: intento normal → intento con `resizeWidth` → recién
ahí `<img>` + canvas si los dos anteriores fallan). Opción 2 sola no se recomienda como única
solución porque apuesta a una causa no confirmada — serviría como diagnóstico rápido, no como cierre
del ticket.

En cualquier caso, sumar lo que ya quedó anotado en el diagnóstico: instrumentar el fallo (hoy es
silencioso) y, si las tres fallan, mostrarle al ciudadano un mensaje que lo lleve a elegir una foto
más chica de la galería en vez del texto genérico de fail-safe.

## Qué falta antes de decidir

Ninguna de las tres se probó todavía contra el dispositivo real que mostró el problema (iPhone 13
Pro, Safari) ni contra otros modelos/versiones de iOS — la comparación de arriba es por
características conocidas de las APIs, no por evidencia de que cada una resuelva este caso puntual.
