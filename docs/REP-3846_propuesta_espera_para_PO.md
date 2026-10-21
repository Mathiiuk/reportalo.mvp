# REP-3846 · Propuesta de espera y mensajes con 4 fotos (para ratificar por el PO)

**Para:** Hernán (PO) · **De:** Matías · **Fecha:** 21/10/2026
**Ticket:** REP-3846 (O-01 de la QA REP-3833) · **Rama:** `fix/REP-3846-espera-y-mensajes-4-fotos`

## 1. El problema
La protección de las fotos es secuencial y tarda unos **11,3 s de mediana por foto** (REP-3828), unos 49 s con cuatro. La espera era **fija en 45 s**. Por eso, con 4 fotos y buena señal, la espera vencía siempre: el ciudadano volvía al mapa con «Se enviará automáticamente apenas recuperes señal», aunque nunca se había cortado la conexión. Pasó en 5 de 5 pruebas de REP-3833.

## 2. C · Espera proporcional (lo que hay que ratificar)
Hay dos límites. Los dos crecen con la cantidad de fotos:

| Fotos | Mediana medida (aprox.) | **Aviso** «tarda más de lo habitual» | **Espera máxima** antes de pasar a Pendientes |
|---|---|---|---|
| 1 | 11 s | 30 s | 50 s |
| 2 | 23 s | 45 s | 75 s |
| 3 | 34 s | 60 s | 100 s |
| 4 | 45 s | 75 s | **120 s (techo)** |

- **Aviso:** la pantalla dice que tarda más de lo habitual y ofrece «Dejarlo en Pendientes y salir». **No corta nada:** si la protección termina, el reporte sale normalmente.
- **Espera máxima:** recién ahí el reporte pasa a Pendientes solo. El techo es de **120 s** para cualquier cantidad de fotos.
- **Criterio:** más del doble de la mediana medida, para que la buena señal nunca llegue al límite.
- **Dónde se cambia:** los valores están en `src/services/sendWaitPolicy.js`. Si ratificás otros, se cambian solo ahí.

**Para decidir:**
1. ¿Aprobás la tabla, o preferís otro techo? Por ejemplo, 90 s.
2. ¿Te parece bien que el aviso ofrezca salir antes de la espera máxima?

## 3. E · Mensajes según el estado real (ya implementado)
| Situación | Qué ve el ciudadano |
|---|---|
| Reporte creado, con código | «Reporte enviado» con el #RP. No cambia y no afirma derivación institucional. |
| Fotos protegiéndose, con varias fotos | «Con 4 fotos tarda unos 45 segundos» y «Protegiendo la foto 2 de 4», con el avance real. |
| Pasó el tiempo habitual y sigue con señal | «Está tardando más de lo habitual. Seguimos protegiendo tus fotos: tu reporte todavía no se envió.» y el botón «Dejarlo en Pendientes y salir». |
| Pasa a Pendientes **con señal** (lento o elegido) | «Tu reporte quedó pendiente de envío. Podés consultarlo en Pendientes. Lo seguimos intentando solo.» y **se abre Pendientes**, sin volver al mapa. |
| Pasa a Pendientes **sin conexión confirmada** | «Reporte guardado con éxito. Se enviará automáticamente apenas recuperes señal.» y vuelve al mapa, como siempre. |
| No se pudo dejar un borrador reintentable | «No pudimos guardar tu reporte para enviarlo después. Tus datos siguen en pantalla…». No promete ningún envío. |
| Error no recuperable de protección | La pantalla de error de siempre, con el motivo (REP-3793). |

«Sin conexión confirmada» quiere decir que el teléfono informa que no tiene red. Un pedido que simplemente tarda **no** se trata como pérdida de señal.

**Para decidir:**
3. ¿Aprobás los textos de la tabla?

## 4. Evidencia (21/10, local contra la base Reportalo)
- **4 fotos con buena señal:** el reporte de prueba **#RP-6F56BD99** se protegió en 32 s, con el contador real foto por foto, y llegó a «Reporte enviado» a los 34 s. No volvió al mapa. Quedó un solo reporte con sus 4 fotos, sin duplicados.
- **Red lenta simulada** (1 foto, con una demora artificial de 45 s solo en el navegador de prueba): el aviso apareció a los 30 s. Con «Dejarlo en Pendientes y salir» se abrió Pendientes con el mensaje de pendiente, y el borrador se podía consultar. Después lo descarté: no se creó ningún reporte.
- **Tests:** 1098 en verde. `Rep3846EsperaYMensajes4Fotos.test.jsx` tiene 13 casos, incluido uno con reloj simulado: con 4 fotos no pasa a Pendientes a los 46 s, avisa a los 75 s y pasa a los 120 s.

## 5. Fuera de alcance (como dice el ticket)
- Paralelizar la anonimización, las llamadas de Vision duplicadas y las fotos huérfanas (O-02 de REP-3833).
- **Observación:** la tarjeta de Pendientes dice «Falta protegerse la foto: requiere conexión». Es correcto, pero con señal lenta suena a desconexión. Si te parece, lo ajusto en el mismo PR.
- **Observación:** la barra de progreso es una animación que llega al 96 % a los pocos segundos. El avance real ahora lo muestra el contador de fotos. Atar la barra al avance real sería un cambio chico, si lo querés.
