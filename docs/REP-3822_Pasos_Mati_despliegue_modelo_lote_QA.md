# REP-3822 — Pasos para Mati: despliegue, modelo y lote QA visual
Tarea: https://unlz2026.atlassian.net/browse/REP-3822
Antecedente de costos: https://unlz2026.atlassian.net/browse/REP-3799

## Pedido

Mati, para medir costo y performance de la verificación visual necesitamos confirmar tres cosas: **cuándo quedó disponible en staging, qué modelo/configuración ejecuta realmente y cómo vamos a distinguir cada llamada del lote QA visual**. Seguí estos pasos y devolvé la ficha del final con el export de prueba. Si algo todavía no está desplegado o registrado, indicá pendiente; no completes con una estimación como si fuera evidencia.

El alcance es verificación visual con resultados `coincide`, `no_coincide` y `no_concluyente`. No implica habilitar la futura fase imagen→RAG. Separar la llamada Gemini de verificación de Cloud Vision utilizado para anonimización y del RAG textual.

## 1. Confirmar disponibilidad real en staging

1. Identificá la URL de staging y la versión de frontend y función/backend que ejecutan la verificación visual.
2. Si aún no está desplegado, informá qué falta y la fecha prevista, identificada como prevista. Prepará los pasos 2 y 3 mientras tanto.
3. Al desplegar, guardá el identificador del despliegue o commit y la fecha/hora con zona horaria. Si frontend y backend se despliegan por separado, registrá ambos.
4. Ejecutá un reporte de humo con una imagen ya protegida y comprobá que llega a la función visual correcta y devuelve un resultado visible/persistido. Identificá esa llamada como `smoke`, separada del lote de medición.
5. Informá dos horarios: despliegue técnico y primera prueba exitosa del recorrido integrado. No dar por disponible staging solo porque terminó el build.
6. Anotá si existe un flag para habilitar la verificación y su estado en staging. Indicá si también quedó habilitada en producción.

Formato de fechas: ISO 8601 con offset, por ejemplo `AAAA-MM-DDTHH:MM:SS-03:00`; conservar también UTC en los registros. El ejemplo es un formato, no una fecha real de despliegue.

**Devolución:** URL staging, commit/deployment, horarios, estado de habilitación e ID de reporte/llamada de humo. Si solo existe una ejecución local, marcar entorno local y no presentarla como staging.

## 2. Confirmar el modelo y la configuración usados

1. Revisá la configuración efectiva de la versión desplegada, sin copiar claves ni secretos.
2. Informá el nombre exacto enviado a la API, la versión informada por la respuesta cuando esté disponible y si se usa un alias que puede cambiar.
3. Indicá versión del prompt, nivel/presupuesto de thinking, límite de salida y parámetros de imagen que se configuren: resolución/dimensiones, compresión y recortes.
4. Confirmá si se envía **una foto por llamada** o **varias fotos en una llamada**, cómo se incluyen descripción/categoría y si se reutilizan datos del análisis textual.
5. Detallá modelos alternativos/fallback, qué los activa y máximo de intentos. Cada intento debe registrar el modelo real, aunque el modelo principal falle.
6. Confirmá qué funciones de Cloud Vision siguen activas para anonimización. En Billing se observaron rostros, objetos y OCR; ese historial no prueba la configuración actual. Mantener sus operaciones separadas del costo de verificación Gemini.

**Devolución:** configuración efectiva y una llamada de humo que la respalde. No elegir el modelo por el que más aparece en Billing: el CSV contiene varios modelos y experimentos.

## 3. Identificar el lote y cada intento antes de medir

1. Reutilizá la auditoría existente si alcanza. No hace falta crear otra tabla si permite exportar todos los datos siguientes.
2. Acordá con Leo e Iván un `qa_batch_id` estable, por ejemplo `REP-3822-QA-01`, y asigná un `case_id` a cada caso. No marcar retrospectivamente todo staging como este lote.
3. Propagá lote y caso desde el reporte a cada llamada del backend. Vinculá cada intento con `report_id`, referencia(s) de foto y un `call_id` único.
4. Registrá cada intento, también los fallidos y los reintentos. Guardá los datos antes de que un error o un resultado descartado impidan persistir el análisis final.
5. Registrá los campos de la tabla siguiente. Los nombres son una propuesta de exportación; se pueden mapear a columnas existentes si se documenta la equivalencia.
6. Si la API no devuelve uso en un fallo, guardá tokens como desconocidos/nulos y la causa. No asumir cero ni que una lectura de cola representa una llamada al proveedor.
7. Si se usa una clave separada para QA visual, anotá solo su alias. Ayuda al control agregado, pero no sustituye la identificación del lote y de cada intento. No es necesario crear otro proyecto para empezar.
8. Exportá una prueba de humo para comprobar que los campos se recuperan. Separá esa prueba de la muestra de QA; si cambia modelo/prompt/despliegue durante el lote, cerrá el lote o versioná explícitamente la nueva cohorte.

| Campo | Contenido mínimo |
|---|---|
| `qa_batch_id`, `case_id`, `environment` | Lote, caso y staging/local/producción |
| `report_id`, `photo_ids`, `photo_count` | Reporte, referencias internas y cantidad de fotos enviadas |
| `call_id`, `attempt`, `stage` | Intento único y etapa: verificación visual, textual o anonimización |
| `deployment_id`, `prompt_version` | Versión efectivamente ejecutada |
| `model_requested`, `model_returned` | Modelo pedido y devuelto si está disponible |
| `started_at`, `finished_at`, `duration_ms` | Tiempo alrededor de la llamada al proveedor, incluidos fallos |
| `input_tokens`, `output_tokens`, `thinking_tokens` | Contadores devueltos y definición de cada uno |
| `raw_usage_metadata` | Metadatos originales para verificar sumas y modalidades |
| `status`, `error_code`, `error_message` | Éxito/error; mensaje sin secretos ni contenido sensible |
| `visual_result` | Coincide/no coincide/no concluyente; fallo técnico separado |

**Tokens:** documentar si `output_tokens` ya incluye thinking. Si no lo incluye, mantener salida visible y thinking separados y calcular salida facturable según la API/modelo. No sumar thinking dos veces. Entrada visual incluye también instrucciones y descripción; no cobrar solo los tokens de imagen.

**Latencia:** diferenciar duración del intento al proveedor de tiempo total de la etapa visual, que puede incluir espera/reintentos. Registrar inicio y fin de la etapa por reporte si es posible. Si hay fotos en paralelo, no sumar sus duraciones como si fuera tiempo de espera del usuario.

**Varias fotos:** el costo de la llamada compartida puede medirse por reporte; dividirlo por cantidad de fotos da una asignación promedio, no tokens reales individuales por foto. Identificarla así.

## 4. Preparar y ejecutar la medición con QA

1. Iván define casos con resultado esperado antes de ejecutar: coincide claramente, contradice la descripción y evidencia insuficiente.
2. Incluir reportes de 1, 2 y 3 fotos, documentando cómo se agrega un resultado si las fotos discrepan. Acordar tamaño y repeticiones según tiempo del sprint; no dar por validada una muestra estadística por tener un número fijo de casos.
3. Anotar inicio y fin exactos del lote, versión y cambios. Identificar experimentos ajenos que compartan proyecto/clave.
4. Medir también el textual vigente con las mismas descripciones y una referencia comparable. Separar costo/latencia de cada etapa del tiempo del recorrido completo.
5. Exportar todos los intentos del lote a CSV y una ficha del lote. Si alguna métrica no está disponible, indicar limitación y acción para obtenerla antes de correr la muestra principal.

## 5. Cómo usar AI Studio y Billing sin igualar ventanas distintas

AI Studio: https://aistudio.google.com/usage
Billing: https://console.cloud.google.com/billing/01D709-814165-79F0AA/reports?project=gen-lang-client-0092300839

En las capturas de Leo del 07/10, AI Studio ofrece última hora, 1 día, 7 días, 28 días, 90 días y este mes. No se observa una opción de 30 días ni un intervalo personalizado. **No hace falta buscarla ni cambiar a 90 días para forzar la comparación.**

- Los 90 días sirven como contexto histórico; no conciliar su total con el CSV Billing 07/09–06/10.
- Para el lote, usar la vista más corta que lo contenga y filtros de modelo/alias de clave disponibles. Anotar hora de captura, período, filtros y zona mostrada; los gráficos adjuntos indican UTC−8.
- La fuente exacta del lote será el CSV del backend filtrado por `qa_batch_id` y timestamps, no la altura de las barras.
- Leo fija en Billing las fechas pertinentes, proyecto explícito y agrupación por SKU; mantiene costo de lista, ahorros y neto. Registrar desfases de fecha/zona y esperar actualización de cargos antes de conciliar.
- Billing puede mezclar texto, visual y pruebas del mismo modelo; una diferencia antes/después no demuestra costo exclusivo del lote si hubo otras llamadas. Documentar consumo concurrente y cualquier diferencia sin atribuir.
- Los paneles “Solicitudes de Imagen” vacíos no reemplazan la revisión del consumo multimodal: el CSV ya muestra entrada de imagen en Gemini.

No sumar Cloud Vision ni embeddings al costo incremental de verificación salvo que esa nueva etapa los invoque adicionalmente. Mostrar aparte el costo del recorrido completo si se requiere.

## 6. Entregable de Mati

Adjuntar a REP-3822:

- [ ] Ficha de despliegue y disponibilidad real.
- [ ] Modelo/configuración definitiva, fallback y versión de prompt.
- [ ] Mapeo de campos y lugar de registro/exportación.
- [ ] CSV de humo que demuestra identificación y recuperación de métricas.
- [ ] Luego de QA: CSV completo del lote y horarios de inicio/fin.

### Ficha para completar

```text
Estado: pendiente de despliegue / desplegado / recorrido probado
URL staging:
Commit/deployment frontend:
Commit/deployment backend:
Despliegue técnico (fecha, hora, zona):
Primera prueba integrada exitosa (fecha, hora, zona):
Reporte/llamada de humo:
Modelo solicitado y versión devuelta:
Prompt/configuración/thinking/límite salida:
Fotos por llamada y agregación de resultados:
Fallback y política de reintentos:
Funciones Vision actuales:
Identificador del lote QA:
Dónde se registra y cómo se exporta:
¿Se conservan intentos fallidos?:
¿Salida incluye thinking?:
Campos pendientes:
Inicio/fin del lote (a completar al ejecutar):
Archivos/evidencias adjuntas:
Limitaciones y siguiente acción:
```

## Referencias técnicas

- Tokens y metadatos de uso: https://ai.google.dev/gemini-api/docs/tokens
- Thinking: https://ai.google.dev/gemini-api/docs/thinking
- Tarifas para el modelo confirmado, verificar al medir: https://ai.google.dev/gemini-api/docs/pricing
- Interpretación de errores: https://ai.google.dev/gemini-api/docs/troubleshooting
- Billing y filtros: https://cloud.google.com/billing/docs/how-to/reports

**Criterio práctico:** antes del lote principal tenemos que poder relacionar una foto/reporte con sus intentos, modelo, tokens, duración y resultado. Leo calcula costos/proyecciones; Iván verifica los resultados; Mati entrega la trazabilidad técnica. No se pide reconstruir el historial completo ni iniciar la Fase 2.
