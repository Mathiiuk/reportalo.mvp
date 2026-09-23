# Reporte de Ejecución — REP-3787 · Bloque 7 (Acceso y primer ingreso)

- **Tarea:** REP-3787 · **Bloque:** 7 · **Pantallas:** M01 · M02 · M03
- **Rama:** `feat/REP-3787-uj33` · **Base declarada:** `3995cf3` + bloques 5 y 6
- **Fecha:** 22/09/2026 · **Estado:** READY_FOR_PR

---

## 1. Aplicación

`git apply` limpio, sin offsets ni conflictos. **Tercer bloque seguido sin fricción.**

| Archivo | Pantalla | Cambio |
|---|---|---|
| `src/pages/WelcomePage.jsx` | M01 | Colores a tokens, foco visible y área táctil en los accesos del encabezado. |
| `src/pages/LoginPage.jsx` | M02 | Colores a tokens, incluidos el aviso de acceso rechazado y el campo de correo. |
| `src/pages/CheckEmailPage.jsx` | M03 | Colores a tokens y cuenta regresiva de reenvío de 60 s con formato m:ss. |
| `src/test/Bloque7AccesoUJ33.test.jsx` | — | Nuevo. 1 test. |

Sin cambios en la lógica de autenticación, el envío del enlace ni la validación del correo.

## 2. Quality Gates

| Gate | Comando | Resultado |
|---|---|---|
| Unit tests | `pnpm test` | **285 / 285 en verde** (43 archivos) |
| Build | `pnpm build` | **Compila.** PWA `injectManifest`, 64 entradas de precache |

Tercera vez que el README del bloque reporta UT-QPS-14 y UT-QPS-15 en rojo. Acá dan verde:
**H-06 no existe desde el 21/09.**

## 3. Cambio de comportamiento: la cuenta regresiva pasa de 45 s a 60 s

Es el único cambio funcional del bloque. Lo pide el diseño de M03. Quedó además limpiado un
comentario que seguía diciendo «inicia en 45 segundos según mockup» justo encima del valor
nuevo.

## 4. PA-01: el código ya sigue el UJ, la contradicción está en los criterios

La observación dice que el UJ v3.3 ordena bienvenida → acceso → onboarding, mientras que los
criterios de aceptación de las historias dicen bienvenida → onboarding → acceso.

Verificado en `App.jsx`: `PublicRoute` solo deriva a `/onboarding` **cuando ya hay sesión**, así
que el onboarding es inalcanzable sin haber pasado por el acceso. El recorrido implementado es
bienvenida → acceso → onboarding, es decir **el del UJ v3.3**.

O sea que PA-01 no es una decisión entre dos caminos igual de caros: seguir el UJ es no tocar
nada, y seguir los criterios de aceptación implicaría rehacer el guardado de rutas para permitir
onboarding sin sesión. Conviene llevarlo así a Hernán: lo más probable es que haya que corregir
los criterios, no el código.

## 5. Nota de flakiness observada

Durante una corrida completa falló **UT-B6-01** (Bloque 6). Aislado da 5/5, y la corrida
siguiente dio 285/285. Causa probable: los fixtures de
`Bloque6ReportesNotificacionesUJ33.test.jsx` usan `new Date()` y `Date.now() - 3 días`, y el
agrupamiento «Hoy / Esta semana / Antes» se calcula al ejecutar. Cruzar la medianoche entre la
carga del módulo y la aserción deja el aviso «de hoy» en otro grupo.

No bloquea, pero conviene fijar la fecha en esos tests (`vi.setSystemTime`) en vez de depender
del reloj. Queda anotado para cuando se conecte CI (H-07), que es donde más molesta.

## 6. Observaciones

| ID | Observación | Responsable |
|---|---|---|
| **PA-01** | Abierta, pero acotada (§4): el código ya sigue el UJ. | Hernán (PO) · Iván |
| H-44 | Quedan colores sueltos fuera de paleta: 9 en la bienvenida, 13 en el acceso. Son tonos del héroe, del logo de Google y del aviso de rechazo. | Iván (UX) |
| H-45 | Falta la versión oscura de M01 en el diseño: el héroe sigue en azul y «Comenzar» queda oscuro con texto de acento. | Iván (UX) |

## 7. Pendiente

- **Onboarding y permisos (M04–M07) no entran acá**: van como Bloque 7-B y dependen de PA-01,
  de las tres ilustraciones reales, y de confirmar que la pantalla de términos sale del
  recorrido (el consentimiento se pide al enviar, M13).
- Perfil (M19 / D20) sigue pendiente como Bloque 6-B, atado a H-09.

---

*Reportalo · REP-3787 · Sprint 13 · Matías Krepchuk*
