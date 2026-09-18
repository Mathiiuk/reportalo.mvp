# Reportalo

*Plataforma de Auditoría Ciudadana*

## VERIFICACIÓN DEL RAG — CUARTA RONDA: CIERRE DEL SPRINT 12

**Versión 1.0 · 15 de septiembre de 2026 · Proyecto RAR-2026**

**Responde a:** `REP-2908-VERIF_devolucion-ronda3.md` (Matías, 15/09)
**Jira:** [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) · [REP-2901](https://unlz2026.atlassian.net/browse/REP-2901) · [REP-2909](https://unlz2026.atlassian.net/browse/REP-2909) · [REP-2910](https://unlz2026.atlassian.net/browse/REP-2910) · [REP-3773](https://unlz2026.atlassian.net/browse/REP-3773) · [REP-2500](https://unlz2026.atlassian.net/browse/REP-2500)
**Archivos de apoyo (carpeta Drive del proyecto):** https://drive.google.com/drive/folders/1JJ6T0Y2MhhzONvaffT8PN7j34lTJjoe9
- `REP-3769_seed_y_RAG.sql` (PARTES 5B, 7 y 8)
- `REP-3764_casos_esperados.md` (casos A–F)
- `REP-2908-VERIF_ronda2_hernan.md` (criterios de cierre)

**Equipo:** Hernán Gregorini (PO · DBA) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

---

## 0. Reglas (sin cambios)

1. Este documento es la única fuente de instrucciones. Si algo no está claro, se le pregunta a Matías.
2. Nunca se escribe una clave en ningún lado. Las consultas devuelven nombres, nunca valores.
3. Las consultas son de solo lectura, salvo las marcadas **[ESCRIBE]**.
4. Nada se borra sin el OK escrito de Hernán.
5. Todo cambio de base se hace con una migración y entra por PR contra `staging`. **La parte de base la revisa Hernán antes del merge.**
6. Si un nombre real difiere del de este documento, se usa el real y se anota la diferencia.

---

## 1. Resumen

La tercera ronda deja resuelto casi todo lo de seguridad:

- el repositorio público quedó limpio;
- la clave expuesta quedó sin valor, porque las claves viejas están deshabilitadas;
- los datos demo están recargados;
- el costo real quedó medido: **unos US$ 1,9 cada 1.000 reportes** con el prompt v1.

Para cerrar el RAG del Sprint 12 (viernes 18/09) quedan cinco frentes:

1. **Una decisión de producto que el arreglo de V-09 tomó de hecho:** el RAG ahora solo busca normas de la categoría que eligió el ciudadano. Hernán la registra en REP-3773 (sección 2).
2. **Volver a correr los casos A–E con ese filtro.** Las 35 corridas se hicieron antes del arreglo (P-01).
3. **Explicar los dos `indeterminado` de los datos demo** y definir qué ve el ciudadano en ese caso (P-02).
4. **Aplicar los permisos de lectura** de las tablas que clasificó Hernán. Algunos los necesitan REP-2500 y la línea de tiempo del reporte (P-04).
5. **Pendientes cortos:** alerta de presupuesto, protección de contraseñas, PR de V-04, comentario en Jira y la reconstrucción de la base (P-07 a P-10).

---

## 2. Decisión del PO sobre el filtro por categoría (V-09)

**Qué cambió.** `match_knowledge_fragments` ahora filtra por la categoría que elige el ciudadano, usando `fragment_services`. Si esa categoría no tiene fragmentos, el resultado es `sin_normativa` sin llamar al modelo. Esto corrige el caso F, que fallaba 5 de 5 citando una norma de tránsito para venta ambulante.

**Lo que implica:**
- **El RAG ya no detecta una categoría mal elegida.** Si alguien reporta un auto sobre una rampa como "Infraestructura", sale `sin_normativa` aunque la norma exista. Esto afecta a REP-2901 ("clasificar jurídicamente un reporte") y a REP-2910 ("probar precisión de clasificación").
- **La tabla `fragment_services` pasa a ser la pieza jurídica crítica:** decide qué puede citar el RAG. El error del caso F muestra por qué. La cita probablemente era el art. 48 inc. t) de la Ley 24.449 ("realizar venta de productos en zona alguna del camino"): era literal y superaba la validación, pero estaba mal aplicada, porque en esa ley "camino" es una vía rural (art. 5 inc. i). **Que una cita sea literal no garantiza que sea correcta.**

**Decisión para el Sprint 12:**
1. **Se acepta el filtro por categoría** para lo que el sistema **cita**.
2. **Cambios en la tabla:** `fragment_services` solo se modifica con el OK de Hernán, que es el responsable del corpus legal. Cada cambio pasa por PR.
3. **Queda para un ticket aparte, fuera del S12:** cuando la búsqueda filtrada no encuentra nada, hacer una búsqueda sin filtro **solo para sugerir** otra categoría (`suggested_service_id`). Esa búsqueda no se cita nunca. Así el sistema vuelve a poder avisar "¿no será de otra categoría?" sin reabrir el problema del caso F.
4. **Registro:** Hernán deja esta decisión en REP-3773 y ajusta el alcance de REP-2901 y REP-2910.

**Qué mandar:**

```sql
-- Definición actual de la búsqueda (puede tener más de una firma)
select pg_get_function_identity_arguments(p.oid) as firma, pg_get_functiondef(p.oid) as definicion
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'match_knowledge_fragments';

-- Asignación actual de categorías (se compara contra la PARTE 7: 15 filas, FR15 sin categoría)
select f.id, f.hierarchy_path, string_agg(s.service_code, ', ' order by s.service_code) as categorias
from public.knowledge_fragments f
left join public.fragment_services fs on fs.fragment_id = f.id
left join public.services s on s.id = fs.service_id
where f.is_current
group by f.id, f.hierarchy_path
order by f.id;
```

**Revisión posterior de los PR #62 a #64.** Se mergearon sin la revisión de base. Hernán los revisa ahora con la definición de arriba. Si encuentra algo, sale en un PR de corrección.

---

## 3. Puntos abiertos

| ID | Tema | Prioridad | Responsable |
|---|---|---|---|
| P-01 | Volver a correr A–E con el filtro por categoría | P1 | Matías |
| P-02 | Los dos `indeterminado` de los datos demo y qué ve el ciudadano | P1 | Matías → Hernán |
| P-03 | Reporte 7 (microbasural) y caso A: normas de obligación | P2 | Hernán decide, Matías aplica |
| P-04 | Permisos de lectura de las 14 tablas | P1 | Matías aplica, Hernán revisa |
| P-05 | Cómo se arregló `embedding_model_code` | P1 | Matías |
| P-06 | Tokens de razonamiento y tope de salida | P2 | Matías |
| P-07 | Alerta de presupuesto y protección de contraseñas | P1 | Matías (cinco minutos) |
| P-08 | Reconstruir la base desde cero | P1 | Matías |
| P-09 | PR de V-04 y comentario en REP-2908 | P1 | Matías |
| P-10 | V-06: evidencia faltante | P2 | Matías |
| P-11 | Repositorio público: cierre del incidente | P2 | Matías · Hernán |
| P-12 | Trigger `audit_ia` | P3 | Hernán decide |

---

### P-01 · Volver a correr A–E con el filtro — P1

Las 35 corridas se hicieron **antes** del arreglo. Después solo se probaron 2 casos nuevos. El filtro cambia lo que se recupera en todos los casos, así que hay que repetirlos.

**Qué correr.** 5 corridas de cada caso, con la categoría que elegiría un ciudadano, más 2 pruebas de categoría mal elegida (1 corrida cada una). En total, 37 corridas, con un costo menor a US$ 0,10.

| Caso | Texto (REP-3764) | Jurisdicción | Categoría | Resultado esperado |
|---|---|---|---|---|
| A | Boca de tormenta rota | Avellaneda | INFRAESTRUCTURA | LOM 52/59 (e idealmente Const. PBA 192.4, ver P-03) |
| B | Auto sobre la rampa | CABA | TRANSITO | Ley 2148 art. 7.1.9 y Ley 451 |
| C | Auto sobre la rampa | Avellaneda | TRANSITO | Ley 24.449; ninguna norma de CABA |
| D-Av | No anda la luz | Avellaneda | INFRAESTRUCTURA | LOM 52 |
| D-CABA | No anda la luz | CABA | INFRAESTRUCTURA | Ley 210 art. 2 inc. b) |
| E | Discuten y frenan el tránsito | Avellaneda | TRANSITO | Ley 24.449; no el Código de Faltas |
| Prueba 1 | Auto sobre la rampa | CABA | **INFRAESTRUCTURA** (mal elegida) | `sin_normativa`. Documenta el límite del filtro |
| Prueba 2 | Venta ambulante | Avellaneda | **TRANSITO** (mal elegida) | **No** citar el art. 48 inc. t). Si lo cita, hay que revisar esa asignación |

**Qué mandar:**
- una tabla por corrida con estado, citas, lista recuperada (posición, fragmento, similitud) y motivo si fue rechazada;
- un resumen de aciertos por caso (X de 5).

**Se cierra cuando:**
- **(excluyente)** no hay ninguna cita fuera de lo recuperado ni ninguna cita no literal;
- C nunca recupera normas de CABA;
- B y D-CABA nunca recuperan la Ley 24.449;
- la prueba 2 no cita el art. 48 inc. t).

---

### P-02 · Los dos `indeterminado` de los datos demo — P1

Los reportes 3 (residuos en Puerto Madero, confianza 0,3) y 5 (luminaria en Retiro, confianza 0,5) dieron `indeterminado`, pero figuran con citas. En nuestro catálogo, `indeterminado` significa **"error o validación fallida: no se emite fundamento"**.

**Preguntas:**
1. ¿Cuál fue el motivo exacto de cada uno? Opciones: cita no literal, error de la API, confianza por debajo de un umbral (¿cuál?), o el propio modelo respondió "no puedo determinar".
2. Si el código convierte a `indeterminado` las respuestas con confianza baja, ¿cuál es el umbral y dónde está?
3. ¿Dónde queda guardado el motivo?

```sql
select r.id, s.service_code, a.result_status_code, a.confidence_score,
       a.citizen_feedback, a.official_legal_foundation, a.prompt_version
from public.report_ai_analysis a
join public.citizen_reports r on r.id = a.report_id
join public.services s on s.id = r.service_id
where r.id in ('40000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000005');
```

**Propuesta, si el motivo no se guarda en ningún lado.** Agregar una columna de texto con el motivo. No afecta la normalización: depende solo del análisis. Va por migración, con el OK de Hernán.

```sql
-- [ESCRIBE, por migración, con OK de Hernán]
alter table public.report_ai_analysis add column if not exists status_reason text;
```

**Regla de visualización propuesta:**

| Estado | Qué ve el ciudadano | Qué ve el organismo |
|---|---|---|
| `fundamentado` | El fundamento en lenguaje llano, sin sanciones | El fundamento técnico y las citas |
| `sin_normativa` | "Todavía no tenemos normativa cargada para este tipo de reclamo" | Lo mismo |
| `indeterminado` | "El análisis legal está en revisión". **Ninguna cita** | El motivo y lo que se recuperó |

**Se cierra cuando:**
- está el motivo de los dos casos;
- el motivo queda guardado en cada análisis nuevo;
- la regla de visualización queda escrita en REP-2909.

---

### P-03 · Normas de obligación: reporte 7 y caso A — P2, decide Hernán

- **Reporte 7 (microbasural en Sarandí, AMBIENTE):** dio `sin_normativa` con 1 fragmento recuperado y 0 citados. Hernán decidió el 14/09 que la LOM art. 52 ("barrido, riego, limpieza…") **cubre los basurales**, y la tabla de categorías lo refleja. El fragmento se recuperó, pero el modelo no lo usó.
- **Caso A:** se repite el patrón con la Constitución PBA art. 192 inc. 4 ("la vialidad pública").

El modelo es muy conservador con las normas de tipo `obligacion`, que están escritas en términos generales. Se propone una regla en el prompt, que **Hernán aprueba en REP-3773** antes de aplicarse:

> "Las normas de tipo *obligación* establecen deberes generales del Estado o del municipio. Pueden fundar un reclamo aunque no nombren la situación concreta, siempre que el servicio o la obra reclamada esté comprendido en el texto (por ejemplo: 'limpieza' comprende la acumulación de residuos; 'vialidad pública' comprende calles y desagües de la vía pública). No se aplican a conductas de terceros."

**Si se aprueba:**
- sube la versión del prompt a `v2`;
- se vuelven a correr el caso A (5 veces), el reporte 7 y la prueba 2 de P-01, que no debe empeorar.

---

### P-04 · Permisos de lectura de las 14 tablas — P1

**Clasificación de Hernán.** Varias tablas las necesita REP-2500 y la línea de tiempo del reporte:

| Tabla | Decisión | Por qué |
|---|---|---|
| `countries`, `states_provinces` | Lectura para usuarios con sesión | El selector de REP-2500 muestra "Localidad — Partido/Comuna, Provincia" |
| `service_attributes`, `service_attribute_values` | Lectura para usuarios con sesión | Las usa el formulario del reporte |
| `agencies` | Lectura para usuarios con sesión | La vista `report_timeline` muestra organismo y departamento |
| `report_state_history`, `report_events` | Lectura para el dueño del reporte y para el funcionario que lo atiende | "Consultar el reporte después" (REP-2500) y la trazabilidad decidida el 14/09 |
| `profiles` | Cada usuario lee su propio perfil | Mínimo necesario |
| `infraction_attribute_responses` | El ciudadano carga y lee las respuestas de sus reportes; el funcionario que lo atiende las lee | Son las respuestas del formulario |
| `agency_contacts`, `agency_subscriptions`, `profile_services`, `report_outreach_logs` | Solo el servidor (correcto como está) | Datos de contacto y comerciales |
| `infraction_types` | Solo el servidor | Heredada, igual que `infractions` |
| `embedding_models`, `generation_models`, `fragment_embeddings` | Solo el servidor (correcto como está) | Uso interno del RAG |

**Antes de aplicar, confirmar:**
- **Perfiles:** si hoy la app lee `profiles` desde el navegador y funciona, ¿cómo lo hace (RPC, clave de servidor)? Hay que avisarnos antes de aplicar, porque la política cambia ese acceso.
- **Reportes propios:** las políticas de abajo consultan `citizen_reports` para saber si el reporte es del usuario. Eso supone que el ciudadano ya puede leer sus propios reportes. Si no puede, avisar.
- **Nombres de columna:** si `citizen_reports.user_id` o algún otro nombre difiere en la base real, se usa el real (regla 6).

**Migración propuesta [ESCRIBE, por PR, la revisa Hernán]:**

```sql
begin;

-- 1) Catálogos y organismos: lectura para usuarios con sesión
do $$
declare t text;
begin
  foreach t in array array['countries','states_provinces','service_attributes',
                           'service_attribute_values','agencies'] loop
    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = t and policyname = 'read authenticated') then
      execute format('create policy "read authenticated" on public.%I for select to authenticated using (true)', t);
    end if;
  end loop;
end $$;

-- 2) Historia y eventos del reporte: dueño o funcionario que lo atiende
do $$
declare t text;
begin
  foreach t in array array['report_state_history','report_events'] loop
    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = t and policyname = 'read own or attended') then
      execute format($p$
        create policy "read own or attended" on public.%I for select to authenticated
        using (
          exists (select 1 from public.citizen_reports r
                  where r.id = report_id and r.user_id = (select auth.uid()))
          or public.profile_attends_report((select auth.uid()), report_id)
        )$p$, t);
    end if;
  end loop;
end $$;

-- 3) Perfil propio
create policy "read own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- 4) Respuestas del formulario
create policy "read own or attended" on public.infraction_attribute_responses for select to authenticated
  using (
    exists (select 1 from public.citizen_reports r
            where r.id = report_id and r.user_id = (select auth.uid()))
    or public.profile_attends_report((select auth.uid()), report_id)
  );
create policy "insert own" on public.infraction_attribute_responses for insert to authenticated
  with check (
    exists (select 1 from public.citizen_reports r
            where r.id = report_id and r.user_id = (select auth.uid()))
  );

commit;
```

**Opcional, para más adelante (P2): "Enviado al organismo" en la línea de tiempo.** Hoy `report_timeline` llega al organismo pasando por `agency_contacts`, que no debe ser pública. Esto quedó mal resuelto en nuestra PARTE 5B. La solución, sin romper la normalización, es que los usuarios solo puedan leer las columnas `id` y `agency_id` de esa tabla. Postgres lo permite con permisos por columna:

```sql
-- NO aplicar todavía: requiere OK de Hernán y revisar que nada lea agency_contacts con "select *"
-- revoke select on public.agency_contacts from authenticated;
-- grant select (id, agency_id) on public.agency_contacts to authenticated;
-- create policy "read ids authenticated" on public.agency_contacts for select to authenticated using (true);
-- create policy "read own or attended" on public.report_outreach_logs for select to authenticated
--   using (exists (select 1 from public.citizen_reports r where r.id = report_id and r.user_id = (select auth.uid()))
--          or public.profile_attends_report((select auth.uid()), report_id));
```

**Qué mandar:**
- el enlace al PR;
- la salida de esta consulta después de aplicar:

  ```sql
  select tablename, policyname, cmd, roles
  from pg_policies
  where schemaname = 'public'
    and tablename in ('countries','states_provinces','service_attributes','service_attribute_values','agencies',
                      'report_state_history','report_events','profiles','infraction_attribute_responses')
  order by 1, 2;
  ```

- una prueba con dos usuarios demo:
  1. `ciudadano.demo` ve la historia de su reporte y **no** la de `ciudadano.vecino`;
  2. un funcionario ve la historia de los reportes que atiende y no la de los otros.

**Se cierra cuando** el PR está mergeado y la prueba con los dos usuarios da el resultado esperado.

---

### P-05 · Cómo se arregló `embedding_model_code` — P1

En V-08 se corrigió un error: el guardado de un análisis descartado fallaba porque `embedding_model_code` no puede quedar vacío. **¿Cómo se corrigió?**

- **Si ahora se guarda el código del modelo activo** (el que se intentó usar): es correcto y no cambia el modelo de datos.
- **Si se sacó la obligación de tener valor** (`drop not null`): es un cambio del modelo de datos que necesita el OK de Hernán. La propuesta es volver a exigir el valor y guardar el modelo activo.

**Qué mandar:** la línea de código o la migración del arreglo.

---

### P-06 · Tokens de razonamiento y tope de salida — P2

1. **Tokens de razonamiento.** Gemini informa por separado los tokens de razonamiento (`thoughtsTokenCount`) y los de respuesta (`candidatesTokenCount`), y **cobra los dos como salida**. ¿`output_tokens` guarda los dos sumados? Si guarda solo los de respuesta, el costo por reporte está subestimado. **Propuesta:** guardar la suma en `output_tokens`.
2. **Tope de salida.** Hoy la llamada no tiene tope. **Propuesta:**
   - poner un tope holgado (por ejemplo, 2.048) como control de costo;
   - comprobar que no corte el JSON;
   - si lo corta, el resultado tiene que quedar `indeterminado` con su motivo.
3. **Temperatura.** Queda el valor por defecto de la API, pero **anotado** junto con la versión del prompt. No se cambia sin medir antes con P-01.

**Qué mandar:** la línea de código que guarda los tokens y el tope elegido.

---

### P-07 · Alerta de presupuesto y protección de contraseñas — P1

Son tareas de consola, de cinco minutos cada una:

- **Alerta de presupuesto en Google Cloud.** Mandar una captura con el monto, sin la clave.
- **Protección de contraseñas filtradas en Supabase Auth.** Mandar una captura con el control activado, o el aviso de que el plan no la permite.

---

### P-08 · Reconstruir la base desde cero — P1

No hace falta armar un entorno local. Se puede usar un **proyecto de Supabase nuevo y descartable** (plan gratuito, si hay cupo):

1. Aplicar todas las migraciones del repositorio, en orden.
2. Correr las PARTES 2 a 7 de `REP-3769_seed_y_RAG.sql` (sin la 3 ni la 4 si no se crean usuarios de Auth).
3. Correr la PARTE 8.
4. Borrar el proyecto al terminar.

**Qué mandar:** la salida de la PARTE 8. `fragment_embeddings` da 0 hasta correr el script de vectores, y los perfiles y reportes demo dan `REVISAR` si se saltearon las PARTES 3 y 4.

**Se cierra cuando** todo lo demás da `OK`, sin errores de migración. Es la prueba de que el incidente de los seeds borrados no se puede repetir.

---

### P-09 · PR de V-04 y registro en Jira — P1

- Abrir y mergear el PR de `fix/REP-2908-VERIF-v04-seed-demo` contra `staging`, con la revisión de base de Hernán.
- Comentar en REP-2908 un resumen de las cuatro rondas, con enlace a los documentos.

---

### P-10 · V-06: evidencia faltante — P2

La ronda 3 dice "sin cambios respecto a la ronda anterior", pero en la ronda anterior V-06 figuraba como "No iniciado". Si la evidencia está en la v1.1 de `REP-2908-VERIF_devolucion-a-hernan`, subir esa versión al Drive. Hernán solo recibió la v1.0. Si no está, mandar:
- la tabla de parámetros de los dos caminos (modelo, `outputDimensionality`, tipo de tarea);
- la salida de la consulta de similitud de FR12.

De paso, un detalle de números: la ronda 3 dice "47 filas con generación real", pero la tabla de V-11 suma 44 con generación y 3 sin generación. ¿Cuál es el dato correcto?

---

### P-11 · Repositorio público: cierre del incidente — P2

1. **Avisar a las personas del equipo** que sus correos (`profiles.username`) y los contactos de organismos estuvieron publicados en el repositorio.
2. **Comprobar que el commit del backup ya no se pueda abrir** por su identificador en la plataforma de Git, incluidas las referencias de los PR. Si todavía se puede, pedir al soporte de la plataforma que lo borre de su caché.
3. **Borrar la copia local del backup** cuando se cierre este documento, o guardarla cifrada.
4. **Pendiente de Matías:** por qué se regeneró la clave de Gemini y confirmación de que la anterior quedó eliminada en Google.

---

### P-12 · Trigger `audit_ia` — P3

Queda desactivado y la clave que contiene ya no sirve. Si Hernán da el OK, se elimina por migración. La tabla `infractions` es heredada y está vacía:

```sql
-- [ESCRIBE, por migración, SOLO con OK escrito de Hernán]
-- drop trigger if exists audit_ia on public.infractions;
```

---

## 4. Lista de entrega

| # | Evidencia | Punto | ✔ |
|---|---|---|---|
| 1 | Definición de `match_knowledge_fragments` y asignación de categorías | 2 | ☐ |
| 2 | 37 corridas con el filtro y resumen de aciertos por caso | P-01 | ☐ |
| 3 | Motivo de los reportes 3 y 5, dónde se guarda el motivo y umbral de confianza, si existe | P-02 | ☐ |
| 4 | PR de permisos, salida de `pg_policies` y prueba con dos usuarios | P-04 | ☐ |
| 5 | Arreglo de `embedding_model_code` | P-05 | ☐ |
| 6 | Tokens de razonamiento y tope de salida | P-06 | ☐ |
| 7 | Capturas de la alerta de presupuesto y de la protección de contraseñas | P-07 | ☐ |
| 8 | PARTE 8 en un proyecto nuevo | P-08 | ☐ |
| 9 | PR de V-04 mergeado y comentario en REP-2908 | P-09 | ☐ |
| 10 | Evidencia de V-06 y aclaración 47/44 | P-10 | ☐ |
| 11 | Aviso al equipo, commit inaccesible y respuesta sobre la clave de Gemini | P-11 | ☐ |

---

## 5. Cuándo damos por cumplido el RAG del Sprint 12

1. **Decisión registrada:** el filtro por categoría está anotado en REP-3773 (sección 2).
2. **Sin inventar:** P-01 no tiene ninguna cita fuera de lo recuperado ni ninguna cita no literal, y la prueba 2 no cita el art. 48 inc. t).
3. **Trazable:** P-02 con el motivo guardado y la regla de visualización escrita.
4. **Seguro:** P-04 y P-07 hechos.
5. **Reproducible:** P-08 en `OK` y P-09 mergeado.

P-03, P-06, P-10, P-11 y P-12 pueden pasar al Sprint 13 **declarados como pendientes** en la Sprint Review.

---

## 6. Reconocimiento

Esta ronda cerró un incidente real (el repositorio público), encontró y corrigió errores que nosotros no habíamos visto (guardado del descarte, funciones de la cola expuestas) y midió el costo. Además, las 5 corridas por caso demostraron su valor: el caso F, que en la primera ronda "pasaba" con una sola corrida, fallaba 5 de 5. Gracias.

---

**Documentos relacionados:** [REP-1009 — Épica IA jurídica / RAG](https://unlz2026.atlassian.net/browse/REP-1009) · [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) · [REP-3773](https://unlz2026.atlassian.net/browse/REP-3773) · `REP-2908-VERIF_ronda2_hernan.md` (Drive)
