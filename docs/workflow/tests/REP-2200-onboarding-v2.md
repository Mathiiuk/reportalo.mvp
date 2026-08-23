# Plan de Pruebas y Matriz QA — REP-2200: Reportalo V2 Onboarding y Autenticación

---

## 1. Alcance de Pruebas V2

Esta matriz define los casos de prueba para validar la funcionalidad del flujo V2 (Landing con colapso, registro con T&C, login, solicitud de permisos, visualización de mapa y notificaciones con Sonner) para **Ivan Juarez (QA)**.

---

## 2. Matriz de Casos de Prueba

| ID | Vista | Caso de Prueba | Resultado Esperado | Estado |
| :--- | :--- | :--- | :--- | :---: |
| **TC-01** | Landing | Clic en "Registrarse" | Despliega suavemente `RegisterForm` y oculta `LoginForm`. | ✅ Superado |
| **TC-02** | Landing | Clic en "Iniciar sesión" | Despliega suavemente `LoginForm` y oculta `RegisterForm`. | ✅ Superado |
| **TC-03** | Registro | Validación de T&C | El botón "Registrarse" permanece deshabilitado hasta tildar el checkbox. | ✅ Superado |
| **TC-04** | Registro | Modal de T&C | El enlace abre un modal accesible con el texto de términos y privacidad. | ✅ Superado |
| **TC-05** | Registro | Envío de formulario válido | Crea el usuario en Supabase, actualiza onboarding a `'registered'` y redirige a `/permisos`. | ✅ Superado |
| **TC-06** | Permisos | Solicitud de Cámara y GPS | Muestra cards interactivas y actualiza badge a `✓ Activado` o `Rechazado`. | ✅ Superado |
| **TC-07** | Permisos | Botón "Ahora no" | Notifica con Sonner, marca onboarding `'completed'` y avanza a `/map` sin bloquear. | ✅ Superado |
| **TC-08** | Mapa | Render de MapLibre GL JS | Inicializa el mapa a pantalla completa con controles de navegación. | ✅ Superado |
| **TC-09** | Mapa | Cierre de sesión | Limpia la sesión de Supabase y el estado de onboarding y redirige a `/`. | ✅ Superado |
| **TC-10** | Rutas | Protección de `/map` | Usuarios sin sesión o sin onboarding son redirigidos a `/` o `/permisos`. | ✅ Superado |
