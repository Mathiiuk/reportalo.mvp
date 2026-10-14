# REP-2800 · Preguntas previas a implementar

Contexto leído: ticket REP-2800, REP-2806, `00_LEEME_Matias_RAG_y_destino_Sprint16.md`, `Propuesta_carga_destino_y_vocabulario.md` y `REP_2806_matriz_organismos_canales_v1_2.md`.

**Cómo lo entiendo**
- REP-2800 (Sprint 16) es el motor de routing, el contrato JSON, las reglas R-1 a R-8 y los fixtures para QA.
- Lo del Sprint 17 es la carga de normas, la partición del art. 26 por inciso, la inclusión forzada en el RAG, las leyes 2628 y 5688 y el vocabulario con su puente al RAG.
- El routing necesita datos reales para correr en staging, y ahí hay que trazar la línea con cuidado para no desorganizar el Sprint 17.

---

## Alcance

1. **¿Qué entra en REP-2800 y qué queda para el Sprint 17?**
   Recomendación: entra solo lo mínimo para que el routing funcione: la migración de `agency_services.attribute_value_id`, las prestaciones y sus valores, y los organismos, canales y `agency_services`. Queda fuera `service_keywords` (vocabulario), `fragment_services` (normas) y todo lo del RAG.
2. **¿Existe ya un ticket del Sprint 17 para la carga de normas y el vocabulario?** Si no, ¿quieres que deje el texto redactado para que lo cree Leo (sin crearlo yo)?
3. **Los puntos 2 a 7 del PO** (REP-2502, REP-2801, REP-2902, REP-3535, REP-3827, REP-3828): no se tocan, ¿correcto?

## Archivos

4. En `docs/New folder` solo hay 3 `.md`. Faltan los **4 CSV** (`prestaciones`, `vocabulario`, `destino`, `vinculos_norma`) y el script que los regenera. Sin `destino.csv` y `prestaciones.csv` no puedo cargar datos ni armar fixtures. ¿Los tienes? Si no, los busco en el Drive conectado.

## Decisiones de diseño

5. **Organismos de toda la Ciudad (§2.2 de la propuesta).** Opción A: una fila por comuna (15 por organismo). Opción B: agregar `state_province_id` a `agencies`.
   Recomendación: A, porque no toca el RLS. Consecuencia: `agencies.name` es `UNIQUE`, así que hay que nombrarlas distinto (p. ej. "Ministerio EPHU — Comuna 1") o relajar la restricción.
6. **Dónde vive la lógica.** Recomendación: función SQL determinística sobre las tablas existentes, que devuelve el JSON del contrato. Alternativa: Edge Function. ¿Cuál?
7. **Cuándo corre y dónde se guarda.** Recomendación: al enviar el reporte, persistiendo el resultado con versión de catálogo y regla (escenario 3: misma entrada, mismo destino, sin envíos duplicados). Implica una tabla o columna nueva para la traza. ¿De acuerdo?
8. **Prestación de entrada.** El routing necesita la prestación, pero el selector de prestación no existe en el front. ¿Cómo se alimenta en este sprint? Opciones: parámetro de entrada de la función, o default por categoría. Si falta la prestación, aplica R-2 (sin destino verificado).
9. **Avenida vs. calle secundaria (T-7).** No hay dato de jerarquía vial. Recomendación: parámetro opcional `tipo_via` (`avenida`, `secundaria` o nulo); si falta, `no_resuelto` con los dos candidatos. Sin geometría.
10. **Jurisdicción efectiva.** Recomendación: derivarla de `locality_id` → subdivisión → provincia/Ciudad, sin geocodificar. ¿Alcanza para el caso "datos geográficos insuficientes"?

## Entorno y proceso

11. **Supabase.** ¿Puedo consultar staging con el MCP en solo lectura (`services`, `agencies`, RLS, `service_attributes`)? Las migraciones nuevas, ¿las aplico yo en staging o las dejo en el repo y las aplicas tú?
12. **Rama.** Estás en `feat/RAG-S15-aplicado-en-staging-lote3-y-prompt-v5` con muchos archivos sin versionar. Propongo salir de `staging` a `feat/REP-2800-resolver-organismo-receptor`, sin arrastrar nada. ¿Correcto?
13. **Datos de prueba.** El LEEME dice que los 2 organismos del seed (`@reportalo.test`) se reemplazan. ¿Puedo reemplazarlos aunque `seed.sql` o `SupabaseSeedValidation.test.js` dependan de ellos? Lo reviso, pero necesito tu confirmación.

## Comportamiento pendiente del PO

14. **Gmail de Avellaneda.** El LEEME los da por válidos, la matriz dice "confirmar antes del envío automático". Recomendación: el motor devuelve el canal y `requiere_envio = false` siempre en esta tarea, porque REP-2801 queda en "solo borrador". ¿Correcto?

---

**Prioridad:** con las respuestas a 1, 4, 5, 6, 7 y 8 puedo armar el plan técnico. El resto lo resuelvo con las recomendaciones indicadas, salvo que indiques otra cosa.

---

## Actualización: lo que cambian los comentarios de Jira

Comentarios leídos: REP-2806 (Hernán, 14/10 10:23), REP-2801 (Hernán, 14/10 11:29), REP-2805 (Iván y Hernán, 13 y 14/10). REP-2800, REP-2809, REP-2810, REP-3836 y REP-1008 no tienen comentarios.

**Ya respondido por el PO (se cierra la pregunta 14)**
- Canal del MVP: **solo borrador**, no sale ningún correo a organismos. Los Gmail de Avellaneda se toman como válidos para mostrarlos. Para probar el envío se suma una **dirección de prueba asociada al contacto**; cómo se guarda lo define Matías.
- Iván propuso `reportalo-qa@proton.me` como casilla de prueba (REP-2805, 14/10 11:38).
- Vulnerabilidad social **no se deriva** con la plantilla: el reporte queda como "comunicado" y se informa el canal (108, Desarrollo Social, 102 o Consejo de Niñez), sin prometer que alguien va a ir.
- El estado que se informa es "notificado al organismo X" con el área nombrada. "Resuelto" solo lo pone el organismo.
- Ejemplos de referencia: bache en Flores (CABA) y luminaria en Avellaneda, ambos con destino y marcados como borrador.

**Preguntas nuevas**
15. **Dirección de prueba.** El PO dice que se guarda "junto al contacto" y lo defino yo. Recomendación: una columna opcional `test_value` en `agency_contacts`, y que el routing la devuelva aparte (`canal_prueba`) sin mezclarla con `canal_verificado`. ¿Es REP-2800 o REP-2801? Impacta el contrato JSON.
16. **Vulnerabilidad social en el contrato.** Con "comunicado" en vez de "enviado", ¿el motor devuelve `requiere_envio = false` y un criterio propio (p. ej. `solo_informar_canal`), o sigue la regla R-6 tal cual? Recomendación: `requiere_envio = false` siempre en esta tarea (todo es borrador), y para vulnerabilidad social además un criterio explícito.
17. **¿La salida es "notificado a X" o "borrador"?** El estado real lo define REP-2801/REP-2502, pero el routing debe dejar el dato (organismo + área). Confirmo que no escribo estados desde REP-2800.
18. **Subtarea REP-3742.** El ticket dice que forma parte de los 2 SP, pero no la encuentro en Jira. ¿Es la subtarea DEV y se llama así, o es otro número?
19. **REP-3836 (Sprint 17).** El gate jurídico de Hernán sobre D2–D4 bloquea la carga de normas, no el routing. Confirmo que REP-2800 no depende de él.
