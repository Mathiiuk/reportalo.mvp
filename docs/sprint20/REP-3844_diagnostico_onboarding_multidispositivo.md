# REP-3844 · Diagnóstico: el onboarding se repite en otro navegador o dispositivo

**Sprint 20 · 1 SP · Matías · 06/11/2026**
**Conclusión: no hay regresión.** La repetición en incógnito, en otro navegador o en otra PC es el comportamiento acordado en REP-3519 (persistencia local, por navegador). Que se recuerde por cuenta sería alcance nuevo y lo decide Hernán.

---

## 1. Cómo persiste hoy (código de `origin/staging`, `50d8bcc`)

| Dónde | Qué hace |
|---|---|
| `src/pages/OnboardingPage.jsx:15-31` (`handleFinish`) | Guarda `localStorage['reportalo_onboarding_completed'] = 'true'` y sigue a `/permisos` o `/mapa`. |
| «Saltar» (líneas 188 y 218) | Llama a `handleFinish`: marca el tutorial como completado. |
| «Empezar» (paso 3, líneas 179 y 270) | `handleNext` en el último paso llama a `handleFinish`: marca el tutorial como completado. |
| «Siguiente» (pasos 1 y 2) | Solo avanza el paso (`setCurrentStep`). **No guarda nada.** |
| `src/App.jsx:115-136` y `163-181` (`ProtectedRoute` / `PublicRoute`) | Con sesión, si falta la clave en `localStorage`, redirige a `/onboarding`. |
| `AuthContext.signOut` | Borra el marcador de sesión y cierra la sesión de Supabase. **No toca la clave del onboarding.** |
| Resto de `src/` | Ningún otro código lee, escribe ni borra `reportalo_onboarding_completed`. Los únicos `removeItem` son claves de términos (`termsService.js`). |

La clave nunca estuvo en la base (`profiles`) ni en la sesión. Es así desde `787c92e feat(REP-3519)`; los cambios posteriores (`8889fcc` permisos, `1682caf`/`9f2556a` REP-3747 organismos) no cambiaron cómo se guarda.

## 2. Escenarios del ticket contra el código

| Escenario | Resultado según el código | ¿Cumple REP-3519? |
|---|---|---|
| **A** · Completar o saltar, cerrar sesión y volver a entrar en el **mismo navegador** | No reaparece: la clave sigue en `localStorage` después de `signOut`. | Sí |
| **B** · Primer ingreso en un navegador | Aparece una vez, se puede terminar («Empezar») u omitir («Saltar»). | Sí |
| **C** · Mismo usuario en incógnito, otro navegador u otra PC | **Reaparece**: ese navegador no tiene la clave. Es lo que vio Iván el 15/10. | Sí: REP-3519 pide persistencia **local**; el criterio por cuenta no está aprobado. |
| **D** · Solo «Siguiente» y cerrar antes del final | No se marca como completado; la próxima vez vuelve a aparecer. | Sí |
| **E** · Cantidad de reportes | No interviene: la condición es solo la clave local. Con 0 o con N reportes pasa lo mismo. | Sí |

Efecto colateral del diseño por navegador: la clave **no es por usuario**. Si otra cuenta entra en un navegador donde ya se completó, no ve el tutorial. Es coherente con «por navegador», pero conviene que el PO lo sepa al decidir.

## 3. Lo que falta para cerrar el diagnóstico

- **Prueba manual en staging** con una cuenta de vecino de prueba (pasos 1 a 6 del ticket, registrando el build `50d8bcc` y el navegador). Necesita que alguien con esa cuenta inicie sesión: Iván o Matías.
- **Cobertura:** UT-OB-03 y UT-OB-04 (`OnboardingFlow.test.jsx`) ya prueban que «Saltar» y «Empezar» guardan la clave. Para los demás escenarios se sumó `src/test/Rep3844OnboardingPorDispositivo.test.jsx`:
  - **UT-3844-01 (A):** el `signOut` real de `AuthProvider` no borra la clave.
  - **UT-3844-02 (A):** al volver a entrar en el mismo navegador sigue a `/permisos`, no a `/onboarding`.
  - **UT-3844-03 (C):** en un navegador sin la clave, la misma cuenta va a `/onboarding`.
  - **UT-3844-04 (D):** avanzar hasta el paso 3 solo con «Siguiente» y cerrar no guarda la clave.

  Prueba de mutación: si `signOut` borra la clave, falla UT-3844-01; si «Siguiente» la guarda, falla UT-3844-04.

## 3b. Qué se guarda en la base la primera vez

Lo único que la app guarda en la base al primer ingreso es la **aceptación de los términos** (`terms_consents`: `terms_version`, `accepted_at`, `camera_permission`, `location_permission`), **por cuenta**. `syncTermsConsentWithRemote` la trae al iniciar sesión en cualquier dispositivo (`AuthContext.jsx:125` y `160`). `profiles` no tiene ninguna columna de onboarding ni de permisos.

| Qué | Dónde | Alcance | Efecto al entrar en la PC después del celular |
|---|---|---|---|
| Términos aceptados | `terms_consents` + `localStorage` | Por cuenta | **No se vuelven a pedir.** Es correcto: el consentimiento es de la persona, no del equipo. |
| Onboarding | `localStorage['reportalo_onboarding_completed']` | Por dispositivo/navegador | **Se muestra de nuevo**, con el texto de escritorio («Subís la foto» en lugar de «Sacás la foto», D04). |
| Pantalla de permisos | `localStorage['reportalo_permissions_configured']` | Por dispositivo/navegador | **Se muestra de nuevo**: la cámara y la ubicación se otorgan en cada navegador. |
| `camera_permission` / `location_permission` en la base | `terms_consents` | Por cuenta | **Ninguno.** Solo se registran; ningún código los usa para saltear permisos ni el tutorial. |

## 4. Decisión

**Postura de Matías (06/11): por dispositivo.** Si alguien lo hace en el celular y después entra por la PC, tiene que ver el tutorial y los permisos de ese equipo, que son distintos. Es el comportamiento actual y el contrato de REP-3519, así que no hace falta cambiar código. Falta que Hernán lo confirme como PO, porque el ticket le asigna esa decisión.

**Alternativa descartada, a menos que Hernán la pida:** por cuenta.

**Caso:** el tutorial se repite en cada navegador o dispositivo nuevo.

**Opciones:**

1. **Por dispositivo (contrato REP-3519, postura de Matías).** Sin cambio funcional. Se suman los tests de A y D y se cierra como «sin regresión».
2. **Por cuenta.** Es alcance nuevo:
   - una columna en `profiles` (por ejemplo `onboarding_completed_at`) con su migración y RLS;
   - escribirla en `handleFinish`;
   - leerla al iniciar sesión, antes de los guards de `App.jsx`, con `localStorage` como respaldo sin conexión;
   - decidir qué pasa con quienes ya lo completaron (migración o primera vez de nuevo);
   - tests nuevos.

   Estimación: unos 3 SP, con riesgo de regresión en el ingreso (`App.jsx` decide hoy de forma síncrona; habría que esperar el perfil).

**Impacto:** la opción 1 no consume el sprint. La opción 2 compite con el objetivo del Sprint 20 y con la regresión final REP-3882.
